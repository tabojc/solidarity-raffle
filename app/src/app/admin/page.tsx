"use client"

import { useEffect, useState, useCallback } from "react"
import { fetchNumbers, fetchConfig, confirmNumber, exportCsv } from "@/lib/api"
import type { NumbersMap, RaffleConfig } from "@/lib/types"

export default function AdminPage() {
  const [token, setToken] = useState("")
  const [authenticated, setAuthenticated] = useState(false)
  const [numbers, setNumbers] = useState<NumbersMap>({})
  const [config, setConfig] = useState<RaffleConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [nums, cfg] = await Promise.all([
        fetchNumbers(),
        fetchConfig(),
      ])
      setNumbers(nums)
      setConfig(cfg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem("admin_token") ?? ""
    setToken(stored)
    if (stored) {
      setAuthenticated(true)
      loadData()
    } else {
      setLoading(false)
    }
  }, [loadData])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) return
    localStorage.setItem("admin_token", token.trim())
    setAuthenticated(true)
    setLoading(true)
    loadData()
  }

  async function handleConfirm(num: string) {
    setConfirming(num)
    try {
      await confirmNumber(num, token)
      await loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al confirmar")
    } finally {
      setConfirming(null)
    }
  }

  async function handleExport() {
    try {
      const blob = await exportCsv(token)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "rifa-export.csv"
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al exportar")
    }
  }

  function handleLogout() {
    localStorage.removeItem("admin_token")
    setAuthenticated(false)
    setToken("")
    setNumbers({})
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 space-y-4"
        >
          <h1 className="text-xl font-bold text-zinc-800">Admin</h1>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Token de acceso
            </label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Ingresa el token"
              type="password"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 text-white py-2.5 font-medium hover:bg-emerald-700"
          >
            Ingresar
          </button>
        </form>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-zinc-500 animate-pulse">Cargando...</p>
      </div>
    )
  }

  const entries = Object.entries(numbers).sort(([a], [b]) =>
    a.localeCompare(b)
  )
  const reserved = entries.filter(([, d]) => d.status === "reserved")
  const sold = entries.filter(([, d]) => d.status === "sold")
  const availableCount = entries.filter(([, d]) => d.status === "available").length

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
        <h1 className="font-semibold text-zinc-800">
          Admin — {config?.name ?? "Rifa"}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            Exportar CSV
          </button>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-200">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">
              Disponibles
            </p>
            <p className="text-2xl font-bold text-emerald-600">
              {availableCount}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-200">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">
              Reservados
            </p>
            <p className="text-2xl font-bold text-amber-500">
              {reserved.length}
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-200">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">
              Vendidos
            </p>
            <p className="text-2xl font-bold text-red-500">{sold.length}</p>
          </div>
        </div>

        {reserved.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-zinc-800 mb-3">
              Reservados ({reserved.length})
            </h2>
            <div className="space-y-2">
              {reserved.map(([num, data]) => (
                <div
                  key={num}
                  className="bg-white rounded-xl p-4 shadow-sm border border-zinc-200 flex items-center justify-between"
                >
                  <div>
                    <p className="text-lg font-bold text-zinc-800">{num}</p>
                    {data.reservedBy && (
                      <p className="text-sm text-zinc-500">{data.reservedBy}</p>
                    )}
                    {data.reservedAt && (
                      <p className="text-xs text-zinc-400">
                        {new Date(data.reservedAt).toLocaleString("es-VE")}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleConfirm(num)}
                    disabled={confirming === num}
                    className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {confirming === num ? "..." : "Confirmar pago"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {sold.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-zinc-800 mb-3">
              Vendidos ({sold.length})
            </h2>
            <div className="space-y-2">
              {sold.map(([num, data]) => (
                <div
                  key={num}
                  className="bg-white rounded-xl p-4 shadow-sm border border-zinc-200 flex items-center justify-between"
                >
                  <div>
                    <p className="text-lg font-bold text-zinc-800">{num}</p>
                    {data.reservedBy && (
                      <p className="text-sm text-zinc-500">{data.reservedBy}</p>
                    )}
                    {data.confirmedAt && (
                      <p className="text-xs text-zinc-400">
                        Confirmado:{" "}
                        {new Date(data.confirmedAt).toLocaleString("es-VE")}
                      </p>
                    )}
                  </div>
                  <span className="text-sm text-red-600 font-medium">
                    Vendido
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {reserved.length === 0 && sold.length === 0 && (
          <p className="text-zinc-400 text-center py-12">
            No hay reservas ni ventas aún
          </p>
        )}
      </main>
    </div>
  )
}
