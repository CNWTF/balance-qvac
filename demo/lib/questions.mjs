// Reviewed questions a person can bring to a health professional. Non-medical, no numbers, no cause-and-effect claims.
// `when` lists the code-computed observations a question fits; an empty list means it always fits.
export const QUESTION_BANK = [
  { id: 'Q01', when: ['三溫暖當晚比沒去的晚上睡得久'], text: '三溫暖當晚睡得比較久，下週的三溫暖要怎麼排進行程？' },
  { id: 'Q02', when: ['三溫暖當晚比沒去的晚上睡得久'], text: '沒去三溫暖的晚上睡得比較短，睡前可以先調整哪些習慣？' },
  { id: 'Q03', when: ['三溫暖當晚比沒去的晚上睡得久'], text: '三溫暖結束到上床之間，怎麼安排比較好？' },
  { id: 'Q04', when: ['三溫暖當晚比沒去的晚上睡得短'], text: '三溫暖當晚睡得比較短，三溫暖的時段要不要提早？' },
  { id: 'Q05', when: ['三溫暖當晚比沒去的晚上睡得短'], text: '三溫暖當晚睡得比較短，結束後到睡前可以怎麼放鬆？' },
  { id: 'Q06', when: ['三溫暖當晚和沒去的晚上睡眠時間差不多'], text: '三溫暖當晚和平常睡得差不多，下週想調整的話可以先試什麼？' },
  { id: 'Q07', when: ['這週平均睡眠比前一週短'], text: '這週平均睡得比前一週短，可以先從哪個習慣開始調整？' },
  { id: 'Q08', when: ['這週平均睡眠比前一週長'], text: '這週平均睡得比前一週長，哪些安排值得繼續維持？' },
  { id: 'Q09', when: ['這週有去三溫暖'], text: '每次三溫暖的時間要維持現在這樣，還是可以調整？' },
  { id: 'Q10', when: ['這週沒有去三溫暖'], text: '這週沒有去三溫暖，下週想恢復的話怎麼安排比較好？' },
  { id: 'Q11', when: [], text: '想把這週的紀錄帶去討論，見面時先看哪一段比較好？' }
]

export function eligibleQuestions(hints) {
  return QUESTION_BANK.filter(q => q.when.every(w => hints.includes(w)))
}
