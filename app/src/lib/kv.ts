import { Redis } from '@upstash/redis'
import type { NumbersMap, RaffleConfig, RaffleNumber } from './types'

const NUMBERS_KEY = 'raffle:numbers'
const CONFIG_KEY = 'raffle:config'

function getRedis(): Redis {
  return Redis.fromEnv()
}

function buildDefaultNumbers(): NumbersMap {
  const numbers: NumbersMap = {}
  for (let i = 0; i < 100; i++) {
    const key = i.toString().padStart(2, '0')
    numbers[key] = {
      status: 'available',
      reservedBy: null,
      reservedAt: null,
      confirmedAt: null,
    }
  }
  return numbers
}

export async function getAllNumbers(): Promise<NumbersMap> {
  const kv = getRedis()
  const numbers = await kv.hgetall<NumbersMap>(NUMBERS_KEY)
  if (!numbers || Object.keys(numbers).length === 0) {
    return buildDefaultNumbers()
  }
  return numbers
}

export async function getNumber(num: string): Promise<RaffleNumber | null> {
  const kv = getRedis()
  return kv.hget<RaffleNumber>(NUMBERS_KEY, num)
}

export async function reserveNumber(
  num: string,
  reservedBy?: string
): Promise<RaffleNumber | null> {
  const kv = getRedis()
  const existing = await kv.hget<RaffleNumber>(NUMBERS_KEY, num)
  if (!existing || existing.status !== 'available') return null

  const updated: RaffleNumber = {
    status: 'reserved',
    reservedBy: reservedBy ?? null,
    reservedAt: Date.now(),
    confirmedAt: null,
  }

  await kv.hset(NUMBERS_KEY, { [num]: updated })
  return updated
}

export async function confirmNumber(num: string): Promise<RaffleNumber | null> {
  const kv = getRedis()
  const existing = await kv.hget<RaffleNumber>(NUMBERS_KEY, num)
  if (!existing || existing.status !== 'reserved') return null

  const updated: RaffleNumber = {
    ...existing,
    status: 'sold',
    confirmedAt: Date.now(),
  }

  await kv.hset(NUMBERS_KEY, { [num]: updated })
  return updated
}

export async function getConfig(): Promise<RaffleConfig | null> {
  const kv = getRedis()
  return kv.hgetall<RaffleConfig>(CONFIG_KEY)
}
