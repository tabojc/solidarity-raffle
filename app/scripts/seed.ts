import { Redis } from '@upstash/redis'

const kv = Redis.fromEnv()

function getEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}

function getEnvInt(key: string, fallback: number): number {
  const val = process.env[key]
  return val ? parseInt(val, 10) : fallback
}

async function seed() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN')
    process.exit(1)
  }

  const existingNumbers = await kv.hlen('raffle:numbers')
  if (existingNumbers && existingNumbers > 0 && !process.argv.includes('--force')) {
    console.log(`✓ Skipped numbers reset (${existingNumbers} numbers exist). Use --force to re-seed.`)
  } else {
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
    console.log('✓ Seeded 100 numbers (00-99) as available')
  }

  await kv.hset('raffle:config', {
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
  })
  console.log('✓ Seeded raffle config')

  console.log('\nRaffle ready:')
  console.log(`  Name:        ${getEnv('RAFFLE_NAME', 'Rifa Solidaria')}`)
  console.log(`  Beneficiary: ${getEnv('BENEFICIARY_NAME', 'Beneficiaria')}`)
  console.log(`  Tickets:     100 (00-99)`)
  console.log(`  Price:       $${getEnvInt('TICKET_PRICE', 20)}`)
  console.log(`  Draw:        ${getEnv('DRAW_DATE', '2026-07-26')} ${getEnv('DRAW_TIME', '22:30')}`)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
