// Base64 to bytes without relying on atob or Buffer (Hermes and Node).
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const LOOKUP = (() => { const t = new Uint8Array(256); for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i; return t })()

export function b64ToBytes(b64) {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '')
  const out = new Uint8Array(Math.floor(clean.length * 3 / 4))
  let o = 0
  for (let i = 0; i + 3 < clean.length + 3; i += 4) {
    const a = LOOKUP[clean.charCodeAt(i)], b = LOOKUP[clean.charCodeAt(i + 1)]
    const c = i + 2 < clean.length ? LOOKUP[clean.charCodeAt(i + 2)] : 0
    const d = i + 3 < clean.length ? LOOKUP[clean.charCodeAt(i + 3)] : 0
    const n = (a << 18) | (b << 12) | (c << 6) | d
    if (o < out.length) out[o++] = (n >> 16) & 255
    if (i + 2 < clean.length && o < out.length) out[o++] = (n >> 8) & 255
    if (i + 3 < clean.length && o < out.length) out[o++] = n & 255
    if (i + 4 >= clean.length) break
  }
  return out
}


// Bytes to base64 (for writing generated audio files).
export function bytesToB64(bytes) {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (b === undefined ? '=' : B64[(n >> 6) & 63]) + (c === undefined ? '=' : B64[n & 63])
  }
  return out
}
