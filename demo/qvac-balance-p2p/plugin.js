// Worker-side QVAC plugin: one Hyperswarm node per loaded "model".
// Peers on the same topic connect directly over Noise-encrypted streams; each peer is identified by its public key.
// Messages are newline-delimited JSON. No server holds or relays plaintext.
import { z } from 'zod'
import { definePlugin, defineHandler } from '@qvac/sdk/plugin-utils'
import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-crypto'
import b4a from 'b4a'

const nodes = new Map() // modelId -> node

function createNode(seedHex) {
  const keyPair = seedHex ? crypto.keyPair(b4a.from(seedHex, 'hex')) : crypto.keyPair()
  const node = {
    keyPair,
    publicKey: b4a.toString(keyPair.publicKey, 'hex'),
    swarm: null,
    me: null, // { name, role }
    peers: new Map(), // publicKey hex -> { conn, name, role, buf }
    inbox: []
  }
  node.join = async (topic, me) => {
    node.me = me
    if (!node.swarm) {
      node.swarm = new Hyperswarm({ keyPair })
      node.swarm.on('connection', (conn, info) => {
        const key = b4a.toString(conn.remotePublicKey, 'hex')
        const peer = { conn, name: null, role: null, buf: '' }
        node.peers.set(key, peer)
        conn.on('data', (d) => {
          peer.buf += b4a.toString(d)
          let i
          while ((i = peer.buf.indexOf('\n')) >= 0) {
            const line = peer.buf.slice(0, i); peer.buf = peer.buf.slice(i + 1)
            try {
              const msg = JSON.parse(line)
              if (msg.kind === 'hello') { peer.name = msg.name; peer.role = msg.role; continue }
              // Reachability probe: answer at once so the sender can tell delivered from merely sent.
              if (msg.kind === 'probe') { conn.write(JSON.stringify({ kind: 'probe-ack', at: msg.at, rx: Date.now() }) + '\n'); continue }
              node.inbox.push({ from: key, fromName: peer.name, fromRole: peer.role, at: Date.now(), msg })
            } catch { /* ignore malformed line */ }
          }
        })
        conn.on('error', () => {})
        conn.on('close', () => { if (node.peers.get(key) === peer) node.peers.delete(key) })
        conn.write(JSON.stringify({ kind: 'hello', name: node.me?.name, role: node.me?.role }) + '\n')
      })
    }
    const discovery = node.swarm.join(crypto.hash(b4a.from('balance-bop:' + topic)), { server: true, client: true })
    await discovery.flushed()
    // Look again every 20 s: on phones an app may sleep in the background or a peer may start later.
    if (node.refreshTimer) clearInterval(node.refreshTimer)
    node.refreshTimer = setInterval(() => { discovery.refresh({ client: true, server: true }).catch(() => {}) }, 20000)
    return { publicKey: node.publicKey }
  }
  node.send = (msg, toRole, toKey) => {
    let sent = 0
    for (const [key, peer] of node.peers) {
      if (toKey && key !== toKey) continue
      if (toRole && peer.role !== toRole) continue
      peer.conn.write(JSON.stringify(msg) + '\n'); sent++
    }
    return sent
  }
  node.destroy = async () => { if (node.refreshTimer) clearInterval(node.refreshTimer); if (node.swarm) await node.swarm.destroy() }
  return node
}

const peerList = (node) => [...node.peers].map(([key, p]) => ({ publicKey: key, name: p.name ?? '', role: p.role ?? '' }))

export const balanceP2PPlugin = definePlugin({
  modelType: 'balance-p2p',
  displayName: 'Balance P2P (Hyperswarm)',
  addonPackage: 'none',
  skipPrimaryModelPathValidation: true,
  loadConfigSchema: z.object({ seed: z.string().optional() }).catchall(z.unknown()),
  createModel(params) {
    const node = createNode(params.modelConfig?.seed)
    nodes.set(params.modelId, node)
    const model = {
      load: async () => {},
      unload: async () => { nodes.delete(params.modelId); await node.destroy() }
    }
    return { model }
  },
  handlers: {
    join: defineHandler({
      requestSchema: z.object({ modelId: z.string(), topic: z.string(), name: z.string(), role: z.string() }),
      responseSchema: z.object({ publicKey: z.string() }),
      streaming: false,
      handler: async (req) => nodes.get(req.modelId).join(req.topic, { name: req.name, role: req.role })
    }),
    refresh: defineHandler({
      requestSchema: z.object({ modelId: z.string() }),
      responseSchema: z.object({ ok: z.boolean() }),
      streaming: false,
      handler: async (req) => { const n = nodes.get(req.modelId); if (n?.swarm) { for (const d of n.swarm.topics()) await d.refresh({ client: true, server: true }).catch(() => {}) } return { ok: true } }
    }),
    send: defineHandler({
      requestSchema: z.object({ modelId: z.string(), msg: z.record(z.string(), z.unknown()), toRole: z.string().optional(), toKey: z.string().optional() }),
      responseSchema: z.object({ sent: z.number() }),
      streaming: false,
      handler: async (req) => ({ sent: nodes.get(req.modelId).send(req.msg, req.toRole, req.toKey) })
    }),
    poll: defineHandler({
      requestSchema: z.object({ modelId: z.string() }),
      responseSchema: z.object({
        publicKey: z.string(),
        peers: z.array(z.object({ publicKey: z.string(), name: z.string(), role: z.string() })),
        messages: z.array(z.object({ from: z.string(), fromName: z.string().nullable(), fromRole: z.string().nullable(), at: z.number(), msg: z.record(z.string(), z.unknown()) })),
        debug: z.record(z.string(), z.unknown())
      }),
      streaming: false,
      handler: async (req) => {
        const node = nodes.get(req.modelId)
        const messages = node.inbox.splice(0)
        const sw = node.swarm
        const debug = sw ? { connections: sw.connections.size, connecting: sw.connecting, discovered: sw.peers.size, firewalled: sw.dht.firewalled, bootstrapped: sw.dht.bootstrapped, host: sw.dht.host, port: sw.dht.port } : {}
        return { publicKey: node.publicKey, peers: peerList(node), messages, debug }
      }
    })
  }
})

export default balanceP2PPlugin
