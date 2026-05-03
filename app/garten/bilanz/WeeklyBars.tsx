import type { BilanzWeekRow } from '@/app/garten/plan/actions'

type Props = {
  weeks: BilanzWeekRow[]
}

const BAR_W = 14
const BAR_GAP = 6
const MAX_H = 60
const LABEL_H = 14

/**
 * Stage 10 — tiny SVG bar chart of harvest activity per ISO week.
 * Server-rendered, no client JS. Renders only weeks that have data —
 * so a single-week garden gets a single bar (chart hidden by parent
 * if < 3 weeks, but renders fine here regardless).
 */
export default function WeeklyBars({ weeks }: Props) {
  if (weeks.length === 0) return null
  const max = Math.max(...weeks.map((w) => w.totalAmount), 1)
  const width = weeks.length * (BAR_W + BAR_GAP) - BAR_GAP
  const height = MAX_H + LABEL_H + 6
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label={`Ernte pro Woche, ${weeks.length} Wochen mit Daten`}
    >
      {weeks.map((w, i) => {
        const h = Math.max(2, (w.totalAmount / max) * MAX_H)
        const x = i * (BAR_W + BAR_GAP)
        const y = MAX_H - h
        return (
          <g key={w.weekKey}>
            <rect
              x={x}
              y={y}
              width={BAR_W}
              height={h}
              rx={2}
              fill="#4A7C59"
              opacity={0.85}
            >
              <title>
                {w.weekLabel}: {w.count} Ernten
              </title>
            </rect>
            <text
              x={x + BAR_W / 2}
              y={MAX_H + LABEL_H}
              fontSize={9}
              fill="#888780"
              textAnchor="middle"
            >
              {w.weekLabel.replace('KW ', '')}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
