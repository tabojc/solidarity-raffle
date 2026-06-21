#!/usr/bin/env node
/**
 * Pre-process hero image for raffle-image generation.
 *
 * Reads hero.webp from public/, creates a 200×200 circular crop with
 * transparent background, and saves it as hero-circular.png.
 *
 * This avoids any runtime dependency on sharp or WebP decoding for
 * the SVG-based hero compositing in the raffle-image route.
 */

import sharp from 'sharp'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(__dirname, '..', 'public')

async function main() {
  const src = join(PUBLIC, 'hero.webp')
  const dst = join(PUBLIC, 'hero-circular.png')

  if (!existsSync(src)) {
    console.log('[preprocess-hero] hero.webp not found — skipping')
    return
  }

  console.log(`[preprocess-hero] Reading ${src}`)
  const buf = readFileSync(src)

  // Resize to 200×200 cover
  const resized = await sharp(buf)
    .resize(200, 200, { fit: 'cover', position: 'center' })
    .png()
    .toBuffer()

  // Create a circular mask: white circle on transparent background
  const circleSvg = Buffer.from(
    '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="100" cy="100" r="100" fill="white"/></svg>'
  )

  // Composite: keep only the circle area (dest-in = destination-in)
  const circular = await sharp(resized)
    .composite([{ input: circleSvg, blend: 'dest-in' }])
    .png()
    .toBuffer()

  writeFileSync(dst, circular)
  console.log(`[preprocess-hero] Wrote ${dst} (${(circular.length / 1024).toFixed(0)}KB)`)
}

main().catch(err => {
  console.error('[preprocess-hero] FAILED:', err)
  process.exit(1)
})
