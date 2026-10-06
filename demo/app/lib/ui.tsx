// Shared bilingual UI pieces. Lang: 'both' shows Chinese with English below; 'zh' or 'en' shows one.
import React, { createContext, useContext } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native'

export type Lang = 'both' | 'zh' | 'en'
export const UiContext = createContext<{ lang: Lang, accent: string, accentText: string, soft: string }>({ lang: 'both', accent: '#22C55E', accentText: '#0B0B0F', soft: '#12261A' })
export const useUi = () => useContext(UiContext)

export function T({ zh, en, style }: { zh: string, en: string, style?: any }) {
  const { lang } = useUi()
  return <>
    {lang !== 'en' && <Text style={style}>{zh}</Text>}
    {lang !== 'zh' && <Text style={[style, lang === 'both' && s.enLine]}>{en}</Text>}
  </>
}
export function useLabel() {
  const { lang } = useUi()
  return (zh: string, en: string) => lang === 'zh' || zh === en ? zh : lang === 'en' ? en : `${zh} · ${en}`
}

export function Card({ children, tint }: { children: any, tint?: boolean }) {
  const { soft } = useUi()
  return <View style={[s.card, tint && { backgroundColor: soft }]}>{children}</View>
}

export function Btn({ zh, en, onPress, disabled, kind = 'primary', busy }: { zh: string, en: string, onPress: () => void, disabled?: boolean, kind?: 'primary' | 'secondary', busy?: boolean }) {
  const { accent, accentText } = useUi()
  const label = useLabel()
  const primary = kind === 'primary'
  return <Pressable onPress={onPress} disabled={disabled || busy}
    style={[primary ? [s.btn, { backgroundColor: accent }] : s.btn2, (disabled || busy) && s.off]}>
    {busy ? <ActivityIndicator color={primary ? accentText : '#E5E5EA'} /> : <Text style={primary ? [s.btnText, { color: accentText }] : s.btn2Text}>{label(zh, en)}</Text>}
  </Pressable>
}

export function Row({ children }: { children: any }) { return <View style={s.row}>{children}</View> }

export function KV({ rows }: { rows: [[string, string], [string, string]][] }) {
  const { lang } = useUi()
  const label = useLabel()
  return <View style={s.kvBox}>{rows.map(([k, v], i) => (
    <View key={i} style={s.kvRow}>
      <Text style={s.kvKey}>{label(k[0], k[1])}</Text>
      <Text style={s.kvVal}>{lang === 'en' ? v[1] : lang === 'zh' || v[0] === v[1] ? v[0] : `${v[0]}  ${v[1]}`}</Text>
    </View>))}</View>
}

export const ROLE_COLOR: Record<string, string> = { user: '#22C55E', pro: '#3B82F6', venue: '#F59E0B' }

export const s = StyleSheet.create({
  enLine: { color: '#9AA0AE', fontSize: 13 },
  h1: { color: 'white', fontSize: 22, fontWeight: '700' },
  h2: { color: 'white', fontSize: 17, fontWeight: '600' },
  sub: { color: '#A7A7B3', fontSize: 13 },
  card: { backgroundColor: '#15151C', borderRadius: 12, padding: 14, gap: 6 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  status: { color: '#E5E5EA', fontSize: 15 },
  meta: { color: '#8E8E99', fontSize: 12 },
  body: { color: 'white', fontSize: 15 },
  warn: { color: '#FBBF24', fontSize: 14, fontWeight: '600' },
  good: { color: '#86EFAC', fontSize: 14, fontWeight: '600' },
  question: { color: '#C7F9CC', fontSize: 16, fontWeight: '600' },
  mono: { color: '#C7F9CC', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12 },
  input: { color: 'white', backgroundColor: '#0F0F14', borderRadius: 8, padding: 10, fontSize: 15, minHeight: 56 },
  btn: { borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', flexGrow: 1 },
  btn2: { flexGrow: 1, backgroundColor: '#22232B', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' },
  btn2Text: { color: '#E5E5EA', fontWeight: '600', fontSize: 14 },
  btnText: { fontWeight: '700', fontSize: 15 },
  off: { opacity: 0.4 },
  kvBox: { backgroundColor: '#0F0F14', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 12 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2A2B33', gap: 12 },
  kvKey: { color: '#9AA0AE', fontSize: 14 },
  kvVal: { color: 'white', fontSize: 14, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  pill: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10, borderWidth: 1 }
})
