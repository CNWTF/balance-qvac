// Parse the first complete JSON object in a model output (grammar-constrained output may be followed by extra text).
export function parseFirstJson(s) {
  const start = s.indexOf('{')
  if (start < 0) throw new Error('no JSON object in output: ' + s.slice(0, 80))
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue }
    if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return JSON.parse(s.slice(start, i + 1))
  }
  throw new Error('unterminated JSON object: ' + s.slice(0, 80))
}
