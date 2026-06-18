/**
 * restore.ts — Restore numbers from a backup JSON file.
 *
 * Safe, gradual restore for production use:
 *   - Dry-run mode (default): preview only
 *   - Interactive mode: one number at a time
 *   - Batch mode: restore all at once with confirmation
 *
 * Usage:
 *   pnpm seed:restore backup.json                  # preview only
 *   pnpm seed:restore backup.json --dry-run        # explicit preview
 *   pnpm seed:restore backup.json --interactive    # one by one
 *   pnpm seed:restore backup.json --batch          # all at once
 *   pnpm seed:restore backup.json --batch --force  # skip confirm
 *
 * Backup JSON format (accepted inputs):
 *
 *   Array format (recommended):
 *     [
 *       { "num": "01", "status": "reserved", "reservedBy": "María Pérez" },
 *       { "num": "05", "status": "sold", "reservedBy": "Juan López" }
 *     ]
 *
 *   Map format:
 *     { "01": { "status": "reserved", "reservedBy": "María Pérez" } }
 *
 *   Simple map (assumes reserved):
 *     { "01": "María Pérez", "05": "Juan López" }
 */

import { Redis } from '@upstash/redis'
import { createInterface } from 'readline'
import { readFileSync } from 'fs'
import type { RaffleNumber } from '../src/lib/types'

interface BackupEntry {
  num: string
  status: 'reserved' | 'sold'
  reservedBy: string
  reservedAt?: number
  confirmedAt?: number | null
}

const kv = Redis.fromEnv()
const NUMBERS_KEY = 'raffle:numbers'

function getFlag(name: string): boolean {
  return process.argv.includes(`--${name}`) || process.argv.includes(`-${name[0]}`)
}

function isDryRun(): boolean {
  return getFlag('dry-run')
}

function isInteractive(): boolean {
  return getFlag('interactive')
}

function isBatch(): boolean {
  return getFlag('batch')
}

function isForce(): boolean {
  return getFlag('force')
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
}

function getBackupPath(): string | null {
  // First positional arg that is not a flag
  const args = process.argv.slice(2).filter(a => !a.startsWith('--') && !a.startsWith('-'))
  return args[0] ?? null
}

function readBackup(path: string): BackupEntry[] {
  const raw = readFileSync(path, 'utf-8')
  const data = JSON.parse(raw)

  if (Array.isArray(data)) {
    // Array format: [{ num, status, reservedBy }, ...]
    return data.map((item: Record<string, unknown>) => ({
      num: String(item.num).padStart(2, '0'),
      status: item.status === 'sold' ? 'sold' : 'reserved',
      reservedBy: String(item.reservedBy ?? ''),
      reservedAt: typeof item.reservedAt === 'number' ? item.reservedAt : Date.now(),
      confirmedAt: item.status === 'sold'
        ? (typeof item.confirmedAt === 'number' ? item.confirmedAt : Date.now())
        : null,
    }))
  }

  if (typeof data === 'object' && data !== null) {
    return Object.entries(data).map(([key, val]) => {
      const num = key.padStart(2, '0')

      if (typeof val === 'string') {
        // Simple map: "01": "María Pérez" → reserved
        return {
          num,
          status: 'reserved' as const,
          reservedBy: val,
          reservedAt: Date.now(),
          confirmedAt: null,
        }
      }

      const entry = val as Record<string, unknown>
      return {
        num,
        status: entry.status === 'sold' ? 'sold' : 'reserved',
        reservedBy: String(entry.reservedBy ?? ''),
        reservedAt: typeof entry.reservedAt === 'number' ? entry.reservedAt : Date.now(),
        confirmedAt: entry.status === 'sold'
          ? (typeof entry.confirmedAt === 'number' ? entry.confirmedAt : Date.now())
          : null,
      }
    })
  }

  console.error('❌ Invalid backup format. See instructions above.')
  process.exit(1)
}

async function confirm(prompt: string): Promise<boolean> {
  if (isForce()) return true

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(`${prompt} (y/N) `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y')
    })
  })
}

function printTable(entries: BackupEntry[]): void {
  const rows = entries.map(e => {
    const icon = e.status === 'sold' ? '💰' : '📌'
    const statusLabel = e.status === 'sold' ? 'VENDIDO' : 'RESERVADO'
    return `  ${icon} #${e.num}  ${statusLabel}  — ${e.reservedBy}`
  })
  console.log(rows.join('\n'))
}

