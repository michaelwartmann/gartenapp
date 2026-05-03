/**
 * Stage 8.1 — generate the curated Skizzen-Hintergrund PNGs.
 *
 * One-time run (idempotent — skips themes whose PNG already exists in
 * `public/garten-bg/`, unless `--force` is passed). Outputs are committed
 * to the repo. Re-run after editing a prompt with `--force --only=erde`.
 */

import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const GOOGLE_AI_KEY = process.env.GOOGLE_AI_API_KEY
if (!GOOGLE_AI_KEY) {
  console.error('Missing env var: GOOGLE_AI_API_KEY')
  process.exit(1)
}

const IMAGE_MODEL = process.env.IMAGE_MODEL || 'gemini-2.5-flash-image'
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const REQUEST_TIMEOUT_MS = 90_000
const OUT_DIR = join(process.cwd(), 'public', 'garten-bg')

type BgRecipe = {
  key: string
  prompt: string
}

const BACKGROUNDS: BgRecipe[] = [
  {
    key: 'erde',
    prompt:
      'A seamless top-down view of soft kawaii garden soil. Dark cocoa-brown earth ' +
      'with tiny scattered pebbles and a few small leaves. Soft watercolor texture, ' +
      'gentle organic patterns, warm and inviting. No plants, no characters, no text, ' +
      'no labels, no watermark. Perfectly tileable, even lighting.',
  },
  {
    key: 'wiese',
    prompt:
      'A soft kawaii top-down meadow background. Sage-green grass blades with a few ' +
      'tiny white daisies scattered randomly. Watercolor style, gentle pastel tones, ' +
      'no harsh edges. No characters, no text, no labels, no watermark. Tileable, ' +
      'even lighting, peaceful and warm.',
  },
  {
    key: 'holz',
    prompt:
      'A soft kawaii top-down view of warm cottagecore wooden planks. Light honey-' +
      'colored timber, gentle wood grain in watercolor style, slightly weathered, ' +
      'cozy. No plants, no characters, no text, no labels, no watermark. Tileable, ' +
      'even lighting.',
  },
  {
    key: 'aquarell',
    prompt:
      'An abstract soft watercolor wash background in pale cream and sage-green and ' +
      'a hint of dusty rose. No structure, no patterns, no characters, no text, no ' +
      'plants. Just gentle colors blending. Like a kawaii art journal page. Even, ' +
      'calming, very subtle.',
  },
  {
    key: 'stein',
    prompt:
      'A soft kawaii top-down view of grey cobblestone pavement. Rounded stones with ' +
      'tiny patches of moss in the joints. Watercolor style, muted colors, gentle. ' +
      'No characters, no text, no labels, no watermark. Tileable, even lighting.',
  },
  {
    key: 'botanik',
    prompt:
      'A delicate seamless botanical pattern: tiny watercolor leaves and small ' +
      'flowers (daisies, ferns, sprigs) scattered on a cream background. Kawaii ' +
      'aesthetic, very soft pastel colors, lots of whitespace between elements. ' +
      'Perfectly tileable. No characters, no text, no labels, no watermark.',
  },
]

async function generate(prompt: string): Promise<Buffer> {
  const url = `${API_BASE}/models/${IMAGE_MODEL}:generateContent?key=${GOOGLE_AI_KEY}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    }),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Gemini ${response.status}: ${text.slice(0, 500)}`)
  }
  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }>
      }
    }>
  }
  const inlinePart = data.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData?.data
  )
  const base64 = inlinePart?.inlineData?.data
  if (!base64) {
    throw new Error(`No image in response: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return Buffer.from(base64, 'base64')
}

async function main() {
  const force = process.argv.includes('--force')
  const onlyArg = process.argv.find((a) => a.startsWith('--only='))
  const only = onlyArg ? onlyArg.slice('--only='.length) : null

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })

  console.log(`Model: ${IMAGE_MODEL}`)
  console.log(`Output: ${OUT_DIR}`)

  for (const bg of BACKGROUNDS) {
    if (only && only !== bg.key) continue
    const outPath = join(OUT_DIR, `${bg.key}.png`)
    if (!force && existsSync(outPath)) {
      console.log(`✓ ${bg.key}.png already exists (use --force to regenerate)`)
      continue
    }
    process.stdout.write(`… generating ${bg.key} … `)
    try {
      const bytes = await generate(bg.prompt)
      writeFileSync(outPath, bytes)
      console.log(`✓ ${bytes.length} bytes`)
    } catch (e) {
      console.log(`✗ FAILED`)
      console.error(`  ${e instanceof Error ? e.message : e}`)
    }
    // Polite pause for free-tier rate limit
    await new Promise((r) => setTimeout(r, 1500))
  }
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
