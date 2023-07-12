import {
  Event,
  EventTemplate,
  validateEvent,
  verifySignature
} from 'nostr-tools'

export const now = () => Math.floor(Date.now() / 1000)

export function formatEvent (
  eventName : string,
  payload   : any,
  template  : EventTemplate
) : EventTemplate {
  return {
    ...template,
    content : JSON.stringify([ eventName, payload ])
  }
}

export function parseEvent (
  event : Event
) : any[] {
  const arr = JSON.parse(event.content)
  if (!Array.isArray(arr) || arr.length < 1) {
    throw new TypeError('Invalid content payload.')
  }
  return arr
}

export function verifyEvent (
  event : Event
) : void {
  validateEvent(event)
  if (!verifySignature(event)) {
    throw new Error('Invalid signature!')
  }
}
