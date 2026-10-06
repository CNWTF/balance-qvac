// P1 v3: hybrid intent (model classifies, rules own dates/prices) on the tuned set and a held-out set,
// plus a summary where the model picks facts and writes a digit-free question for the professional.
import { loadModel, unloadModel, completion } from '@qvac/sdk'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { INTENTS, TODAY_ISO } from './intents.mjs'
import { HELDOUT } from './heldout.mjs'
import { draftServiceRequest } from '../lib/intent.mjs'
import { buildSummary } from '../lib/summary.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'results'); mkdirSync(OUT, { recursive: true })
const MODEL = process.env.P1_MODEL || 'https://huggingface.co/qvac/MedPsy-1.7B-GGUF/resolve/main/medpsy-1.7b-q4_k_m-imat.gguf'

const SYNTH = { F1: '過去7天三溫暖3次', F2: '平均每次42分鐘', F3: '平均睡眠6小時18分（前一段6小時52分）', F4: '三溫暖當晚平均睡眠6小時51分（3晚）', F5: '沒去三溫暖的晚上平均睡眠5小時54分（4晚）' }

let modelId
const out = { model: MODEL }
try {
  const t0 = Date.now()
  modelId = await loadModel({ modelSrc: MODEL, modelType: 'llamacpp-completion', modelConfig: { ctx_size: 4096 } })
  out.loadMs = Date.now() - t0
  const sums = []
  for (let i = 0; i < 3; i++) sums.push(await buildSummary(modelId, SYNTH, ['這週有去三溫暖', '三溫暖當晚比沒去的晚上睡得久', '這週平均睡眠比前一週短']))
  out.summary = sums
  sums.forEach(s => console.log('[summary]', s.text, `(${s.ms} ms)`))
  for (const [name, set] of [['tuned', INTENTS], ['heldout', HELDOUT]]) {
    const rows = []
    for (const [u, e] of set) {
      const r = await draftServiceRequest(modelId, u, TODAY_ISO)
      const fields = Object.fromEntries(Object.keys(e).map(k => [k, r.request[k] === e[k]]))
      fields.no_extra_price = e.max_price_twd === undefined ? r.request.max_price_twd === undefined : true
      const ok = Object.values(fields).every(Boolean)
      rows.push({ u, ok, fields, ...r })
      console.log(`${name} ${ok ? 'OK' : 'NG'} ${r.ms}ms ${u} -> ${JSON.stringify(r.request)}`)
    }
    const n = rows.length
    const keys = ['service_type', 'needs_professional', 'date', 'time_window', 'no_extra_price']
    out[name] = { ok: rows.filter(r => r.ok).length, n, median_ms: rows.map(r => r.ms).sort((a, b) => a - b)[Math.floor(n / 2)],
      field_ok: Object.fromEntries(keys.map(k => [k, rows.filter(r => r.fields[k] !== false).length])), rows }
    console.log(`[${name}] ok ${out[name].ok}/${n} median ${out[name].median_ms}ms fields ${JSON.stringify(out[name].field_ok)}`)
  }
  const f = join(OUT, `p1v3_${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(f, JSON.stringify(out, null, 2)); console.log('written', f)
} catch (e) { console.error('ERROR', e); process.exitCode = 1 } finally {
  if (modelId) await unloadModel({ modelId, clearStorage: false })
  process.exit(process.exitCode ?? 0)
}
