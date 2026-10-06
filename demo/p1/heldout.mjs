// Held-out intents written after the extraction rules were fixed; not used to tune rules or prompts.
export const HELDOUT = [
  ['禮拜五晚上想去烤箱，順便問健康管理師睡眠的事', { service_type: 'sauna', date: '2026-10-09', time_window: 'evening', needs_professional: true }],
  ['明天下午能不能排冷泉？最多700', { service_type: 'cold_plunge', date: '2026-10-07', time_window: 'afternoon', needs_professional: false, max_price_twd: 700 }],
  ['10/25早上想找人幫我做伸展', { service_type: 'stretching', date: '2026-10-25', time_window: 'morning', needs_professional: true }],
  ['下週三下午按摩，兩千以內', { service_type: 'massage', date: '2026-10-14', time_window: 'afternoon', needs_professional: false, max_price_twd: 2000 }],
  ['今晚想泡三溫暖放鬆一下', { service_type: 'sauna', date: '2026-10-06', time_window: 'evening', needs_professional: false }],
  ['Can I get a consultation with a health coach next Friday morning?', { service_type: 'consultation', date: '2026-10-16', time_window: 'morning', needs_professional: true }],
  ['週六早上冷泉，自己去', { service_type: 'cold_plunge', date: '2026-10-10', time_window: 'morning', needs_professional: false }],
  ['11月2日晚上三溫暖，預算九百', { service_type: 'sauna', date: '2026-11-02', time_window: 'evening', needs_professional: false, max_price_twd: 900 }],
  ['後天晚上想跟專業的人聊我的恢復紀錄', { service_type: 'consultation', date: '2026-10-08', time_window: 'evening', needs_professional: true }],
  ['tomorrow evening sauna, under 1200', { service_type: 'sauna', date: '2026-10-07', time_window: 'evening', needs_professional: false, max_price_twd: 1200 }],
  ['週日下午伸展，自己做就好', { service_type: 'stretching', date: '2026-10-11', time_window: 'afternoon', needs_professional: false }],
  ['腰很痠，週四晚上想按摩', { service_type: 'massage', date: '2026-10-08', time_window: 'evening', needs_professional: false }],
  ['明早想約健康管理諮詢', { service_type: 'consultation', date: '2026-10-07', time_window: 'morning', needs_professional: true }],
  ['下週六晚上三溫暖，想要有人帶', { service_type: 'sauna', date: '2026-10-17', time_window: 'evening', needs_professional: true }],
  ['10月9日下午冷泉，不要超過六百', { service_type: 'cold_plunge', date: '2026-10-09', time_window: 'afternoon', needs_professional: false, max_price_twd: 600 }]
]
