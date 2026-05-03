/**
 * Stage 13 — extracted from Stage 5C's BackgroundPicker so the same
 * compression helper can serve both the background-photo upload (768 px)
 * and the bed-tagebuch upload (1024 px, more detail matters per photo).
 *
 * Browser-side: FileReader → Image → Canvas → WebP @ 0.78. Falls back to
 * JPEG → original Blob if the browser can't encode WebP. Server accepts
 * all three.
 */

export const COMPRESS_QUALITY_DEFAULT = 0.78

export async function compressImage(
  file: File,
  maxDim: number,
  quality: number = COMPRESS_QUALITY_DEFAULT
): Promise<Blob> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result ?? ''))
    r.onerror = () => reject(r.error ?? new Error('FileReader failed'))
    r.readAsDataURL(file)
  })
  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('Image decode failed'))
    im.src = dataUrl
  })
  const longest = Math.max(img.width, img.height)
  const ratio = longest > maxDim ? maxDim / longest : 1
  const w = Math.max(1, Math.round(img.width * ratio))
  const h = Math.max(1, Math.round(img.height * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, w, h)
  const blob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/webp', quality)
  })
  if (blob && blob.size > 0) return blob
  // Fallback: try JPEG, otherwise return original
  const jpeg: Blob | null = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85)
  })
  return jpeg && jpeg.size > 0 ? jpeg : file
}
