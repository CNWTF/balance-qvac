// Role and colour theme, derived from the installed app id (one codebase, three apps).
import * as Application from 'expo-application'

export type Role = 'user' | 'pro' | 'venue'

export function currentRole(): Role {
  const id = Application.applicationId ?? ''
  if (id.endsWith('.pro')) return 'pro'
  if (id.endsWith('.venue')) return 'venue'
  return 'user'
}

export const THEME: Record<Role, { accent: string, accentText: string, soft: string, name: [string, string], agent: [string, string] }> = {
  user: { accent: '#22C55E', accentText: '#0B0B0F', soft: '#12261A', name: ['本人', 'Personal'], agent: ['本人Agent', 'Personal Agent'] },
  pro: { accent: '#3B82F6', accentText: '#FFFFFF', soft: '#121C2E', name: ['專業者', 'Professional'], agent: ['專業者Agent', 'Professional Agent'] },
  venue: { accent: '#F59E0B', accentText: '#0B0B0F', soft: '#2A1E0A', name: ['場館', 'Venue'], agent: ['場館Agent', 'Venue Agent'] }
}

export const TOPIC = 'balance-demo-1011' // shared demo topic; peers are identified by their public keys
