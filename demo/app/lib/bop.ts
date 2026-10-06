// Minimal BOP message set for the demo and plain-language labels.
// Every message carries an id that ties a case together; health data only ever goes user -> pro, with consent.
export type Pair = [string, string]

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

export const SERVICE_NAME: Record<string, Pair> = {
  sauna: ['三溫暖', 'Sauna'], cold_plunge: ['冷泉', 'Cold plunge'], massage: ['按摩', 'Massage'],
  consultation: ['健康諮詢', 'Consultation'], stretching: ['伸展', 'Stretching']
}
export const WINDOW_NAME: Record<string, Pair> = { morning: ['早上', 'Morning'], afternoon: ['下午', 'Afternoon'], evening: ['晚上', 'Evening'] }
const WEEKDAY: Pair[] = [['日', 'Sun'], ['一', 'Mon'], ['二', 'Tue'], ['三', 'Wed'], ['四', 'Thu'], ['五', 'Fri'], ['六', 'Sat']]
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function dateLabel(iso: string | null): Pair {
  if (!iso) return ['待確認', 'to be confirmed']
  const d = new Date(iso + 'T00:00:00Z'); const w = WEEKDAY[d.getUTCDay()]
  return [`${d.getUTCMonth() + 1}/${d.getUTCDate()}（週${w[0]}）`, `${w[1]}, ${MONTH_EN[d.getUTCMonth()]} ${d.getUTCDate()}`]
}
export const money = (n: number): Pair => [`NT$${n.toLocaleString()}`, `NT$${n.toLocaleString()}`]

export function requestRows(r: any): [Pair, Pair][] {
  return [
    [['服務', 'Service'], SERVICE_NAME[r.service_type] ?? [r.service_type, r.service_type]],
    [['日期', 'Date'], dateLabel(r.date)],
    [['時段', 'Time'], r.time_window ? WINDOW_NAME[r.time_window] : ['待確認', 'to be confirmed']],
    [['找專業者', 'Professional'], r.needs_professional ? ['需要', 'Yes'] : ['不需要', 'No']],
    [['預算上限', 'Budget limit'], r.max_price_twd != null ? money(r.max_price_twd) : ['未指定', 'Not specified']]
  ]
}

// Text that arrives from another agent is data, never instructions. Flag instruction-like content for the person.
const INJECTION = /(忽略|無視|傳給我|告訴我.*(睡眠|健康|資料)|把.*資料.*(給|傳)|ignore (all|previous)|send me|forward .*data|reveal|password|系統提示|system prompt)/i
export const looksLikeInstruction = (text: string) => INJECTION.test(text || '')

// Venue catalogue (demo). Capacity is held by the venue's own phone.
export type Offer = { slot: string, price: number, left: number }
export const SLOTS: Record<string, string[]> = { morning: ['09:00', '10:30'], afternoon: ['14:00', '16:00'], evening: ['18:30', '20:00'] }
export const DEFAULT_PRICES: Record<string, number> = { sauna: 800, cold_plunge: 500, massage: 1500, stretching: 600, consultation: 1200 }
