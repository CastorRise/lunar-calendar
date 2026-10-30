import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, ArrowRight, Bell, CalendarDays, CalendarRange, Check, ChevronDown, Clock3, Copy, Download, Info, LockKeyhole, Moon, Share2, SunMoon, X } from 'lucide-react'
import { solarToLunar, lunarToSolar, getLunarMonths, predictDates, anniversaryRuleFromDate, MIN_YEAR, MAX_YEAR, MIN_SOLAR, MAX_SOLAR, MONTH_NAMES, DAY_NAMES, type LunarDate } from './lunar'
import { generateICS, type IcsConfig } from './ics'
import { chineseNow, dateString, loadSettings, parseSolar, SETTINGS_STORAGE_KEY, type Settings } from './settings'
import { PredictionResults } from './PredictionResults'
import './style.css'

type Tab = 'convert' | 'future' | 'export'
const steps = [
  { key: 'convert', title: '日期转换', subtitle: '公历与农历双向换算' },
  { key: 'future', title: '未来推算', subtitle: '找到每一年的纪念日' },
  { key: 'export', title: '日历导出', subtitle: '添加到你的日历' },
] as const
const reminders = [{ value: 'none', label: '不提醒' }, { value: '0', label: '事件发生时' }, { value: '10', label: '提前 10 分钟' }, { value: '60', label: '提前 1 小时' }, { value: '1440', label: '提前 1 天' }, { value: '4320', label: '提前 3 天' }, { value: '10080', label: '提前 7 天' }]
const reminderChoice = (minutes: number | null) => minutes === null ? 'none' : reminders.some(x => x.value === String(minutes)) ? String(minutes) : 'custom'
const lunarDay = (l: Pick<LunarDate, 'month' | 'day' | 'isLeap'>) => `${l.isLeap ? '闰' : ''}${MONTH_NAMES[l.month - 1] ?? ''}${DAY_NAMES[l.day - 1] ?? ''}`
const errorText = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback

