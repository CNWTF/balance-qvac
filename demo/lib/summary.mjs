// Weekly summary. Code renders every fact (all numbers); F4 and F5 always appear together as one comparison.
// Code computes direction-only observations and filters a reviewed question bank to the questions that fit them;
// the model (JSON-schema constrained) picks the single most useful question for this week.
import { completion } from '@qvac/sdk'
import { parseFirstJson } from './json.mjs'
import { eligibleQuestions } from './questions.mjs'

const SYS = '你是非醫療的恢復紀錄整理助理。根據本人這週的觀察，從候選問題中選出一題最值得本人拿去請教健康管理師的問題，只回傳它的代號。' +
  '優先選和這週最明顯的變化有關、能直接討論下週安排的問題。'

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
  const candidates = eligibleQuestions(hints)
  const schema = {
    type: 'object',
    properties: { pick: { type: 'string', enum: candidates.map(q => q.id) } },
    required: ['pick'], additionalProperties: false
  }
  const body = renderFacts(facts)
  const t0 = Date.now()
  const run = completion({
    modelId, stream: true,
    history: [{ role: 'system', content: SYS }, {
      role: 'user',
      content: '這週的觀察：' + hints.join('；') + '。\n候選問題：\n' + candidates.map(q => `${q.id}：${q.text}`).join('\n') + '\n/no_think'
    }],
    responseFormat: { type: 'json_schema', json_schema: { name: 'pick', schema } },
    generationParams: { predict: 40, reasoning_budget: 0, temp: 0.2 }
  })
  for await (const _ of run.events) { /* drain */ }
  const f = await run.final
  let pick = null
  try { pick = parseFirstJson(f.contentText).pick } catch { /* fall through */ }
  const chosen = candidates.find(q => q.id === pick) ?? candidates[0] // fallback keeps the demo deterministic
  return { questionId: chosen.id, question: chosen.text, modelPicked: chosen.id === pick, candidates: candidates.map(q => q.id),
    text: body + `想請教專業者：${chosen.text}`, ms: Date.now() - t0 }
}
