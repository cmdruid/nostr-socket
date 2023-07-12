import { NostrSocket, Signer } from '../src/index.js'

const signer = Signer.generate()
const pubkey = await signer.getPublicKey()
const relays = [ 'wss://relay.damus.io' ]
const config = { echo : true, cipher: 'deadbeef' }

const socket = new NostrSocket(signer, pubkey, relays, config)

socket.on('ping', (payload, envelope) => {
  console.log('payload:', payload)
  console.log('envelope:', envelope)
})

socket.on('pong', (payload, envelope) => {
  console.log('payload:', payload)
  console.log('envelope:', envelope)
})

socket.on('_eose', () => {
  console.log('connected!')
})

socket.pub('pong', 'hello world!')