function Field({ id, label, children, hint, extra }: { id: string; label: string; children: React.ReactNode; hint?: string; extra?: React.ReactNode }) {
  return <div className="field"><div className="field-label"><label htmlFor={id}>{label}</label>{extra}</div>{children}{hint && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}</div>
}
function TimingChoice({ allDay, onChange }: { allDay: boolean; onChange(value: boolean): void }) {
  return <fieldset className="field choice-field"><legend>日程时间</legend><div className="segmented"><button type="button" aria-pressed={allDay} className={allDay ? 'active' : ''} onClick={() => onChange(true)}>全天</button><button type="button" aria-pressed={!allDay} className={!allDay ? 'active' : ''} onClick={() => onChange(false)}>指定时间</button></div></fieldset>
}
function ErrorNotice({ children }: { children: React.ReactNode }) {
  return <div className="notice error-notice" role="alert"><Info size={17} /><span>{children}</span></div>
}
function App() {
  const [s, setS] = useState(loadSettings)
  const [tab, setTab] = useState<Tab>('convert')
  const [mode, setMode] = useState<'solar' | 'lunar'>('solar')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [message, setMessage] = useState('')
  const [reminderMode, setReminderMode] = useState(() => reminderChoice(s.config.reminderMinutes))
  const mainRef = useRef<HTMLElement>(null)
  const update = (patch: Partial<Settings>) => setS(value => ({ ...value, ...patch }))
  const configure = (patch: Partial<IcsConfig>) => setS(value => ({ ...value, config: { ...value.config, ...patch } }))
  const goTo = (next: Tab) => {
    setTab(next)
    requestAnimationFrame(() => {
      mainRef.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    })
  }

  useEffect(() => { try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(s)) } catch { /* Local storage may be disabled. */ } }, [s])
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => document.documentElement.classList.toggle('dark', s.theme === 'dark' || (s.theme === 'system' && media.matches))
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [s.theme])
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 4500)
    return () => clearTimeout(timer)
  }, [message])

  const conversion = useMemo(() => {
    try {
      if (!s.config.allDay && !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time)) throw Error('请输入有效时间。')
      return { value: mode === 'solar' ? solarToLunar(parseSolar(s.solar)) : lunarToSolar(s.lunar), error: '' }
    } catch (error) { return { value: null, error: errorText(error, '日期无效，请检查输入。') } }
  }, [s.solar, s.lunar, s.time, s.config.allDay, mode])
  const months = useMemo(() => { try { return getLunarMonths(s.lunar.year) } catch { return [] } }, [s.lunar.year])
  const prediction = useMemo(() => {
    try { return { values: predictDates(s), error: '' } }
    catch (error) { return { values: [], error: errorText(error, '请检查推算设置。') } }
  }, [s.startYear, s.month, s.day, s.isLeap, s.years, s.leapPolicy, s.dayPolicy])
  useEffect(() => { setSelected(new Set(prediction.values.filter(x => x.info).map(x => x.year))) }, [prediction])
  const valid = useMemo(() => prediction.values.filter(x => x.info), [prediction])
  const chosen = useMemo(() => valid.filter(x => selected.has(x.year)), [valid, selected])
  const events = useMemo(() => chosen.map(x => ({ date: dateString(x.info!.solar) })), [chosen])
  const exportError = useMemo(() => {
    try { generateICS(events, s.config); return '' }
    catch (error) { return errorText(error, '无法生成日历文件。') }
  }, [events, s.config])

  function setLunar(patch: Partial<LunarDate>) {
    const next = { ...s.lunar, ...patch }
    try {
      const options = getLunarMonths(next.year)
      let month = options.find(x => x.month === next.month && x.isLeap === next.isLeap)
      if (!month) { month = options.find(x => x.month === next.month && !x.isLeap); next.isLeap = false }
      if (month) next.day = Math.min(next.day, month.days)
    } catch { /* Keep the input visible for validation. */ }
    update({ lunar: next })
  }
  function switchMode(next: 'solar' | 'lunar') {
    if (conversion.value) update(next === 'lunar' ? { lunar: conversion.value.lunar } : { solar: dateString(conversion.value.solar) })
    setMode(next)
  }
  function today() {
    const now = chineseNow()
    try { update({ ...now, lunar: solarToLunar(parseSolar(now.solar)).lunar }) }
    catch (error) { setMessage(errorText(error, '当前日期超出支持范围。')) }
  }
  function useFuture() {
    if (!conversion.value) return
    try { update(anniversaryRuleFromDate(conversion.value.lunar, parseSolar(chineseNow().solar))); goTo('future') }
    catch (error) { setMessage(errorText(error, '当前日期超出支持范围。')) }
  }
  function toggle(year: number) {
    setSelected(previous => { const next = new Set(previous); if (next.has(year)) next.delete(year); else next.add(year); return next })
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setMessage('已复制到剪贴板') }
    catch { setMessage('复制失败，请检查浏览器权限。') }
  }
  const fileName = () => `${s.config.title.replace(/[\\/:*?"<>|]/g, '_').trim() || '农历日历'}_${chosen[0]?.year}-${chosen.at(-1)?.year}.ics`
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([generateICS(events, s.config)], { type: 'text/calendar;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url; link.download = fileName(); link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage(`已生成 ${chosen.length} 个日程的日历文件`)
    } catch (error) { setMessage(errorText(error, '导出失败。')) }
  }
  async function share() {
    try {
      const file = new File([generateICS(events, s.config)], fileName(), { type: 'text/calendar' })
      if (!navigator.canShare?.({ files: [file] })) throw Error('当前浏览器不支持分享文件，请使用下载。')
      await navigator.share({ files: [file], title: s.config.title })
    } catch (error) { if (error instanceof Error && error.name === 'AbortError') return; setMessage(errorText(error, '分享失败，请使用下载。')) }
  }

  const result = conversion.value
  const currentMonth = months.find(x => x.month === s.lunar.month && x.isLeap === s.lunar.isLeap)
  const first = chosen[0]?.info
  const reminderLabel = reminders.find(x => x.value === String(s.config.reminderMinutes ?? 'none'))?.label ?? (Number.isFinite(s.config.reminderMinutes) ? `提前 ${s.config.reminderMinutes} 分钟` : '待设置')
  return <div className="app-shell">
    <header className="app-header">
      <div className="brand"><span className="brand-mark"><Moon size={23} strokeWidth={1.8} /></span><div><h1>农历日历</h1><p>记住每一年的重要日子</p></div></div>
      <div className="header-tools"><span className="today-label">今天 {chineseNow().solar.replaceAll('-', '.')}</span><div className="theme-control"><SunMoon size={17} /><select aria-label="外观设置" value={s.theme} onChange={e => update({ theme: e.target.value as Settings['theme'] })}><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></div></div>
    </header>
    <nav className="workflow" aria-label="主要功能">{steps.map((step, index) => <button key={step.key} className={`workflow-step ${tab === step.key ? 'active' : ''}`} aria-current={tab === step.key ? 'step' : undefined} onClick={() => goTo(step.key)}><span className="step-number">{index + 1}</span><span className="step-text"><strong>{step.title}</strong><small>{step.subtitle}</small></span>{index < 2 && <span className="step-arrow"><ChevronDown size={15} /></span>}</button>)}</nav>
    <main ref={mainRef} tabIndex={-1} className="workspace">
      {tab === 'convert' && <div className="workspace-grid">
        <section className="panel settings-panel" aria-labelledby="convert-heading">
          <div className="panel-header"><div><p className="eyebrow">选择日期</p><h2 id="convert-heading">你想记住哪一天？</h2></div><CalendarDays size={22} className="heading-icon" /></div>
          <div className="segmented" role="group" aria-label="转换方向"><button aria-pressed={mode === 'solar'} className={mode === 'solar' ? 'active' : ''} onClick={() => switchMode('solar')}>公历 → 农历</button><button aria-pressed={mode === 'lunar'} className={mode === 'lunar' ? 'active' : ''} onClick={() => switchMode('lunar')}>农历 → 公历</button></div>
          {mode === 'solar' ? <Field id="solar-date" label="公历日期" extra={<button className="text-button" onClick={today}>今天</button>}><input id="solar-date" type="date" min={dateString(MIN_SOLAR)} max={dateString(MAX_SOLAR)} value={s.solar} onInput={e => update({ solar: e.currentTarget.value })} onChange={e => update({ solar: e.target.value })} /></Field> : <>
            <Field id="lunar-year" label="农历年份" extra={<button className="text-button" onClick={today}>今天</button>}><input id="lunar-year" type="number" min={MIN_YEAR} max={MAX_YEAR} value={s.lunar.year || ''} onChange={e => setLunar({ year: Number(e.target.value) })} /></Field>
            <div className="field-row"><Field id="lunar-month" label="月份"><select id="lunar-month" value={`${s.lunar.month}-${s.lunar.isLeap}`} onChange={e => { const [month, leap] = e.target.value.split('-'); setLunar({ month: Number(month), isLeap: leap === 'true' }) }}>{months.map(m => <option key={`${m.month}-${m.isLeap}`} value={`${m.month}-${m.isLeap}`}>{m.label}</option>)}</select></Field><Field id="lunar-day" label="日期"><select id="lunar-day" value={s.lunar.day} onChange={e => setLunar({ day: Number(e.target.value) })}>{DAY_NAMES.slice(0, currentMonth?.days ?? 30).map((day, i) => <option value={i + 1} key={day}>{day}</option>)}</select></Field></div>
          </>}
          <div className="form-divider" />
          <TimingChoice allDay={s.config.allDay} onChange={allDay => configure({ allDay })} />
          {!s.config.allDay && <Field id="conversion-time" label="换算时间" hint="按中国标准时间显示；日程开始和结束时间可在导出时设置。"><input id="conversion-time" aria-describedby="conversion-time-hint" type="time" value={s.time} onInput={e => update({ time: e.currentTarget.value })} onChange={e => update({ time: e.target.value })} /></Field>}
          {conversion.error && <ErrorNotice>{conversion.error}</ErrorNotice>}
          <p className="form-footnote"><Clock3 size={14} />日期基准：中国标准时间 UTC+8</p>
        </section>
        <section className="panel conversion-panel" aria-label="转换结果">
          {result ? <>
            <div className="panel-header"><span className="eyebrow">转换结果</span><span className="badge"><Check size={13} />已换算</span></div>
            <div className="date-result"><p className="result-kicker">{mode === 'solar' ? `${result.lunar.year} 年 · 农历` : `${result.solar.year} 年 · 公历`}</p><h2>{mode === 'solar' ? lunarDay(result.lunar) : `${result.solar.month} 月 ${result.solar.day} 日`}</h2><p className="result-context">{result.yearGanZhi}年 · {result.zodiac}年 <span>／</span> {result.weekday}</p><div className="result-chips"><span>{result.lunar.isLeap ? '闰月' : '非闰月'}</span><span>{s.config.allDay ? '全天' : `${s.time} UTC+8`}</span></div></div>
            <dl className="date-reference"><div><dt>{mode === 'solar' ? '对应公历' : '对应农历'}</dt><dd>{mode === 'solar' ? dateString(result.solar) : `${result.lunar.year} 年 ${lunarDay(result.lunar)}`}</dd></div></dl>
            <div className="conversion-actions"><button className="button button-primary" onClick={useFuture}>以此日期推算未来 <ArrowRight size={17} /></button><button className="button button-secondary" onClick={() => copy(`${dateString(result.solar)} ${result.weekday} · ${result.lunarText} · ${result.yearGanZhi}年 ${result.zodiac}`)}><Copy size={16} />复制</button></div>
            <p className="under-action">生日或纪念日？下一步可查看未来每年的对应日期。</p>
          </> : <div className="empty-state"><CalendarDays size={32} /><h2>等待有效日期</h2><p>请检查左侧日期，再查看转换结果。</p></div>}
        </section>
      </div>}
      {tab === 'future' && <div className="workspace-grid">
        <section className="panel settings-panel" aria-labelledby="future-heading">
          <div className="panel-header"><div><p className="eyebrow">设置规则</p><h2 id="future-heading">每年农历的这一天</h2></div><CalendarRange size={22} className="heading-icon" /></div>
          <div className="field-row"><Field id="future-month" label="农历月份"><select id="future-month" value={s.month} onChange={e => update({ month: Number(e.target.value) })}>{MONTH_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}</select></Field><Field id="future-day" label="农历日期"><select id="future-day" value={s.day} onChange={e => update({ day: Number(e.target.value) })}>{DAY_NAMES.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}</select></Field></div>
          <label className="check-row"><input type="checkbox" checked={s.isLeap} onChange={e => update({ isLeap: e.target.checked })} /><span>这是闰月日期</span></label>
          <div className="form-divider" />
          <div className="field-row"><Field id="start-year" label="起始农历年份"><input id="start-year" type="number" min={MIN_YEAR} max={MAX_YEAR} value={s.startYear || ''} onChange={e => update({ startYear: Number(e.target.value) })} /></Field><Field id="year-count" label="推算年数"><input id="year-count" type="number" min="1" max="100" value={s.years || ''} onChange={e => update({ years: Number(e.target.value) })} /></Field></div>
          <div className="year-shortcuts" aria-label="推算年数快捷选择">{[1, 3, 5, 10, 20, 30, 50].map(years => <button key={years} aria-pressed={s.years === years} className={s.years === years ? 'active' : ''} onClick={() => update({ years })}>{years} 年</button>)}</div>
          <p className="field-hint">包含起始年。{!prediction.error && `${s.startYear} 至 ${s.startYear + s.years - 1} 年，共 ${s.years} 个农历年。`}</p>
          <details className="disclosure rules-disclosure" key={s.isLeap ? 'leap' : 'normal'} open={s.isLeap || undefined}><summary><span>特殊日期处理<small>{s.leapPolicy === 'skip' && s.dayPolicy === 'skip' ? '默认跳过无效日期' : '已设置替代日期'}</small></span><ChevronDown size={17} /></summary><div className="disclosure-content">
            {s.isLeap && <Field id="leap-policy" label="没有相同闰月时"><select id="leap-policy" value={s.leapPolicy} onChange={e => update({ leapPolicy: e.target.value as Settings['leapPolicy'] })}><option value="skip">跳过该年份</option><option value="regular">使用普通同名月份</option></select></Field>}
            <Field id="day-policy" label="农历三十不存在时"><select id="day-policy" value={s.dayPolicy} onChange={e => update({ dayPolicy: e.target.value as Settings['dayPolicy'] })}><option value="skip">跳过该年份</option><option value="last">使用该月最后一天</option></select></Field><p className="field-hint">所有跳过和调整都会在结果中说明。</p>
          </div></details>
          {prediction.error && <ErrorNotice>{prediction.error}</ErrorNotice>}
          <p className="form-footnote">从转换结果进入时，默认从当前农历年开始；已过日期也会列出。</p>
        </section>
        <section className="panel results-panel" aria-label="未来推算结果"><PredictionResults results={prediction.values} selected={selected} onToggle={toggle} onSelectAll={() => setSelected(new Set(valid.map(x => x.year)))} onClear={() => setSelected(new Set())} onCopy={() => copy(prediction.values.map(x => x.info ? `${x.year}：${dateString(x.info.solar)} ${x.info.weekday} ${x.info.lunarText}${x.reason ? `（${x.reason}）` : ''}` : `${x.year}：跳过（${x.reason}）`).join('\n'))} onContinue={() => goTo('export')} /></section>
      </div>}
      {tab === 'export' && <div className="workspace-grid">
        <section className="panel settings-panel" aria-labelledby="export-heading">
          <div className="panel-header"><div><p className="eyebrow">日程设置</p><h2 id="export-heading">给纪念日一个名字</h2></div><CalendarDays size={22} className="heading-icon" /></div>
          <Field id="event-title" label="日程名称"><input id="event-title" value={s.config.title} placeholder="例如：妈妈的生日" maxLength={200} onChange={e => configure({ title: e.target.value })} /></Field>
          <Field id="calendar-name" label="日历名称" hint="导入已有日历时，以目标日历的名称为准。"><input id="calendar-name" aria-describedby="calendar-name-hint" value={s.config.calendarName} placeholder="例如：家人纪念日" maxLength={200} onChange={e => configure({ calendarName: e.target.value })} /></Field>
          <div className="form-divider" />
          <TimingChoice allDay={s.config.allDay} onChange={allDay => configure({ allDay })} />
          {!s.config.allDay && <><div className="field-row"><Field id="start-time" label="开始时间"><input id="start-time" type="time" value={s.config.startTime} onInput={e => configure({ startTime: e.currentTarget.value })} onChange={e => configure({ startTime: e.target.value })} /></Field><Field id="end-time" label="结束时间"><input id="end-time" type="time" value={s.config.endTime} onInput={e => configure({ endTime: e.currentTarget.value })} onChange={e => configure({ endTime: e.target.value })} /></Field></div><Field id="event-zone" label="事件时区"><input id="event-zone" list="timezones" value={s.config.timeZone} onChange={e => configure({ timeZone: e.target.value })} /><datalist id="timezones">{['Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Tokyo', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'UTC'].map(zone => <option key={zone} value={zone} />)}</datalist></Field></>}
          <Field id="reminder" label="提醒"><select id="reminder" value={reminderMode} onChange={e => { const choice = e.target.value; setReminderMode(choice); configure({ reminderMinutes: choice === 'none' ? null : choice === 'custom' ? 30 : Number(choice) }) }}>{reminders.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}<option value="custom">自定义提醒</option></select></Field>
          {reminderMode === 'custom' && <Field id="custom-reminder" label="提前分钟数"><input id="custom-reminder" type="number" min="0" max="5256000" value={Number.isFinite(s.config.reminderMinutes) ? s.config.reminderMinutes! : ''} onChange={e => configure({ reminderMinutes: e.target.value === '' ? NaN : Number(e.target.value) })} /></Field>}
          <details className="disclosure" open={s.config.description ? true : undefined}><summary><span>备注<small>可选</small></span><ChevronDown size={17} /></summary><div className="disclosure-content"><Field id="description" label="事件备注"><textarea id="description" placeholder="想在这一天记住的事…" value={s.config.description} onChange={e => configure({ description: e.target.value })} /></Field></div></details>
        </section>
        <section className="panel export-panel" aria-label="导出预览">
          <div className="panel-header"><div><p className="eyebrow">准备导出</p><h2>将 {chosen.length} 个日程加入日历</h2></div><span className="format-label">ICS</span></div>
          {first ? <>
            <div className="event-preview"><div className="event-date"><span>{first.solar.month} 月</span><strong>{first.solar.day}</strong><small>{first.weekday}</small></div><div className="event-content"><span className="event-calendar">{s.config.calendarName.trim() || '未命名日历'}</span><h3>{s.config.title.trim() || '未命名日程'}</h3><p>{first.solar.year} 年 · {lunarDay(first.lunar)}</p><span className="event-time">{s.config.allDay ? '全天' : `${s.config.startTime} – ${s.config.endTime}`}</span></div></div>
            <dl className="export-summary"><div><dt><CalendarRange size={16} />日期范围</dt><dd>农历 {chosen[0].year}–{chosen.at(-1)!.year} 年</dd></div><div><dt><Bell size={16} />提醒</dt><dd>{reminderLabel}</dd></div>{!s.config.allDay && <div><dt><Clock3 size={16} />时区</dt><dd>{s.config.timeZone}</dd></div>}</dl>
          </> : <div className="empty-state"><CalendarRange size={30} /><h3>还没有选中日期</h3><p>先到未来推算，选择要加入日历的日期。</p><button className="button button-secondary" onClick={() => goTo('future')}>返回选择日期</button></div>}
          {exportError && chosen.length > 0 && <ErrorNotice>{exportError}</ErrorNotice>}
          <div className="export-actions"><button className="button button-primary" disabled={!!exportError} onClick={download}><Download size={18} />下载 ICS 文件{chosen.length > 0 && <span>· {chosen.length} 个日程</span>}</button>{typeof navigator.share === 'function' && <button className="button button-secondary" disabled={!!exportError} onClick={share}><Share2 size={17} />分享</button>}</div>
          <p className="under-action">支持 Apple 日历、Google Calendar 和 Outlook</p>
          {chosen.length > 0 && <details className="disclosure date-details"><summary><span>查看全部 {chosen.length} 个日期</span><ChevronDown size={17} /></summary><div className="date-preview-list">{chosen.map(item => <div key={item.year}><span>{dateString(item.info!.solar)} <small>{item.info!.weekday}</small></span><span>{lunarDay(item.info!.lunar)}</span></div>)}</div></details>}
          <div className="notice export-notice"><Info size={16} /><p>这是一次性导入文件，未来新增年份不会自动同步。</p></div>
          <button className="text-button back-button" onClick={() => goTo('future')}><ArrowLeft size={15} />返回调整日期</button>
        </section>
      </div>}
    </main>
    <footer className="app-footer"><span><LockKeyhole size={13} />所有计算在本地完成</span><span>支持农历 {MIN_YEAR}–{MAX_YEAR} 年</span></footer>
    {message && <div className="toast" role="status"><Check size={17} /><span>{message}</span><button aria-label="关闭提示" onClick={() => setMessage('')}><X size={16} /></button></div>}
  </div>
}

const root = createRoot(document.getElementById('root')!)
root.render(<React.StrictMode><App /></React.StrictMode>)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(() => navigator.serviceWorker.ready).then(registration => {
      const assets = performance.getEntriesByType('resource').map(entry => entry.name).filter(url => new URL(url).origin === location.origin)
      registration.active?.postMessage({ assets })
    }).catch(() => { /* Offline caching is optional. */ })
  })
}
