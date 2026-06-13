"use client"

import { useEffect, useState, useCallback } from "react"
import { fetchNumbers, fetchConfig } from "@/lib/api"
import type { NumbersMap, RaffleConfig } from "@/lib/types"
import Hero from "@/components/Hero"
import NumberGrid from "@/components/NumberGrid"
import ReserveModal from "@/components/ReserveModal"

export default function Home() {
  const [numbers, setNumbers] = useState<NumbersMap>({})
  const [config, setConfig] = useState<RaffleConfig | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [nums, cfg] = await Promise.all([
        fetchNumbers(),
        fetchConfig(),
      ])
      setNumbers(nums)
      setConfig(cfg)
      setError(null)
    } catch {
      setError("Error al cargar los datos")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    loadData()
    /* eslint-enable react-hooks/set-state-in-effect */
    const interval = setInterval(() => {
      if (selected === null) loadData()
    }, 5000)
    return () => clearInterval(interval)
  }, [loadData, selected])

  async function handleSuccess() {
    setSelected(null)
    await loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-zinc-500 animate-pulse">Cargando...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-3">
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadData}
            className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm hover:bg-emerald-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Hero config={config} />
      <main className="max-w-3xl mx-auto">
        <NumberGrid numbers={numbers} onSelect={setSelected} />
      </main>
      <footer className="text-center text-xs text-zinc-400 py-6">
        {config?.lottery} — {config?.drawDate}
      </footer>
      <ReserveModal
        num={selected}
        config={config}
        onClose={() => setSelected(null)}
        onSuccess={handleSuccess}
      />
    </>
  )
}
