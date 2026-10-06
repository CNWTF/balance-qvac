// Desktop stand-in for the professional or venue agent (same QVAC P2P plugin, same BOP messages).
// Usage: node p2p/agent_bot.mjs pro|venue [minutes]
import { openP2P, closeP2P, joinTopic, sendMessage, pollMessages } from 'qvac-balance-p2p'
import { fileURLToPath } from 'node:url'

const role = process.argv[2] || 'venue'
const minutes = +(process.argv[3] || 30)
const NAME = { pro: '健康管理師 Coach (PC)', venue: '暖森三溫暖 Warmwood (PC)' }[role]
const id = await openP2P({ anchorPath: fileURLToPath(import.meta.url) })
const { publicKey } = await joinTopic({ modelId: id, topic: 'balance-demo-1011', name: NAME, role })
console.log(`[${role}] online ${publicKey.slice(0, 8)}`)
const requests = new Map()
let capacity = 4
const SLOTS = { morning: ['09:00', '10:30'], afternoon: ['14:00', '16:00'], evening: ['18:30', '20:00'] }
const PRICE = { sauna: 800, cold_plunge: 500, massage: 1500, stretching: 600, consultation: 1200 }
const send = (msg, toRole) => sendMessage({ modelId: id, msg, toRole })

const t0 = Date.now(); let lastPeers = ''
const timer = setInterval(async () => {
  const r = await pollMessages({ modelId: id })
  const peers = r.peers.map(p => `${p.role}/${p.name}`).join(', ')
  if (peers !== lastPeers) { console.log(`[${role}] peers: ${peers || 'none'}`); lastPeers = peers }
  for (const m of r.messages) {
    const k = m.msg.kind
    console.log(`[${role}] <- ${m.fromRole}/${m.fromName}: ${k} ${m.msg.id ?? ''}`)
    if (role === 'pro' && k === 'service_request') {
      await send({ kind: 'pro_reply', id: m.msg.id, decision: 'accept',
        noteZh: '收到你的紀錄。想讓三溫暖配合睡眠，可以把時段排在晚餐後、睡前兩到三小時結束；週六見面時再一起看這週的變化。',
        noteEn: 'Got your records. To fit the sauna around sleep, schedule it after dinner and finish two to three hours before bed; let’s review this week together on Saturday.' }, 'user')
      console.log(`[${role}] -> pro_reply`)
    }
    if (role === 'venue' && k === 'quote_request') {
      const q = m.msg.request; requests.set(m.msg.id, q)
      const offers = (SLOTS[q.time_window] ?? SLOTS.evening).map(slot => ({ slot, price: PRICE[q.service_type] ?? 800, left: capacity }))
      await send({ kind: 'quote', id: m.msg.id, venue: { nameZh: '暖森三溫暖（示範・電腦）', nameEn: 'Warmwood Sauna (demo, PC)' }, offers,
        replyZh: `週六晚上還有${offers.map(o => o.slot).join('、')}可以預約，每人${offers[0].price}元。`, replyEn: `Saturday evening ${offers.map(o => o.slot).join(', ')} available, NT$${offers[0].price} per person.` }, 'user')
      console.log(`[${role}] -> quote`)
    }
    if (role === 'venue' && k === 'confirm') {
      capacity -= 1
      const q = requests.get(m.msg.id) ?? {}
      await send({ kind: 'order', id: m.msg.id, orderNo: 'BOP-' + Date.now().toString(36).toUpperCase().slice(-6), slot: m.msg.slot, price: m.msg.price, service: q.service_type, capacityLeft: capacity }, 'user')
      console.log(`[${role}] -> order (capacity left ${capacity})`)
    }
  }
  if (Date.now() - t0 > minutes * 60000) { clearInterval(timer); await closeP2P(id); process.exit(0) }
}, 1000)
