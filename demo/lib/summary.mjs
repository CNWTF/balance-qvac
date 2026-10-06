// Weekly summary. Code renders every fact (all numbers); F4 and F5 always appear together as one comparison.
// The model sees only digit-free, direction-only observations computed by code, and writes one question for the professional.
import { completion } from '@qvac/sdk'
import { parseFirstJson } from './json.mjs'

const SYS = '你是非醫療的恢復紀錄整理助理。根據本人這週的觀察，用台灣正體中文寫一句想請教健康管理師的問題：' +
  '要具體到這週的觀察；不含任何數字；30字以內；不做診斷、不給醫療建議、不說某件事造成另一件事。' +
  '好問題範例：「沒去三溫暖的晚上睡得比較短，睡前可以先調整哪些習慣？」「三溫暖當晚睡得比較久，下週的三溫暖要怎麼排進行程？」' +
  '不好的問題：「睡眠品質是否有改善？」（太籠統）、「三溫暖能治療失眠嗎？」（醫療宣稱）。'

// Arabic digits anywhere, or Chinese numerals used as a quantity. 三溫暖 is a word, not a number.
const hasNumber = q => { const t = q.replace(/三溫暖/g, ''); return /[0-9０-９]/.test(t) || /[一二兩三四五六七八九十百千半]+\s*(次|晚|夜|小時|分|天|日|個|週|周|成|倍)/.test(t) }

// Reject questions that state the opposite direction of a code-computed observation.
function contradicts(q, hints) {
  const h = hints.join('；')
  if (h.includes('睡得久') && /延後|睡得短|睡得少|睡眠差|變差|較短/.test(q)) return true
  if (h.includes('睡得短') && /睡得久|睡得多|較長|延長/.test(q)) return true
  return false
}

export function renderFacts(facts) {
  const lines = []
  const head = [facts.F1, facts.F2].filter(Boolean).join('，')
  if (head) lines.push(`${head}［${['F1', 'F2'].filter(k => facts[k]).join('、')}］`)
  if (facts.F4 && facts.F5) lines.push(`${facts.F4}，對照${facts.F5}［F4、F5］`)
  else for (const k of ['F4', 'F5']) if (facts[k]) lines.push(`${facts[k]}［${k}］`)
  if (facts.F3) lines.push(`${facts.F3}［F3］`)
  return lines.join('。') + '。'
}

export async function buildSummary(modelId, facts, hints) {
  const schema = {
    type: 'object',
    properties: { question: { type: 'string', maxLength: 40 } },
    required: ['question'], additionalProperties: false
  }
  const body = renderFacts(facts)
  const t0 = Date.now()
  const rejected = []
  let j = null, f, attempts = 0
  while (!j && attempts < 3) {
    attempts++
    const run = completion({
      modelId, stream: true,
      history: [{ role: 'system', content: SYS }, { role: 'user', content: '這週的觀察：' + hints.join('；') + '。 /no_think' }],
      responseFormat: { type: 'json_schema', json_schema: { name: 'question', schema } },
      generationParams: { predict: 160, reasoning_budget: 0, temp: 0.4 }
    })
    for await (const _ of run.events) { /* drain */ }
    f = await run.final
    try { j = parseFirstJson(f.contentText) } catch { j = null }
    if (j && (hasNumber(j.question) || contradicts(j.question, hints))) { rejected.push(j.question); j = null } // numbers and directions belong to code
  }
  if (!j) throw new Error('no valid question after 3 attempts; rejected: ' + JSON.stringify(rejected))
  const text = body + `想請教專業者：${j.question}`
  return { question: j.question, text, attempts, rejected, ms: Date.now() - t0 }
}
