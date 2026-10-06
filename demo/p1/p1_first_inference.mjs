// P1: first on-device-style inference on the dev PC with QVAC SDK 0.21.0.
// Loads MedPsy-1.7B (q4_k_m) from Hugging Face, runs one zh-TW summary on
// synthetic data, then 20 BOP intents through tool calling with tool_choice=required.
// Results are written to p1/results/ and echoed to stdout.
import { completion, loadModel, unloadModel } from '@qvac/sdk'
import { z } from 'zod'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'results')
mkdirSync(OUT, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const MODEL = process.env.P1_MODEL ||
  'https://huggingface.co/qvac/MedPsy-1.7B-GGUF/resolve/main/medpsy-1.7b-q4_k_m-imat.gguf'

// --- BOP minimal subset: ServiceRequest -----------------------------------
const serviceRequest = z.object({
  service_type: z.enum(['sauna', 'cold_plunge', 'massage', 'consultation', 'stretching'])
    .describe('Kind of recovery service the person wants'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Requested date, YYYY-MM-DD'),
  time_window: z.enum(['morning', 'afternoon', 'evening']).describe('Preferred part of day'),
  needs_professional: z.boolean().describe('Whether the person also wants a health professional'),
  max_price_twd: z.number().int().positive().optional()
    .describe('Upper price limit in TWD, only if the person stated one'),
  note: z.string().max(120).optional().describe('Short free-text note from the person')
})
const tools = [{
  name: 'create_service_request',
  description: 'Turn the person\'s request into a BOP ServiceRequest. Do not book anything; this only drafts the request.',
  parameters: serviceRequest
}]

// 20 intents; today is fixed so date resolution is checkable.
const TODAY = '2026-10-06 (Tuesday)'
const INTENTS = [
  ['這週睡不好，週六晚上想去三溫暖，也想找健康管理師聊聊', { service_type: 'sauna', date: '2026-10-10', time_window: 'evening', needs_professional: true }],
  ['明天早上想去冷泉，自己去就好', { service_type: 'cold_plunge', date: '2026-10-07', time_window: 'morning', needs_professional: false }],
  ['週五下午想按摩，預算1500元以內', { service_type: 'massage', date: '2026-10-09', time_window: 'afternoon', needs_professional: false, max_price_twd: 1500 }],
  ['10月15日晚上幫我約一個健康管理諮詢', { service_type: 'consultation', date: '2026-10-15', time_window: 'evening', needs_professional: true }],
  ['今天晚上想去蒸一下，不超過800', { service_type: 'sauna', date: '2026-10-06', time_window: 'evening', needs_professional: false, max_price_twd: 800 }],
  ['週日早上想做伸展，有教練帶比較好', { service_type: 'stretching', date: '2026-10-11', time_window: 'morning', needs_professional: true }],
  ['後天下午去三溫暖', { service_type: 'sauna', date: '2026-10-08', time_window: 'afternoon', needs_professional: false }],
  ['I want a sauna session this Saturday evening and a chat with a health coach', { service_type: 'sauna', date: '2026-10-10', time_window: 'evening', needs_professional: true }],
  ['下週一晚上冷泉加三溫暖，先訂冷泉', { service_type: 'cold_plunge', date: '2026-10-12', time_window: 'evening', needs_professional: false }],
  ['肩膀很緊，明天下午想按摩', { service_type: 'massage', date: '2026-10-07', time_window: 'afternoon', needs_professional: false }],
  ['週四早上找營養或健康管理的人諮詢一下', { service_type: 'consultation', date: '2026-10-08', time_window: 'morning', needs_professional: true }],
  ['10/20 晚上三溫暖，預算一千', { service_type: 'sauna', date: '2026-10-20', time_window: 'evening', needs_professional: false, max_price_twd: 1000 }],
  ['週六下午伸展課，自己來', { service_type: 'stretching', date: '2026-10-10', time_window: 'afternoon', needs_professional: false }],
  ['最近恢復很差，週五晚上想去三溫暖順便請專業的人看我的紀錄', { service_type: 'sauna', date: '2026-10-09', time_window: 'evening', needs_professional: true }],
  ['明早冷泉，價格不要超過500', { service_type: 'cold_plunge', date: '2026-10-07', time_window: 'morning', needs_professional: false, max_price_twd: 500 }],
  ['Book a massage on Oct 9 afternoon, under 2000 TWD', { service_type: 'massage', date: '2026-10-09', time_window: 'afternoon', needs_professional: false, max_price_twd: 2000 }],
  ['週三晚上想跟健康管理師約諮詢', { service_type: 'consultation', date: '2026-10-07', time_window: 'evening', needs_professional: true }],
  ['今天下午去三溫暖', { service_type: 'sauna', date: '2026-10-06', time_window: 'afternoon', needs_professional: false }],
  ['週日晚上冷泉，想要有人指導', { service_type: 'cold_plunge', date: '2026-10-11', time_window: 'evening', needs_professional: true }],
  ['10月18日早上伸展，預算600', { service_type: 'stretching', date: '2026-10-18', time_window: 'morning', needs_professional: false, max_price_twd: 600 }]
]

const SYSTEM_TOOL = `You draft BOP ServiceRequests for a recovery-service app. Today is ${TODAY}. ` +
  'Resolve relative dates against today. Only include max_price_twd if the person stated a limit. ' +
  'Never diagnose. Always answer by calling create_service_request.'

const SYNTH_SUMMARY_INPUT = `合成資料（非真人）：
- 過去7天三溫暖：3次（週一、週三、週六），平均每次42分鐘
- 平均睡眠：6小時18分（前一週6小時52分）
- 三溫暖當晚平均睡眠：6小時51分；非三溫暖夜：5小時54分
資料來源代號：S1＝手錶睡眠紀錄，S2＝手錶活動紀錄`
const SYSTEM_SUMMARY = '你是非醫療的恢復紀錄整理助理。用台灣正體中文寫3句以內的週摘要；' +
  '只能使用輸入裡的數字，不可自行計算新數字；每句句尾用［S1］或［S2］標出來源；不做診斷、不給醫療建議。'

const log = []
const t0 = Date.now()
let modelId
try {
  modelId = await loadModel({
    modelSrc: MODEL,
    modelType: 'llamacpp-completion',
    modelConfig: { ctx_size: 4096, tools: true },
    onProgress: (p) => {
      if (Math.round(p.percentage) % 10 === 0) process.stderr.write(`\rdownload ${p.percentage.toFixed(0)}%   `)
    }
  })
  const loadMs = Date.now() - t0
  console.log(`\nloaded ${modelId} in ${loadMs} ms`)

  // 1) summary
  const s0 = Date.now()
  const sum = completion({
    modelId,
    history: [{ role: 'system', content: SYSTEM_SUMMARY }, { role: 'user', content: SYNTH_SUMMARY_INPUT }],
    stream: true,
    captureThinking: true
  })
  for await (const _ of sum.events) { /* drain */ }
  const sf = await sum.final
  const summary = { ms: Date.now() - s0, text: sf.contentText, thinkingChars: (sf.thinkingText || '').length, stats: sf.stats }
  console.log('\n[summary]\n' + sf.contentText + `\n(${summary.ms} ms, ${sf.stats?.tokensPerSecond?.toFixed?.(1)} tok/s)`)

  // 2) tool calls
  const rows = []
  for (const [utterance, expected] of INTENTS) {
    const c0 = Date.now()
    const run = completion({
      modelId,
      history: [{ role: 'system', content: SYSTEM_TOOL }, { role: 'user', content: utterance }],
      stream: true,
      tools,
      generationParams: { tool_choice: 'required' }
    })
    for await (const _ of run.events) { /* drain */ }
    const f = await run.final
    const call = f.toolCalls?.[0]
    const parsed = call ? serviceRequest.safeParse(call.arguments) : null
    const fields = {}
    if (parsed?.success) {
      for (const k of Object.keys(expected)) fields[k] = parsed.data[k] === expected[k]
      fields.no_extra_price = expected.max_price_twd === undefined ? parsed.data.max_price_twd === undefined : true
    }
    const row = {
      utterance,
      ms: Date.now() - c0,
      emitted_call: !!call,
      tool_errors: (f.toolErrors || []).length,
      schema_ok: !!parsed?.success,
      all_fields_ok: !!parsed?.success && Object.values(fields).every(Boolean),
      fields,
      args: call?.arguments ?? null,
      tps: f.stats?.tokensPerSecond ?? null
    }
    rows.push(row)
    console.log(`${row.all_fields_ok ? 'OK ' : row.schema_ok ? 'FLD' : 'BAD'} ${row.ms}ms ${utterance} -> ${JSON.stringify(row.args)}`)
  }

  const n = rows.length
  const agg = {
    model: MODEL, sdk: '0.21.0', host: 'win32-x64 Intel Arc 140V (Vulkan)', loadMs,
    emitted_call: rows.filter(r => r.emitted_call).length,
    schema_ok: rows.filter(r => r.schema_ok).length,
    all_fields_ok: rows.filter(r => r.all_fields_ok).length,
    n,
    median_ms: rows.map(r => r.ms).sort((a, b) => a - b)[Math.floor(n / 2)]
  }
  console.log('\n[aggregate] ' + JSON.stringify(agg))
  writeFileSync(join(OUT, `p1_${stamp}.json`), JSON.stringify({ agg, summary, rows }, null, 2))
  console.log(`written ${join(OUT, `p1_${stamp}.json`)}`)
} catch (e) {
  console.error('ERROR', e)
  process.exitCode = 1
} finally {
  if (modelId) await unloadModel({ modelId, clearStorage: false })
  process.exit(process.exitCode ?? 0)
}
