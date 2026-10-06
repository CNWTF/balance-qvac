// Import a person's own data pack (raw Garmin FIT + sleep records) and decode it on the phone.
// The pack is kept only in this app's private document directory.
import * as FileSystem from 'expo-file-system/legacy'
import * as DocumentPicker from 'expo-document-picker'
import { parseSaunaFit, sleepNights } from './recovery'
import { b64ToBytes } from './b64'

const STORE = FileSystem.documentDirectory + 'balance_pack.json'
const DECODED = FileSystem.documentDirectory + 'balance_decoded.json' // decoded once on this phone, reused on later launches
export function decodePack(text) {
  const p = JSON.parse(text)
  if (p.kind !== 'balance-pack') throw new Error('不是Balance資料包')
  const t0 = Date.now()
  const sessions = p.fit.map(f => parseSaunaFit(b64ToBytes(f.b64)))
  const nights = sleepNights(p.sleep)
  return { sessions, nights, range: p.range, fitCount: p.fit.length, decodeMs: Date.now() - t0 }
}

export async function pickAndStorePack() {
  const r = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false })
  if (r.canceled) return null
  const text = await FileSystem.readAsStringAsync(r.assets[0].uri)
  const data = decodePack(text) // validate before keeping it
  await FileSystem.writeAsStringAsync(STORE, text)
  await FileSystem.writeAsStringAsync(DECODED, JSON.stringify(data))
  return data
}

export async function loadStoredPack() {
  const cached = await FileSystem.getInfoAsync(DECODED)
  if (cached.exists) return { ...JSON.parse(await FileSystem.readAsStringAsync(DECODED)), fromCache: true }
  const info = await FileSystem.getInfoAsync(STORE)
  if (!info.exists) return null
  const data = decodePack(await FileSystem.readAsStringAsync(STORE))
  await FileSystem.writeAsStringAsync(DECODED, JSON.stringify(data))
  return data
}

export async function clearStoredPack() {
  await FileSystem.deleteAsync(STORE, { idempotent: true })
  await FileSystem.deleteAsync(DECODED, { idempotent: true })
}

// Week end dates (inclusive, 7-day windows) from the newest date backwards.
export function weekEnds(range, count = 12) {
  const out = []
  let d = new Date(range.to + 'T00:00:00Z')
  const from = new Date(range.from + 'T00:00:00Z')
  for (let i = 0; i < count; i++) {
    const start = new Date(d); start.setUTCDate(start.getUTCDate() - 7) // need one prior week for comparison
    if (start < from) break
    out.push(d.toISOString().slice(0, 10))
    d = new Date(d); d.setUTCDate(d.getUTCDate() - 7)
  }
  return out
}
