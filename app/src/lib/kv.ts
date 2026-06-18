import { Redis } from '@upstash/redis'
import type { NumbersMap, RaffleConfig, RaffleNumber } from './types'

const NUMBERS_KEY = 'raffle:numbers'
const CONFIG_KEY = 'raffle:config'
const IMAGE_CACHE_KEY = 'raffle:image:png'

const RESERVE_SCRIPT = `
  local raw = redis.call("HGET", KEYS[1], ARGV[1])
  if not raw then return 0 end
  local data = cjson.decode(raw)
  if data["status"] ~= "available" then return 0 end
  data["status"] = "reserved"
  data["reservedBy"] = ARGV[2]
  data["reservedAt"] = tonumber(ARGV[3])
  data["confirmedAt"] = cjson.null
  data["note"] = cjson.null
  redis.call("HSET", KEYS[1], ARGV[1], cjson.encode(data))
  return 1
`

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

async function getTimeoutMs(): Promise<number> {
  const kv = getRedis()
  const config = await kv.hgetall<Record<string, unknown>>(CONFIG_KEY)
  const hours = typeof config?.reserveTimeoutHours === "number" ? config.reserveTimeoutHours : 24
  return hours * 3_600_000
}

function isExpired(data: RaffleNumber, timeoutMs: number): boolean {
  if (data.status !== "reserved" || !data.reservedAt) return false
  return Date.now() - data.reservedAt > timeoutMs
}

export async function getAllNumbers(): Promise<NumbersMap> {
  const kv = getRedis()
  const numbers = await kv.hgetall<NumbersMap>(NUMBERS_KEY)
  if (!numbers || Object.keys(numbers).length === 0) {
    return buildDefaultNumbers()
  }

  const timeoutMs = await getTimeoutMs()
  const reverted: string[] = []

  for (const [key, val] of Object.entries(numbers)) {
    if (isExpired(val, timeoutMs)) {
      numbers[key] = {
        status: "available",
        reservedBy: null,
        reservedAt: null,
        confirmedAt: null,
      }
      reverted.push(key)
    }
  }

  if (reverted.length > 0) {
    const updates: Record<string, RaffleNumber> = {}
    for (const key of reverted) {
      updates[key] = numbers[key]
    }
    await kv.hset(NUMBERS_KEY, updates)
  }

  return numbers
}

export async function getNumber(num: string): Promise<RaffleNumber | null> {
  const kv = getRedis()
  const data = await kv.hget<RaffleNumber>(NUMBERS_KEY, num)
  if (!data) return null

  const timeoutMs = await getTimeoutMs()
  if (isExpired(data, timeoutMs)) {
    const reverted: RaffleNumber = {
      status: "available",
      reservedBy: null,
      reservedAt: null,
      confirmedAt: null,
    }
    await kv.hset(NUMBERS_KEY, { [num]: reverted })
    return reverted
  }

  return data
}

export async function reserveNumber(
  num: string,
  reservedBy?: string
): Promise<RaffleNumber | null> {
  const kv = getRedis()
  const now = Date.now()

  const ok = await kv.eval<string[], number>(RESERVE_SCRIPT, [NUMBERS_KEY], [
    num,
    reservedBy ?? '',
    String(now),
  ])

  if (!ok) return null

  await clearImageCache()

  return {
    status: 'reserved',
    reservedBy: reservedBy ?? null,
    reservedAt: now,
    confirmedAt: null,
  }
}

export async function adminReserveNumber(
  num: string,
  reservedBy: string
): Promise<RaffleNumber | null> {
  const kv = getRedis()

  const updated: RaffleNumber = {
    status: 'reserved',
    reservedBy,
    reservedAt: Date.now(),
    confirmedAt: null,
  }

  await kv.hset(NUMBERS_KEY, { [num]: updated })
  await clearImageCache()
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
  await clearImageCache()
  return updated
}

export async function undoConfirmNumber(num: string): Promise<RaffleNumber | null> {
  const kv = getRedis()
  const existing = await kv.hget<RaffleNumber>(NUMBERS_KEY, num)
  if (!existing || existing.status !== 'sold') return null

  const updated: RaffleNumber = {
    ...existing,
    status: 'reserved',
    confirmedAt: null,
  }

  await kv.hset(NUMBERS_KEY, { [num]: updated })
  await clearImageCache()
  return updated
}

export async function renameNumber(num: string, newName: string): Promise<RaffleNumber | null> {
  const kv = getRedis()
  const existing = await kv.hget<RaffleNumber>(NUMBERS_KEY, num)
  if (!existing || existing.status === 'available') return null

  const updated: RaffleNumber = {
    ...existing,
    reservedBy: newName,
  }

  await kv.hset(NUMBERS_KEY, { [num]: updated })
  await clearImageCache()
  return updated
}

export async function cancelReservation(num: string): Promise<RaffleNumber | null> {
  const kv = getRedis()
  const existing = await kv.hget<RaffleNumber>(NUMBERS_KEY, num)
  if (!existing || existing.status !== 'reserved') return null

  const updated: RaffleNumber = {
    status: 'available',
    reservedBy: null,
    reservedAt: null,
    confirmedAt: null,
  }

  await kv.hset(NUMBERS_KEY, { [num]: updated })
  await clearImageCache()
  return updated
}

export async function getImageCache(): Promise<string | null> {
  const kv = getRedis()
  return kv.get<string>(IMAGE_CACHE_KEY)
}

export async function setImageCache(pngBase64: string): Promise<void> {
  const kv = getRedis()
  await kv.set(IMAGE_CACHE_KEY, pngBase64, { ex: 3600 })
}

export async function clearImageCache(): Promise<void> {
  const kv = getRedis()
  await kv.del(IMAGE_CACHE_KEY)
}

export async function getConfig(): Promise<RaffleConfig | null> {
  const kv = getRedis()
  const data = await kv.hgetall<Record<string, unknown>>(CONFIG_KEY)
  if (!data) return null
  return data as unknown as RaffleConfig
}
