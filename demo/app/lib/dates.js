// Deterministic date resolution: the model picks a reference, code computes the date.
const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
export const DAY_REFS = ['today', 'tomorrow', 'day_after_tomorrow',
  ...WD.map(d => `this_${d}`), ...WD.map(d => `next_${d}`), 'explicit']

const addDays = (iso, n) => {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Week starts on Monday. this_<wd>: that weekday in the current Mon–Sun week;
// if it is already past, the same weekday next week. next_<wd>: weekday in next week.
export function resolveDayRef(ref, monthDay, todayIso) {
  const today = new Date(todayIso + 'T00:00:00Z')
  const dow = (today.getUTCDay() + 6) % 7 // Mon=0
  if (ref === 'today') return todayIso
  if (ref === 'tomorrow') return addDays(todayIso, 1)
  if (ref === 'day_after_tomorrow') return addDays(todayIso, 2)
  if (ref === 'explicit') {
    const m = /^(\d{1,2})-(\d{1,2})$/.exec(monthDay || '')
    if (!m) throw new Error('explicit date without MM-DD')
    const y = today.getUTCFullYear()
    let iso = `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
    if (iso < todayIso) iso = `${y + 1}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
    return iso
  }
  const [kind, wd] = ref.split('_')
  const target = (WD.indexOf(wd) + 6) % 7 // Mon=0
  if (target < 0 || !['this', 'next'].includes(kind)) throw new Error('bad day_ref ' + ref)
  let delta = target - dow
  if (kind === 'next') delta += 7
  else if (delta < 0) delta += 7
  return addDays(todayIso, delta)
}
