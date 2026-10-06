// Balance Recovery Agents — on-device demo (QVAC SDK + MedPsy-1.7B). Everything runs on this phone.
// Bilingual UI: 中英 (both), 中文, or English.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native'
import { loadModel, unloadModel } from '@qvac/sdk'
import { draftServiceRequest } from './lib/intent'
import { buildSummary, factSentences } from './lib/summary'
import { recoveryFacts, factTable, factTableEn, qualitativeHints } from './lib/recovery'
import { pickAndStorePack, loadStoredPack, clearStoredPack, weekEnds } from './lib/pack'

const MODEL_URL = 'https://huggingface.co/qvac/MedPsy-1.7B-GGUF/resolve/main/medpsy-1.7b-q4_k_m-imat.gguf'

// Synthetic week, shown until the person imports their own data.
const DEMO_FACTS = {
  F1: '這週三溫暖3次', F2: '平均每次42分鐘',
  F3: '平均睡眠6小時18分（前一段6小時52分）',
  F4: '三溫暖當晚平均睡眠6小時51分（3晚）', F5: '沒去三溫暖的晚上平均睡眠5小時54分（4晚）'
}
const DEMO_FACTS_EN = {
  F1: 'This week: sauna 3 times', F2: '42 min on average',
  F3: 'Average sleep 6h 18m (previous week 6h 52m)',
  F4: 'Nights after sauna: 6h 51m of sleep on average (3 nights)', F5: 'nights without sauna: 5h 54m (4 nights)'
}
const DEMO_HINTS = ['這週有去三溫暖', '三溫暖當晚比沒去的晚上睡得久', '這週平均睡眠比前一週短']

