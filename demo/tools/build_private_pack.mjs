// Build a private demo data pack from a Garmin Connect export (never committed).
// Usage: node tools/build_private_pack.mjs <exportDir> <outDir> <fromDate YYYY-MM-DD> <toDate YYYY-MM-DD>
// exportDir must contain DI_CONNECT/... JSON and fit/ with the extracted uploaded FIT files.
import { Decoder, Stream } from '@garmin/fitsdk'
import { readFileSync, readdirSync, mkdirSync, copyFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const [exportDir, outDir, fromDate, toDate] = process.argv.slice(2)
if (!toDate) { console.error('usage: <exportDir> <outDir> <from> <to>'); process.exit(2) }

const fitn = join(exportDir, 'DI_CONNECT/DI-Connect-Fitness')
const actFile = readdirSync(fitn).find(f => f.endsWith('_summarizedActivities.json'))
const acts = JSON.parse(readFileSync(join(fitn, actFile), 'utf8'))[0].summarizedActivitiesExport
const localDate = a => new Date(a.startTimeLocal).toISOString().slice(0, 10) // startTimeLocal is local wall-clock in ms
const targets = acts.filter(a => a.name === 'sauna' && localDate(a) >= fromDate && localDate(a) <= toDate)
const byGmt = new Map(targets.map(a => [Math.round(a.startTimeGmt / 1000), a]))
console.log(`sauna activities in range: ${targets.length}`)

const fitDir = join(exportDir, 'fit')
const files = readdirSync(fitDir).filter(f => f.toLowerCase().endsWith('.fit'))
const found = new Map()
let decoded = 0, errors = 0
for (const f of files) {
  const p = join(fitDir, f)
  if (statSync(p).size < 2000) continue
  try {
    const dec = new Decoder(Stream.fromByteArray(readFileSync(p)))
    if (!dec.isFIT()) continue
    const { messages, errors: errs } = dec.read({ includeUnknownData: false, applyScaleAndOffset: true, convertDateTimesToDates: true })
    decoded++
    if (errs.length) errors++
    const s = messages.sessionMesgs?.[0]
    if (!s?.startTime) continue
    const key = Math.round(s.startTime.getTime() / 1000)
    for (const d of [0, -1, 1, -2, 2]) {
      if (byGmt.has(key + d) && !found.has(key + d)) { found.set(key + d, p); break }
    }
  } catch { errors++ }
  if (found.size === byGmt.size) break
}
console.log(`decoded ${decoded}, decode errors ${errors}, matched ${found.size}/${byGmt.size}`)

mkdirSync(join(outDir, 'sauna_fit'), { recursive: true })
const manifest = []
for (const [key, p] of found) {
  const a = byGmt.get(key)
  const name = `sauna_${localDate(a)}_${a.activityId}.fit`
  copyFileSync(p, join(outDir, 'sauna_fit', name))
  manifest.push({ file: `sauna_fit/${name}`, activityId: a.activityId, localDate: localDate(a),
    sha256: createHash('sha256').update(readFileSync(p)).digest('hex') })
}
const wl = join(exportDir, 'DI_CONNECT/DI-Connect-Wellness')
const sleep = readdirSync(wl).filter(f => f.endsWith('_sleepData.json'))
  .flatMap(f => JSON.parse(readFileSync(join(wl, f), 'utf8')))
  .filter(r => r.calendarDate >= fromDate && r.calendarDate <= toDate)
writeFileSync(join(outDir, 'sleep.json'), JSON.stringify(sleep))
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ fromDate, toDate, sauna: manifest.sort((x, y) => x.localDate.localeCompare(y.localDate)), sleepNights: sleep.length }, null, 2))
console.log(`pack: ${manifest.length} sauna FIT, ${sleep.length} sleep nights -> ${outDir}`)
