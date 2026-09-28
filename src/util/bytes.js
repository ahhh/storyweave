// base64url helpers, defensive against hostile input.

export function bytesToB64(bytes) {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

export function b64ToBytes(str) {
  if (typeof str !== 'string' || !/^[A-Za-z0-9+/=\s]*$/.test(str)) throw new Error('Invalid base64')
  const bin = atob(str.replace(/\s+/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export const bytesToB64url = bytes => bytesToB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export function b64urlToBytes(str) {
  if (typeof str !== 'string' || !/^[A-Za-z0-9_-]*$/.test(str)) throw new Error('Invalid base64url')
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  return b64ToBytes(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
}

export const toHex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')

export function randomId(bytes = 9) {
  return bytesToB64url(crypto.getRandomValues(new Uint8Array(bytes)))
}
