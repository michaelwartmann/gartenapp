import Link from 'next/link'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { getCurrentGardenId } from '@/lib/currentGarden'
import { getGardenBilanz } from '@/app/garten/plan/actions'
import { formatHarvest } from '@/lib/harvestUnits'
import { removedReasonMeta } from '@/lib/removedReasons'
import { bedKindIcon } from '@/lib/bedKinds'
import WeeklyBars from './WeeklyBars'

export const dynamic = 'force-dynamic'

function categoryColor(cat: string): string {
  switch (cat) {
    case 'Gemüse': return '#4A7C59'
    case 'Kraut': return '#C17B5C'
    case 'Blume': return '#8B5A95'
    case 'Obst': return '#D49C3D'
    case 'Baum': return '#5C7C4A'
    case 'Strauch': return '#8FA376'
    case 'Nuss': return '#A37D5C'
    default: return '#888780'
  }
}

function formatISODate(iso: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${m[3]}.${m[2]}.${m[1]}`
}

function shortDate(iso: string | null): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${m[3]}.${m[2]}.`
}

export default async function BilanzPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const gardenId = await getCurrentGardenId()
  if (!gardenId) redirect('/login')

  const params = await searchParams
  const yearParam = params.year ? Number(params.year) : undefined
  const year = yearParam && Number.isFinite(yearParam) ? yearParam : undefined

  const bilanz = await getGardenBilanz(year)
  if (!bilanz) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: '#FAFAF7' }}
      >
        <p style={{ color: '#888780' }}>Keine Bilanz verfügbar.</p>
      </div>
    )
  }

  const isEmpty = bilanz.harvestEventCount === 0 && bilanz.lossCount === 0
  const weeksHaveEnough = bilanz.perWeek.length >= 3

  return (
    <div
      className="min-h-screen px-4 py-6 pb-12"
      style={{ backgroundColor: '#FAFAF7' }}
    >
      <div className="w-full max-w-md mx-auto">
        <header className="mb-4 flex items-center justify-between gap-2">
          <Link
            href="/"
            className="text-sm font-medium shrink-0"
            style={{ color: '#4A7C59' }}
          >
            ← Mein Garten
          </Link>
          <h1
            className="text-base font-medium text-center flex-1"
            style={{ color: '#2C2C2A' }}
          >
            📊 Bilanz
          </h1>
          {bilanz.availableYears.length > 1 ? (
            <YearSwitcher
              currentYear={bilanz.year}
              availableYears={bilanz.availableYears}
            />
          ) : (
            <span
              className="text-sm font-medium px-3 py-2"
              style={{ color: '#888780' }}
            >
              {bilanz.year}
            </span>
          )}
        </header>

        {/* Kopf-Numbers */}
        <div
          className="mb-6 rounded-xl p-4"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E6DF' }}
        >
          <p
            className="text-xs uppercase tracking-wide mb-2"
            style={{ color: '#888780' }}
          >
            {bilanz.year} · Diese Saison
          </p>
          {isEmpty ? (
            <p className="text-sm leading-relaxed" style={{ color: '#2C2C2A' }}>
              Noch keine Ernten dokumentiert. Tipp 🌾 auf einer deiner Pflanzen
              im{' '}
              <Link href="/garten/plan" className="underline" style={{ color: '#4A7C59' }}>
                Plan
              </Link>{' '}
              an, um anzufangen.
            </p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: '#2C2C2A' }}>
              <span>
                <strong style={{ color: '#4A7C59' }}>
                  {bilanz.harvestedPlantCount}
                </strong>{' '}
                Pflanzen geerntet
              </span>
              <span>
                <strong>{bilanz.harvestEventCount}</strong> Ernten
              </span>
              {bilanz.lossCount > 0 && (
                <span>
                  <strong style={{ color: '#C17B5C' }}>{bilanz.lossCount}</strong>{' '}
                  verloren
                </span>
              )}
            </div>
          )}
        </div>

        {/* 🏆 Highlights */}
        {bilanz.highlights.length > 0 && (
          <Section title="🏆 Highlights">
            <div className="space-y-2">
              {bilanz.highlights.map((h, i) => (
                <HighlightRow key={i} h={h} />
              ))}
            </div>
          </Section>
        )}

        {/* 🌱 Pro Pflanze */}
        {bilanz.perPlant.length > 0 && (
          <Section title="🌱 Pro Pflanze">
            <div className="space-y-2">
              {bilanz.perPlant.map((p) => (
                <Link
                  key={p.plantId}
                  href={`/plants/${p.plantId}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-white touch-manipulation active:scale-[0.99]"
                  style={{ borderColor: '#E8E6DF' }}
                >
                  <div
                    className="w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: categoryColor(p.plantCategory) + '22' }}
                  >
                    {p.plantIllustrationUrl ? (
                      <Image
                        src={p.plantIllustrationUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="object-cover"
                      />
                    ) : (
                      <span style={{ color: categoryColor(p.plantCategory) }}>🌱</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium leading-tight truncate"
                      style={{ color: '#2C2C2A' }}
                    >
                      {p.plantName}
                    </p>
                    <p className="text-xs leading-tight mt-0.5" style={{ color: '#888780' }}>
                      {p.byUnit
                        .map((u) => formatHarvest(u.total, u.unit))
                        .join(' + ')}
                      {' · '}
                      {p.count} {p.count === 1 ? 'Ernte' : 'Ernten'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* 📦 Pro Beet */}
        {bilanz.perBed.length > 0 && (
          <Section title="📦 Pro Beet">
            <div className="space-y-2">
              {bilanz.perBed.map((b) => (
                <div
                  key={b.bedId}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-white"
                  style={{ borderColor: '#E8E6DF' }}
                >
                  <span className="text-xl shrink-0">{bedKindIcon(b.bedKind)}</span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-sm font-medium leading-tight truncate"
                      style={{ color: '#2C2C2A' }}
                    >
                      {b.bedLabel}
                    </p>
                    <p className="text-xs leading-tight mt-0.5" style={{ color: '#888780' }}>
                      {b.byUnit
                        .map((u) => formatHarvest(u.total, u.unit))
                        .join(' + ')}
                      {' · '}
                      {b.count} {b.count === 1 ? 'Ernte' : 'Ernten'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 📈 Pro Woche */}
        {weeksHaveEnough && (
          <Section title="📈 Pro Woche">
            <div
              className="px-3 py-3 rounded-lg border bg-white"
              style={{ borderColor: '#E8E6DF' }}
            >
              <WeeklyBars weeks={bilanz.perWeek} />
            </div>
          </Section>
        )}

        {/* 💔 Was nicht klappte */}
        {!isEmpty && (
          <Section title="💔 Was nicht klappte">
            {bilanz.losses.length === 0 ? (
              <p className="text-sm leading-relaxed" style={{ color: '#888780' }}>
                Diese Saison ist alles geblieben — toll!
              </p>
            ) : (
              <div className="space-y-2">
                {bilanz.losses.map((l) => {
                  const meta = removedReasonMeta(l.reasonKey)
                  return (
                    <Link
                      key={l.plantingId}
                      href={`/plants/${l.plantId}`}
                      className="flex items-start gap-3 px-3 py-2 rounded-lg border bg-white touch-manipulation"
                      style={{ borderColor: '#F2D8CD' }}
                    >
                      <span className="text-lg shrink-0 mt-0.5">
                        {meta?.emoji ?? '·'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-sm font-medium leading-tight truncate"
                          style={{ color: '#2C2C2A' }}
                        >
                          {l.plantName}{' '}
                          <span style={{ color: '#888780', fontWeight: 400 }}>
                            ({bedKindIcon(l.bedKind)} {l.bedLabel})
                          </span>
                        </p>
                        <p
                          className="text-xs leading-tight mt-0.5"
                          style={{ color: '#C17B5C' }}
                        >
                          {meta?.label ?? l.reasonKey} · {shortDate(l.removedAt)}
                        </p>
                        {meta?.hint && (
                          <p
                            className="text-[11px] leading-tight mt-0.5"
                            style={{ color: '#888780' }}
                          >
                            💡 {meta.hint}
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-6">
      <h2
        className="text-xs font-medium uppercase tracking-wide mb-2"
        style={{ color: '#888780' }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function HighlightRow({
  h,
}: {
  h: import('@/app/garten/plan/actions').BilanzHighlight
}) {
  const text =
    h.kind === 'first'
      ? `Erste Ernte: ${h.plantName} (${formatHarvest(h.amount, h.unit)}) am ${shortDate(h.date)}`
      : h.kind === 'biggest'
      ? `Schwerste Einzelernte: ${h.plantName} ${formatHarvest(h.amount, h.unit)} (${shortDate(h.date)})`
      : h.kind === 'most_consistent'
      ? `Konstanteste: ${h.plantName} (${h.count}× · ${formatHarvest(h.totalAmount, h.unit)})`
      : `Stärkste Woche: ${h.weekLabel} (${h.count} Ernten)`
  return (
    <div
      className="px-3 py-2 rounded-lg text-sm border bg-white"
      style={{ borderColor: '#C9DCC9', color: '#2C2C2A' }}
    >
      {text}
    </div>
  )
}

function YearSwitcher({
  currentYear,
  availableYears,
}: {
  currentYear: number
  availableYears: number[]
}) {
  return (
    <div className="flex gap-1 shrink-0">
      {availableYears.map((y) => {
        const active = y === currentYear
        return (
          <Link
            key={y}
            href={y === new Date().getFullYear() ? '/garten/bilanz' : `/garten/bilanz?year=${y}`}
            className="px-2 py-2 rounded-lg text-xs font-medium touch-manipulation min-h-[40px] flex items-center"
            style={{
              backgroundColor: active ? '#4A7C59' : '#FFFFFF',
              color: active ? '#FFFFFF' : '#888780',
              border: `1px solid ${active ? '#4A7C59' : '#E8E6DF'}`,
            }}
          >
            {y}
          </Link>
        )
      })}
    </div>
  )
}
