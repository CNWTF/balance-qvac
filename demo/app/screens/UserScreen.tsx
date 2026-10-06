// Personal agent (green): own data, weekly summary, voice/photo input, read-aloud, share with a professional,
// ask a venue for a quote, confirm within the delegated budget. Health data never goes to the venue.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Text, TextInput, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useAudioRecorder, RecordingPresets, AudioModule, setAudioModeAsync } from 'expo-audio'
import { T, Card, Btn, Row, KV, s, useUi, useLabel } from '../lib/ui'
import { draftServiceRequest } from '../lib/intent'
import { buildSummary, factSentences } from '../lib/summary'
import { recoveryFacts, factTable, factTableEn, qualitativeHints } from '../lib/recovery'
import { pickAndStorePack, loadStoredPack, clearStoredPack, weekEnds } from '../lib/pack'
import { classifyPhoto, describePhoto, ocrPhoto, transcribeAudio, speak } from '../lib/caps'
import { newId, requestRows, money, looksLikeInstruction, SERVICE_NAME, Pair } from '../lib/bop'

const DEMO_FACTS = { F1: '這週三溫暖3次', F2: '平均每次42分鐘', F3: '平均睡眠6小時18分（前一段6小時52分）', F4: '三溫暖當晚平均睡眠6小時51分（3晚）', F5: '沒去三溫暖的晚上平均睡眠5小時54分（4晚）' }
const DEMO_FACTS_EN = { F1: 'This week: sauna 3 times', F2: '42 min on average', F3: 'Average sleep 6h 18m (previous week 6h 52m)', F4: 'Nights after sauna: 6h 51m of sleep on average (3 nights)', F5: 'nights without sauna: 5h 54m (4 nights)' }
const DEMO_HINTS = ['這週有去三溫暖', '三溫暖當晚比沒去的晚上睡得久', '這週平均睡眠比前一週短']
export const DEFAULT_ASK = { zh: '這週睡不好，週六晚上想去三溫暖，也想找健康管理師聊聊', en: "I slept badly this week. I'd like a sauna on Saturday evening and a chat with a health coach." }
const md = (iso: string) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const FIELD_NAME: Record<string, Pair> = { service_type: ['服務類型', 'service'], date: ['日期', 'date'], time_window: ['時段', 'time of day'], needs_professional: ['是否找專業者', 'whether a professional is needed'], max_price_twd: ['預算', 'budget'] }

