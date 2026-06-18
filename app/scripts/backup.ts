/**
 * backup.ts — Export current raffle numbers from Redis to a local JSON file.
 *
 * Usage:
 *   pnpm seed:backup                        # saves to backup-YYYY-MM-DD-HHMMSS.json
 *   pnpm seed:backup --output my-file.json  # custom filename
 *   pnpm seed:backup --active-only          # only export reserved/sold numbers
 *
 * The backup includes ALL numbers by default (available, reserved, sold).
 * Use --active-only if you only care about non-available numbers.
 */

import { Redis } from '@upstash/redis'
import { writeFileSync } from 'fs'
import type { RaffleNumber } from '../src/lib/types'

const kv = Redis.fromEnv()
const NUMBERS_KEY = 'raffle:numbers'

function getFlag(name: string): boolean {
  return process.argv.includes(`--${name}`) || process.argv.includes(`-${name[0]}`)
}

function getOutputPath(): string | null {
  const idx = process.argv.indexOf('--output')
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1]
  return null
}

function timestamp(): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

async function main() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN')
    process.exit(1)
  }

  const activeOnly = getFlag('active-only')
  const outputPath = getOutputPath() ?? `backup-${timestamp()}.json`

  console.log(`\nFetching numbers from Redis...`)

  const numbers = await kv.hgetall<Record<string, RaffleNumber>>(NUMBERS_KEY)

  if (!numbers || Object.keys(numbers).length === 0) {
    console.log('No numbers found in Redis.')
    process.exit(0)
  }

  const entries = Object.entries(numbers).sort(([a], [b]) => a.localeCompare(b))
  const reserved = entries.filter(([, v]) => v.status === 'reserved')
  const sold = entries.filter(([, v]) => v.status === 'sold')
  const available = entries.filter(([, v]) => v.status === 'available')

  let dataToSave: Record<string, RaffleNumber>

  if (activeOnly) {
    dataToSave = Object.fromEntries([...reserved, ...sold])
    console.log(`\nFiltered: ${reserved.length} reserved + ${sold.length} sold = ${Object.keys(dataToSave).length} active numbers`)
  } else {
    dataToSave = Object.fromEntries(entries)
    console.log(`\nTotal: ${entries.length} numbers`)
    console.log(`  ${available.length} available`)
    console.log(`  ${reserved.length} reserved`)
    console.log(`  ${sold.length} sold`)
  }

  writeFileSync(outputPath, JSON.stringify(dataToSave, null, 2), 'utf-8')

  console.log(`\nBackup saved to: ${outputPath}`)
  console.log(`To restore: pnpm seed:restore ${outputPath} --interactive\n`)
}

main().catch((err) => {
  console.error('Backup failed:', err)
  process.exit(1)
})
