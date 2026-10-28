import { describe, expect, it } from 'vitest'
import { generateICS, zonedTimeToUtc, type IcsConfig } from './ics'

const config: IcsConfig = { title: '生日,快乐; 家人\\朋友', description: '第一行\n第二行', allDay: true, startTime: '09:00', endTime: '10:30', timeZone: 'Asia/Shanghai', reminderMinutes: 1440 }
const stamp = new Date('2026-01-01T00:00:00Z')

describe('ICS 导出', () => {
  it('生成独立的全天事件及排他结束日，转义文本并生成提醒', () => {
    const text = generateICS([{ date: '2026-12-31' }, { date: '2027-02-01' }], config, stamp)
    expect(text).toContain('DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101')
    expect(text).toContain('SUMMARY:生日\\,快乐\\; 家人\\\\朋友')
    expect(text).toContain('DESCRIPTION:第一行\\n第二行')
    expect(text).toContain('TRIGGER:-PT1440M')
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(new Set(text.match(/^UID:.*$/gm)).size).toBe(2)
    expect(text).not.toContain('RRULE')
    expect(text.endsWith('\r\n')).toBe(true)
  })
  it('转换所选时区的事件时间为 UTC', () => {
    const text = generateICS([{ date: '2026-02-17' }], { ...config, allDay: false }, stamp)
    expect(text).toContain('DTSTART:20260217T010000Z')
    expect(text).toContain('DTEND:20260217T023000Z')
    expect(zonedTimeToUtc('2026-07-01', '09:00', 'America/New_York').toISOString()).toBe('2026-07-01T13:00:00.000Z')
  })
  it('正确按 UTF-8 字节折行', () => {
    const title = '生日🎂'.repeat(60)
    const text = generateICS([{ date: '2026-02-17' }], { ...config, title }, stamp)
    for (const line of text.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    expect(text.replace(/\r\n[ \t]/g, '')).toContain(`SUMMARY:${title}`)
  })
  it('拒绝无效输入和夏令时异常', () => {
    expect(() => generateICS([], config)).toThrow('至少')
    expect(() => generateICS([{ date: '2026-02-29' }], config)).toThrow('不存在')
    expect(() => generateICS([{ date: '2026-02-17' }], { ...config, title: '  ' })).toThrow('事件名称')
    expect(() => generateICS([{ date: '2026-02-17' }], { ...config, allDay: false, endTime: '08:00' })).toThrow('结束时间')
    expect(() => zonedTimeToUtc('2026-03-08', '02:30', 'America/New_York')).toThrow('不存在')
    expect(() => zonedTimeToUtc('2026-11-01', '01:30', 'America/New_York')).toThrow('出现两次')
  })
})
