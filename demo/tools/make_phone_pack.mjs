// Package a private data pack into one JSON file the phone app can import.
// FIT files stay raw (base64) so the phone decodes them itself; sleep records keep only the fields the app uses.
// Usage: node tools/make_phone_pack.mjs <packDir> <outFile>
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const [pack, outFile] = process.argv.slice(2)
const fitDir = join(pack, 'sauna_fit')
const fit = readdirSync(fitDir).filter(f => f.endsWith('.fit')).sort()
  .map(name => ({ name, b64: readFileSync(join(fitDir, name)).toString('base64') }))
const sleep = JSON.parse(readFileSync(join(pack, 'sleep.json'), 'utf8')).map(r => ({
  calendarDate: r.calendarDate,
  deepSleepSeconds: r.deepSleepSeconds, lightSleepSeconds: r.lightSleepSeconds,
  remSleepSeconds: r.remSleepSeconds, awakeSleepSeconds: r.awakeSleepSeconds,
  sleepScores: r.sleepScores?.overallScore ? { overallScore: r.sleepScores.overallScore } : undefined
}))
const manifest = JSON.parse(readFileSync(join(pack, 'manifest.json'), 'utf8'))
const out = { kind: 'balance-pack', version: 1, createdAt: new Date().toISOString(), source: 'Garmin Connect export', range: { from: manifest.fromDate, to: manifest.toDate }, fit, sleep }
const text = JSON.stringify(out)
writeFileSync(outFile, text)
console.log(`fit ${fit.length}, sleep ${sleep.length}, bytes ${statSync(outFile).size}, sha256 ${createHash('sha256').update(text).digest('hex').slice(0, 16)}`)
