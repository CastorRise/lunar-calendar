/** RFC 5545 iCalendar serialization, kept independent of the UI. */
export interface IcsEvent {
  /** Gregorian calendar date, YYYY-MM-DD. */
  date: string
}

export interface IcsConfig {
  title: string
  description: string
  allDay: boolean
  startTime: string
  endTime: string
  /** IANA time-zone identifier, e.g. Asia/Shanghai. */
  timeZone: string
  /** Minutes before start, or null for no alarm. */
  reminderMinutes: number | null
}

const encoder = new TextEncoder()

/** Fold at 75 UTF-8 octets without splitting a Unicode code point. */
export function foldLine(line: string): string {
  const lines: string[] = []
  let part = ''
  let bytes = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    if (bytes + size > 75) {
      lines.push(part)
      part = ' '
      bytes = 1
    }
    part += char
    bytes += size
  }
  lines.push(part)
  return lines.join('\r\n')
}

function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
}

function parseDate(value: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error('公历日期格式无效，请使用 YYYY-MM-DD。')
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(0, 0, 0, 0)
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`公历日期 ${value} 不存在。`)
  }
  return [year, month, day]
}

function parseTime(value: string): [number, number] {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) throw new Error('时间无效，请使用 00:00 至 23:59。')
  return [Number(match[1]), Number(match[2])]
}

function utcMillis(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(hour, minute, second, 0)
  return date.getTime()
}

/** Convert wall-clock time to UTC. Ambiguous or missing DST times are rejected. */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = parseDate(date)
  const [hour, minute] = parseTime(time)
  let formatter: Intl.DateTimeFormat
  try {
    formatter = new Intl.DateTimeFormat('en-GB-u-ca-gregory-nu-latn', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    })
  } catch {
    throw new Error('事件时区无效，请选择有效的 IANA 时区。')
  }
  const local = utcMillis(year, month, day, hour, minute)
  const offsets = new Set<number>()
  // Sample on both sides of the requested wall time, capturing DST changes.
  for (let delta = -48; delta <= 48; delta += 6) {
    const sample = local + delta * 3600000
    const parts = formatter.formatToParts(new Date(sample))
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
    const interpreted = utcMillis(get('year'), get('month'), get('day'), get('hour'), get('minute'), get('second'))
    offsets.add(interpreted - sample)
  }
  const matches = [...offsets].map((offset) => local - offset).filter((instant) => {
    const parts = formatter.formatToParts(new Date(instant))
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
    return get('year') === year && get('month') === month && get('day') === day && get('hour') === hour && get('minute') === minute && get('second') === 0
  })
  if (matches.length === 0) throw new Error(`${date} ${time} 在 ${timeZone} 不存在（可能处于夏令时切换期间）。`)
  if (matches.length > 1) throw new Error(`${date} ${time} 在 ${timeZone} 出现两次（夏令时切换），请选择其他时间。`)
  return new Date(matches[0])
}

function formatUtc(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new Error('时间无效。')
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function nextDate(value: string): string {
  const [year, month, day] = parseDate(value)
  const date = new Date(utcMillis(year, month, day) + 86400000)
  return `${String(date.getUTCFullYear()).padStart(4, '0')}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

/** Generate one independent VEVENT per selected solar date, without RRULE. */
export function generateICS(events: IcsEvent[], config: IcsConfig, now: Date = new Date()): string {
  if (!Array.isArray(events) || events.length === 0) throw new Error('请至少选择一个可导出的日期。')
  if (!config.title.trim()) throw new Error('请输入事件名称。')
  if (config.reminderMinutes !== null && (!Number.isSafeInteger(config.reminderMinutes) || config.reminderMinutes < 0 || config.reminderMinutes > 5256000)) {
    throw new Error('提醒时间须为 0 到 5256000 分钟之间的整数。')
  }
  if (!config.allDay) {
    const [startHour, startMinute] = parseTime(config.startTime)
    const [endHour, endMinute] = parseTime(config.endTime)
    if (endHour * 60 + endMinute <= startHour * 60 + startMinute) throw new Error('结束时间必须晚于开始时间。')
  }
  const stamp = formatUtc(now)
  const id = makeId()
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lunar Calendar//Lunar Calendar//ZH-CN', 'CALSCALE:GREGORIAN']
  events.forEach((event, index) => {
    parseDate(event.date)
    lines.push('BEGIN:VEVENT', `UID:${id}-${index}@lunar-calendar.local`, `DTSTAMP:${stamp}`)
    if (config.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${event.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${nextDate(event.date)}`)
    } else {
      const start = zonedTimeToUtc(event.date, config.startTime, config.timeZone)
      const end = zonedTimeToUtc(event.date, config.endTime, config.timeZone)
      if (end <= start) throw new Error(`${event.date} 的结束时间必须晚于开始时间。`)
      lines.push(`DTSTART:${formatUtc(start)}`, `DTEND:${formatUtc(end)}`)
    }
    lines.push(`SUMMARY:${escapeText(config.title.trim())}`)
    if (config.description) lines.push(`DESCRIPTION:${escapeText(config.description)}`)
    if (config.reminderMinutes !== null) {
      const trigger = config.reminderMinutes === 0 ? 'PT0M' : `-PT${config.reminderMinutes}M`
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(config.title.trim())}`, `TRIGGER:${trigger}`, 'END:VALARM')
    }
    lines.push('END:VEVENT')
  })
  lines.push('END:VCALENDAR')
  return `${lines.map(foldLine).join('\r\n')}\r\n`
}