async function restoreEntry(entry: BackupEntry): Promise<string> {
  // Check current state
  const existing = await kv.hget<RaffleNumber>(NUMBERS_KEY, entry.num)

  if (existing) {
    if (existing.status === 'sold') {
      return `#${entry.num}  ⏭️  SALTADO — ya está VENDIDO (${existing.reservedBy})`
    }
    if (existing.status === 'reserved') {
      return `#${entry.num}  ⏭️  SALTADO — ya está RESERVADO (${existing.reservedBy})`
    }
  }

  const updated: RaffleNumber = {
    status: entry.status,
    reservedBy: entry.reservedBy,
    reservedAt: entry.status === 'reserved' ? entry.reservedAt! : Date.now(),
    confirmedAt: entry.status === 'sold' ? (entry.confirmedAt ?? Date.now()) : null,
  }

  await kv.hset(NUMBERS_KEY, { [entry.num]: updated })

  const icon = entry.status === 'sold' ? '💰' : '📌'
  const label = entry.status === 'sold' ? 'VENDIDO' : 'RESERVADO'
  return `#${entry.num}  ${icon}  RESTAURADO como ${label} — ${entry.reservedBy}`
}

async function main() {
  const backupPath = getBackupPath()

  if (!backupPath) {
    console.log(`
Usage:
  pnpm seed:restore <backup.json>              Preview (dry-run default)
  pnpm seed:restore <backup.json> --interactive Restore one by one
  pnpm seed:restore <backup.json> --batch       Restore all at once
  pnpm seed:restore <backup.json> --force       Skip confirmations

Backup format (JSON):
  [ { "num": "01", "status": "reserved", "reservedBy": "Name" } ]
  { "01": { "status": "sold", "reservedBy": "Name" } }
  { "01": "Name" }  (assumes reserved)
`)
    process.exit(0)
  }

  // Validate file exists
  try {
    readFileSync(backupPath, 'utf-8')
  } catch {
    console.error(`❌ File not found: ${backupPath}`)
    process.exit(1)
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error('❌ Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN')
    process.exit(1)
  }

  // Parse backup
  const entries = readBackup(backupPath)

  if (entries.length === 0) {
    console.log('⚠️  Backup is empty — nothing to restore.')
    process.exit(0)
  }

  // Preview
  const reserved = entries.filter(e => e.status === 'reserved')
  const sold = entries.filter(e => e.status === 'sold')

  console.log(`\n📋 Backup contiene ${entries.length} número(s):`)
  if (reserved.length > 0) console.log(`   📌 ${reserved.length} reservado(s)`)
  if (sold.length > 0) console.log(`   💰 ${sold.length} vendido(s)`)
  console.log('')
  printTable(entries)
  console.log('')

  if (isDryRun() || (!isInteractive() && !isBatch())) {
    console.log('🔍 Dry-run — no se hizo ningún cambio.')
    console.log('   Para restaurar usa:  --interactive  (uno por uno)')
    console.log('   o:                  --batch         (todos juntos)')
    process.exit(0)
  }

  // Production guard for batch mode
  if (isBatch() && isProduction() && !isForce()) {
    const ok = await confirm('\n⚠️  PRODUCTION — esto va a RESTAURAR datos en producción. ¿Continuar?')
    if (!ok) {
      console.log('Cancelado.')
      process.exit(0)
    }
  }

  // Restore
  const results: string[] = []

  if (isInteractive()) {
    console.log('\n--- Restaurando uno por uno ---\n')
    for (const entry of entries) {
      const preview = entry.status === 'sold'
        ? `💰 #${entry.num} como VENDIDO — ${entry.reservedBy}`
        : `📌 #${entry.num} como RESERVADO — ${entry.reservedBy}`

      console.log(`\n${preview}`)
      const ok = await confirm('  ¿Restaurar este número?')
      if (!ok) {
        results.push(`#${entry.num}  ⏭️  SALTADO por el usuario`)
        continue
      }

      const result = await restoreEntry(entry)
      results.push(result)
      console.log(`  ✅ ${result}`)
    }
  } else {
    // Batch mode
    console.log('\n--- Restaurando todos ---\n')
    for (const entry of entries) {
      const result = await restoreEntry(entry)
      results.push(result)
      console.log(`  ✅ ${result}`)
    }
  }

  // Summary
  const restored = results.filter(r => r.includes('RESTAURADO')).length
  const skipped = results.filter(r => r.includes('SALTADO')).length
  const cancelled = results.filter(r => r.includes('SALTADO por el usuario')).length

  console.log('\n─────────────────────────────')
  console.log(`✅ ${restored} restaurado(s)`)
  if (skipped > 0) console.log(`⏭️  ${skipped} saltado(s) (ya existían)`)
  if (cancelled > 0) console.log(`⏸️  ${cancelled} cancelado(s) por el usuario`)
  console.log('─────────────────────────────')
}

main().catch((err) => {
  console.error('❌ Restore failed:', err)
  process.exit(1)
})
