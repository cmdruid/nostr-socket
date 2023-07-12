import 'websocket-polyfill'

import { EventEmitter } from './emitter.js'

import {
  getLabel,
  getSecret,
  encryptEvent,
  decryptEvent
} from './crypto.js'

import {
  Event,
  EventTemplate,
  Filter,
  SimplePool,
  Sub,
  UnsignedEvent,
  generatePrivateKey,
  getEventHash,
  getPublicKey,
  getSignature,
  validateEvent
} from 'nostr-tools'

import { 
  SocketConfig, 
  SocketOptions, 
  get_config 
} from './config.js'

import * as util from './utils.js'

export class NostrSocket extends EventEmitter {
  readonly _pool   : SimplePool
  readonly _pubkey : string
  readonly _signer : Signer
  readonly filter  : Filter
  readonly relays : string[]
  readonly opt    : SocketOptions

  _cipher ?: string
  _sub     : Sub

  constructor (
    signer  : Signer,
    pubkey  : string,
    relays  : string[],
    config ?: SocketConfig
  ) {
    super()
    this._pool   = new SimplePool
    this._pubkey = pubkey
    this._signer = signer
    
    this.relays  = relays
    this.opt     = get_config(config)

    this.filter = {
      kinds : [ this.opt.kind ],
      since : util.now()
    }

    this.cipher = config?.cipher
    this._sub   = this.sub(this.filter) 
  }

  set cipher (secret : string | undefined) {
    if (secret === undefined) {
      this._cipher = undefined
      delete this.filter['#h']
    } else {
      this._cipher = getSecret(secret)
      this.filter['#h'] = [ getLabel(this._cipher) ]
    }
  }

  get pool () : SimplePool {
    return this._pool
  }

  get pubkey () : string {
    return this._pubkey
  }

  get template () : EventTemplate {
    return {
      kind       : this.opt.kind,
      tags       : this.opt.tags,
      content    : '',
      created_at : util.now()
    }
  }

  _isEcho (event : Event) : boolean {
    return (
      !this.opt.echo &&
      event.pubkey === this.pubkey
    )
  }

  async _eventHandler (event : Event) {
    try {
      util.verifyEvent(event)
      if (this._isEcho(event)) return
      const decrypted = await decryptEvent(event, this._cipher)
      const [ label, payload ] = util.parseEvent(decrypted)
      this.emit(label, payload, event)
    } catch (err) {
      const { message } = err as Error
      this.emit('_err', [ message, event ])
    }
  }

  async pub (
    eventName : string,
    payload   : any,
    template ?: Partial<EventTemplate>
  ) {
    const base   = { ...this.template, ...template }
      let temp   = util.formatEvent(eventName, payload, base)
          temp   = await encryptEvent(temp, this._cipher)
    const event  = { ...temp, pubkey: this.pubkey } 
    const signed = await this._signer.signEvent(event)
    const pub    = this._pool.publish(this.relays, signed)
    pub.on('ok', (data : any) => this.emit('_ok', data))
    pub.on('failed', (data : any) => this.emit('_fail', data))
    return pub
  }

  sub (filter : Filter) {
    const sub = this.pool.sub(this.relays, [ filter ])
    sub.on('eose', () => { this.emit('_eose') })
    sub.on('event', (event : Event) => {
      this._eventHandler(event)
      this.emit('_event', [ event ])
    })
    return sub
  }

}

export class Signer {
  static generate () : Signer {
    const sec = generatePrivateKey()
    return new Signer(sec)
  }

  readonly _secret : string

  constructor (secret : string) {
    this._secret = secret
  }

  async getPublicKey () : Promise<string> {
    return getPublicKey(this._secret)
  }

  async signEvent (event : UnsignedEvent) {
    validateEvent(event)
    const id  = getEventHash(event)
    const sig = getSignature(event, this._secret)
    return { ...event, id, sig }
  }
}
