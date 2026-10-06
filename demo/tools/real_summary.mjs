// Run the weekly summary on a person's own private data pack, locally. Output goes to the private folder only.
// Usage: node tools/real_summary.mjs <packDir> <endDate YYYY-MM-DD> [runs]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadModel, unloadModel } from '@qvac/sdk'
import { parseSaunaFit, sleepNights, recoveryFacts, factTable } from '../lib/recovery.mjs'
import { buildSummary } from '../lib/summary.mjs'

const [pack, endDate, runsArg] = process.argv.slice(2)
const runs = +(runsArg || 3)
const MODEL = 'https://huggingface.co/qvac/MedPsy-1.7B-GGUF/resolve/main/medpsy-1.7b-q4_k_m-imat.gguf'
const sessions = readdirSync(join(pack, 'sauna_fit')).map(f => parseSaunaFit(readFileSync(join(pack, 'sauna_fit', f))))
const nights = sleepNights(JSON.parse(readFileSync(join(pack, 'sleep.json'), 'utf8')))
const facts = recoveryFacts(sessions, nights, endDate, 7)
const table = factTable(facts, `${facts.window.start}至${facts.window.end}`)

let modelId
try {
  modelId = await loadModel({ modelSrc: MODEL, modelType: 'llamacpp-completion', modelConfig: { ctx_size: 4096 } })
  const outs = []
  for (let i = 0; i < runs; i++) outs.push(await buildSummary(modelId, table))
  const report = { endDate, facts, table, outputs: outs.map(o => ({ text: o.text, picks: o.picks, question: o.question, digitFree: o.digitFree, ms: o.ms })) }
  const file = join(pack, `real_summary_${endDate}.json`)
  writeFileSync(file, JSON.stringify(report, null, 2))
  console.log('FACTS'); for (const [k, v] of Object.entries(table)) console.log(`  ${k} ${v}`)
  outs.forEach((o, i) => console.log(`RUN${i + 1} (${o.ms} ms, digitFree=${o.digitFree}): ${o.text}`))
  console.log('written', file)
} catch (e) { console.error('ERROR', e); process.exitCode = 1 } finally {
  if (modelId) await unloadModel({ modelId, clearStorage: false })
  process.exit(process.exitCode ?? 0)
}
