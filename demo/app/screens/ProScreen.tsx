// Professional agent (blue): receives cases a person chose to share, searches its own knowledge base on the phone
// (EmbeddingGemma + QVAC RAG), drafts a reply the professional edits and approves; machine translation for English.
import React, { useEffect, useState } from 'react'
import { Alert, Text, TextInput, View } from 'react-native'
import { T, Card, Btn, Row, KV, s, useLabel } from '../lib/ui'
import { kbSearch, translateText } from '../lib/caps'
import { requestRows } from '../lib/bop'

// Domain terms the on-device NMT model does not know; mapped before translation.
const GLOSSARY: [RegExp, string][] = [[/三溫暖/g, '桑拿'], [/冷泉/g, '冷水池'], [/健康管理師/g, '健康教練'], [/專業者/g, '教練']]

export default function ProScreen({ p2p }: any) {
  const label = useLabel()
  const [cases, setCases] = useState<any[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [hits, setHits] = useState<any>(null)
  const [noteZh, setNoteZh] = useState('')
  const [noteEn, setNoteEn] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    p2p.onMessage((m: any) => {
      if (m.msg.kind === 'service_request') setCases(c => [{ ...m.msg, from: m.from, fromName: m.fromName, at: m.at, revoked: false, done: false }, ...c.filter(x => x.id !== m.msg.id)])
      if (m.msg.kind === 'revoke') setCases(c => c.map(x => x.id === m.msg.id ? { ...x, revoked: true, share: null } : x))
    })
  }, [p2p.ready])

  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn() } catch (e: any) { Alert.alert(label('發生錯誤', 'Error'), String(e?.message ?? e)) } setBusy(null) }
  const c = cases.find(x => x.id === openId)

  const findGuidance = () => run('rag', async () => {
    const q = [c.share?.questionZh, ...(c.share?.zh ?? [])].filter(Boolean).join(' ')
    const r = await kbSearch(q, 3)
    setHits(r)
  })
  const useHit = (h: any) => { setNoteZh(n => (n ? n + '\n' : '') + h.zh); setNoteEn(n => (n ? n + '\n' : '') + h.en) }
  const translate = () => run('nmt', async () => {
    let text = noteZh; for (const [re, rep] of GLOSSARY) text = text.replace(re, rep)
    const r = await translateText(text, 'zh', 'en'); setNoteEn(r.r)
  })
  const accept = () => run('accept', async () => {
    const n = await p2p.send({ kind: 'pro_reply', id: c.id, decision: 'accept', noteZh, noteEn: noteEn || noteZh }, 'user', c.from)
    if (!n) throw new Error(label('本人Agent目前不在線上，回覆沒有送出', 'The personal agent is offline; the reply was not sent'))
    setCases(cs => cs.map(x => x.id === c.id ? { ...x, done: true } : x))
  })

  return <>
    <Card>
      <T zh="收到的個案" en="Incoming cases" style={s.h2} />
      {!cases.length && <T zh="還沒有個案。本人Agent按「同意分享給專業者」後會出現在這裡。" en="No cases yet. They appear here when a personal agent taps “Share with professional”." style={s.meta} />}
      {cases.map(x => <Btn key={x.id} kind={x.id === openId ? 'primary' : 'secondary'} zh={`${x.fromName ?? '本人'}｜${x.share?.range || '示範'}${x.revoked ? '（已撤回）' : x.done ? '（已回覆）' : ''}`} en={`${x.fromName ?? 'Person'} | ${x.share?.range || 'demo'}${x.revoked ? ' (revoked)' : x.done ? ' (replied)' : ''}`} onPress={() => { setOpenId(x.id); setHits(null); setNoteZh(''); setNoteEn('') }} />)}
    </Card>

    {c && <Card>
      <T zh="本人同意分享的內容" en="What the person agreed to share" style={s.h2} />
      {c.revoked
        ? <T zh="本人已撤回分享。摘要已從這支手機移除，不能再讀取。" en="The person revoked sharing. The summary was removed from this phone and can no longer be read." style={s.warn} />
        : <>
          {(c.share?.zh ?? []).map((zh: string, i: number) => <T key={i} zh={zh} en={c.share.en?.[i] ?? ''} style={s.body} />)}
          {c.share?.questionZh && <T zh={`本人想問：${c.share.questionZh}`} en={`They want to ask: ${c.share.questionEn ?? ''}`} style={s.question} />}
          {c.request && <KV rows={requestRows(c.request)} />}
          <T zh={`同意範圍：週摘要與問題，${c.consent?.expiresInDays ?? 7}天內有效`} en={`Consent: weekly summary and question, valid ${c.consent?.expiresInDays ?? 7} days`} style={s.meta} />
        </>}
    </Card>}

    {c && !c.revoked && <Card>
      <T zh="草擬回覆（專業者在迴路）" en="Draft a reply (professional in the loop)" style={s.h2} />
      <Btn kind="secondary" zh="在手機上檢索知識庫（RAG）" en="Search knowledge base on this phone (RAG)" onPress={findGuidance} busy={busy === 'rag'} />
      <T zh="示範知識庫（本案自編，非協會教材）；用EmbeddingGemma在手機上做向量檢索。" en="Demo knowledge base (written for this demo, not association material); vector search on this phone with EmbeddingGemma." style={s.meta} />
      {hits && <>
        <Text style={s.meta}>{hits.ms} ms</Text>
        {hits.r.map((h: any) => <View key={h.id} style={{ gap: 2 }}>
          <T zh={`[${h.id}] ${h.zh}`} en={`[${h.id}] ${h.en}`} style={s.body} />
          <Btn kind="secondary" zh="加入回覆" en="Add to reply" onPress={() => useHit(h)} />
        </View>)}
      </>}
      <T zh="回覆（中文）" en="Reply (Chinese)" style={s.meta} />
      <TextInput style={s.input} value={noteZh} onChangeText={setNoteZh} multiline />
      <Row><Btn kind="secondary" zh="機器翻譯成英文" en="Machine-translate to English" onPress={translate} disabled={!noteZh} busy={busy === 'nmt'} /></Row>
      <T zh="回覆（英文；機器翻譯，送出前請確認）" en="Reply (English; machine translation, check before sending)" style={s.meta} />
      <TextInput style={s.input} value={noteEn} onChangeText={setNoteEn} multiline />
      <Btn zh="承接並回覆" en="Accept and reply" onPress={accept} disabled={!noteZh || c.done} busy={busy === 'accept'} />
      {c.done && <T zh="已回覆本人。" en="Replied to the person." style={s.good} />}
    </Card>}
  </>
}