type Lang = 'both' | 'zh' | 'en'
type Pair = [string, string]

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const md = (iso: string) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`

export default function App() {
  const [lang, setLang] = useState<Lang>('both')
  const [status, setStatus] = useState<Pair>(['準備中…', 'Starting…'])
  const [pct, setPct] = useState<number | null>(null)
  const [modelId, setModelId] = useState<string | null>(null)
  const [loadMs, setLoadMs] = useState<number | null>(null)
  const [data, setData] = useState<any>(null)
  const [week, setWeek] = useState(0)
  const [summary, setSummary] = useState<any>(null)
  const [utterance, setUtterance] = useState('這週睡不好，週六晚上想去三溫暖，也想找健康管理師聊聊')
  const [draft, setDraft] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [decoding, setDecoding] = useState<Pair | null>(null)
  const idRef = useRef<string | null>(null)

  // Text in the selected language(s): Chinese first, English below in a lighter style.
  const T = ({ zh, en, style, enStyle }: { zh: string, en: string, style?: any, enStyle?: any }) => (
    <>
      {lang !== 'en' && <Text style={style}>{zh}</Text>}
      {lang !== 'zh' && <Text style={[style, lang === 'both' && s.enLine, enStyle]}>{en}</Text>}
    </>
  )
  const label = (zh: string, en: string) => lang === 'zh' ? zh : lang === 'en' ? en : `${zh} · ${en}`

  useEffect(() => {
    let cancelled = false
    const onProg = (i: number, n: number) => { if (!cancelled) setDecoding([`正在手機上解碼你的FIT檔…${i}/${n}`, `Decoding your FIT files on this phone… ${i}/${n}`]) }
    loadStoredPack(onProg)
      .then(d => { if (!cancelled && d) setData(d); if (!cancelled) setDecoding(null) })
      .catch((e: any) => { if (!cancelled) setDecoding(['讀取資料失敗：' + (e?.message ?? String(e)), 'Could not read your data: ' + (e?.message ?? String(e))]) })
    ;(async () => {
      try {
        setStatus(['下載／載入MedPsy-1.7B…', 'Downloading / loading MedPsy-1.7B…'])
        const t0 = Date.now()
        const id = await loadModel({
          modelSrc: MODEL_URL,
          modelType: 'llamacpp-completion',
          // Samsung/Mali GPUs crash in the GPU backend during load (seen on Galaxy A32 5G); QVAC's own config example forces CPU on Samsung.
          modelConfig: Platform.OS === 'android' ? { ctx_size: 2048, device: 'cpu' } : { ctx_size: 2048 },
          onProgress: (p: any) => { if (!cancelled) setPct(Math.round(p.percentage)) }
        } as any)
        idRef.current = id
        if (cancelled) return
        setPct(null); setLoadMs(Date.now() - t0); setModelId(id)
        setStatus(['模型已在手機上載入', 'Model loaded on this phone'])
      } catch (e: any) {
        if (!cancelled) setStatus(['錯誤：' + (e?.message ?? String(e)), 'Error: ' + (e?.message ?? String(e))])
      }
    })()
    return () => { cancelled = true; if (idRef.current) void unloadModel({ modelId: idRef.current, clearStorage: false }).catch(() => {}) }
  }, [])

  const ends = useMemo(() => data ? weekEnds(data.range) : [], [data])
  const current = useMemo(() => {
    if (!data || !ends.length) return { facts: DEMO_FACTS, factsEn: DEMO_FACTS_EN, hints: DEMO_HINTS, source: ['示範資料（合成）', 'Demo data (synthetic)'] as Pair }
    const end = ends[Math.min(week, ends.length - 1)]
    const f = recoveryFacts(data.sessions, data.nights, end, 7)
    const range = `${md(f.window.start)}–${md(f.window.end)}`
    return { facts: factTable(f, '這週'), factsEn: factTableEn(f), hints: qualitativeHints(f), source: [`你的Garmin紀錄：${range}`, `Your Garmin records: ${range}`] as Pair }
  }, [data, ends, week])

  const importPack = async () => {
    setBusy(true)
    try {
      const d = await pickAndStorePack((i: number, n: number) => setDecoding([`正在手機上解碼你的FIT檔…${i}/${n}`, `Decoding your FIT files on this phone… ${i}/${n}`]))
      if (d) { setData(d); setWeek(0); setSummary(null) }
    } catch (e: any) { Alert.alert(label('匯入失敗', 'Import failed'), e?.message ?? String(e)) }
    setDecoding(null)
    setBusy(false)
  }
  const removePack = async () => { await clearStoredPack(); setData(null); setSummary(null) }

  const runSummary = async () => {
    if (!modelId) return
    setBusy(true)
    try {
      const r = await buildSummary(modelId, current.facts, current.hints)
      setSummary({ ...r, zh: factSentences(current.facts, 'zh'), en: factSentences(current.factsEn, 'en') })
    } catch (e: any) { setStatus(['摘要錯誤：' + e?.message, 'Summary error: ' + e?.message]) }
    setBusy(false)
  }
  const runDraft = async () => {
    if (!modelId) return
    setBusy(true)
    try { setDraft(await draftServiceRequest(modelId, utterance, todayIso())) } catch (e: any) { setStatus(['請求錯誤：' + e?.message, 'Request error: ' + e?.message]) }
    setBusy(false)
  }
  const step = (d: number) => { setWeek(w => Math.max(0, Math.min(ends.length - 1, w + d))); setSummary(null) }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.langRow}>
          {(['both', 'zh', 'en'] as Lang[]).map(l => (
            <Pressable key={l} style={[s.langBtn, lang === l && s.langOn]} onPress={() => setLang(l)}>
              <Text style={[s.langText, lang === l && s.langTextOn]}>{l === 'both' ? '中英' : l === 'zh' ? '中文' : 'EN'}</Text>
            </Pressable>
          ))}
        </View>
        <T zh="Balance · 本人Agent" en="Balance · Personal Agent" style={s.h1} />
        <T zh="QVAC SDK 0.21.0 · MedPsy-1.7B · 全部在這支手機上執行" en="QVAC SDK 0.21.0 · MedPsy-1.7B · everything runs on this phone" style={s.sub} />

        <View style={s.card}>
          <T zh={status[0] + (pct != null ? `（${pct}%）` : '')} en={status[1] + (pct != null ? ` (${pct}%)` : '')} style={s.status} />
          {pct != null && <View style={s.bar}><View style={[s.fill, { width: `${pct}%` }]} /></View>}
          {loadMs != null && <T zh={`載入耗時 ${(loadMs / 1000).toFixed(1)} 秒`} en={`Load time ${(loadMs / 1000).toFixed(1)} s`} style={s.meta} />}
        </View>

        <View style={s.card}>
          <T zh="我的資料" en="My data" style={s.h2} />
          {decoding && <T zh={decoding[0]} en={decoding[1]} style={s.status} />}
          {data
            ? <T zh={`已匯入：${data.fitCount}個三溫暖FIT檔與${data.nights.length}晚睡眠紀錄，匯入時在手機上解碼耗時${data.decodeMs} ms${data.fromCache ? '（本次開啟沿用解碼結果）' : ''}。資料只存在這支手機。`}
                 en={`Imported ${data.fitCount} sauna FIT files and ${data.nights.length} nights of sleep, decoded on this phone in ${data.decodeMs} ms${data.fromCache ? ' (reused this time)' : ''}. Your data stays on this phone.`} style={s.meta} />
            : <T zh="尚未匯入。選取Balance資料包（.json），FIT檔會在手機上解碼。" en="Nothing imported yet. Pick a Balance data pack (.json); FIT files are decoded on this phone." style={s.meta} />}
          <View style={s.row}>
            <Pressable style={[s.btn2, busy && s.btnOff]} onPress={importPack} disabled={busy}><Text style={s.btn2Text}>{data ? label('重新匯入', 'Re-import') : label('匯入我的Garmin資料', 'Import my Garmin data')}</Text></Pressable>
            {data && <Pressable style={s.btn2} onPress={removePack}><Text style={s.btn2Text}>{label('移除', 'Remove')}</Text></Pressable>}
          </View>
        </View>

        <View style={s.card}>
          <T zh="本週摘要" en="Weekly summary" style={s.h2} />
          <T zh={`${current.source[0]}。數字由程式計算；模型只挑一題請教專業者的問題。`} en={`${current.source[1]}. Numbers are computed by code; the model only picks one question for the professional.`} style={s.meta} />
          {data && ends.length > 1 && <View style={s.row}>
            <Pressable style={[s.btn2, week >= ends.length - 1 && s.btnOff]} onPress={() => step(1)} disabled={week >= ends.length - 1}><Text style={s.btn2Text}>{label('‹ 上一週', '‹ Prev week')}</Text></Pressable>
            <Pressable style={[s.btn2, week === 0 && s.btnOff]} onPress={() => step(-1)} disabled={week === 0}><Text style={s.btn2Text}>{label('下一週 ›', 'Next week ›')}</Text></Pressable>
          </View>}
          <Pressable style={[s.btn, (!modelId || busy) && s.btnOff]} onPress={runSummary} disabled={!modelId || busy}>
            <Text style={s.btnText}>{label('產生摘要', 'Generate summary')}</Text>
          </Pressable>
          {summary && <>
            {/* One sentence per Text: iOS mis-measures long mixed CJK/Latin paragraphs and clips the last line. */}
            {summary.zh.map((zh: string, i: number) => <T key={i} zh={zh} en={summary.en[i]} style={s.body} />)}
            <T zh="想請教專業者：" en="Question for the professional:" style={s.body} />
            <T zh={summary.question} en={summary.questionEn} style={s.question} />
            <Text style={s.meta}>{summary.questionId} · {summary.ms} ms</Text>
          </>}
        </View>

        <View style={s.card}>
          <T zh="說出需求 → BOP服務請求" en="Say what you need → BOP ServiceRequest" style={s.h2} />
          <TextInput style={s.input} value={utterance} onChangeText={setUtterance} multiline />
          <Pressable style={[s.btn, (!modelId || busy) && s.btnOff]} onPress={runDraft} disabled={!modelId || busy}>
            <Text style={s.btnText}>{label('產生服務請求', 'Draft request')}</Text>
          </Pressable>
          {draft && <>
            <Text style={s.mono}>{JSON.stringify(draft.request, null, 2)}</Text>
            <T zh={'來源：' + Object.entries(draft.provenance).map(([k, v]) => `${k}=${v}`).join('、')} en={'Source: ' + Object.entries(draft.provenance).map(([k, v]) => `${k}=${v}`).join(', ')} style={s.meta} />
            <T zh={`${draft.ms} ms${draft.missing.length ? ` · 需要追問：${draft.missing.join('、')}` : ''}`} en={`${draft.ms} ms${draft.missing.length ? ` · needs follow-up: ${draft.missing.join(', ')}` : ''}`} style={s.meta} />
          </>}
        </View>
        {busy && <ActivityIndicator color="#22C55E" />}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B0B0F', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  container: { padding: 16, gap: 10 },
  langRow: { flexDirection: 'row', alignSelf: 'flex-end', backgroundColor: '#15151C', borderRadius: 8, padding: 3, gap: 3 },
  langBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 6 },
  langOn: { backgroundColor: '#22C55E' },
  langText: { color: '#A7A7B3', fontWeight: '600', fontSize: 13 },
  langTextOn: { color: '#0B0B0F' },
  enLine: { color: '#9AA0AE', fontSize: 13 },
  h1: { color: 'white', fontSize: 22, fontWeight: '700' },
  h2: { color: 'white', fontSize: 17, fontWeight: '600' },
  sub: { color: '#A7A7B3', fontSize: 13 },
  card: { backgroundColor: '#15151C', borderRadius: 12, padding: 14, gap: 6 },
  row: { flexDirection: 'row', gap: 8 },
  status: { color: '#E5E5EA', fontSize: 15 },
  meta: { color: '#8E8E99', fontSize: 12 },
  body: { color: 'white', fontSize: 15 },
  question: { color: '#C7F9CC', fontSize: 16, fontWeight: '600' },
  mono: { color: '#C7F9CC', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 },
  input: { color: 'white', backgroundColor: '#0F0F14', borderRadius: 8, padding: 10, fontSize: 15, minHeight: 60 },
  btn: { backgroundColor: '#22C55E', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  btn2: { flex: 1, backgroundColor: '#22232B', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  btn2Text: { color: '#E5E5EA', fontWeight: '600', fontSize: 14 },
  btnOff: { opacity: 0.4 },
  btnText: { color: '#0B0B0F', fontWeight: '700', fontSize: 15 },
  bar: { height: 8, backgroundColor: '#1A1A22', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#22C55E' }
})
