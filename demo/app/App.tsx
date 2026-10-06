// Balance Recovery Agents — on-device demo (QVAC SDK + MedPsy-1.7B). Everything runs on this phone.
import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native'
import { loadModel, unloadModel } from '@qvac/sdk'
import { draftServiceRequest } from './lib/intent'
import { buildSummary } from './lib/summary'

const MODEL_URL = 'https://huggingface.co/qvac/MedPsy-1.7B-GGUF/resolve/main/medpsy-1.7b-q4_k_m-imat.gguf'

// Synthetic week until real-data display is approved.
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

export default function App() {
  const [status, setStatus] = useState('準備中…')
  const [pct, setPct] = useState<number | null>(null)
  const [modelId, setModelId] = useState<string | null>(null)
  const [loadMs, setLoadMs] = useState<number | null>(null)
  const [summary, setSummary] = useState<{ text: string, ms: number, questionId: string } | null>(null)
  const [utterance, setUtterance] = useState('這週睡不好，週六晚上想去三溫暖，也想找健康管理師聊聊')
  const [draft, setDraft] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const idRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setStatus('下載／載入MedPsy-1.7B…')
        const t0 = Date.now()
        const id = await loadModel({
          modelSrc: MODEL_URL,
          modelType: 'llamacpp-completion',
          modelConfig: { ctx_size: 2048 },
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

  const runSummary = async () => {
    if (!modelId) return
    setBusy(true)
    try { setSummary(await buildSummary(modelId, DEMO_FACTS, DEMO_HINTS)) } catch (e: any) { setStatus('摘要錯誤：' + e?.message) }
    setBusy(false)
  }
  const runDraft = async () => {
    if (!modelId) return
    setBusy(true)
    try { setDraft(await draftServiceRequest(modelId, utterance, todayIso())) } catch (e: any) { setStatus('請求錯誤：' + e?.message) }
    setBusy(false)
  }

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
          <Text style={s.h2}>本週摘要</Text>
          <Text style={s.meta}>示範資料（合成）。數字由程式計算；模型只挑一題請教專業者的問題。</Text>
          <Pressable style={[s.btn, (!modelId || busy) && s.btnOff]} onPress={runSummary} disabled={!modelId || busy}>
            <Text style={s.btnText}>產生摘要</Text>
          </Pressable>
          {summary && <>
            <Text style={s.body}>{summary.text}</Text>
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
  status: { color: '#E5E5EA', fontSize: 15 },
  meta: { color: '#8E8E99', fontSize: 12 },
  body: { color: 'white', fontSize: 15, lineHeight: 22 },
  mono: { color: '#C7F9CC', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 },
  input: { color: 'white', backgroundColor: '#0F0F14', borderRadius: 8, padding: 10, fontSize: 15, minHeight: 60 },
  btn: { backgroundColor: '#22C55E', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  btnOff: { opacity: 0.4 },
  btnText: { color: '#0B0B0F', fontWeight: '700', fontSize: 15 },
  bar: { height: 8, backgroundColor: '#1A1A22', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#22C55E' }
})
