// Deterministic severe-event detection. No Gemini, no DB.
// Two severity tiers — `hinweis` (good to know) vs `warnung` (actionable
// risk). Thresholds aligned with the Beaufort scale and DWD norms so we
// don't freak out gardeners over a stiff breeze.

import type { Forecast, DailyForecast, HourlyForecast } from './weather'

export type EventType =
  | 'frost'
  | 'wind'
  | 'sturm'
  | 'hitze'
  | 'warm'
  | 'starkregen'
  | 'vielregen'
  | 'gewitter'
  | 'trocken'

export type EventSeverity = 'warnung' | 'hinweis'

export type WeatherEvent = {
  type: EventType
  severity: EventSeverity
  date: string // ISO YYYY-MM-DD (start date for trockenperiode)
  endDate?: string // ISO, only for trockenperiode
  hour?: number // 0-23, when applicable
  message: string
}

// Thresholds — change here if Kim disagrees in the field.
const T = {
  // Beaufort 7 starts at 50 km/h, Bft 9 (Sturm) at 75 km/h
  windHinweisGust: 50, // Bft 7-8: starker / stürmischer Wind
  sturmGust: 75, // Bft 9+: Sturm
  // Frost: any sub-zero Tmin during growing season is actionable
  frostMinC: 0,
  // Hitze: 28°C warm, 32°C echte Hitze (DWD Hitzewarnung ~32°C)
  warmMaxC: 28,
  hitzeMaxC: 32,
  // Starkregen: DWD Markante 15-25mm/h, Unwetter 25-40mm/h. Tagesbasis konservativer.
  vielRegenMmDay: 15,
  starkregenMmDay: 30,
  vielRegenMmHour: 8,
  starkregenMmHour: 15,
  // Trockenperiode: 5+ Tage <2mm + warm
  trockenMaxMm: 2,
  trockenMinTmaxC: 20,
  trockenMinDays: 5,
}

const THUNDER_CODES = new Set([95, 96, 99])

function dayName(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
  return days[date.getUTCDay()]
}

function findFirstHour(
  hourly: HourlyForecast[],
  date: string,
  predicate: (h: HourlyForecast) => boolean
): number | undefined {
  const hits = hourly.filter((h) => h.date === date && predicate(h))
  if (hits.length === 0) return undefined
  hits.sort((a, b) => a.hour - b.hour)
  return hits[0].hour
}

