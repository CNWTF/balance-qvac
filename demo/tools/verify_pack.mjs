// Verify the JS decoder against the reference analysis (Python FIT SDK) for the private pack.
// Usage: node tools/verify_pack.mjs <packDir> <referenceSessionsCsv>
// Prints only match counts; no health values are printed.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseSaunaFit, sleepNights, recoveryFacts } from '../lib/recovery.mjs'

const [pack, refCsv] = process.argv.slice(2)
const lines = readFileSync(refCsv, 'utf8').trim().split(/\r?\n/)
const head = lines[0].split(',')
const idx = k => head.indexOf(k)
const ref = lines.slice(1).map(l => l.split(',')).map(c => ({ date: c[idx('local_date')], timer: +c[idx('timer_minutes')], avgHr: +c[idx('summary_avg_hr')] }))
const files = readdirSync(join(pack, 'sauna_fit'))
const ours = files.map(f => parseSaunaFit(readFileSync(join(pack, 'sauna_fit', f))))
let dateOk = 0, timerOk = 0, hrOk = 0
const pool = [...ref]
for (const s of ours) {
  const i = pool.findIndex(r => r.date === s.localDate && Math.abs(r.timer - s.timerMinutes) < 0.05)
  if (i >= 0) { dateOk++; timerOk++; if (Math.abs(pool[i].avgHr - s.avgHr) < 0.5) hrOk++; pool.splice(i, 1) }
}
const refInRange = ref.filter(r => r.date >= '2026-05-13' && r.date <= '2026-08-10').length
console.log(`sessions decoded ${ours.length}; reference in range ${refInRange}; matched date+timer ${timerOk}; avgHr match ${hrOk}`)
const nights = sleepNights(JSON.parse(readFileSync(join(pack, 'sleep.json'), 'utf8')))
const f = recoveryFacts(ours, nights, '2026-08-10', 7)
console.log(`sleep nights ${nights.length}; last-7-day window ${f.window.start}..${f.window.end}: sauna ${f.saunaCount}, nights ${f.nights}, afterSauna ${f.nightsAfterSauna}, other ${f.nightsOther}`)
