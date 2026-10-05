/**
 * Generates all required icon assets from apps/desktop/resources/icon.svg:
 *   apps/desktop/resources/icon.ico        (256x256 — Windows installer)
 *   apps/web/public/icons/192.png
 *   apps/web/public/icons/512.png
 *   apps/web/public/apple-touch-icon.png   (180x180)
 *
 * Run once after cloning or whenever the icon SVG changes:
 *   node scripts/generate-icons.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const svgPath = join(root, 'apps/desktop/resources/icon.svg')
const svgBuf = readFileSync(svgPath)

async function makePng(size, outPath) {
  await sharp(svgBuf)
    .resize(size, size)
    .png()
    .toFile(outPath)
  console.log(`  ✓ ${outPath.replace(root, '.')} (${size}x${size})`)
}

async function main() {
  console.log('Generating icons from icon.svg…\n')

  mkdirSync(join(root, 'apps/web/public/icons'), { recursive: true })
  mkdirSync(join(root, 'apps/desktop/resources'), { recursive: true })

  // Generate PNGs
  const png256 = join(root, 'apps/desktop/resources/icon-256.png')
  await makePng(512, join(root, 'apps/web/public/icons/512.png'))
  await makePng(192, join(root, 'apps/web/public/icons/192.png'))
  await makePng(180, join(root, 'apps/web/public/apple-touch-icon.png'))
  await makePng(256, png256)

  // Convert 256px PNG to ICO
  const icoBuf = await pngToIco([png256])
  writeFileSync(join(root, 'apps/desktop/resources/icon.ico'), icoBuf)
  console.log('  ✓ ./apps/desktop/resources/icon.ico (256x256)')

  // Clean up temporary 256 PNG
  const { unlinkSync } = await import('fs')
  unlinkSync(png256)

  console.log('\nDone.')
}

main().catch(err => { console.error(err); process.exit(1) })
