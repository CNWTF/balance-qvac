// Desktop smoke test of the QVAC capabilities used by the Balance roles (grant SOW 11.1).
// Each step loads its model, runs once, unloads, and records time and a short result.
import {
  loadModel, unloadModel, completion, classify, ocr, transcribe, textToSpeech, translate, embed,
  ragIngest, ragSearch, batchCompletion,
  WHISPER_BASE_Q8_0, TTS_MULTILINGUAL_SUPERTONIC3_Q4_0, BERGAMOT_ZH_EN, BERGAMOT_EN_ZH,
  EMBEDDINGGEMMA_300M_Q4_0, OCR_LATIN, QWEN3_600M_INST_Q4,
  VISIONPSY_NANO_460M_MULTIMODAL_Q8_0, MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0
} from '@qvac/sdk'
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'results'); mkdirSync(OUT, { recursive: true })
const IMG = process.argv[2] // any test image (png/jpg)
const only = (process.argv[3] || '').split(',').filter(Boolean)
const res = {}
const want = (k) => !only.length || only.includes(k)

function wav(samples, rate) {
  const b = Buffer.alloc(44 + samples.length * 2)
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12)
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40)
  samples.forEach((v, i) => b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v))), 44 + i * 2))
  return b
}

async function step(name, fn) {
  if (!want(name)) return
  const t0 = Date.now()
  try { const r = await fn(); res[name] = { ok: true, ms: Date.now() - t0, ...r }; console.log('OK ', name, Date.now() - t0, 'ms', JSON.stringify(r).slice(0, 220)) }
  catch (e) { res[name] = { ok: false, ms: Date.now() - t0, error: String(e?.message || e).slice(0, 300) }; console.log('ERR', name, String(e?.message || e).slice(0, 300)) }
}

await step('classify', async () => {
  const id = await loadModel({ modelType: 'ggml-classification' })
  const r = await classify({ modelId: id, image: readFileSync(IMG) })
  await unloadModel({ modelId: id }); return { results: r }
})

await step('tts', async () => {
  const out = {}
  for (const lang of ['en', 'zh']) {
    try {
      const id = await loadModel({ modelSrc: TTS_MULTILINGUAL_SUPERTONIC3_Q4_0, modelType: 'tts', modelConfig: { ttsEngine: 'supertonic', language: lang, voice: 'F1' } })
      const text = lang === 'zh' ? '這週三溫暖四次，平均每次二十七分鐘。' : 'This week you went to the sauna four times.'
      const r = textToSpeech({ modelId: id, text, inputType: 'text', stream: false })
      const samples = await r.buffer
      writeFileSync(join(OUT, `tts_${lang}.wav`), wav(samples, 44100))
      out[lang] = { samples: samples.length }
      await unloadModel({ modelId: id })
    } catch (e) { out[lang] = { error: String(e?.message || e).slice(0, 200) } }
  }
  return out
})

await step('asr', async () => {
  const id = await loadModel({ modelSrc: WHISPER_BASE_Q8_0, modelType: 'whisper', modelConfig: { language: 'auto' } })
  const r = {}
  for (const lang of ['en', 'zh']) {
    try { r[lang] = await transcribe({ modelId: id, audioChunk: join(OUT, `tts_${lang}.wav`) }) } catch (e) { r[lang] = 'ERR ' + String(e?.message || e).slice(0, 120) }
  }
  await unloadModel({ modelId: id }); return r
})

await step('translate', async () => {
  const id = await loadModel({ modelSrc: BERGAMOT_ZH_EN, modelConfig: { engine: 'Bergamot', from: 'zh', to: 'en' } })
  const zh2en = await translate({ modelId: id, modelType: 'nmt', text: '三溫暖當晚睡得比較久，下週的三溫暖要怎麼排進行程？', from: 'zh', to: 'en', stream: false }).text
  await unloadModel({ modelId: id })
  const id2 = await loadModel({ modelSrc: BERGAMOT_EN_ZH, modelConfig: { engine: 'Bergamot', from: 'en', to: 'zh' } })
  const en2zh = await translate({ modelId: id2, modelType: 'nmt', text: 'Keep the sauna session under thirty minutes and drink water afterwards.', from: 'en', to: 'zh', stream: false }).text
  await unloadModel({ modelId: id2 }); return { zh2en, en2zh }
})

await step('rag', async () => {
  const id = await loadModel({ modelSrc: EMBEDDINGGEMMA_300M_Q4_0 })
  const docs = ['三溫暖後補充水分，避免空腹或飲酒後進入。', '睡前兩小時內避免高強度運動，可改做伸展。', '冷熱交替時每輪熱區十到十五分鐘，冷區一到兩分鐘。']
  await ragIngest({ modelId: id, workspace: 'balance-kb-test', documents: docs, chunk: false })
  const hits = await ragSearch({ modelId: id, workspace: 'balance-kb-test', query: '睡前可以做什麼', topK: 2 })
  const e = await embed({ modelId: id, text: 'sauna' })
  await unloadModel({ modelId: id }); return { hits: hits.map(h => (h.content || h.text || '').slice(0, 30)), dim: e.embedding.length }
})

await step('ocr', async () => {
  const id = await loadModel({ modelSrc: OCR_LATIN.src, modelType: 'ggml-ocr' })
  const blocks = await ocr({ modelId: id, image: IMG }).blocks
  await unloadModel({ modelId: id }); return { n: blocks.length, sample: blocks.slice(0, 6).map(b => b.text) }
})

await step('vision', async () => {
  const id = await loadModel({ modelSrc: VISIONPSY_NANO_460M_MULTIMODAL_Q8_0, modelConfig: { ctx_size: 2048, projectionModelSrc: MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0, image_no_upscale: 'on' } })
  const run = completion({ modelId: id, stream: true, history: [{ role: 'user', content: 'Describe this image in one sentence.', attachments: [{ path: IMG }] }], generationParams: { predict: 60 } })
  for await (const _ of run.events) {}
  const f = await run.final
  await unloadModel({ modelId: id }); return { text: f.contentText.slice(0, 200) }
})

await step('batch', async () => {
  const id = await loadModel({ modelSrc: QWEN3_600M_INST_Q4, modelConfig: { ctx_size: 2048, parallel: 3 } })
  const prompts = ['週六晚上', '週日早上', '週五下午'].map((t, i) => ({ id: 'q' + i, history: [{ role: 'user', content: `用一句台灣正體中文回覆客人：${t}三溫暖有空位，每人800元。 /no_think` }], generationParams: { predict: 60, reasoning_budget: 0 } }))
  const run = batchCompletion({ modelId: id, prompts })
  const results = await run.results
  await unloadModel({ modelId: id }); return { n: results.length, first: JSON.stringify(results[0]).slice(0, 160) }
})

writeFileSync(join(OUT, `caps_${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify(res, null, 2))
process.exit(0)
