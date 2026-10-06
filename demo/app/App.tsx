// Balance Recovery Agents — three apps from one codebase (personal / professional / venue), all on-device with QVAC.
// The role comes from the installed app id; each role has its own colour. Agents talk over Hyperswarm (no server).
import React, { useEffect, useRef, useState } from 'react'
import { Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native'
import { loadModel, unloadModel, QWEN3_600M_INST_Q4 } from '@qvac/sdk'
import { currentRole, THEME } from './lib/roles'
import { useP2P } from './lib/p2p'
import { UiContext, Lang, T, s, ROLE_COLOR } from './lib/ui'
import UserScreen, { DEFAULT_ASK } from './screens/UserScreen'
import ProScreen from './screens/ProScreen'
import VenueScreen from './screens/VenueScreen'

const MEDPSY = 'https://huggingface.co/qvac/MedPsy-1.7B-GGUF/resolve/main/medpsy-1.7b-q4_k_m-imat.gguf'
const ROLE = currentRole()
const theme = THEME[ROLE]
const AGENT_NAME = { user: '本人 Person', pro: '健康管理師 Coach', venue: '暖森三溫暖 Warmwood' }[ROLE]
// Samsung/Mali GPUs crash in the GPU backend during load (seen on Galaxy A32 5G); QVAC's own config example forces CPU on Samsung.
const cpu = Platform.OS === 'android' ? { device: 'cpu' } : {}
const MODEL = ROLE === 'user' ? { label: 'MedPsy-1.7B', opts: { modelSrc: MEDPSY, modelType: 'llamacpp-completion', modelConfig: { ctx_size: 2048, ...cpu } } }
  : ROLE === 'venue' ? { label: 'Qwen3-0.6B', opts: { modelSrc: QWEN3_600M_INST_Q4, modelConfig: { ctx_size: 2048, parallel: 3, ...cpu } } }
    : null // the professional's agent loads its models on demand (EmbeddingGemma for RAG, Bergamot for translation)

export default function App() {
  const [lang, setLang] = useState<Lang>('both')
  const [status, setStatus] = useState<[string, string]>(['準備中…', 'Starting…'])
  const [pct, setPct] = useState<number | null>(null)
  const [modelId, setModelId] = useState<string | null>(null)
  const [loadMs, setLoadMs] = useState<number | null>(null)
  const [utterance, setUtterance] = useState(DEFAULT_ASK.zh)
  const idRef = useRef<string | null>(null)
  const p2p = useP2P(ROLE, AGENT_NAME, true)

  useEffect(() => {
    if (!MODEL) { setStatus(['模型按需要載入（RAG、翻譯）', 'Models load on demand (RAG, translation)']); return }
    let cancelled = false
    ;(async () => {
      try {
        setStatus([`下載／載入${MODEL.label}…`, `Downloading / loading ${MODEL.label}…`])
        const t0 = Date.now()
        const id = await loadModel({ ...(MODEL.opts as any), onProgress: (p: any) => { if (!cancelled) setPct(Math.round(p.percentage)) } })
        idRef.current = id
        if (cancelled) return
        setPct(null); setLoadMs(Date.now() - t0); setModelId(id)
        setStatus([`${MODEL.label}已在手機上載入`, `${MODEL.label} loaded on this phone`])
      } catch (e: any) { if (!cancelled) setStatus(['錯誤：' + (e?.message ?? String(e)), 'Error: ' + (e?.message ?? String(e))]) }
    })()
    return () => { cancelled = true; if (idRef.current) void unloadModel({ modelId: idRef.current, clearStorage: false }).catch(() => {}) }
  }, [])

  const switchLang = (l: Lang) => {
    setLang(l)
    setUtterance(u => u === DEFAULT_ASK.zh || u === DEFAULT_ASK.en ? (l === 'en' ? DEFAULT_ASK.en : DEFAULT_ASK.zh) : u)
  }

  return (
    <UiContext.Provider value={{ lang, accent: theme.accent, accentText: theme.accentText, soft: theme.soft }}>
      <SafeAreaView style={st.safe}>
        <View style={[st.band, { backgroundColor: theme.accent }]} />
        <ScrollView contentContainerStyle={st.container} keyboardShouldPersistTaps="handled">
          <View style={st.top}>
            <View style={[s.pill, { borderColor: theme.accent }]}><Text style={{ color: theme.accent, fontWeight: '700' }}>{lang === 'en' ? theme.name[1] : theme.name[0]}</Text></View>
            <View style={st.langRow}>
              {(['both', 'zh', 'en'] as Lang[]).map(l => (
                <Pressable key={l} style={[st.langBtn, lang === l && { backgroundColor: theme.accent }]} onPress={() => switchLang(l)}>
                  <Text style={[st.langText, lang === l && { color: theme.accentText }]}>{l === 'both' ? '中英' : l === 'zh' ? '中文' : 'EN'}</Text>
                </Pressable>))}
            </View>
          </View>
          <T zh={`Balance · ${theme.agent[0]}`} en={`Balance · ${theme.agent[1]}`} style={s.h1} />
          <T zh={`QVAC SDK 0.21.0 · ${MODEL?.label ?? 'EmbeddingGemma · Bergamot'} · 全部在這支手機上執行`} en={`QVAC SDK 0.21.0 · ${MODEL?.label ?? 'EmbeddingGemma · Bergamot'} · everything runs on this phone`} style={s.sub} />

          <View style={s.card}>
            <T zh={status[0] + (pct != null ? `（${pct}%）` : '')} en={status[1] + (pct != null ? ` (${pct}%)` : '')} style={s.status} />
            {pct != null && <View style={st.bar}><View style={[st.fill, { width: `${pct}%`, backgroundColor: theme.accent }]} /></View>}
            {loadMs != null && <T zh={`載入耗時 ${(loadMs / 1000).toFixed(1)} 秒`} en={`Load time ${(loadMs / 1000).toFixed(1)} s`} style={s.meta} />}
            <T zh={p2p.ready ? `P2P已上線（Hyperswarm，加密直連）· 我的金鑰 ${p2p.publicKey.slice(0, 8)}` : 'P2P連線中…'} en={p2p.ready ? `P2P online (Hyperswarm, encrypted direct) · my key ${p2p.publicKey.slice(0, 8)}` : 'P2P connecting…'} style={s.meta} />
            <View style={[s.row, { gap: 6 }]}>
              {p2p.peers.length === 0 && p2p.ready && <T zh="尚未發現其他Agent（第一次連線可能要等30秒）" en="No other agents yet (first connection can take ~30 s)" style={s.meta} />}
              {p2p.peers.map((p: any) => <View key={p.publicKey} style={[s.pill, { borderColor: ROLE_COLOR[p.role] ?? '#888' }]}>
                <Text style={{ color: ROLE_COLOR[p.role] ?? '#ccc', fontSize: 12 }}>{p.name} · {p.publicKey.slice(0, 6)}</Text>
              </View>)}
            </View>
            {p2p.error && <Text style={s.warn}>{p2p.error}</Text>}
          </View>

          {ROLE === 'user' && <UserScreen modelId={modelId} p2p={p2p} utterance={utterance} setUtterance={setUtterance} />}
          {ROLE === 'pro' && <ProScreen p2p={p2p} />}
          {ROLE === 'venue' && <VenueScreen modelId={modelId} p2p={p2p} />}
        </ScrollView>
      </SafeAreaView>
    </UiContext.Provider>
  )
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B0B0F', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  band: { height: 4 },
  container: { padding: 16, gap: 10 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  langRow: { flexDirection: 'row', backgroundColor: '#15151C', borderRadius: 8, padding: 3, gap: 3 },
  langBtn: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 6 },
  langText: { color: '#A7A7B3', fontWeight: '600', fontSize: 13 },
  bar: { height: 8, backgroundColor: '#1A1A22', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%' }
})
