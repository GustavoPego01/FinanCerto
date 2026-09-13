const pad = (value) => String(value).padStart(2, '0')
export function parseDate(value) {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : new Date(value)
  const text = String(value ?? '').trim()
  let parts
  if (/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(text))
    parts = text.slice(0, 10).split('-').map(Number)
  else if (/^\d{2}\/\d{2}\/\d{4}$/.test(text))
    parts = text.split('/').reverse().map(Number)
  else return null
  const [year, month, day] = parts
  const date = new Date(year, month - 1, day, 12)
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null
}
export function toISODate(value) {
  const date = parseDate(value)
  if (!date) return null
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
export function today() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (type) => parts.find((p) => p.type === type).value
  return `${part('year')}-${part('month')}-${part('day')}`
}
export const formatDate = (value) => {
  const iso = toISODate(value)
  return iso ? iso.split('-').reverse().join('/') : 'Data não reconhecida'
}
export const monthKey = (value = today()) => toISODate(value)?.slice(0, 7) ?? ''
export const monthLabel = (key) =>
  parseDate(`${key}-01`)?.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  }) ?? ''
export function shiftMonth(key, delta) {
  const date = parseDate(`${key}-01`)
  date.setMonth(date.getMonth() + delta)
  return monthKey(date)
}
export function dateRange(period, month = monthKey()) {
  const end =
    period === 'month'
      ? new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0, 12)
      : parseDate(today())
  const start = period === 'month' ? parseDate(`${month}-01`) : new Date(end)
  if (period !== 'month') start.setDate(start.getDate() - Number(period) + 1)
  return { start: toISODate(start), end: toISODate(end) }
}
export function daysBetween(start, end) {
  return Math.round((parseDate(end) - parseDate(start)) / 86400000)
}
