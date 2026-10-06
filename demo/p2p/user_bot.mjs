// Desktop stand-in for the personal agent: sends a quote request to the venue, confirms the first offer
// within budget, and (optionally) shares a demo summary with the professional.
// Usage: node p2p/user_bot.mjs [minutes] [--share]
import { openP2P, closeP2P, joinTopic, sendMessage, pollMessages } from 'qvac-balance-p2p'
import { fileURLToPath } from 'node:url'

const minutes = +(process.argv[2] || 5)
const share = process.argv.includes('--share')
const id = await openP2P({ anchorPath: fileURLToPath(import.meta.url) })
const { publicKey } = await joinTopic({ modelId: id, topic: 'balance-demo-1011', name: '本人 Person (PC)', role: 'user' })
console.log(`[user] online ${publicKey.slice(0, 8)}`)
const caseId = 'pc' + Date.now().toString(36)
const send = async (msg, toRole) => (await sendMessage({ modelId: id, msg, toRole })).sent
let sentQuote = false, sentShare = false, confirmed = false
const t0 = Date.now(); let lastPeers = ''
const timer = setInterval(async () => {
  const r = await pollMessages({ modelId: id })
  const peers = r.peers.map(p => `${p.role}/${p.name}`).join(', ')
  if (peers !== lastPeers) { console.log(`[user] peers: ${peers || 'none'} (${Math.round((Date.now() - t0) / 1000)} s)`); lastPeers = peers }
  if (!sentQuote && r.peers.some(p => p.role === 'venue')) {
    const n = await send({ kind: 'quote_request', id: caseId, request: { service_type: 'sauna', date: '2026-10-10', time_window: 'evening', max_price_twd: 1000 } }, 'venue')
    sentQuote = n > 0; console.log(`[user] -> quote_request (${n})`)
  }
  if (share && !sentShare && r.peers.some(p => p.role === 'pro')) {
    const n = await send({ kind: 'service_request', id: caseId, request: { service_type: 'sauna', date: '2026-10-10', time_window: 'evening', needs_professional: true }, share: { range: '示範', zh: ['這週三溫暖3次，平均每次42分鐘［F1、F2］。', '三溫暖當晚平均睡眠6小時51分（3晚），對照沒去三溫暖的晚上平均睡眠5小時54分（4晚）［F4、F5］。'], en: ['This week: sauna 3 times, 42 min on average [F1, F2].', 'Nights after sauna: 6h 51m of sleep on average (3 nights); nights without sauna: 5h 54m (4 nights) [F4, F5].'], questionZh: '三溫暖當晚睡得比較久，下週的三溫暖要怎麼排進行程？', questionEn: "You slept longer on sauna nights. How should next week's sauna sessions fit into your schedule?" }, consent: { scope: ['weekly_summary', 'question'], expiresInDays: 7 } }, 'pro')
    sentShare = n > 0; console.log(`[user] -> service_request (${n})`)
  }
  for (const m of r.messages) {
    console.log(`[user] <- ${m.fromRole}/${m.fromName}: ${m.msg.kind} ${JSON.stringify(m.msg).slice(0, 200)}`)
    if (m.msg.kind === 'quote' && !confirmed) {
      const o = m.msg.offers.find(x => x.price <= 1000)
      if (o) { await send({ kind: 'confirm', id: caseId, slot: o.slot, price: o.price, receipt: { approvedBy: 'user', at: Date.now() } }, 'venue'); confirmed = true; console.log(`[user] -> confirm ${o.slot}`) }
    }
  }
  if (Date.now() - t0 > minutes * 60000) { clearInterval(timer); await closeP2P(id); process.exit(0) }
}, 1000)