export default function UserScreen({ modelId, p2p, utterance, setUtterance }: any) {
  const { lang } = useUi(); const label = useLabel()
  const [data, setData] = useState<any>(null)
  const [decoding, setDecoding] = useState<Pair | null>(null)
  const [week, setWeek] = useState(0)
  const [summary, setSummary] = useState<any>(null)
  const [draft, setDraft] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [photo, setPhoto] = useState<any>(null)
  const [shared, setShared] = useState<any>(null) // case shared with the professional
  const [proReply, setProReply] = useState<any>(null)
  const [quote, setQuote] = useState<any>(null)
  const [order, setOrder] = useState<any>(null)
  const [recording, setRecording] = useState(false)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const caseId = useRef(newId())

  useEffect(() => {
    loadStoredPack((i: number, n: number) => setDecoding([`正在手機上解碼你的FIT檔…${i}/${n}`, `Decoding your FIT files on this phone… ${i}/${n}`]))
      .then(d => { if (d) setData(d); setDecoding(null) }).catch(() => setDecoding(null))
  }, [])

  useEffect(() => {
    p2p.onMessage((m: any) => {
      const k = m.msg.kind
      if (k === 'pro_reply') setProReply({ ...m.msg, fromName: m.fromName, from: m.from })
      if (k === 'quote') setQuote({ ...m.msg, fromName: m.fromName, from: m.from })
      if (k === 'order' || k === 'decline') setOrder({ ...m.msg, fromName: m.fromName })
    })
  }, [p2p.ready])

  const ends = useMemo(() => data ? weekEnds(data.range) : [], [data])
  const current = useMemo(() => {
    if (!data || !ends.length) return { facts: DEMO_FACTS, factsEn: DEMO_FACTS_EN, hints: DEMO_HINTS, source: ['示範資料（合成）', 'Demo data (synthetic)'] as Pair, range: '' }
    const end = ends[Math.min(week, ends.length - 1)]
    const f = recoveryFacts(data.sessions, data.nights, end, 7)
    const range = `${md(f.window.start)}–${md(f.window.end)}`
    return { facts: factTable(f, '這週'), factsEn: factTableEn(f), hints: qualitativeHints(f), source: [`你的Garmin紀錄：${range}`, `Your Garmin records: ${range}`] as Pair, range }
  }, [data, ends, week])

  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn() } catch (e: any) { Alert.alert(label('發生錯誤', 'Error'), String(e?.message ?? e)) } setBusy(null) }

  const importPack = () => run('import', async () => {
    const d = await pickAndStorePack((i: number, n: number) => setDecoding([`正在手機上解碼你的FIT檔…${i}/${n}`, `Decoding your FIT files on this phone… ${i}/${n}`]))
    if (d) { setData(d); setWeek(0); setSummary(null) }
    setDecoding(null)
  })
  const runSummary = () => run('summary', async () => {
    const r = await buildSummary(modelId, current.facts, current.hints)
    setSummary({ ...r, zh: factSentences(current.facts, 'zh'), en: factSentences(current.factsEn, 'en') })
  })
  const runDraft = () => run('draft', async () => setDraft(await draftServiceRequest(modelId, utterance, todayIso())))

  const toggleRecord = () => run('voice', async () => {
    if (!recording) {
      const p = await AudioModule.requestRecordingPermissionsAsync()
      if (!p.granted) throw new Error(label('沒有麥克風權限', 'Microphone permission denied'))
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync(); recorder.record(); setRecording(true)
    } else {
      await recorder.stop(); setRecording(false)
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
      const { r } = await transcribeAudio(recorder.uri!, lang === 'en' ? 'en' : 'zh')
      if (r) setUtterance(r)
    }
  })

  const takePhoto = (camera: boolean) => run('photo', async () => {
    const pick = camera ? await ImagePicker.launchCameraAsync({ quality: 0.7 }) : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
    if (pick.canceled) return
    const uri = pick.assets[0].uri
    setPhoto({ uri, step: 'classify' })
    const c = await classifyPhoto(uri)
    const top = [...c.r].sort((a: any, b: any) => b.confidence - a.confidence)[0]
    setPhoto({ uri, label: top.label, conf: top.confidence, classifyMs: c.ms, step: top.label === 'report' ? 'ocr' : 'vision' })
    if (top.label === 'report') {
      const o = await ocrPhoto(uri)
      setPhoto((p: any) => ({ ...p, step: 'done', text: o.r.slice(0, 20).join(' '), ms: o.ms, kind: 'ocr' }))
    } else {
      const v = await describePhoto(uri, lang === 'en' ? 'en' : 'zh')
      setPhoto((p: any) => ({ ...p, step: 'done', text: v.r, ms: v.ms, kind: 'vision' }))
    }
  })

  const readAloud = (ttsLang: 'en' | 'ja') => run('tts', async () => {
    const text = ttsLang === 'ja'
      ? '今週のまとめです。サウナの夜は、行かなかった夜より長く眠れました。専門家に相談しましょう。'
      : summary ? [...summary.en, 'Question for the professional: ' + summary.questionEn].join(' ') : 'Please generate the weekly summary first.'
    await speak(text, ttsLang)
  })

  const shareWithPro = () => run('share', async () => {
    const msg = { kind: 'service_request', id: caseId.current, request: draft?.request ?? null, share: { range: current.range, zh: summary?.zh ?? [], en: summary?.en ?? [], questionZh: summary?.question, questionEn: summary?.questionEn }, consent: { scope: ['weekly_summary', 'question'], expiresInDays: 7 } }
    const n = await p2p.send(msg, 'pro')
    if (!n) throw new Error(label('目前沒有連上專業者Agent', 'No professional agent is connected'))
    setShared({ at: Date.now(), revoked: false })
  })
  const revoke = () => run('revoke', async () => { await p2p.send({ kind: 'revoke', id: caseId.current }, 'pro'); setShared((x: any) => ({ ...x, revoked: true })) })
  const askVenue = () => run('quote', async () => {
    const r = draft.request
    const n = await p2p.send({ kind: 'quote_request', id: caseId.current, request: { service_type: r.service_type, date: r.date, time_window: r.time_window, max_price_twd: r.max_price_twd ?? null } }, 'venue')
    if (!n) throw new Error(label('目前沒有連上場館Agent', 'No venue agent is connected'))
    setQuote({ waiting: true })
  })
  const confirmOffer = (o: any) => run('confirm', async () => {
    await p2p.send({ kind: 'confirm', id: caseId.current, slot: o.slot, price: o.price, receipt: { approvedBy: 'user', at: Date.now() } }, 'venue')
  })

  const budget = draft?.request?.max_price_twd
  const injected = quote && (looksLikeInstruction(quote.venue?.descZh) || looksLikeInstruction(quote.venue?.descEn) || looksLikeInstruction(quote.replyZh))

  return <>
    <Card>
      <T zh="我的資料" en="My data" style={s.h2} />
      {decoding && <T zh={decoding[0]} en={decoding[1]} style={s.status} />}
      {data
        ? <T zh={`已匯入：${data.fitCount}個三溫暖FIT檔與${data.nights.length}晚睡眠紀錄，匯入時在手機上解碼耗時${data.decodeMs} ms。資料只存在這支手機。`} en={`Imported ${data.fitCount} sauna FIT files and ${data.nights.length} nights of sleep, decoded on this phone in ${data.decodeMs} ms. Your data stays on this phone.`} style={s.meta} />
        : <T zh="尚未匯入。選取Balance資料包（.json），FIT檔會在手機上解碼。" en="Nothing imported yet. Pick a Balance data pack (.json); FIT files are decoded on this phone." style={s.meta} />}
      <Row>
        <Btn kind="secondary" zh={data ? '重新匯入' : '匯入我的Garmin資料'} en={data ? 'Re-import' : 'Import my Garmin data'} onPress={importPack} busy={busy === 'import'} />
        {data && <Btn kind="secondary" zh="移除" en="Remove" onPress={async () => { await clearStoredPack(); setData(null); setSummary(null) }} />}
      </Row>
    </Card>

    <Card>
      <T zh="本週摘要" en="Weekly summary" style={s.h2} />
      <T zh={`${current.source[0]}。數字由程式計算；模型只挑一題請教專業者的問題。`} en={`${current.source[1]}. Numbers are computed by code; the model only picks one question for the professional.`} style={s.meta} />
      {data && ends.length > 1 && <Row>
        <Btn kind="secondary" zh="‹ 上一週" en="‹ Prev week" onPress={() => { setWeek(w => Math.min(ends.length - 1, w + 1)); setSummary(null) }} disabled={week >= ends.length - 1} />
        <Btn kind="secondary" zh="下一週 ›" en="Next week ›" onPress={() => { setWeek(w => Math.max(0, w - 1)); setSummary(null) }} disabled={week === 0} />
      </Row>}
      <Btn zh="產生摘要" en="Generate summary" onPress={runSummary} disabled={!modelId} busy={busy === 'summary'} />
      {summary && <>
        {summary.zh.map((zh: string, i: number) => <T key={i} zh={zh} en={summary.en[i]} style={s.body} />)}
        <T zh="想請教專業者：" en="Question for the professional:" style={s.body} />
        <T zh={summary.question} en={summary.questionEn} style={s.question} />
        <Text style={s.meta}>{summary.questionId} · {summary.ms} ms</Text>
        <Row>
          <Btn kind="secondary" zh="🔊 英文朗讀" en="🔊 Read in English" onPress={() => readAloud('en')} busy={busy === 'tts'} />
          <Btn kind="secondary" zh="🔊 日文朗讀" en="🔊 Read in Japanese" onPress={() => readAloud('ja')} busy={busy === 'tts'} />
        </Row>
        <T zh="朗讀用QVAC Supertonic在手機上合成；這個尺寸的語音模型沒有中文。" en="Read-aloud is synthesized on this phone with QVAC Supertonic; this model size has no Chinese voice." style={s.meta} />
      </>}
    </Card>

    <Card>
      <T zh="📷 拍照記錄" en="📷 Photo log" style={s.h2} />
      <T zh="先分類（食物／報告／其他）：食物用VisionPsy描述，報告用OCR讀字。都在手機上跑。" en="Classified first (food / report / other): food is described by VisionPsy, reports are read by OCR. All on this phone." style={s.meta} />
      <Row>
        <Btn kind="secondary" zh="拍照" en="Camera" onPress={() => takePhoto(true)} busy={busy === 'photo'} />
        <Btn kind="secondary" zh="從相簿選" en="From library" onPress={() => takePhoto(false)} busy={busy === 'photo'} />
      </Row>
      {photo && <>
        {photo.label && <T zh={`分類：${{ food: '食物', report: '報告', other: '其他' }[photo.label as 'food']}（${Math.round(photo.conf * 100)}%，${photo.classifyMs} ms）`} en={`Class: ${photo.label} (${Math.round(photo.conf * 100)}%, ${photo.classifyMs} ms)`} style={s.meta} />}
        {photo.step !== 'done' && <T zh={photo.step === 'ocr' ? '正在讀取文字…' : photo.step === 'vision' ? 'VisionPsy正在看照片…' : '正在分類…'} en={photo.step === 'ocr' ? 'Reading text…' : photo.step === 'vision' ? 'VisionPsy is looking at the photo…' : 'Classifying…'} style={s.status} />}
        {photo.text && <Text style={s.body}>{photo.text}</Text>}
        {photo.ms && <T zh={`${photo.kind === 'ocr' ? 'OCR' : 'VisionPsy'}在手機上耗時 ${(photo.ms / 1000).toFixed(1)} 秒`} en={`${photo.kind === 'ocr' ? 'OCR' : 'VisionPsy'} on this phone: ${(photo.ms / 1000).toFixed(1)} s`} style={s.meta} />}
      </>}
    </Card>

    <Card>
      <T zh="說出需求 → BOP服務請求" en="Say what you need → BOP ServiceRequest" style={s.h2} />
      <TextInput style={s.input} value={utterance} onChangeText={setUtterance} multiline />
      <Row>
        <Btn kind="secondary" zh={recording ? '■ 停止並辨識' : '🎤 用說的'} en={recording ? '■ Stop & transcribe' : '🎤 Speak'} onPress={toggleRecord} busy={busy === 'voice' && !recording} />
        <Btn zh="產生服務請求" en="Draft request" onPress={runDraft} disabled={!modelId} busy={busy === 'draft'} />
      </Row>
      {draft && <>
        <KV rows={requestRows(draft.request)} />
        <T zh={`在這支手機上處理，耗時 ${(draft.ms / 1000).toFixed(1)} 秒`} en={`Processed on this phone in ${(draft.ms / 1000).toFixed(1)} s`} style={s.meta} />
        {draft.missing.length > 0 && <T zh={`還需要跟你確認：${draft.missing.map((k: string) => FIELD_NAME[k][0]).join('、')}`} en={`Still needs your confirmation: ${draft.missing.map((k: string) => FIELD_NAME[k][1]).join(', ')}`} style={s.warn} />}
      </>}
    </Card>

    <Card tint>
      <T zh="交給Agent網路" en="Hand off to the agent network" style={s.h2} />
      <T zh="摘要只送給專業者，而且要你同意；場館只會收到服務、日期、時段和預算。" en="The summary goes only to the professional, with your consent; the venue only gets service, date, time and budget." style={s.meta} />
      <Row>
        <Btn zh="同意分享給專業者" en="Share with professional" onPress={shareWithPro} disabled={!summary} busy={busy === 'share'} />
        {shared && !shared.revoked && <Btn kind="secondary" zh="撤回分享" en="Revoke" onPress={revoke} busy={busy === 'revoke'} />}
      </Row>
      {shared && <T zh={shared.revoked ? '已撤回：專業者那邊看不到摘要了。' : '已分享，等待專業者回覆。'} en={shared.revoked ? 'Revoked: the professional can no longer see the summary.' : 'Shared. Waiting for the professional.'} style={shared.revoked ? s.warn : s.good} />}
      {proReply && <View style={{ gap: 4 }}>
        <T zh={`專業者 ${proReply.fromName ?? ''} 承接了：`} en={`Professional ${proReply.fromName ?? ''} accepted:`} style={s.good} />
        <T zh={proReply.noteZh} en={proReply.noteEn} style={s.body} />
      </View>}
      <Btn zh="向場館詢價" en="Ask the venue for a quote" onPress={askVenue} disabled={!draft} busy={busy === 'quote'} />
      {quote?.waiting && <T zh="已送出，等待場館回覆。" en="Sent. Waiting for the venue." style={s.meta} />}
      {quote && !quote.waiting && <View style={{ gap: 6 }}>
        <T zh={`${quote.venue?.nameZh ?? '場館'} 回覆：`} en={`${quote.venue?.nameEn ?? 'Venue'} replied:`} style={s.status} />
        {quote.replyZh && <T zh={quote.replyZh} en={quote.replyEn ?? ''} style={s.body} />}
        {injected && <T zh="⚠ 場館訊息裡有像指令的文字，已當作資料處理、不執行；你的健康資料不會送給場館。" en="⚠ The venue's message contains instruction-like text. It is treated as data and not executed; your health data is never sent to the venue." style={s.warn} />}
        {(quote.offers ?? []).map((o: any, i: number) => {
          const over = budget != null && o.price > budget
          return <View key={i} style={{ gap: 4 }}>
            <KV rows={[[['時段', 'Slot'], [o.slot, o.slot]], [['價格', 'Price'], money(o.price)], [['剩餘名額', 'Places left'], [String(o.left), String(o.left)]]]} />
            {over
              ? <T zh={`⏸ 超過你設定的預算上限（NT$${budget}），Agent停下來等你決定。`} en={`⏸ Above your budget limit (NT$${budget}). The agent stopped and is waiting for you.`} style={s.warn} />
              : null}
            <Btn kind={over ? 'secondary' : 'primary'} zh={over ? '我仍要預約這個時段' : '確認預約這個時段'} en={over ? 'Book this slot anyway' : 'Confirm this slot'} onPress={() => confirmOffer(o)} busy={busy === 'confirm'} />
          </View>
        })}
      </View>}
      {order && <T zh={order.kind === 'order' ? `✅ 訂單成立：${order.orderNo}，${SERVICE_NAME[order.service]?.[0] ?? ''} ${order.slot}，NT$${order.price}。場館容量已由場館手機確認。` : `場館無法承接：${order.reasonZh}`} en={order.kind === 'order' ? `✅ Booked: ${order.orderNo}, ${SERVICE_NAME[order.service]?.[1] ?? ''} ${order.slot}, NT$${order.price}. Capacity was committed on the venue's phone.` : `The venue declined: ${order.reasonEn}`} style={order.kind === 'order' ? s.good : s.warn} />}
    </Card>
  </>
}
