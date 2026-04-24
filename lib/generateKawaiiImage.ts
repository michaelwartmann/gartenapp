import { createClient } from '@supabase/supabase-js'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const REQUEST_TIMEOUT_MS = 60_000

function getImageModel(): string {
  return process.env.IMAGE_MODEL || 'gemini-2.5-flash-image'
}

function buildKawaiiPrompt(name: string, latinName: string): string {
  const latin = latinName ? ` (${latinName})` : ''
  return [
    `A kawaii botanical illustration of ${name}${latin}.`,
    'Cute character style with a friendly face, soft pastel watercolor,',
    'plain white background, single plant centered.',
    'Japanese kawaii aesthetic, gentle outlines, charming and warm.',
    'No text, no labels, no watermark.',
  ].join(' ')
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ä/g, 'a')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

async function generateViaPredict(
  prompt: string,
  model: string,
  apiKey: string
): Promise<Buffer> {
  const url = `${API_BASE}/models/${model}:predict?key=${apiKey}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '1:1',
        safetyFilterLevel: 'block_only_high',
        personGeneration: 'dont_allow',
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Imagen API ${response.status}: ${text.slice(0, 500)}`)
  }

  const data = (await response.json()) as {
    predictions?: Array<{ bytesBase64Encoded?: string }>
  }
  const base64 = data.predictions?.[0]?.bytesBase64Encoded
  if (!base64) {
    throw new Error(`No image bytes in response: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return Buffer.from(base64, 'base64')
}

async function generateViaGenerateContent(
  prompt: string,
  model: string,
  apiKey: string
): Promise<Buffer> {
  const url = `${API_BASE}/models/${model}:generateContent?key=${apiKey}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Gemini image API ${response.status}: ${text.slice(0, 500)}`)
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType?: string; data?: string }
        }>
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

export async function generateKawaiiImageBytes(
  name: string,
  latinName: string
): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('Missing GOOGLE_AI_API_KEY')
  const model = getImageModel()
  const prompt = buildKawaiiPrompt(name, latinName)
  if (model.startsWith('imagen')) {
    return generateViaPredict(prompt, model, apiKey)
  }
  return generateViaGenerateContent(prompt, model, apiKey)
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!url || !secret) throw new Error('Missing Supabase credentials')
  return createClient(url, secret)
}

export async function uploadKawaiiImage(
  plantId: string,
  plantName: string,
  imageBytes: Buffer
): Promise<string> {
  const supabase = adminClient()
  const slug = slugify(plantName)
  const filePath = `kawaii/${plantId}-${slug}.png`

  const { error } = await supabase.storage
    .from('illustrations')
    .upload(filePath, imageBytes, {
      contentType: 'image/png',
      upsert: true,
    })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  const {
    data: { publicUrl },
  } = supabase.storage.from('illustrations').getPublicUrl(filePath)
  return publicUrl
}

export async function generateAndUploadKawaiiImage(
  plantId: string,
  plantName: string,
  latinName: string
): Promise<string> {
  const bytes = await generateKawaiiImageBytes(plantName, latinName)
  return uploadKawaiiImage(plantId, plantName, bytes)
}
