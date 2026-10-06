import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-crypto'
import b4a from 'b4a'
const s = new Hyperswarm()
s.on('connection', (c) => { console.log(process.argv[2], 'CONNECTED', b4a.toString(c.remotePublicKey, 'hex').slice(0, 8)); c.on('error', () => {}) })
const d = s.join(crypto.hash(b4a.from('balance-raw-test')), { server: true, client: true })
await d.flushed(); console.log(process.argv[2], 'flushed')
setTimeout(async () => { console.log(process.argv[2], 'conns', s.connections.size); await s.destroy(); process.exit(0) }, 30000)
