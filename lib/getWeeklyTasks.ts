import { createClient } from '@supabase/supabase-js'
import {
  recommendTasks,
  type PlantedPlantInput,
  type WeeklyTasksResult,
  type WeatherContext,
} from '@/lib/weeklyTasks'
import { describeWeatherCode, type Forecast } from '@/lib/weather'
import {
  detectEvents,
  nearTermEvents,
  type WeatherEvent,
} from '@/lib/weatherEvents'

const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function dayName(iso: string, idx: number): string {
  if (idx === 0) return 'Heute'
  if (idx === 1) return 'Morgen'
  const [y, m, d] = iso.split('-').map(Number)
  return DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

function summarizeForecast(
  forecast: Forecast | null,
  events: WeatherEvent[]
): WeatherContext | undefined {
  if (!forecast || forecast.daily.length === 0) return undefined
  const daily = forecast.daily.slice(0, 7).map((d, i) => {
    const code = describeWeatherCode(d.weather_code)
    const rain = d.precip_mm >= 1 ? `, ${Math.round(d.precip_mm)}mm Regen` : ''
    const wind =
      d.wind_gust_max >= 50 ? `, Böen ${Math.round(d.wind_gust_max)}km/h` : ''
    return `${dayName(d.date, i)} ${Math.round(d.tmin)}-${Math.round(d.tmax)}° ${code.label}${rain}${wind}`
  })
  // Severe events that fall in the next 7 days are useful for the prompt;
  // we use detectEvents output (already 7-day scoped).
  const severe = events.map((e) => {
    const dayIdx = forecast.daily.findIndex((d) => d.date === e.date)
    const day = dayIdx >= 0 ? dayName(e.date, dayIdx) : e.date
    if (e.type === 'trocken') {
      const startIdx = forecast.daily.findIndex((d) => d.date === e.date)
      const endIdx = forecast.daily.findIndex((d) => d.date === e.endDate)
      const startDay = startIdx >= 0 ? dayName(e.date, startIdx) : e.date
      const endDay = endIdx >= 0 ? dayName(e.endDate ?? e.date, endIdx) : ''
      return `Trockenperiode ${startDay}–${endDay}: warm und trocken, Boden trocknet schnell`
    }
    const hourTxt = e.hour !== undefined ? ` ab ${e.hour} Uhr` : ''
    const labelMap: Record<WeatherEvent['type'], string> = {
      frost: 'Frost',
      wind: 'starker Wind',
      sturm: 'Sturm',
      gewitter: 'Gewitter',
      starkregen: 'Starkregen',
      vielregen: 'viel Regen',
      hitze: 'Hitze',
      warm: 'warm',
      trocken: 'Trocken',
    }
    return `${day}${hourTxt} ${labelMap[e.type]}`
  })
  return { daily, severe }
}

export async function getWeeklyTasks(
  gardenId: string,
  planted: PlantedPlantInput[],
  forecast?: Forecast | null
): Promise<WeeklyTasksResult> {
  if (planted.length === 0) return { tasks: [] }

  const today = todayISO()
  const admin = adminClient()

  const { data: garden } = await admin
    .from('gardens')
    .select('weekly_tasks_cache, weekly_tasks_cache_date')
    .eq('id', gardenId)
    .maybeSingle()

  if (
    garden?.weekly_tasks_cache_date === today &&
    garden.weekly_tasks_cache &&
    typeof garden.weekly_tasks_cache === 'object'
  ) {
    return garden.weekly_tasks_cache as WeeklyTasksResult
  }

  // Build weather summary if forecast available. Events drive severe hints.
  const events = forecast ? detectEvents(forecast) : []
  // Restrict severe hints to the most actionable: today + tomorrow's
  // warnings PLUS any trockenperiode in the 7-day window.
  const severe = events.filter(
    (e) => e.type === 'trocken' || nearTermEvents([e]).length > 0
  )
  const weather = summarizeForecast(forecast ?? null, severe)

  let result: WeeklyTasksResult
  try {
    result = await recommendTasks({ todayISO: today, planted, weather })
  } catch (e) {
    console.error('weeklyTasks Gemini failed:', e)
    return { tasks: [] }
  }

  const { error: updateError } = await admin
    .from('gardens')
    .update({
      weekly_tasks_cache: result,
      weekly_tasks_cache_date: today,
    })
    .eq('id', gardenId)

  if (updateError) {
    console.error('weeklyTasks cache write failed:', updateError)
  }

  return result
}
