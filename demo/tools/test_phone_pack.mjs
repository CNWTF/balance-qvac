// Check the phone-side decoding path (base64 -> FIT -> facts) against the private pack on the dev PC.
import { readFileSync } from 'node:fs'
import { b64ToBytes } from '../app/lib/b64.js'
import { parseSaunaFit, sleepNights, recoveryFacts } from '../lib/recovery.mjs'
const p = JSON.parse(readFileSync(process.argv[2], 'utf8'))
let same = 0
for (const f of p.fit) { const a = Buffer.from(f.b64, 'base64'); const b = b64ToBytes(f.b64); if (a.length === b.length && a.every((x, i) => x === b[i])) same++ }
const sessions = p.fit.map(f => parseSaunaFit(b64ToBytes(f.b64)))
const f = recoveryFacts(sessions, sleepNights(p.sleep), p.range.to, 7)
console.log(`base64 identical ${same}/${p.fit.length}; sessions ${sessions.length}; window sauna ${f.saunaCount}, nights ${f.nights}`)
