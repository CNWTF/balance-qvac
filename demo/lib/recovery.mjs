// Deterministic recovery facts from a person's own Garmin data. Runs on Node and in the phone app.
// All numbers shown to people come from here, never from the model.
import { Decoder, Stream } from '@garmin/fitsdk'

const pad = n => String(n).padStart(2, '0')
const isoDate = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

export function parseSaunaFit(bytes) {
  const dec = new Decoder(Stream.fromByteArray(bytes))
  if (!dec.isFIT()) throw new Error('not a FIT file')
  const { messages, errors } = dec.read({ applyScaleAndOffset: true, convertDateTimesToDates: true })
  if (errors.length) throw new Error('FIT decode error: ' + errors[0].message)
  const s = messages.sessionMesgs?.[0]
  const act = messages.activityMesgs?.[0]
  if (!s) throw new Error('no session message')
  // local offset = activity.localTimestamp (seconds, local wall clock) - activity.timestamp (UTC)
  let offsetSec = 0
  if (act?.localTimestamp != null && act?.timestamp) {
    const FIT_EPOCH = 631065600 // 1989-12-31T00:00:00Z in Unix seconds
    const ltFit = typeof act.localTimestamp === 'number' ? act.localTimestamp : act.localTimestamp.getTime() / 1000 - FIT_EPOCH
    offsetSec = Math.round(ltFit - (act.timestamp.getTime() / 1000 - FIT_EPOCH))
  }
  const startLocal = new Date(s.startTime.getTime() + offsetSec * 1000)
  const temps = (messages.recordMesgs || []).map(r => r.temperature).filter(t => typeof t === 'number')
  return {
    localDate: isoDate(startLocal),
    startHourLocal: startLocal.getUTCHours(),
    timerMinutes: s.totalTimerTime / 60,
    avgHr: s.avgHeartRate ?? null,
    maxHr: s.maxHeartRate ?? null,
    maxTempC: temps.length ? Math.max(...temps) : null
  }
}

export function sleepNights(sleepRecords) {
  return sleepRecords
    .filter(r => (r.deepSleepSeconds ?? 0) + (r.lightSleepSeconds ?? 0) + (r.remSleepSeconds ?? 0) > 0)
    .map(r => ({
      wakeDate: r.calendarDate,
      sleepMinutes: ((r.deepSleepSeconds ?? 0) + (r.lightSleepSeconds ?? 0) + (r.remSleepSeconds ?? 0)) / 60,
      score: r.sleepScores?.overallScore ?? null
    }))
}

const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return isoDate(d) }
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null
export const fmtHM = m => m == null ? '—' : `${Math.floor(m / 60)}小時${pad(Math.round(m % 60))}分`

// Facts for the window ending on endDate (inclusive). A night "after sauna" is the sleep that ends the day after a sauna day.
export function recoveryFacts(sessions, nights, endDate, days = 7) {
  const start = addDays(endDate, -(days - 1))
  const prevStart = addDays(start, -days), prevEnd = addDays(start, -1)
  const inRange = (d, a, b) => d >= a && d <= b
  const sx = sessions.filter(s => inRange(s.localDate, start, endDate))
  const saunaDays = new Set(sessions.map(s => s.localDate))
  const nw = nights.filter(n => inRange(n.wakeDate, addDays(start, 1), addDays(endDate, 1)))
  const np = nights.filter(n => inRange(n.wakeDate, addDays(prevStart, 1), addDays(prevEnd, 1)))
  const after = nw.filter(n => saunaDays.has(addDays(n.wakeDate, -1)))
  const other = nw.filter(n => !saunaDays.has(addDays(n.wakeDate, -1)))
  return {
    window: { start, end: endDate, days },
    saunaCount: sx.length,
    saunaDays: [...new Set(sx.map(s => s.localDate))].length,
    saunaMeanMinutes: mean(sx.map(s => s.timerMinutes)),
    sleepMeanMinutes: mean(nw.map(n => n.sleepMinutes)),
    sleepMeanMinutesPrev: mean(np.map(n => n.sleepMinutes)),
    sleepAfterSaunaMean: mean(after.map(n => n.sleepMinutes)), nightsAfterSauna: after.length,
    sleepOtherMean: mean(other.map(n => n.sleepMinutes)), nightsOther: other.length,
    nights: nw.length
  }
}

// Fact sentences with ids, for the model to cite. Numbers rendered here.
export function factTable(f, label = '這段期間') {
  const t = {
    F1: `${label}三溫暖${f.saunaCount}次`,
    F2: f.saunaMeanMinutes == null ? '沒有三溫暖紀錄' : `平均每次${Math.round(f.saunaMeanMinutes)}分鐘`,
    F3: `平均睡眠${fmtHM(f.sleepMeanMinutes)}（前一段${fmtHM(f.sleepMeanMinutesPrev)}）`,
    F4: `三溫暖當晚平均睡眠${fmtHM(f.sleepAfterSaunaMean)}（${f.nightsAfterSauna}晚）`,
    F5: `沒去三溫暖的晚上平均睡眠${fmtHM(f.sleepOtherMean)}（${f.nightsOther}晚）`
  }
  return t
}
