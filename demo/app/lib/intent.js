// UserAgent intent -> BOP ServiceRequest draft.
// Model (QVAC, JSON-schema constrained) classifies the service and whether a professional is wanted;
// rules own dates, parts of day and price limits. Each field records where it came from.
import { completion } from '@qvac/sdk'
import { parseFirstJson } from './json'
import { extractDate, extractTimeWindow, extractPriceLimit, wantsProfessional } from './extract'

export const SERVICE = ['sauna', 'cold_plunge', 'massage', 'consultation', 'stretching']
export const WINDOW = ['morning', 'afternoon', 'evening']

const schema = {
  type: 'object',
  properties: {
    service_type: { type: 'string', enum: SERVICE },
    needs_professional: { type: 'boolean' },
    time_window: { type: 'string', enum: [...WINDOW, 'unspecified'] }
  },
  required: ['service_type', 'needs_professional', 'time_window'],
  additionalProperties: false
}
const SYS = 'Classify a recovery-service request as JSON. ' +
  'service_type: sauna (三溫暖, 烤箱, 蒸, sauna), cold_plunge (冷泉, 冰水), massage (按摩), consultation (諮詢, 聊, chat with a professional), stretching (伸展). ' +
  'If the person wants both a facility and to talk with someone, choose the facility. ' +
  'needs_professional: true only if the person asks for a professional, coach, 健康管理師, 專業的人, 教練, 有人帶/指導/幫我; a massage by itself is false; a consultation is always true. ' +
  'time_window: morning, afternoon, evening, or unspecified.'

export async function draftServiceRequest(modelId, utterance, todayIso) {
  const t0 = Date.now()
  const run = completion({
    modelId, stream: true,
    history: [{ role: 'system', content: SYS }, { role: 'user', content: utterance + ' /no_think' }],
    responseFormat: { type: 'json_schema', json_schema: { name: 'intent', schema } },
    generationParams: { predict: 80, reasoning_budget: 0, temp: 0.1 }
  })
  for await (const _ of run.events) { /* drain */ }
  const f = await run.final
  const m = parseFirstJson(f.contentText)
  const d = extractDate(utterance, todayIso)
  const tw = extractTimeWindow(utterance)
  const price = extractPriceLimit(utterance)
  const req = {
    service_type: m.service_type,
    needs_professional: m.service_type === 'consultation' || wantsProfessional(utterance),
    date: d?.date ?? null,
    time_window: tw ?? (m.time_window === 'unspecified' ? null : m.time_window)
  }
  if (price != null) req.max_price_twd = price
  const provenance = { service_type: 'model', needs_professional: 'rule', model_needs_professional: m.needs_professional, date: d ? 'rule:' + d.rule : 'missing', time_window: tw ? 'rule' : 'model', max_price_twd: price != null ? 'rule' : 'none' }
  const missing = ['date', 'time_window'].filter(k => req[k] == null)
  return { request: req, provenance, missing, ms: Date.now() - t0, raw: f.contentText }
}
