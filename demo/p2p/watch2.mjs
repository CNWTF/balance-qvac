// Reachability probe with delivery check: joins the demo topic as a "user" peer, sends a probe to the given role
// every 30 s, and logs each acknowledgement (qvac-balance-p2p >= 0.1.2 answers probes at once). "sent" alone only
// means a local connection object exists; an ack means the other app actually received and processed the probe.
// Usage: node p2p/watch2.mjs <role> <minutes> <logfile>
import { openP2P, closeP2P, joinTopic, sendMessage, pollMessages, refreshP2P } from 'qvac-balance-p2p'
import { fileURLToPath } from 'node:url'
import { appendFileSync } from 'node:fs'

const [role = 'pro', minutes = '20', logfile = 'watch2.log'] = process.argv.slice(2)
const id = await openP2P({ anchorPath: fileURLToPath(import.meta.url) })
await joinTopic({ modelId: id, topic: 'balance-demo-1011', name: 'probe (PC)', role: 'user' })
const t0 = Date.now()
const hhmmss = (t) => new Date(t).toISOString().slice(11, 19)
const log = (s) => { const line = `${hhmmss(Date.now())} +${Math.round((Date.now() - t0) / 1000)}s ${s}`; console.log(line); appendFileSync(logfile, line + '\n') }
log(`probe online, watching role=${role}`)
let last = null, n = 0, seq = 0
const pending = new Map()
const timer = setInterval(async () => {
  const r = await pollMessages({ modelId: id })
  const target = r.peers.filter(p => p.role === role).map(p => `${p.name}/${p.publicKey.slice(0, 6)}`).join(',') || 'NONE'
  if (target !== last) { log(`${role} peers: ${target}`); last = target }
  for (const m of r.messages || []) {
    if (m.msg?.kind !== 'probe-ack') continue
    const sentAt = pending.get(m.msg.at)
    if (sentAt === undefined) continue
    pending.delete(m.msg.at)
    log(`ACK probe sent ${hhmmss(sentAt)}: round trip ${((Date.now() - sentAt) / 1000).toFixed(1)}s`)
  }
  n++
  if (n % 30 === 0) {
    const at = Date.now() * 1000 + (seq++ % 1000)
    const s = await sendMessage({ modelId: id, msg: { kind: 'probe', at }, toRole: role })
    if (s.sent) pending.set(at, Date.now())
    const waiting = [...pending.values()].filter(t => Date.now() - t > 10000).length
    log(`probe sent to ${s.sent} ${role} peer(s); unacknowledged >10s: ${waiting}`)
    await refreshP2P({ modelId: id }).catch(() => {})
  }
  if (Date.now() - t0 > +minutes * 60000) { clearInterval(timer); await closeP2P(id); process.exit(0) }
}, 1000)
