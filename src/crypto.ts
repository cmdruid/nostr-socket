import { Buff, Bytes } from '@cmdcode/buff-utils'
import { Event, EventTemplate } from 'nostr-tools'

// Attempt to import the crypto library from somewhere.
const { subtle } = globalThis?.crypto ?? crypto ?? window?.crypto

if (
  typeof subtle === 'undefined'  ||
  subtle.importKey === undefined ||
  subtle.encrypt   === undefined ||
  subtle.decrypt   === undefined
) {
  throw new Error('Subtle crypto library not found on this device!')
}

export function getSecret (seed : string) : string {
  return Buff.str(seed).digest.hex
}
export function getLabel (secret : string) : string {
  return Buff.hex(secret).digest.hex
}

async function getKey (secret : Bytes) {
  /** Derive a CryptoKey object (for Webcrypto library). */
  const key     = Buff.bytes(secret)
  const options = { name: 'AES-CBC' }
  const usage   = [ 'encrypt', 'decrypt' ] as KeyUsage[]
  return subtle.importKey('raw', key, options, true, usage)
}

export async function encrypt (
  message : string,
  secret  : Bytes,
  vector ?: Bytes
) {
  /** Encrypt a message using a CryptoKey object. */
  const key = await getKey(secret)
  const msg = Buff.str(message)
  const iv  = (vector !== undefined)
    ? Buff.bytes(vector)
    : Buff.random(16)
  const opt = { name: 'AES-CBC', iv }
  return subtle.encrypt(opt, key, msg)
    .then((bytes) => Buff.bytes(bytes).base64 + '?iv=' + iv.base64)
}

export async function decrypt (
  encoded : string,
  secret  : Bytes
) {
  /** Decrypt an encrypted message using a CryptoKey object. */
  if (!encoded.includes('?iv=')) {
    throw new Error('Missing vector on encrypted message!')
  }
  const [ message, vector ] = encoded.split('?iv=')
  const key = await getKey(secret)
  const msg = Buff.base64(message)
  const iv  = Buff.base64(vector)
  const opt = { name: 'AES-CBC', iv }
  return subtle.decrypt(opt, key, msg)
    .then(decoded => Buff.bytes(decoded).str)
}

export async function encryptEvent (
  template : EventTemplate,
  cipher  ?: string
) : Promise<EventTemplate> {
  const temp = { ...template }
  if (typeof cipher === 'string') {
    const { content, tags } = temp
    const lbl = getLabel(cipher)
    const enc = await encrypt(content, cipher)
    temp.content = enc
    temp.tags = [ ...tags, [ 'h', lbl ] ]
  }
  return temp
}

export async function decryptEvent (
  event   : Event,
  cipher ?: string
) : Promise<Event> {
  const ev = { ...event }
  if (typeof cipher === 'string') {
    const { content, tags } = ev
    const label  = getLabel(cipher)
    const htags  = tags.filter(e => e[0] === 'h')
    const hashes = htags.map(e => e[1])
    if (
      hashes.includes(label) &&
      content.includes('?iv=')
    ) {
      ev.content = await decrypt(content, cipher)
    }
  }
  return ev
}
