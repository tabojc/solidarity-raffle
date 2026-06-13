"use client"

import type { NumbersMap, RaffleNumber, NumberStatus } from "@/lib/types"

interface NumberGridProps {
  numbers: NumbersMap
  onSelect: (num: string) => void
}

const statusStyles: Record<NumberStatus, string> = {
  available:
    "bg-available-bg border-available-border text-available hover:bg-available hover:text-white",
  reserved:
    "bg-reserved-bg border-reserved-border text-reserved cursor-not-allowed",
  sold: "bg-sold-bg border-sold-border text-sold cursor-not-allowed",
}

const statusLabels: Record<NumberStatus, string> = {
  available: "Disponible",
  reserved: "Reservado",
  sold: "Vendido",
}

function NumberCell({
  num,
  data,
  onSelect,
}: {
  num: string
  data: RaffleNumber
  onSelect: (num: string) => void
}) {
  const style = statusStyles[data.status]

  return (
    <button
      onClick={() => data.status === "available" && onSelect(num)}
      disabled={data.status !== "available"}
      className={`relative flex flex-col items-center justify-center rounded-lg border-2 p-2 text-sm font-semibold transition-all min-h-[44px] min-w-[44px] ${style}`}
      title={statusLabels[data.status]}
    >
      <span className="text-lg leading-tight">{num}</span>
    </button>
  )
}

export default function NumberGrid({ numbers, onSelect }: NumberGridProps) {
  const entries = Object.entries(numbers).sort(([a], [b]) =>
    a.localeCompare(b)
  )

  return (
    <section className="px-4 py-8">
      <h2 className="text-lg font-semibold text-zinc-800 mb-3">
        Elige tu número
      </h2>

      <div className="flex gap-4 mb-4 text-sm text-zinc-600">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-available-bg border border-available-border" />
          Disponible
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-reserved-bg border border-reserved-border" />
          Reservado
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-sold-bg border border-sold-border" />
          Vendido
        </span>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
        {entries.map(([num, data]) => (
          <NumberCell
            key={num}
            num={num}
            data={data}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  )
}
