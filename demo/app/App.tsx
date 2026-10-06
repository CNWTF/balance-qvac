// Balance Recovery Agents — on-device demo (QVAC SDK + MedPsy-1.7B). Everything runs on this phone.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native'
import { loadModel, unloadModel } from '@qvac/sdk'
import { draftServiceRequest } from './lib/intent'
import { buildSummary } from './lib/summary'
import { recoveryFacts, factTable, qualitativeHints } from './lib/recovery'
import { pickAndStorePack, loadStoredPack, clearStoredPack, weekEnds } from './lib/pack'

const MODEL_URL = 'https://huggingface.co/qvac/MedPsy-1.7B-GGUF/resolve/main/medpsy-1.7b-q4_k_m-imat.gguf'

// Synthetic week, shown until the person imports their own data.
const DEMO_FACTS = {
  F1: '這週三溫暖3次', F2: '平均每次42分鐘',
  F3: '平均睡眠6小時18分（前一段6小時52分）',
  F4: '三溫暖當晚平均睡眠6小時51分（3晚）', F5: '沒去三溫暖的晚上平均睡眠5小時54分（4晚）'
}
const DEMO_HINTS = ['這週有去三溫暖', '三溫暖當晚比沒去的晚上睡得久', '這週平均睡眠比前一週短']

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const md = (iso: string) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`

export default function App() {
  const [status, setStatus] = useState('準備中…')
  const [pct, setPct] = useState<number | null>(null)
  const [modelId, setModelId] = useState<string | null>(null)
  const [loadMs, setLoadMs] = useState<number | null>(null)
  const [data, setData] = useState<any>(null)
  const [week, setWeek] = useState(0)
  const [summary, setSummary] = useState<{ body: string, question: string, ms: number, questionId: string } | null>(null)
  const [utterance, setUtterance] = useState('這週睡不好，週六晚上想去三溫暖，也想找健康管理師聊聊')
  const [draft, setDraft] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const idRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadStoredPack().then(d => { if (!cancelled && d) setData(d) }).catch(() => {})
    ;(async () => {
      try {
        setStatus('下載／載入MedPsy-1.7B…')
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
        setStatus('模型已在手機上載入')
      } catch (e: any) {
        if (!cancelled) setStatus('錯誤：' + (e?.message ?? String(e)))
      }
    })()
    return () => { cancelled = true; if (idRef.current) void unloadModel({ modelId: idRef.current, clearStorage: false }).catch(() => {}) }
  }, [])

  const ends = useMemo(() => data ? weekEnds(data.range) : [], [data])
  const current = useMemo(() => {
    if (!data || !ends.length) return { facts: DEMO_FACTS, hints: DEMO_HINTS, label: '示範資料（合成）' }
    const end = ends[Math.min(week, ends.length - 1)]
    const f = recoveryFacts(data.sessions, data.nights, end, 7)
    return { facts: factTable(f, '這週'), hints: qualitativeHints(f), label: `你的Garmin紀錄：${md(f.window.start)}–${md(f.window.end)}` }
  }, [data, ends, week])

  const importPack = async () => {
    setBusy(true)
    try {
      const d = await pickAndStorePack()
      if (d) { setData(d); setWeek(0); setSummary(null) }
    } catch (e: any) { Alert.alert('匯入失敗', e?.message ?? String(e)) }
    setBusy(false)
  }
  const removePack = async () => { await clearStoredPack(); setData(null); setSummary(null) }

  const runSummary = async () => {
    if (!modelId) return
    setBusy(true)
    try { setSummary(await buildSummary(modelId, current.facts, current.hints)) } catch (e: any) { setStatus('摘要錯誤：' + e?.message) }
    setBusy(false)
  }
  const runDraft = async () => {
    if (!modelId) return
    setBusy(true)
    try { setDraft(await draftServiceRequest(modelId, utterance, todayIso())) } catch (e: any) { setStatus('請求錯誤：' + e?.message) }
    setBusy(false)
  }
  const step = (d: number) => { setWeek(w => Math.max(0, Math.min(ends.length - 1, w + d))); setSummary(null) }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.h1}>Balance · 本人Agent</Text>
        <Text style={s.sub}>QVAC SDK 0.21.0 · MedPsy-1.7B · 全部在這支手機上執行</Text>
        <View style={s.card}>
          <Text style={s.status}>{status}{pct != null ? `（${pct}%）` : ''}</Text>
          {pct != null && <View style={s.bar}><View style={[s.fill, { width: `${pct}%` }]} /></View>}
          {loadMs != null && <Text style={s.meta}>載入耗時 {(loadMs / 1000).toFixed(1)} 秒</Text>}
        </View>

        <View style={s.card}>
          <Text style={s.h2}>我的資料</Text>
          {data
            ? <Text style={s.meta}>已匯入：{data.fitCount}個三溫暖FIT檔與{data.nights.length}晚睡眠紀錄，匯入時在手機上解碼耗時{data.decodeMs} ms{data.fromCache ? '（本次開啟沿用解碼結果）' : ''}。資料只存在這支手機。</Text>
            : <Text style={s.meta}>尚未匯入。選取Balance資料包（.json），FIT檔會在手機上解碼。</Text>}
          <View style={s.row}>
            <Pressable style={[s.btn2, busy && s.btnOff]} onPress={importPack} disabled={busy}><Text style={s.btn2Text}>{data ? '重新匯入' : '匯入我的Garmin資料'}</Text></Pressable>
            {data && <Pressable style={s.btn2} onPress={removePack}><Text style={s.btn2Text}>移除</Text></Pressable>}
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.h2}>本週摘要</Text>
          <Text style={s.meta}>{current.label}。數字由程式計算；模型只挑一題請教專業者的問題。</Text>
          {data && ends.length > 1 && <View style={s.row}>
            <Pressable style={[s.btn2, week >= ends.length - 1 && s.btnOff]} onPress={() => step(1)} disabled={week >= ends.length - 1}><Text style={s.btn2Text}>‹ 上一週</Text></Pressable>
            <Pressable style={[s.btn2, week === 0 && s.btnOff]} onPress={() => step(-1)} disabled={week === 0}><Text style={s.btn2Text}>下一週 ›</Text></Pressable>
          </View>}
          <Pressable style={[s.btn, (!modelId || busy) && s.btnOff]} onPress={runSummary} disabled={!modelId || busy}>
            <Text style={s.btnText}>產生摘要</Text>
          </Pressable>
          {summary && <>
            <Text style={s.body}>{summary.body}</Text>
            <Text style={s.body}>想請教專業者：</Text>
            <Text style={s.question}>{summary.question}</Text>
            <Text style={s.meta}>{summary.questionId} · {summary.ms} ms</Text>
          </>}
        </View>

        <View style={s.card}>
          <Text style={s.h2}>說出需求 → BOP服務請求</Text>
          <TextInput style={s.input} value={utterance} onChangeText={setUtterance} multiline />
          <Pressable style={[s.btn, (!modelId || busy) && s.btnOff]} onPress={runDraft} disabled={!modelId || busy}>
            <Text style={s.btnText}>產生服務請求</Text>
          </Pressable>
          {draft && <>
            <Text style={s.mono}>{JSON.stringify(draft.request, null, 2)}</Text>
            <Text style={s.meta}>來源：{Object.entries(draft.provenance).map(([k, v]) => `${k}=${v}`).join('、')}</Text>
            <Text style={s.meta}>{draft.ms} ms{draft.missing.length ? ` · 需要追問：${draft.missing.join('、')}` : ''}</Text>
          </>}
        </View>
        {busy && <ActivityIndicator color="#22C55E" />}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B0B0F', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  container: { padding: 16, gap: 12 },
  h1: { color: 'white', fontSize: 22, fontWeight: '700' },
  h2: { color: 'white', fontSize: 17, fontWeight: '600' },
  sub: { color: '#A7A7B3', fontSize: 13 },
  card: { backgroundColor: '#15151C', borderRadius: 12, padding: 14, gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  status: { color: '#E5E5EA', fontSize: 15 },
  meta: { color: '#8E8E99', fontSize: 12 },
  body: { color: 'white', fontSize: 15, lineHeight: 24 },
  question: { color: '#C7F9CC', fontSize: 16, lineHeight: 26, fontWeight: '600' },
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
