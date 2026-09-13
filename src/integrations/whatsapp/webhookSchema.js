// Provider adapters must validate signatures before normalizing a payload.
export function validateEnvelope(envelope) {
  if (
    !envelope ||
    typeof envelope.messageId !== 'string' ||
    !envelope.messageId ||
    typeof envelope.sender !== 'string' ||
    !/^\+?[1-9]\d{7,14}$/.test(envelope.sender) ||
    typeof envelope.text !== 'string' ||
    !envelope.text.trim() ||
    envelope.text.length > 1000
  )
    throw new Error('Invalid WhatsApp envelope')
  return {
    messageId: envelope.messageId,
    sender: envelope.sender,
    text: envelope.text,
    receivedAt: envelope.receivedAt,
  }
}
