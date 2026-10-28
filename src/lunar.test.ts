import { describe, expect, it } from 'vitest';
import { getLunarMonths, lunarToSolar, solarToLunar, predictDates, MIN_SOLAR, MAX_SOLAR } from './lunar';

describe('农历换算', () => {
  // Samples cross-checked against Hong Kong Observatory's published tables.
  it.each([
    [{year:1917,month:3,day:23}, {year:1917,month:2,day:1,isLeap:true}],
    [{year:1922,month:6,day:25}, {year:1922,month:5,day:1,isLeap:true}],
    [{year:1987,month:7,day:26}, {year:1987,month:6,day:1,isLeap:true}],
    [{year:2018,month:11,day:8}, {year:2018,month:10,day:1,isLeap:false}],
    [{year:2026,month:2,day:17}, {year:2026,month:1,day:1,isLeap:false}],
    [{year:2023,month:3,day:22}, {year:2023,month:2,day:1,isLeap:true}],
    [{year:2033,month:12,day:22}, {year:2033,month:11,day:1,isLeap:true}],
    [{year:2000,month:2,day:29}, {year:2000,month:1,day:25,isLeap:false}],
    [{year:2100,month:1,day:1}, {year:2099,month:11,day:21,isLeap:false}],
  ])('已知日期双向换算 %o', (solar, lunar) => {
    expect(solarToLunar(solar).lunar).toEqual(lunar);
    expect(lunarToSolar(lunar).solar).toEqual(solar);
  });
  it('支持边界与闰月，逐年逐月双向往返', () => {
    for (let year = 1901; year <= 2099; year++) {
      for (const m of getLunarMonths(year)) {
        for (const day of [1, m.days]) {
          const lunar = {year, month: m.month, day, isLeap:m.isLeap};
          expect(solarToLunar(lunarToSolar(lunar).solar).lunar).toEqual(lunar);
        }
      }
    }
    expect(solarToLunar(MIN_SOLAR).lunar).toEqual({year:1901,month:1,day:1,isLeap:false});
    expect(solarToLunar(MAX_SOLAR).lunar.year).toBe(2099);
  });
  it('拒绝错误的公历、农历和闰月', () => {
    expect(() => solarToLunar({year:2025,month:2,day:29})).toThrow('不存在');
    expect(() => solarToLunar({year:2024,month:2,day:29})).not.toThrow();
    expect(() => solarToLunar({year:1800,month:1,day:1})).toThrow('公历日期须');
    expect(() => lunarToSolar({year:2026,month:6,day:1,isLeap:true})).toThrow('没有');
    expect(() => lunarToSolar({year:2026,month:4,day:30,isLeap:false})).toThrow('只有');
    expect(() => lunarToSolar({year:2026,month:1,day:0,isLeap:false})).toThrow();
  });
});

describe('农历纪念日推算', () => {
  const base = {startYear:2025,month:1,day:1,isLeap:false,years:4,leapPolicy:'skip' as const,dayPolicy:'skip' as const};
  it('按连续农历年份计算', () => {
    const result = predictDates(base);
    expect(result.map(r => r.info?.solar)).toEqual([{year:2025,month:1,day:29},{year:2026,month:2,day:17},{year:2027,month:2,day:6},{year:2028,month:1,day:26}]);
  });
  it('仅对应闰月时生成，或选择普通月份替代', () => {
    const args = {...base,startYear:2023,month:2,isLeap:true,years:2};
    const skipped = predictDates(args);
    expect(skipped.map(r => r.status)).toEqual(['ok','skipped']);
    expect(skipped[0].info?.solar).toEqual({year:2023,month:3,day:22});
    const adjusted = predictDates({...args,leapPolicy:'regular'});
    expect(adjusted[1].status).toBe('adjusted');
    expect(adjusted[1].info?.lunar.isLeap).toBe(false);
    expect(adjusted[1].reason).toContain('普通月份');
  });
  it('小月三十可跳过或调整为最后一天', () => {
    const args = {...base,startYear:2026,month:4,day:30,years:1};
    expect(predictDates(args)[0].status).toBe('skipped');
    const adjusted = predictDates({...args,dayPolicy:'last'})[0];
    expect(adjusted.status).toBe('adjusted');
    expect(adjusted.info?.lunar.day).toBe(29);
  });
  it('禁止超出范围和非法输入', () => {
    expect(() => predictDates({...base,startYear:2099,years:2})).toThrow('最后一年');
    expect(() => predictDates({...base,years:101})).toThrow();
    expect(() => predictDates({...base,day:31})).toThrow();
  });
});
