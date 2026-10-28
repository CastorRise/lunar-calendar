declare module 'lunar-javascript' {
  interface SolarValue { getYear(): number; getMonth(): number; getDay(): number; getLunar(): LunarValue }
  interface LunarValue { getYear(): number; getMonth(): number; getDay(): number; getSolar(): SolarValue; getYearInChinese(): string; getMonthInChinese(): string; getDayInChinese(): string; getYearInGanZhi(): string; getYearShengXiao(): string }
  interface LunarMonthValue { getYear(): number; getMonth(): number; getDayCount(): number }
  export const Solar: { fromYmd(year: number, month: number, day: number): SolarValue };
  export const Lunar: { fromYmd(year: number, month: number, day: number): LunarValue };
  export const LunarYear: { fromYear(year: number): { getMonths(): LunarMonthValue[] } };
}
