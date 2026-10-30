import { solarToLunar, type LunarDate, type SolarDate } from './lunar'
import type { IcsConfig } from './ics'

export interface Settings {
  solar: string
  time: string
  lunar: LunarDate
  startYear: number
  month: number
  day: number
  isLeap: boolean
  years: number
  leapPolicy: 'skip' | 'regular'
  dayPolicy: 'skip' | 'last'
  theme: 'system' | 'light' | 'dark'
  config: IcsConfig
}

/** Keep the existing key so upgrades retain previously saved settings. */
export const SETTINGS_STORAGE_KEY = 'lunar-calendar-settings-v1'

const pad = (value: number): string => String(value).padStart(2, '0')

export function dateString(date: SolarDate): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`
}

export function chineseNow(): { solar: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const part = (key: Intl.DateTimeFormatPartTypes): string =>
    parts.find(value => value.type === key)?.value ?? '00'

  return {
    solar: `${part('year')}-${part('month')}-${part('day')}`,
    time: `${part('hour')}:${part('minute')}`,
  }
}

/** Parse the input shape; the lunar core validates the actual calendar date. */
export function parseSolar(value: string): SolarDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('请选择完整的公历日期。')
  }
  const [year, month, day] = value.split('-').map(Number)
  return { year, month, day }
}

function defaultSettings(): Settings {
  const now = chineseNow()
  let lunar: LunarDate = { year: 2026, month: 1, day: 1, isLeap: false }
  try {
    lunar = solarToLunar(parseSolar(now.solar)).lunar
  } catch {
    // Preserve a supported default when the device date is outside the range.
  }

  return {
    ...now,
    lunar,
    startYear: lunar.year,
    month: lunar.month,
    day: lunar.day,
    isLeap: lunar.isLeap,
    years: 10,
    leapPolicy: 'skip',
    dayPolicy: 'skip',
    theme: 'system',
    config: {
      title: '农历生日',
      calendarName: '农历日历',
      description: '',
      allDay: true,
      startTime: '09:00',
      endTime: '10:00',
      timeZone: 'Asia/Shanghai',
      reminderMinutes: null,
    },
  }
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : {}
}

const stringValue = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback

const numberValue = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const booleanValue = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback

export function loadSettings(): Settings {
  const defaults = defaultSettings()
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}')
    if (parsed === null || typeof parsed !== 'object') return defaults

    const saved = record(parsed)
    const lunar = record(saved.lunar)
    const config = record(saved.config)

    return {
      solar: stringValue(saved.solar, defaults.solar),
      time: stringValue(saved.time, defaults.time),
      lunar: {
        year: numberValue(lunar.year, defaults.lunar.year),
        month: numberValue(lunar.month, defaults.lunar.month),
        day: numberValue(lunar.day, defaults.lunar.day),
        isLeap: booleanValue(lunar.isLeap, defaults.lunar.isLeap),
      },
      startYear: numberValue(saved.startYear, defaults.startYear),
      month: numberValue(saved.month, defaults.month),
      day: numberValue(saved.day, defaults.day),
      isLeap: booleanValue(saved.isLeap, defaults.isLeap),
      years: numberValue(saved.years, defaults.years),
      leapPolicy: saved.leapPolicy === 'regular' ? 'regular' : 'skip',
      dayPolicy: saved.dayPolicy === 'last' ? 'last' : 'skip',
      theme: saved.theme === 'light' || saved.theme === 'dark' ? saved.theme : 'system',
      config: {
        title: stringValue(config.title, defaults.config.title),
        calendarName: stringValue(config.calendarName, defaults.config.calendarName),
        description: stringValue(config.description, defaults.config.description),
        allDay: booleanValue(config.allDay, defaults.config.allDay),
        startTime: stringValue(config.startTime, defaults.config.startTime),
        endTime: stringValue(config.endTime, defaults.config.endTime),
        timeZone: stringValue(config.timeZone, defaults.config.timeZone),
        reminderMinutes: config.reminderMinutes === null || config.reminderMinutes === undefined
          ? null
          : numberValue(config.reminderMinutes, 0),
      },
    }
  } catch {
    // Malformed or unavailable browser storage must not prevent startup.
    return defaults
  }
}
