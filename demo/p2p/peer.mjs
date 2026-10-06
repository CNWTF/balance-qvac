// Desktop P2P peer for testing the qvac-balance-p2p plugin.
// Usage: node p2p/peer.mjs <role> <name> [topic] [seconds]
// Every 2 s sends {kind:'ping'}; prints what it receives; exits after N seconds.
import { openP2P, closeP2P, joinTopic, sendMessage, pollMessages } from 'qvac-balance-p2p'
import { fileURLToPath } from 'node:url'

const [role = 'user', name = 'desktop', topic = 'balance-demo', seconds = '40'] = process.argv.slice(2)
const anchor = fileURLToPath(import.meta.url) // any existing local file
const id = await openP2P({ anchorPath: anchor })
const { publicKey } = await joinTopic({ modelId: id, topic, name, role })
console.log(`[${role}] joined as ${publicKey.slice(0, 12)}…`)
const t0 = Date.now(); let n = 0
const timer = setInterval(async () => {
  const sent = await sendMessage({ modelId: id, msg: { kind: 'ping', n: n++, from: name } })
  const r = await pollMessages({ modelId: id })
  for (const m of r.messages) console.log(`[${role}] got from ${m.fromRole}/${m.fromName} ${m.from.slice(0, 8)}: ${JSON.stringify(m.msg)}`)
  if (n % 5 === 0) console.log(`[${role}] peers: ${r.peers.length} debug ${JSON.stringify(r.debug)}`)
  if (Date.now() - t0 > +seconds * 1000) { clearInterval(timer); await closeP2P(id); process.exit(0) }
}, 2000)
