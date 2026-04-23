import { cookies } from 'next/headers'

export async function getCurrentGardenId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('garten_id')?.value ?? null
}

export async function getCurrentGardenName(): Promise<string | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get('garten_name')?.value
  if (!raw) return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}
