'use client'

import { describeWeatherCode, type Forecast } from '@/lib/weather'
import type { WeatherEvent } from '@/lib/weatherEvents'

const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

function dayShort(iso: string, idx: number): string {
  if (idx === 0) return 'Heute'
  if (idx === 1) return 'Morgen'
  const [y, m, d] = iso.split('-').map(Number)
  return DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

function eventLabel(type: WeatherEvent['type']): string {
  switch (type) {
    case 'frost':
      return '❄️ Frost'
    case 'sturm':
      return '💨 Sturm'
    case 'wind':
      return '💨 Starker Wind'
    case 'gewitter':
      return '⛈️ Gewitter'
    case 'starkregen':
      return '🌧️ Starkregen'
    case 'vielregen':
      return '🌧️ Viel Regen'
    case 'hitze':
      return '🔥 Hitze'
    case 'warm':
      return '☀️ Warm'
    case 'trocken':
      return '☀️ Trocken'
  }
}

const WARNUNG_BG = '#FDE8E2'
const WARNUNG_BORDER = '#C17B5C'
const WARNUNG_FG = '#C17B5C'

const HINWEIS_BG = '#F7F0E0'
const HINWEIS_BORDER = '#D4A85C'
const HINWEIS_FG = '#A47736'

export default function WeatherStrip({
  forecast,
  locationLabel,
  events,
  warnings,
}: {
  forecast: Forecast
  locationLabel: string | null
  events: WeatherEvent[]
  warnings: WeatherEvent[]
}) {
  const eventsByDate = new Map<string, WeatherEvent[]>()
  for (const e of events) {
    const list = eventsByDate.get(e.date) ?? []
    list.push(e)
    eventsByDate.set(e.date, list)
  }

  return (
    <section
      className="mb-6 bg-white rounded-xl border p-4"
      style={{ borderColor: '#E8E6DF' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-medium" style={{ color: '#2C2C2A' }}>
          🌤️ Wetter
        </h2>
        {locationLabel && (
          <span className="text-xs" style={{ color: '#888780' }}>
            {locationLabel}
          </span>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {forecast.daily.slice(0, 7).map((d, i) => {
          const code = describeWeatherCode(d.weather_code)
          const dayEvents = eventsByDate.get(d.date) ?? []
          const hasWarnung = dayEvents.some((e) => e.severity === 'warnung')
          const hasHinweis = dayEvents.some((e) => e.severity === 'hinweis')
          const bg = hasWarnung
            ? WARNUNG_BG
            : hasHinweis
            ? HINWEIS_BG
            : '#FAFAF7'
          const borderColor = hasWarnung
            ? WARNUNG_BORDER
            : hasHinweis
            ? HINWEIS_BORDER
            : 'transparent'
          return (
            <div
              key={d.date}
              className="rounded-lg px-1 py-2 flex flex-col items-center"
              style={{
                backgroundColor: bg,
                border: `1px solid ${borderColor}`,
              }}
            >
              <span
                className="text-[10px] uppercase tracking-wide font-medium"
                style={{ color: '#888780' }}
              >
                {dayShort(d.date, i)}
              </span>
              <span className="text-xl my-1 leading-none" aria-label={code.label}>
                {code.icon}
              </span>
              <span
                className="text-xs font-medium"
                style={{ color: '#2C2C2A' }}
              >
                {Math.round(d.tmax)}°
              </span>
              <span className="text-[10px]" style={{ color: '#888780' }}>
                {Math.round(d.tmin)}°
              </span>
              {d.precip_mm >= 1 && (
                <span
                  className="text-[10px] mt-1"
                  style={{ color: '#3A6BA5' }}
                >
                  {Math.round(d.precip_mm)}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {warnings.length > 0 && (
        <div className="mt-3 space-y-2">
          {warnings.map((e, i) => {
            const isWarn = e.severity === 'warnung'
            const bg = isWarn ? WARNUNG_BG : HINWEIS_BG
            const fg = isWarn ? WARNUNG_FG : HINWEIS_FG
            return (
              <div
                key={`${e.type}-${e.date}-${i}`}
                className="rounded-lg p-3"
                style={{ backgroundColor: bg }}
              >
                <span
                  className="inline-block text-[10px] font-semibold uppercase tracking-wide rounded px-2 py-1 mb-2"
                  style={{
                    backgroundColor: '#FFFFFF',
                    color: fg,
                  }}
                >
                  {eventLabel(e.type)}
                </span>
                <p
                  className="text-sm leading-snug"
                  style={{ color: '#2C2C2A' }}
                >
                  {e.message}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
