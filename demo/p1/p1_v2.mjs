// P1 v2: same 20 intents, thinking off (/no_think), three variants:
//   A  tools + tool_choice=required (model writes the date)
//   B  responseFormat json_schema; model picks a day reference, code resolves the date
// plus a summary where the model may only cite fact ids; numbers are rendered by code.
import { completion, loadModel, unloadModel } from '@qvac/sdk'
import { z } from 'zod'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { INTENTS, TODAY_ISO } from './intents.mjs'
import { resolveDayRef, DAY_REFS } from '../lib/dates.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'results'); mkdirSync(OUT, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const MODEL = process.env.P1_MODEL ||
  'https://huggingface.co/qvac/MedPsy-1.7B-GGUF/resolve/main/medpsy-1.7b-q4_k_m-imat.gguf'
const ONLY = process.env.P1_ONLY || 'AB'
const NOTHINK = ' /no_think'

const SERVICE = ['sauna', 'cold_plunge', 'massage', 'consultation', 'stretching']
const WINDOW = ['morning', 'afternoon', 'evening']

// Variant A: tool calling
const reqA = z.object({
  service_type: z.enum(SERVICE), date: z.string().describe('YYYY-MM-DD'),
  time_window: z.enum(WINDOW), needs_professional: z.boolean(),
  max_price_twd: z.number().int().positive().optional()
})
const toolsA = [{ name: 'create_service_request', description: 'Draft a BOP ServiceRequest from the person\'s words.', parameters: reqA }]
const SYS_A = `You draft BOP ServiceRequests. Today is ${TODAY_ISO} (Tuesday). Resolve relative dates against today. ` +
  'Only set max_price_twd if the person stated a limit. Always call create_service_request.'

// Variant B: JSON schema, model picks a day reference; code resolves it
const schemaB = {
  type: 'object',
  properties: {
    service_type: { type: 'string', enum: SERVICE },
    day_ref: { type: 'string', enum: DAY_REFS },
    month_day: { type: 'string', description: 'MM-DD only when day_ref is "explicit"' },
    time_window: { type: 'string', enum: WINDOW },
    needs_professional: { type: 'boolean' },
    price_limit_stated: { type: 'boolean' },
    max_price_twd: { type: 'integer' }
  },
  required: ['service_type', 'day_ref', 'time_window', 'needs_professional', 'price_limit_stated'],
  additionalProperties: false
}
const SYS_B = 'Extract a recovery-service request as JSON. day_ref: today, tomorrow, day_after_tomorrow, ' +
  'this_<weekday> for a weekday in the current week (週六=this_sat), next_<weekday> for 下週, or explicit with month_day MM-DD for a calendar date like 10/15 or 10月15日. ' +
  'Services: sauna 三溫暖/蒸, cold_plunge 冷泉, massage 按摩, consultation 諮詢, stretching 伸展. ' +
  'needs_professional is true if the person wants a professional, coach or 健康管理師. ' +
  'price_limit_stated is true only if a price limit was stated; then put it in max_price_twd.'

function score(got, expected) {
  const fields = {}
  for (const k of Object.keys(expected)) fields[k] = got?.[k] === expected[k]
  fields.no_extra_price = expected.max_price_twd === undefined ? got?.max_price_twd === undefined : true
  return { fields, ok: Object.values(fields).every(Boolean) }
}

// Summary: model cites fact ids; code renders the numbers.
const FACTS = { F1: '過去7天三溫暖3次', F2: '平均每次42分鐘', F3: '平均睡眠6小時18分（前一週6小時52分）', F4: '三溫暖當晚平均睡眠6小時51分', F5: '非三溫暖夜平均睡眠5小時54分' }
const schemaSum = {
  type: 'object',
  properties: { sentences: { type: 'array', minItems: 2, maxItems: 3, items: { type: 'object',
    properties: { lead: { type: 'string' }, facts: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'string', enum: Object.keys(FACTS) } } },
    required: ['lead', 'facts'], additionalProperties: false } } },
  required: ['sentences'], additionalProperties: false
}
const SYS_SUM = '你是非醫療的恢復紀錄整理助理。用台灣正體中文寫2到3句週摘要。每句只寫不含數字的引導語（lead，例如「這週」「和沒去三溫暖的晚上相比」），' +
  '再列出這句要引用的事實代號（facts）；程式會把事實接在引導語後面。lead不可出現任何數字；不做診斷、不給醫療建議。'