export function detectEvents(forecast: Forecast): WeatherEvent[] {
  const events: WeatherEvent[] = []
  const today = forecast.daily[0]?.date ?? ''

  for (const d of forecast.daily) {
    const isToday = d.date === today
    const tag = isToday ? 'heute' : dayName(d.date)

    // Frost — single warnung tier
    if (d.tmin < T.frostMinC) {
      events.push({
        type: 'frost',
        severity: 'warnung',
        date: d.date,
        message: `Frostnacht ${tag} (${Math.round(d.tmin)} °C). Frostempfindliche Pflanzen schützen oder reinholen.`,
      })
    }

    // Hitze: Warnung > 32°C, Hinweis 28-32°C (mutually exclusive)
    if (d.tmax > T.hitzeMaxC) {
      events.push({
        type: 'hitze',
        severity: 'warnung',
        date: d.date,
        message: `Hitze ${tag} bis ${Math.round(d.tmax)} °C. Schattieren, mulchen, morgens und abends gießen — Tomatenblüten setzen über 32 °C schlecht an.`,
      })
    } else if (d.tmax > T.warmMaxC) {
      events.push({
        type: 'warm',
        severity: 'hinweis',
        date: d.date,
        message: `Warmer Tag ${tag} bis ${Math.round(d.tmax)} °C. Morgens oder abends gießen, junge Pflanzen lieber im Schatten.`,
      })
    }

    // Wind: Warnung Bft 9+ (>=75 km/h), Hinweis Bft 7-8 (50-74)
    if (d.wind_gust_max >= T.sturmGust) {
      const hour = findFirstHour(
        forecast.hourly,
        d.date,
        (h) => h.wind_gust >= T.sturmGust
      )
      const hourTxt = hour !== undefined ? ` ab ${hour} Uhr` : ''
      events.push({
        type: 'sturm',
        severity: 'warnung',
        date: d.date,
        hour,
        message: `Sturm ${tag}${hourTxt} (Böen bis ${Math.round(d.wind_gust_max)} km/h, Bft 9+). Stäbe und Folien sichern, hohe Pflanzen abstützen, Vlies runter.`,
      })
    } else if (d.wind_gust_max >= T.windHinweisGust) {
      const hour = findFirstHour(
        forecast.hourly,
        d.date,
        (h) => h.wind_gust >= T.windHinweisGust
      )
      const hourTxt = hour !== undefined ? ` ab ${hour} Uhr` : ''
      events.push({
        type: 'wind',
        severity: 'hinweis',
        date: d.date,
        hour,
        message: `Starker Wind ${tag}${hourTxt} (Böen bis ${Math.round(d.wind_gust_max)} km/h, Bft 7-8). Pflanzstäbe checken, hohe Pflanzen anbinden.`,
      })
    }

    // Gewitter — single warnung tier (with Hagel mention)
    if (THUNDER_CODES.has(d.weather_code)) {
      const hour = findFirstHour(forecast.hourly, d.date, (h) =>
        THUNDER_CODES.has(h.weather_code)
      )
      const hourTxt = hour !== undefined ? ` gegen ${hour} Uhr` : ''
      const hagel =
        d.weather_code === 96 || d.weather_code === 99
          ? ', Hagel möglich'
          : ''
      events.push({
        type: 'gewitter',
        severity: 'warnung',
        date: d.date,
        hour,
        message: `Gewitter ${tag}${hourTxt}${hagel}. Junge Pflanzen abdecken, lockeres Material sichern.`,
      })
    }

    // Regen: Warnung > 30mm/Tag oder > 15mm/h, Hinweis 15-30mm/Tag oder 8-15mm/h
    const heavyHour = findFirstHour(
      forecast.hourly,
      d.date,
      (h) => h.precip_mm > T.starkregenMmHour
    )
    const moderateHour = findFirstHour(
      forecast.hourly,
      d.date,
      (h) => h.precip_mm > T.vielRegenMmHour
    )
    if (
      d.precip_mm > T.starkregenMmDay ||
      heavyHour !== undefined
    ) {
      const hourTxt = heavyHour !== undefined ? ` ab ${heavyHour} Uhr` : ''
      events.push({
        type: 'starkregen',
        severity: 'warnung',
        date: d.date,
        hour: heavyHour,
        message: `Starkregen ${tag}${hourTxt} (${Math.round(d.precip_mm)} mm). Sämlinge und junge Pflanzen abdecken, Saatreihen vor Auswaschung schützen.`,
      })
    } else if (
      d.precip_mm > T.vielRegenMmDay ||
      moderateHour !== undefined
    ) {
      const hourTxt = moderateHour !== undefined ? ` ab ${moderateHour} Uhr` : ''
      events.push({
        type: 'vielregen',
        severity: 'hinweis',
        date: d.date,
        hour: moderateHour,
        message: `Viel Regen ${tag}${hourTxt} (${Math.round(d.precip_mm)} mm). Vorher nicht gießen, frische Saatreihen bei Bedarf abdecken.`,
      })
    }
  }

  // Trockenperiode — Hinweis (mehrtägiges Muster)
  const allDays = forecast.daily.map((d) => d.date)
  const dryDays = new Set(
    forecast.daily
      .filter(
        (d) =>
          d.precip_mm < T.trockenMaxMm &&
          d.tmax > T.trockenMinTmaxC
      )
      .map((d) => d.date)
  )
  let longestStart = -1
  let longestLen = 0
  let curStart = -1
  let curLen = 0
  for (let i = 0; i < allDays.length; i++) {
    if (dryDays.has(allDays[i])) {
      if (curLen === 0) curStart = i
      curLen++
      if (curLen > longestLen) {
        longestLen = curLen
        longestStart = curStart
      }
    } else {
      curLen = 0
    }
  }
  if (longestLen >= T.trockenMinDays && longestStart >= 0) {
    const startDate = allDays[longestStart]
    const endDate = allDays[longestStart + longestLen - 1]
    const peakTmax = Math.max(
      ...forecast.daily
        .filter((d) => d.date >= startDate && d.date <= endDate)
        .map((d) => d.tmax)
    )
    events.push({
      type: 'trocken',
      severity: 'hinweis',
      date: startDate,
      endDate,
      message: `${longestLen} trockene Tage in Folge erwartet (bis ${Math.round(peakTmax)} °C). Gießen nicht vergessen — mulchen hilft, die Feuchte zu halten.`,
    })
  }

  return events
}

// Filter events that are actionable in the next 48h: today + tomorrow.
// "Trocken" is shown if it covers any day in this window OR starts within it.
export function nearTermEvents(events: WeatherEvent[]): WeatherEvent[] {
  if (events.length === 0) return []
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date))
  const dates = Array.from(new Set(sorted.map((e) => e.date))).sort()
  if (dates.length === 0) return []
  const today = dates[0]
  const yIdx = dates.indexOf(today)
  const tomorrow = dates[yIdx + 1]
  return sorted.filter((e) => {
    if (e.type === 'trocken') {
      return (
        e.date <= (tomorrow ?? today) &&
        (e.endDate ?? e.date) >= today
      )
    }
    return e.date === today || e.date === tomorrow
  })
}
