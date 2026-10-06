// Weekly summary: the model chooses which facts matter and writes one digit-free question for the professional.
// Fact text (with all numbers) is rendered by code; each sentence cites its fact id.
import { completion } from '@qvac/sdk'
import { parseFirstJson } from './json.mjs'

const SYS = '你是非醫療的恢復紀錄整理助理。從事實清單中選出2到3個最值得本人注意的事實代號（不可重複），' +
  '再用台灣正體中文寫一句不含任何數字、30字以內、想請教專業者的問題。不做診斷、不給醫療建議、不推測原因。'

export async function buildSummary(modelId, facts) {
  const ids = Object.keys(facts)
  const schema = {
    type: 'object',
    properties: {
      picks: { type: 'array', minItems: 2, maxItems: 3, items: { type: 'string', enum: ids } },
      question: { type: 'string', maxLength: 40, pattern: '^[^0-9０-９一二兩三四五六七八九十百千]*$' }
    },
    required: ['picks', 'question'], additionalProperties: false
  }
  const t0 = Date.now()
  const run = completion({
    modelId, stream: true,
    history: [{ role: 'system', content: SYS }, { role: 'user', content: '事實清單：' + JSON.stringify(facts) + ' /no_think' }],
    responseFormat: { type: 'json_schema', json_schema: { name: 'summary', schema } },
    generationParams: { predict: 120, reasoning_budget: 0, temp: 0.3 }
  })
  for await (const _ of run.events) { /* drain */ }
  const f = await run.final
  const j = parseFirstJson(f.contentText)
  const picks = [...new Set(j.picks)].filter(id => facts[id])
  const digitFree = !/[0-9０-９]/.test(j.question)
  const text = picks.map(id => `${facts[id]}［${id}］`).join('；') + '。' + (digitFree ? `想請教專業者：${j.question}` : '')
  return { picks, question: j.question, digitFree, text, ms: Date.now() - t0, raw: f.contentText }
}
