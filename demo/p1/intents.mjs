// 20 recovery-service intents with expected ServiceRequest fields; today is fixed.
export const TODAY_ISO = '2026-10-06'
export const INTENTS = [
  ['這週睡不好，週六晚上想去三溫暖，也想找健康管理師聊聊', { service_type: 'sauna', date: '2026-10-10', time_window: 'evening', needs_professional: true }],
  ['明天早上想去冷泉，自己去就好', { service_type: 'cold_plunge', date: '2026-10-07', time_window: 'morning', needs_professional: false }],
  ['週五下午想按摩，預算1500元以內', { service_type: 'massage', date: '2026-10-09', time_window: 'afternoon', needs_professional: false, max_price_twd: 1500 }],
  ['10月15日晚上幫我約一個健康管理諮詢', { service_type: 'consultation', date: '2026-10-15', time_window: 'evening', needs_professional: true }],
  ['今天晚上想去蒸一下，不超過800', { service_type: 'sauna', date: '2026-10-06', time_window: 'evening', needs_professional: false, max_price_twd: 800 }],
  ['週日早上想做伸展，有教練帶比較好', { service_type: 'stretching', date: '2026-10-11', time_window: 'morning', needs_professional: true }],
  ['後天下午去三溫暖', { service_type: 'sauna', date: '2026-10-08', time_window: 'afternoon', needs_professional: false }],
  ['I want a sauna session this Saturday evening and a chat with a health coach', { service_type: 'sauna', date: '2026-10-10', time_window: 'evening', needs_professional: true }],
  ['下週一晚上冷泉加三溫暖，先訂冷泉', { service_type: 'cold_plunge', date: '2026-10-12', time_window: 'evening', needs_professional: false }],
  ['肩膀很緊，明天下午想按摩', { service_type: 'massage', date: '2026-10-07', time_window: 'afternoon', needs_professional: false }],
  ['週四早上找營養或健康管理的人諮詢一下', { service_type: 'consultation', date: '2026-10-08', time_window: 'morning', needs_professional: true }],
  ['10/20 晚上三溫暖，預算一千', { service_type: 'sauna', date: '2026-10-20', time_window: 'evening', needs_professional: false, max_price_twd: 1000 }],
  ['週六下午伸展課，自己來', { service_type: 'stretching', date: '2026-10-10', time_window: 'afternoon', needs_professional: false }],
  ['最近恢復很差，週五晚上想去三溫暖順便請專業的人看我的紀錄', { service_type: 'sauna', date: '2026-10-09', time_window: 'evening', needs_professional: true }],
  ['明早冷泉，價格不要超過500', { service_type: 'cold_plunge', date: '2026-10-07', time_window: 'morning', needs_professional: false, max_price_twd: 500 }],
  ['Book a massage on Oct 9 afternoon, under 2000 TWD', { service_type: 'massage', date: '2026-10-09', time_window: 'afternoon', needs_professional: false, max_price_twd: 2000 }],
  ['週三晚上想跟健康管理師約諮詢', { service_type: 'consultation', date: '2026-10-07', time_window: 'evening', needs_professional: true }],
  ['今天下午去三溫暖', { service_type: 'sauna', date: '2026-10-06', time_window: 'afternoon', needs_professional: false }],
  ['週日晚上冷泉，想要有人指導', { service_type: 'cold_plunge', date: '2026-10-11', time_window: 'evening', needs_professional: true }],
  ['10月18日早上伸展，預算600', { service_type: 'stretching', date: '2026-10-18', time_window: 'morning', needs_professional: false, max_price_twd: 600 }]
]
