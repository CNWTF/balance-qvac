// Reviewed questions a person can bring to a health professional. Non-medical, no numbers, no cause-and-effect claims.
// `when` lists the code-computed observations a question fits; an empty list means it always fits.
export const QUESTION_BANK = [
  { id: 'Q01', when: ['三溫暖當晚比沒去的晚上睡得久'], text: '三溫暖當晚睡得比較久，下週的三溫暖要怎麼排進行程？', en: "You slept longer on sauna nights. How should next week's sauna sessions fit into your schedule?" },
  { id: 'Q02', when: ['三溫暖當晚比沒去的晚上睡得久'], text: '沒去三溫暖的晚上睡得比較短，睡前可以先調整哪些習慣？', en: "You slept less on nights without sauna. Which bedtime habits could you adjust first?" },
  { id: 'Q03', when: ['三溫暖當晚比沒去的晚上睡得久'], text: '三溫暖結束到上床之間，怎麼安排比較好？', en: "What is a good routine between finishing the sauna and going to bed?" },
  { id: 'Q04', when: ['三溫暖當晚比沒去的晚上睡得短'], text: '三溫暖當晚睡得比較短，三溫暖的時段要不要提早？', en: "You slept less on sauna nights. Should you go to the sauna earlier in the day?" },
  { id: 'Q05', when: ['三溫暖當晚比沒去的晚上睡得短'], text: '三溫暖當晚睡得比較短，結束後到睡前可以怎麼放鬆？', en: "You slept less on sauna nights. How can you wind down between the sauna and bedtime?" },
  { id: 'Q06', when: ['三溫暖當晚和沒去的晚上睡眠時間差不多'], text: '三溫暖當晚和平常睡得差不多，下週想調整的話可以先試什麼？', en: "Sleep on sauna nights was about the same as usual. What could you try adjusting next week?" },
  { id: 'Q07', when: ['這週平均睡眠比前一週短'], text: '這週平均睡得比前一週短，可以先從哪個習慣開始調整？', en: "You slept less on average than the week before. Which habit could you start adjusting first?" },
  { id: 'Q08', when: ['這週平均睡眠比前一週長'], text: '這週平均睡得比前一週長，哪些安排值得繼續維持？', en: "You slept more on average than the week before. Which routines are worth keeping?" },
  { id: 'Q09', when: ['這週有去三溫暖'], text: '每次三溫暖的時間要維持現在這樣，還是可以調整？', en: "Should each sauna session stay as long as it is now, or change?" },
  { id: 'Q10', when: ['這週沒有去三溫暖'], text: '這週沒有去三溫暖，下週想恢復的話怎麼安排比較好？', en: "You did not go to the sauna this week. How could you ease back in next week?" },
  { id: 'Q11', when: [], text: '想把這週的紀錄帶去討論，見面時先看哪一段比較好？', en: "You want to discuss this week's records. Which part should you look at first together?" }
]

export function eligibleQuestions(hints) {
  return QUESTION_BANK.filter(q => q.when.every(w => hints.includes(w)))
}
