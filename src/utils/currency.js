export const currency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(value) || 0,
  )
export const cents = (value) => Math.round(Number(value) * 100)
export function parseMoney(value) {
  if (typeof value === 'number') return value
  const text = String(value ?? '').replace(/R\$|\s/g, '')
  return Number(
    text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text,
  )
}
