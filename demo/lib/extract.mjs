// Deterministic extraction of dates, parts of day and price limits from zh-TW / English requests.
// The model classifies the service; rules own anything that is a number or a date.
import { resolveDayRef } from './dates.mjs'

const ZH_WD = { 一: 'mon', 二: 'tue', 三: 'wed', 四: 'thu', 五: 'fri', 六: 'sat', 日: 'sun', 天: 'sun' }
const EN_WD = { monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu', friday: 'fri', saturday: 'sat', sunday: 'sun' }
const EN_MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
const ZH_NUM = { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }

function zhAmount(s) {
  // supports digits, 一千, 兩千五, 一千五百, 八百
  if (/^\d+$/.test(s)) return +s
  let total = 0, m
  if ((m = /^([一二兩三四五六七八九])千(?:([一二三四五六七八九])(?:百)?)?$/.exec(s))) {
    total = ZH_NUM[m[1]] * 1000 + (m[2] ? ZH_NUM[m[2]] * 100 : 0); return total
  }
  if ((m = /^([一二兩三四五六七八九])百$/.exec(s))) return ZH_NUM[m[1]] * 100
  return null
}

export function extractDate(text, todayIso) {
  const t = text.toLowerCase()
  let m
  if ((m = /(\d{1,2})\s*[月/]\s*(\d{1,2})\s*[日號]?/.exec(t))) return { date: resolveDayRef('explicit', `${m[1]}-${m[2]}`, todayIso), rule: 'explicit' }
  if ((m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/.exec(t))) return { date: resolveDayRef('explicit', `${EN_MON[m[1]]}-${m[2]}`, todayIso), rule: 'explicit' }
  if (/後天|day after tomorrow/.test(t)) return { date: resolveDayRef('day_after_tomorrow', null, todayIso), rule: 'day_after_tomorrow' }
  if (/明天|明早|明晚|tomorrow/.test(t)) return { date: resolveDayRef('tomorrow', null, todayIso), rule: 'tomorrow' }
  if (/今天|今晚|今早|tonight|today/.test(t)) return { date: todayIso, rule: 'today' }
  if ((m = /下(?:週|周|星期|禮拜)([一二三四五六日天])/.exec(t))) return { date: resolveDayRef('next_' + ZH_WD[m[1]], null, todayIso), rule: 'next_' + ZH_WD[m[1]] }
  if ((m = /(?:週|周|星期|禮拜)([一二三四五六日天])/.exec(t))) return { date: resolveDayRef('this_' + ZH_WD[m[1]], null, todayIso), rule: 'this_' + ZH_WD[m[1]] }
  if ((m = /next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/.exec(t))) return { date: resolveDayRef('next_' + EN_WD[m[1]], null, todayIso), rule: 'next_' + EN_WD[m[1]] }
  if ((m = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/.exec(t))) return { date: resolveDayRef('this_' + EN_WD[m[1]], null, todayIso), rule: 'this_' + EN_WD[m[1]] }
  return null
}

export function extractTimeWindow(text) {
  const t = text.toLowerCase()
  if (/晚上|今晚|明晚|evening|tonight|night/.test(t)) return 'evening'
  if (/下午|afternoon/.test(t)) return 'afternoon'
  if (/早上|上午|明早|今早|morning/.test(t)) return 'morning'
  return null
}

export function extractPriceLimit(text) {
  const t = text.toLowerCase()
  let m
  if ((m = /(?:預算|不超過|不要超過|最多|上限)\s*([\d一二兩三四五六七八九千百]+)\s*(?:元|塊)?/.exec(t))) return zhAmount(m[1])
  if ((m = /([\d一二兩三四五六七八九千百]+)\s*(?:元|塊)?\s*(?:以內|以下)/.exec(t))) return zhAmount(m[1])
  if ((m = /(?:under|below|max(?:imum)?|up to|budget(?: of)?)\s*(?:nt\$|twd\s*)?(\d+)/.exec(t))) return +m[1]
  // English number words, e.g. spoken "under one thousand" or "below eight hundred"
  const EN = { one: 1, a: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 }
  if ((m = /(?:under|below|up to|max(?:imum)?|budget(?: of)?)\s+(one|a|two|three|four|five|six|seven|eight|nine)\s+(thousand|hundred)(?:\s+(?:and\s+)?(one|two|three|four|five|six|seven|eight|nine)\s+hundred)?/.exec(t)))
    return EN[m[1]] * (m[2] === 'thousand' ? 1000 : 100) + (m[3] ? EN[m[3]] * 100 : 0)
  return null
}

// A professional is wanted only when the person says so; a massage by itself does not count.
export function wantsProfessional(text) {
  return /健康管理師|專業|教練|指導|有人帶|找人|幫我做|諮詢|聊|營養師|coach|professional|trainer|consult/i.test(text)
}