const t0 = Date.now()
let modelId
const out = { model: MODEL, sdk: '0.21.0', host: 'win32-x64 Intel Arc 140V (Vulkan)' }
try {
  modelId = await loadModel({ modelSrc: MODEL, modelType: 'llamacpp-completion', modelConfig: { ctx_size: 4096, tools: true } })
  out.loadMs = Date.now() - t0
  console.log(`loaded in ${out.loadMs} ms`)

  // summary
  {
    const s0 = Date.now()
    const run = completion({ modelId, history: [{ role: 'system', content: SYS_SUM },
      { role: 'user', content: '事實：' + JSON.stringify(FACTS) + NOTHINK }],
      stream: true, responseFormat: { type: 'json_schema', json_schema: { name: 'summary', schema: schemaSum } } })
    for await (const _ of run.events) { /* drain */ }
    const f = await run.final
    let rendered = null, digitsInLead = null
    try {
      const j = JSON.parse(f.contentText)
      digitsInLead = j.sentences.some(s => /\d/.test(s.lead))
      rendered = j.sentences.map(s => `${s.lead}${s.lead.endsWith('，') ? '' : '，'}${s.facts.map(id => FACTS[id]).join('；')}［${s.facts.join('、')}］。`).join('')
    } catch {}
    out.summary = { ms: Date.now() - s0, raw: f.contentText, rendered, digitsInLead, tps: f.stats?.tokensPerSecond }
    console.log('[summary]', rendered ?? f.contentText, `(${out.summary.ms} ms)`)
  }

  for (const variant of ONLY.split('')) {
    const rows = []
    for (const [utterance, expected] of INTENTS) {
      const c0 = Date.now()
      let got = null, raw = null, err = null
      if (variant === 'A') {
        const run = completion({ modelId, history: [{ role: 'system', content: SYS_A }, { role: 'user', content: utterance + NOTHINK }],
          stream: true, tools: toolsA, generationParams: { tool_choice: 'required' } })
        for await (const _ of run.events) { /* drain */ }
        const f = await run.final
        raw = f.toolCalls?.[0]?.arguments ?? null
        const p = raw ? reqA.safeParse(raw) : null
        got = p?.success ? p.data : null
        if (raw && !p?.success) err = 'schema'
      } else {
        const run = completion({ modelId, history: [{ role: 'system', content: SYS_B }, { role: 'user', content: utterance + NOTHINK }],
          stream: true, responseFormat: { type: 'json_schema', json_schema: { name: 'request', schema: schemaB } } })
        for await (const _ of run.events) { /* drain */ }
        const f = await run.final
        try {
          raw = JSON.parse(f.contentText)
          const date = resolveDayRef(raw.day_ref, raw.month_day, TODAY_ISO)
          got = { service_type: raw.service_type, date, time_window: raw.time_window, needs_professional: raw.needs_professional }
          if (raw.price_limit_stated && Number.isInteger(raw.max_price_twd)) got.max_price_twd = raw.max_price_twd
        } catch (e) { err = 'parse:' + e.message }
      }
      const sc = score(got, expected)
      rows.push({ variant, utterance, ms: Date.now() - c0, ok: sc.ok, fields: sc.fields, got, raw, err })
      console.log(`${variant} ${sc.ok ? 'OK ' : 'NG '} ${Date.now() - c0}ms ${utterance} -> ${JSON.stringify(got)}`)
    }
    const n = rows.length
    out[variant] = { ok: rows.filter(r => r.ok).length, n, median_ms: rows.map(r => r.ms).sort((a, b) => a - b)[Math.floor(n / 2)],
      field_ok: Object.fromEntries(['service_type', 'date', 'time_window', 'needs_professional', 'no_extra_price'].map(k => [k, rows.filter(r => r.fields[k]).length])), rows }
    console.log(`[${variant}] ok ${out[variant].ok}/${n}, median ${out[variant].median_ms} ms, fields ${JSON.stringify(out[variant].field_ok)}`)
  }
  writeFileSync(join(OUT, `p1v2_${stamp}.json`), JSON.stringify(out, null, 2))
  console.log('written', join(OUT, `p1v2_${stamp}.json`))
} catch (e) { console.error('ERROR', e); process.exitCode = 1 } finally {
  if (modelId) await unloadModel({ modelId, clearStorage: false })
  process.exit(process.exitCode ?? 0)
}
