import { Redis } from '@upstash/redis'
import { createInterface } from 'readline'

const kv = Redis.fromEnv()

function getEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}

function getEnvInt(key: string, fallback: number): number {
  const val = process.env[key]
  return val ? parseInt(val, 10) : fallback
}

function isDryRun(): boolean {
  return process.argv.includes('--dry-run')
}

function isReset(): boolean {
  return process.argv.includes('--reset')
}

function isForce(): boolean {
  return process.argv.includes('--force')
}

function dry(str: string): void {
  if (isDryRun()) console.log(`[DRY-RUN] ${str}`)
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production'
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

function buildConfig() {
  return {
    name: getEnv('RAFFLE_NAME', 'Rifa Solidaria'),
    beneficiary: getEnv('BENEFICIARY_NAME', 'Beneficiaria'),
    heroImageUrl: getEnv('HERO_IMAGE_URL', ''),
    prizes: [
      { position: 1, amount: getEnvInt('PRIZE_FIRST_AMOUNT', 600) },
      { position: 2, amount: getEnvInt('PRIZE_SECOND_AMOUNT', 400) },
    ],
    ticketPrice: getEnvInt('TICKET_PRICE', 20),
    drawDate: getEnv('DRAW_DATE', '2026-07-26'),
    drawTime: getEnv('DRAW_TIME', '22:30'),
    lottery: getEnv('LOTTERY_NAME', 'Lotería Táchira A y B'),
    reserveTimeoutHours: getEnvInt('RESERVE_TIMEOUT_HOURS', 24),
  }
}

function printSummary(config: ReturnType<typeof buildConfig>, resetNumbers: boolean) {
  console.log('\nPreview:')
  console.log(`  Name:        ${config.name}`)
  console.log(`  Beneficiary: ${config.beneficiary}`)
  console.log(`  Hero image:  ${config.heroImageUrl || '(none)'}`)
  console.log(`  Price:       $${config.ticketPrice}`)
  console.log(`  Draw:        ${config.drawDate} ${config.drawTime}`)
  console.log(`  Lottery:     ${config.lottery}`)
  console.log(`  Timeout:     ${config.reserveTimeoutHours}h`)
  if (resetNumbers) {
    console.log(`  Numbers:     RESET 100 to available (THIS DELETES ALL RESERVATIONS)`)
  } else {
    console.log(`  Numbers:     untouched`)
  }
}

async function main() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN')
    process.exit(1)
  }

  const resetNumbers = isReset()
  const config = buildConfig()

  printSummary(config, resetNumbers)

  if (isDryRun()) {
    console.log('\nDry-run complete. No changes made.')
    return
  }

  if (resetNumbers) {
    if (isProduction() && !isForce()) {
      const ok = await confirm('\n⚠️  PRODUCTION — this will DELETE all reservations and sales. Continue?')
      if (!ok) {
        console.log('Cancelled.')
        process.exit(0)
      }
    }

    const numbers: Record<string, Record<string, unknown>> = {}
    for (let i = 0; i < 100; i++) {
      const key = i.toString().padStart(2, '0')
      numbers[key] = {
        status: 'available',
        reservedBy: null,
        reservedAt: null,
        confirmedAt: null,
      }
    }

    await kv.hset('raffle:numbers', numbers)
    console.log('✓ Reset 100 numbers to available')
  } else {
    const existing = await kv.hlen('raffle:numbers')
    console.log(`✓ Numbers untouched (${existing} existing)`)
  }

  await kv.hset('raffle:config', config)
  console.log('✓ Config updated')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
