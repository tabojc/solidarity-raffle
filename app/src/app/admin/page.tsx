"use client"

import { useEffect, useState, useCallback } from "react"
import { fetchNumbers, fetchConfig, confirmNumber, undoConfirmNumber, cancelReservation, exportCsv, generateImage } from "@/lib/api"
import type { NumbersMap, RaffleConfig } from "@/lib/types"

export default function AdminPage() {
  const [token, setToken] = useState("")
  const [authenticated, setAuthenticated] = useState(false)
  const [numbers, setNumbers] = useState<NumbersMap>({})
  const [config, setConfig] = useState<RaffleConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [undoing, setUndoing] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)

  const [confirmModal, setConfirmModal] = useState<string | null>(null)
  const [reserveNum, setReserveNum] = useState("")
  const [reserveName, setReserveName] = useState("")
  const [reserving, setReserving] = useState(false)
  const [reserveErr, setReserveErr] = useState<string | null>(null)

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
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get("token")
    const effectiveToken = urlToken || stored

    if (effectiveToken) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setToken(effectiveToken)
      setAuthenticated(true)
      loadData()
      /* eslint-enable react-hooks/set-state-in-effect */
      if (urlToken) {
        localStorage.setItem("admin_token", urlToken)
        window.history.replaceState(null, "", "/admin")
      }
    } else {
      setLoading(false)
    }

    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
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
    setConfirmModal(null)
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

  async function handleUndoConfirm(num: string) {
    setUndoing(num)
    try {
      await undoConfirmNumber(num, token)
      await loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al deshacer")
    } finally {
      setUndoing(null)
    }
  }

  async function handleCancelReservation(num: string) {
    setCancelling(num)
    try {
      await cancelReservation(num, token)
      await loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al cancelar")
    } finally {
      setCancelling(null)
    }
  }

  async function handleAdminReserve(e: React.FormEvent) {
    e.preventDefault()
    if (!reserveNum.trim() || !reserveName.trim()) return

    setReserving(true)
    setReserveErr(null)
    try {
      const res = await fetch("/api/numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          num: reserveNum.trim().padStart(2, "0"),
          reservedBy: reserveName.trim(),
          adminToken: token,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Error al reservar")
      }
      setReserveNum("")
      setReserveName("")
      await loadData()
    } catch (err) {
      setReserveErr(err instanceof Error ? err.message : "Error al reservar")
    } finally {
      setReserving(false)
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

  async function handleGenerateImage() {
    try {
      const blob = await generateImage()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "rifa-solidaria.png"
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al generar imagen")
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
          <h1 className="text-xl font-bold text-zinc-800">Oficina</h1>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Clave secreta
            </label>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ingresa la clave"
              type="password"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-primary text-white py-2.5 font-medium hover:bg-primary-dark"
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
  const totalSold = sold.reduce((sum) => {
    return sum + (config?.ticketPrice ?? 0)
  }, 0)

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
        <h1 className="font-semibold text-zinc-800">
          Oficina — {config?.name ?? "Rifa"}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            Exportar CSV
          </button>
          <button
            onClick={handleGenerateImage}
            className="rounded-lg border border-primary px-3 py-1.5 text-sm text-primary hover:bg-primary/5"
          >
            Generar Imagen
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-200">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">
              Disponibles
            </p>
            <p className="text-2xl font-bold text-primary">
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
          <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-200">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">
              Total vendido
            </p>
            <p className="text-2xl font-bold text-primary">
              $ {totalSold.toLocaleString("en-US")}
            </p>
          </div>
        </div>

        <section className="bg-white rounded-xl p-4 shadow-sm border border-zinc-200">
          <h2 className="text-lg font-semibold text-zinc-800 mb-3">
            Reservar número (llamada telefónica)
          </h2>
          <form onSubmit={handleAdminReserve} className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Número
              </label>
              <input
                value={reserveNum}
                onChange={(e) => setReserveNum(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Ej: 42"
              />
            </div>
            <div className="flex-[2]">
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Nombre del cliente
              </label>
              <input
                value={reserveName}
                onChange={(e) => setReserveName(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Nombre y apellido"
              />
            </div>
            <button
              type="submit"
              disabled={reserving || !reserveNum.trim() || !reserveName.trim()}
              className="rounded-lg bg-amber-500 text-white px-4 py-2 text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {reserving ? "..." : "Reservar"}
            </button>
          </form>
          {reserveErr && (
            <p className="text-red-600 text-sm mt-2">{reserveErr}</p>
          )}
        </section>

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
                    {data.note && (
                      <p className="text-xs text-zinc-400 italic">{data.note}</p>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => {
                        if (window.confirm(`¿Cancelar reserva del número ${num}?`)) {
                          handleCancelReservation(num)
                        }
                      }}
                      disabled={cancelling === num}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      {cancelling === num ? "..." : "Cancelar"}
                    </button>
                    <button
                      onClick={() => setConfirmModal(num)}
                      disabled={confirming === num}
                      className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
                    >
                      {confirming === num ? "..." : "Confirmar pago"}
                    </button>
                  </div>
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
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-red-600 font-medium">
                      Vendido
                    </span>
                    <button
                      onClick={() => {
                        if (window.confirm(`¿Deshacer venta del número ${num}?`)) {
                          handleUndoConfirm(num)
                        }
                      }}
                      disabled={undoing === num}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
                    >
                      {undoing === num ? "..." : "Deshacer"}
                    </button>
                  </div>
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

      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-zinc-800 mb-2">
              Confirmar pago
            </h3>
            <p className="text-zinc-600 mb-4">
              ¿Estás segura de confirmar el pago del número{" "}
              <span className="font-bold text-zinc-800">{confirmModal}</span>?
              Esta acción se puede deshacer después.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmModal(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleConfirm(confirmModal)}
                className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium hover:bg-primary-dark transition-colors"
              >
                Confirmar pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
