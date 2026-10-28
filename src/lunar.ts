import { Lunar, LunarYear, Solar } from 'lunar-javascript';

// Complete lunar years whose corresponding Gregorian dates fit within the
// Hong Kong Observatory's published 1901–2100 conversion tables.
export const MIN_YEAR = 1901;
export const MAX_YEAR = 2099;
export const MONTH_NAMES = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'] as const;
export const DAY_NAMES = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'] as const;

export interface SolarDate { year: number; month: number; day: number }
export interface LunarDate { year: number; month: number; day: number; isLeap: boolean }
export interface LunarInfo { lunar: LunarDate; solar: SolarDate; lunarText: string; yearGanZhi: string; zodiac: string; weekday: string }
export interface LunarMonthOption { month: number; isLeap: boolean; days: number; label: string }
export interface Prediction { year: number; status: 'ok' | 'adjusted' | 'skipped'; reason: string; info?: LunarInfo }
export interface PredictionOptions { startYear: number; month: number; day: number; isLeap: boolean; years: number; leapPolicy: 'skip' | 'regular'; dayPolicy: 'skip' | 'last' }

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
function checkYear(year: number) {
  if (!isInt(year) || year < MIN_YEAR || year > MAX_YEAR) throw new Error(`农历年份须在 ${MIN_YEAR}–${MAX_YEAR} 之间。`);
}
export function solarDateString(solar: SolarDate): string {
  return `${solar.year}-${String(solar.month).padStart(2, '0')}-${String(solar.day).padStart(2, '0')}`;
}
function solarParts(s: ReturnType<typeof Lunar.fromYmd>['getSolar'] extends (...args: never[]) => infer R ? R : never): SolarDate {
  return { year: s.getYear(), month: s.getMonth(), day: s.getDay() };
}
export const MIN_SOLAR = solarParts(Lunar.fromYmd(MIN_YEAR, 1, 1).getSolar());
const maxMonths = LunarYear.fromYear(MAX_YEAR).getMonths().filter(m => m.getYear() === MAX_YEAR);
const lastMonth = maxMonths[maxMonths.length - 1];
export const MAX_SOLAR = solarParts(Lunar.fromYmd(MAX_YEAR, lastMonth.getMonth(), lastMonth.getDayCount()).getSolar());

export function validateSolar(solar: SolarDate): void {
  if (!solar || !isInt(solar.year) || !isInt(solar.month) || !isInt(solar.day) || solar.month < 1 || solar.month > 12 || solar.day < 1 || solar.day > 31) throw new Error('请输入有效的公历日期。');
  const d = new Date(Date.UTC(solar.year, solar.month - 1, solar.day));
  if (d.getUTCFullYear() !== solar.year || d.getUTCMonth() + 1 !== solar.month || d.getUTCDate() !== solar.day) throw new Error('该公历日期不存在，请检查月份和日期。');
  const value = solarDateString(solar);
  if (value < solarDateString(MIN_SOLAR) || value > solarDateString(MAX_SOLAR)) throw new Error(`公历日期须在 ${solarDateString(MIN_SOLAR)} 至 ${solarDateString(MAX_SOLAR)} 之间。`);
}
export function getLunarMonths(year: number): LunarMonthOption[] {
  checkYear(year);
  return LunarYear.fromYear(year).getMonths().filter(m => m.getYear() === year).map(m => {
    const n = m.getMonth();
    return { month: Math.abs(n), isLeap: n < 0, days: m.getDayCount(), label: `${n < 0 ? '闰' : ''}${MONTH_NAMES[Math.abs(n) - 1]}` };
  });
}
function toInfo(l: ReturnType<typeof Lunar.fromYmd>): LunarInfo {
  const rawMonth = l.getMonth();
  const solar = solarParts(l.getSolar());
  const lunar = { year: l.getYear(), month: Math.abs(rawMonth), day: l.getDay(), isLeap: rawMonth < 0 };
  const weekday = `星期${['日','一','二','三','四','五','六'][new Date(Date.UTC(solar.year, solar.month - 1, solar.day)).getUTCDay()]}`;
  return { lunar, solar, lunarText: `${l.getYearInChinese()}年${l.getMonthInChinese()}月${l.getDayInChinese()}`, yearGanZhi: l.getYearInGanZhi(), zodiac: l.getYearShengXiao(), weekday };
}
export function solarToLunar(solar: SolarDate): LunarInfo {
  validateSolar(solar);
  return toInfo(Solar.fromYmd(solar.year, solar.month, solar.day).getLunar());
}
export function lunarToSolar(lunar: LunarDate): LunarInfo {
  if (!lunar) throw new Error('请输入完整农历日期。');
  checkYear(lunar.year);
  if (!isInt(lunar.month) || lunar.month < 1 || lunar.month > 12 || typeof lunar.isLeap !== 'boolean') throw new Error('请输入有效的农历月份。');
  const m = getLunarMonths(lunar.year).find(m => m.month === lunar.month && m.isLeap === lunar.isLeap);
  if (!m) throw new Error(`${lunar.year} 年没有${lunar.isLeap ? '闰' : ''}${MONTH_NAMES[lunar.month - 1]}。`);
  if (!isInt(lunar.day) || lunar.day < 1 || lunar.day > m.days) throw new Error(`${m.label}只有 ${m.days} 天，请选择有效日期。`);
  return toInfo(Lunar.fromYmd(lunar.year, lunar.isLeap ? -lunar.month : lunar.month, lunar.day));
}
/** Start a converted anniversary in the current China-local lunar year. */
export function anniversaryRuleFromDate(lunar: LunarDate, today: SolarDate): Pick<PredictionOptions, 'startYear' | 'month' | 'day' | 'isLeap'> {
  return { startYear: solarToLunar(today).lunar.year, month: lunar.month, day: lunar.day, isLeap: lunar.isLeap };
}
export function predictDates(options: PredictionOptions): Prediction[] {
  const { startYear, month, day, isLeap, years, leapPolicy, dayPolicy } = options;
  checkYear(startYear);
  if (!isInt(years) || years < 1 || years > 100 || startYear + years - 1 > MAX_YEAR) throw new Error(`推算年数须为 1–100 年，且最后一年不能超过 ${MAX_YEAR} 年。`);
  if (!isInt(month) || month < 1 || month > 12 || !isInt(day) || day < 1 || day > 30 || typeof isLeap !== 'boolean') throw new Error('请输入有效的农历月日。');
  if (!['skip','regular'].includes(leapPolicy) || !['skip','last'].includes(dayPolicy)) throw new Error('请选择有效的日期处理策略。');
  return Array.from({ length: years }, (_, i): Prediction => {
    const year = startYear + i;
    const months = getLunarMonths(year);
    let actualLeap = isLeap;
    const changes: string[] = [];
    if (isLeap && !months.some(m => m.month === month && m.isLeap)) {
      if (leapPolicy === 'skip') return { year, status: 'skipped', reason: `该年没有闰${MONTH_NAMES[month - 1]}，已跳过` };
      actualLeap = false;
      changes.push('无对应闰月，改用普通月份');
    }
    const m = months.find(m => m.month === month && m.isLeap === actualLeap)!;
    let actualDay = day;
    if (day > m.days) {
      if (dayPolicy === 'skip') return { year, status: 'skipped', reason: `${m.label}只有 ${m.days} 天，已跳过` };
      actualDay = m.days;
      changes.push(`该月只有 ${m.days} 天，已调整至最后一天`);
    }
    return { year, status: changes.length ? 'adjusted' : 'ok', reason: changes.join('；'), info: lunarToSolar({ year, month, day: actualDay, isLeap: actualLeap }) };
  });
}
