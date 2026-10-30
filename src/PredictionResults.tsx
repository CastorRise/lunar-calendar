import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Copy, List } from 'lucide-react'
import { DAY_NAMES, MONTH_NAMES, solarDateString, type LunarInfo, type Prediction } from './lunar'

interface PredictionResultsProps {
  results: Prediction[]
  selected: Set<number>
  onToggle: (year: number) => void
  onSelectAll: () => void
  onClear: () => void
  onCopy: () => void
  onContinue: () => void
}

type ValidPrediction = Prediction & { info: LunarInfo }
const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const statusNames = { ok: '正常', adjusted: '已调整', skipped: '已跳过' }
const lunarDay = (info: LunarInfo) => `${info.lunar.isLeap ? '闰' : ''}${MONTH_NAMES[info.lunar.month - 1]}${DAY_NAMES[info.lunar.day - 1]}`
const monthKey = (item: ValidPrediction) => `${item.info.solar.year}-${String(item.info.solar.month).padStart(2, '0')}`

export function PredictionResults({ results, selected, onToggle, onSelectAll, onClear, onCopy, onContinue }: PredictionResultsProps) {
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [displayMonth, setDisplayMonth] = useState('')
  const valid = useMemo(() => results.filter((item): item is ValidPrediction => !!item.info), [results])
  const skipped = results.filter(item => !item.info)
  const adjusted = valid.filter(item => item.status === 'adjusted').length
  const selectedCount = valid.filter(item => selected.has(item.year)).length
  const months = useMemo(() => [...new Set(valid.map(monthKey))].sort(), [valid])
  const activeKey = months.includes(displayMonth) ? displayMonth : months[0]
  const activeIndex = months.indexOf(activeKey)
  const [year, month] = activeKey ? activeKey.split('-').map(Number) : [0, 0]
  const calendarYears = [...new Set(valid.map(item => item.info.solar.year))]
  const availableMonths = months.filter(key => key.startsWith(`${year}-`))
  const monthEvents = valid.filter(item => monthKey(item) === activeKey)
  const firstWeekday = year ? new Date(Date.UTC(year, month - 1, 1)).getUTCDay() : 0
  const monthDays = year ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0

  useEffect(() => { setDisplayMonth('') }, [results])

  return <>
    <div className="panel-header">
      <div>
        <p className="eyebrow">推算结果</p>
        <h2>{results.length ? `${valid.length} 个可用日期` : '等待推算'}</h2>
        <p className="text-muted">{results.length ? `其中 ${adjusted} 个已调整，${skipped.length} 个年份已跳过` : '设置农历月日和年份，即可查看结果。'}</p>
      </div>
      <span className="badge">已选 {selectedCount}</span>
    </div>

    <div className="toolbar">
      <div className="selection-tools">
        <button className="text-button" onClick={onSelectAll} disabled={!valid.length}>全选</button>
        <button className="text-button" onClick={onClear} disabled={!selectedCount}>清空选择</button>
        <button className="text-button" onClick={onCopy} disabled={!results.length}><Copy size={14} /> 复制</button>
      </div>
      <div className="segmented compact" role="group" aria-label="结果视图">
        <button aria-pressed={view === 'list'} className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={15} /> 列表</button>
        <button aria-pressed={view === 'calendar'} className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={15} /> 月历</button>
      </div>
    </div>

    {view === 'list' ? <div className="result-list">
      {results.map(item => <label className={`result-row ${item.info ? '' : 'is-skipped'}`} key={item.year}>
        <input type="checkbox" aria-label={`选择农历 ${item.year} 年`} checked={!!item.info && selected.has(item.year)} disabled={!item.info} onChange={() => onToggle(item.year)} />
        <span className="result-year">{item.year}<small>农历年</small></span>
        <div className="result-date">
          <strong>{item.info ? solarDateString(item.info.solar) : '无对应日期'}</strong>
          <span className="result-description">{item.info ? `${item.info.weekday} · ${lunarDay(item.info)}` : item.reason}</span>
          {item.info && item.reason && <span className="result-description">{item.reason}</span>}
        </div>
        <span className={`status-badge status-${item.status}`}>{statusNames[item.status]}</span>
      </label>)}
      {!results.length && <div className="empty-state"><CalendarDays size={28} /><p>有效的日期会出现在这里</p><span>先在左侧完成推算设置。</span></div>}
    </div> : <>
      {activeKey ? <>
        <div className="calendar-toolbar">
          <button className="icon-button" aria-label="上一个有日程的月份" disabled={activeIndex <= 0} onClick={() => setDisplayMonth(months[activeIndex - 1])}><ChevronLeft size={18} /></button>
          <div className="calendar-selectors">
            <select aria-label="月历公历年份" value={year} onChange={event => setDisplayMonth(months.find(key => key.startsWith(`${event.target.value}-`))!)}>
              {calendarYears.map(item => <option key={item} value={item}>{item} 年</option>)}
            </select>
            <select aria-label="月历公历月份" value={activeKey} onChange={event => setDisplayMonth(event.target.value)}>
              {availableMonths.map(key => <option key={key} value={key}>{Number(key.split('-')[1])} 月</option>)}
            </select>
          </div>
          <button className="icon-button" aria-label="下一个有日程的月份" disabled={activeIndex >= months.length - 1} onClick={() => setDisplayMonth(months[activeIndex + 1])}><ChevronRight size={18} /></button>
        </div>
        <div className="calendar-grid" aria-label={`${year} 年 ${month} 月`}>
          {weekdays.map(day => <span className="calendar-weekday" key={day}>{day}</span>)}
          {Array.from({ length: firstWeekday }, (_, index) => <span className="calendar-day" key={`blank-${index}`} aria-hidden="true" />)}
          {Array.from({ length: monthDays }, (_, index) => {
            const day = index + 1
            const item = monthEvents.find(event => event.info.solar.day === day)
            return item ? <button key={day} className={`calendar-day is-event ${selected.has(item.year) ? 'is-selected' : ''}`} aria-pressed={selected.has(item.year)} aria-label={`${year}年${month}月${day}日，${lunarDay(item.info)}，${selected.has(item.year) ? '已选择' : '未选择'}`} onClick={() => onToggle(item.year)}>
              <strong>{day}</strong><small>{DAY_NAMES[item.info.lunar.day - 1]}</small>
            </button> : <span key={day} className="calendar-day">{day}</span>
          })}
        </div>
        <p className="text-muted calendar-hint">本月日程：{monthEvents.map(item => lunarDay(item.info)).join('、')}。点击标记日期可选择或取消。</p>
        {monthEvents.filter(item => item.reason).map(item => <div className="notice" key={item.year}>{solarDateString(item.info.solar)}：{item.reason}</div>)}
      </> : <div className="empty-state"><CalendarDays size={28} /><p>没有可显示的日期</p><span>检查日期设置或特殊日期处理策略。</span></div>}
      {skipped.length > 0 && <details className="disclosure">
        <summary>查看 {skipped.length} 个跳过年份</summary>
        <div className="result-list">{skipped.map(item => <div className="result-row is-skipped" key={item.year}>
          <span className="result-year">{item.year}</span><span className="result-description">{item.reason}</span><span className="status-badge status-skipped">已跳过</span>
        </div>)}</div>
      </details>}
    </>}

    <div className="result-footer">
      <div><strong>已选 {selectedCount} 个日期</strong><p className="text-muted">只导出选中的结果</p></div>
      <button className="button button-primary" disabled={!selectedCount} onClick={onContinue}>设置日程 <ArrowRight size={17} /></button>
    </div>
  </>
}
