import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import ConfirmResetForm from './ConfirmResetForm'

export const dynamic = 'force-dynamic'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}

export default async function AdminResetPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = adminClient()
  const { data: garden } = await supabase
    .from('gardens')
    .select('owner_name, reset_expires_at')
    .eq('reset_token', token)
    .maybeSingle()

  const expires = garden?.reset_expires_at
    ? new Date(garden.reset_expires_at as string).getTime()
    : 0
  const valid = !!garden && expires > Date.now()

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-8"
      style={{ backgroundColor: '#FAFAF7' }}
    >
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-medium" style={{ color: '#2C2C2A' }}>
            🔑 Passwort zurücksetzen
          </h1>
        </div>

        {valid ? (
          <>
            <p
              className="text-sm leading-relaxed text-center"
              style={{ color: '#888780' }}
            >
              Passwort für Garten <strong>{garden!.owner_name as string}</strong>{' '}
              wirklich zurücksetzen? Die Person muss sich danach mit einem
              neuen Passwort einloggen.
            </p>
            <ConfirmResetForm token={token} />
          </>
        ) : (
          <div
            className="rounded-xl p-5 text-sm leading-relaxed text-center"
            style={{ backgroundColor: '#FDE8E2', color: '#C17B5C' }}
          >
            Dieser Link ist ungültig oder abgelaufen. Die anfragende Person
            muss eine neue Zurücksetzung anfragen.
          </div>
        )}

        <p className="text-center text-sm">
          <Link
            href="/login"
            className="underline"
            style={{ color: '#888780' }}
          >
            Zum Login
          </Link>
        </p>
      </div>
    </div>
  )
}
