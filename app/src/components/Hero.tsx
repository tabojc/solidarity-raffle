"use client"

import type { RaffleConfig } from "@/lib/types"

interface HeroProps {
  config: RaffleConfig | null
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  })
}

export default function Hero({ config }: HeroProps) {
  if (!config) return null

  return (
    <header className="bg-[#FCE8EE] px-4 py-10 md:py-14">
      <div className="max-w-2xl mx-auto text-center space-y-4">
        {config.heroImageUrl && (
          <img
            src={config.heroImageUrl}
            alt={config.beneficiary}
            className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover mx-auto border-4 border-white shadow-lg"
          />
        )}
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-zinc-900">
          {config.name}
        </h1>
        <p className="text-zinc-600 text-lg md:text-xl">
          A beneficio de <span className="font-semibold">{config.beneficiary}</span>
        </p>

        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto pt-2">
          <div className="bg-white/80 rounded-xl p-3">
            <p className="text-zinc-500 text-xs uppercase tracking-wide">Precio</p>
            <p className="text-xl font-bold text-zinc-900">{formatCurrency(config.ticketPrice)}</p>
          </div>
          <div className="bg-white/80 rounded-xl p-3">
            <p className="text-zinc-500 text-xs uppercase tracking-wide">Sorteo</p>
            <p className="text-xl font-bold text-zinc-900">{config.drawDate}</p>
          </div>
        </div>

        <div className="bg-white/80 rounded-xl p-4 max-w-sm mx-auto space-y-2">
          <p className="text-zinc-500 text-xs uppercase tracking-wide">Premios</p>
          {config.prizes.map((prize) => (
            <p key={prize.position} className="text-lg text-zinc-700">
              <span className="font-bold text-zinc-900">{prize.position}°</span>{" "}
              {formatCurrency(prize.amount)}
            </p>
          ))}
        </div>

        <p className="text-zinc-500 text-sm">
          {config.lottery} — {config.drawDate} a las {config.drawTime}
        </p>
      </div>
    </header>
  )
}
