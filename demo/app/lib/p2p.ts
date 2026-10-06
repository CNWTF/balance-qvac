// React hook around the qvac-balance-p2p plugin: Hyperswarm inside the QVAC worker, Noise-encrypted, no server.
import { useEffect, useRef, useState } from 'react'
import * as FileSystem from 'expo-file-system/legacy'
import { openP2P, joinTopic, sendMessage, pollMessages } from 'qvac-balance-p2p'
import { Role, TOPIC } from './roles'

export type Peer = { publicKey: string, name: string, role: string }
export type Inbound = { from: string, fromName: string | null, fromRole: string | null, at: number, msg: any }

const ANCHOR = FileSystem.documentDirectory + 'p2p_identity.txt'

async function identitySeed(): Promise<string> {
  // A stable 32-byte seed per install, so this agent keeps the same public key across launches.
  const info = await FileSystem.getInfoAsync(ANCHOR)
  if (info.exists) return (await FileSystem.readAsStringAsync(ANCHOR)).trim()
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('')
  await FileSystem.writeAsStringAsync(ANCHOR, hex)
  return hex
}

export function useP2P(role: Role, name: string, enabled: boolean) {
  const [modelId, setModelId] = useState<string | null>(null)
  const [publicKey, setPublicKey] = useState<string>('')
  const [peers, setPeers] = useState<Peer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<Inbound[]>([])
  const handlers = useRef<((m: Inbound) => void)[]>([])

  useEffect(() => {
    if (!enabled) return
    let stop = false
    let timer: any
    ;(async () => {
      try {
        const seed = await identitySeed()
        const id = await openP2P({ anchorPath: ANCHOR.replace('file://', ''), seed })
        const r: any = await joinTopic({ modelId: id, topic: TOPIC, name, role })
        if (stop) return
        setModelId(id); setPublicKey(r.publicKey)
        timer = setInterval(async () => {
          try {
            const p: any = await pollMessages({ modelId: id })
            setPeers(p.peers)
            if (p.messages.length) {
              setLog(l => [...p.messages, ...l].slice(0, 100))
              for (const m of p.messages) for (const h of handlers.current) h(m)
            }
          } catch (e: any) { setError(String(e?.message ?? e)) }
        }, 1000)
      } catch (e: any) { setError(String(e?.message ?? e)) }
    })()
    return () => { stop = true; if (timer) clearInterval(timer) }
  }, [enabled])

  const send = async (msg: any, toRole?: Role) => {
    if (!modelId) return 0
    const r: any = await sendMessage({ modelId, msg, toRole })
    return r.sent as number
  }
  const onMessage = (h: (m: Inbound) => void) => { handlers.current = [h] }
  return { ready: !!modelId, publicKey, peers, error, log, send, onMessage }
}
