// QVAC capabilities used by the Balance roles (grant SOW 11.1), each loaded on demand and unloaded after use
// so a 6 GB phone can run them next to the main LLM.
import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import { createAudioPlayer } from 'expo-audio'
import { Asset } from 'expo-asset'
import {
  loadModel, unloadModel, classify, ocr, transcribe, textToSpeech, translate, ragIngest, ragSearch, completion,
  WHISPER_BASE_Q8_0, TTS_MULTILINGUAL_SUPERTONIC3_Q4_0, BERGAMOT_ZH_EN, BERGAMOT_EN_ZH,
  EMBEDDINGGEMMA_300M_Q4_0, OCR_LATIN, VISIONPSY_NANO_460M_MULTIMODAL_Q8_0, MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0
} from '@qvac/sdk'
import { b64ToBytes, bytesToB64 } from './b64'
import { KB } from './kb'

const cpu = Platform.OS === 'android' ? { device: 'cpu' } : {} // Mali GPUs crash in the GPU backend (Galaxy A32)
const localPath = (uri: string) => decodeURI(uri.replace(/^file:\/\//, ''))

async function withModel<T>(opts: any, fn: (id: string) => Promise<T>): Promise<T> {
  const id = await loadModel(opts)
  try { return await fn(id) } finally { await unloadModel({ modelId: id, clearStorage: false }).catch(() => {}) }
}
const timed = async <T>(fn: () => Promise<T>) => { const t0 = Date.now(); const r = await fn(); return { r, ms: Date.now() - t0 } }

// Image classification (QVAC's MobileNetV3: food / report / other). Its weights are not in QVAC's mobile
// worker bundle, so the app ships the same 3 MB GGUF as an asset and passes the local path.
let classifierPath: string | null = null
async function classifierSrc() {
  if (!classifierPath) {
    const a = Asset.fromModule(require('../assets/models/mobilenetv3_3class_v3_fp16.gguf'))
    await a.downloadAsync()
    classifierPath = localPath(a.localUri ?? a.uri)
  }
  return classifierPath
}
export const classifyPhoto = (uri: string) => timed(async () => {
  const bytes = b64ToBytes(await FileSystem.readAsStringAsync(uri, { encoding: 'base64' }))
  return withModel({ modelSrc: await classifierSrc(), modelType: 'ggml-classification' }, (modelId) => classify({ modelId, image: bytes }))
})

// VisionPsy (multimodal) describes a photo, e.g. a meal; one sentence, non-medical.
export const describePhoto = (uri: string, lang: 'zh' | 'en') => timed(() => withModel(
  { modelSrc: VISIONPSY_NANO_460M_MULTIMODAL_Q8_0, modelConfig: { ctx_size: 2048, projectionModelSrc: MMPROJ_VISIONPSY_NANO_460M_MULTIMODAL_Q8_0, image_no_upscale: 'on', ...cpu } },
  async (modelId) => {
    const ask = lang === 'zh' ? 'Describe the food in this photo in one short English sentence. List the main items.' : 'Describe this photo in one short sentence. List the main items.'
    const run = completion({ modelId, stream: true, history: [{ role: 'user', content: ask, attachments: [{ path: localPath(uri) }] }], generationParams: { predict: 60, temp: 0.2 } } as any)
    for await (const _ of run.events) { /* drain */ }
    return (await run.final).contentText.trim()
  }))

// OCR (Latin script: prices, times, English text)
// canvasSize caps the detector input: a 48 MP phone photo otherwise fails to allocate the graph on iPhone.
// If the GPU path still fails, retry once on the CPU.
const runOcr = (uri: string, extra: any) => withModel({ modelSrc: (OCR_LATIN as any).src, modelType: 'ggml-ocr', modelConfig: { canvasSize: 1280, magRatio: 1, ...extra } }, async (modelId) => {
  const blocks = await ocr({ modelId, image: localPath(uri) }).blocks
  return blocks.map((b: any) => b.text).filter(Boolean)
})
export const ocrPhoto = (uri: string) => timed(async () => {
  try { return await runOcr(uri, {}) } catch { return runOcr(uri, { backendDevice: 'cpu' }) }
})

// Speech to text (Whisper base, multilingual)
export const transcribeAudio = (uri: string, lang: 'zh' | 'en') => timed(() => withModel(
  { modelSrc: WHISPER_BASE_Q8_0, modelType: 'whisper', modelConfig: { language: lang } },
  async (modelId) => String(await transcribe({ modelId, audioChunk: localPath(uri) } as any)).trim()))

// Text to speech (Supertonic 3: English and Japanese; no Chinese voice in this size class)
let player: any = null
export const speak = (text: string, lang: 'en' | 'ja') => timed(() => withModel(
  { modelSrc: TTS_MULTILINGUAL_SUPERTONIC3_Q4_0, modelType: 'tts', modelConfig: { ttsEngine: 'supertonic', language: lang, voice: 'F1' } },
  async (modelId) => {
    const samples: number[] = await (textToSpeech({ modelId, text, inputType: 'text', stream: false } as any) as any).buffer
    const rate = 44100
    const bytes = new Uint8Array(44 + samples.length * 2); const v = new DataView(bytes.buffer)
    const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i) }
    str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true)
    v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, samples.length * 2, true)
    samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(s))), true))
    const file = FileSystem.cacheDirectory + `tts_${Date.now()}.wav`
    await FileSystem.writeAsStringAsync(file, bytesToB64(bytes), { encoding: 'base64' })
    if (player) { try { player.remove() } catch {} }
    player = createAudioPlayer({ uri: file }); player.play()
    return { seconds: samples.length / rate }
  }))

// Translation (Bergamot NMT, on device)
export const translateText = (text: string, from: 'zh' | 'en', to: 'zh' | 'en') => timed(() => withModel(
  { modelSrc: from === 'zh' ? BERGAMOT_ZH_EN : BERGAMOT_EN_ZH, modelConfig: { engine: 'Bergamot', from, to } },
  async (modelId) => String(await (translate({ modelId, modelType: 'nmt', text, from, to, stream: false } as any) as any).text).trim()))

// RAG over the professional's knowledge base (EmbeddingGemma 300M + QVAC's on-device vector store)
let kbReady = false
export const kbSearch = (query: string, topK = 2) => timed(() => withModel(
  { modelSrc: EMBEDDINGGEMMA_300M_Q4_0, modelConfig: { ...cpu } },
  async (modelId) => {
    if (!kbReady) { await ragIngest({ modelId, workspace: 'balance-kb', documents: KB.map(k => `${k.id} ${k.zh}`), chunk: false } as any); kbReady = true }
    const hits: any[] = await ragSearch({ modelId, workspace: 'balance-kb', query, topK } as any)
    return hits.map(h => { const text = String(h.content ?? h.text ?? ''); const id = text.slice(0, 2); return { ...(KB.find(k => k.id === id) ?? { id, zh: text, en: '' }), score: h.score } })
  }))
