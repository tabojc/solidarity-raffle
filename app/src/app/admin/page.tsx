"use client"

import { useEffect, useState, useCallback } from "react"
import { fetchNumbers, fetchConfig, confirmNumber, undoConfirmNumber, cancelReservation, renameNumber, exportCsv, generateImage } from "@/lib/api"
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
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editNameValue, setEditNameValue] = useState("")
  const [renaming, setRenaming] = useState<string | null>(null)

  const [confirmModal, setConfirmModal] = useState<string | null>(null)
  const [reserveNum, setReserveNum] = useState("")
  const [reserveName, setReserveName] = useState("")
  const [reservePhone, setReservePhone] = useState("")
  const [reserving, setReserving] = useState(false)
  const [reserveErr, setReserveErr] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)

  function formatError(err: unknown, action: string): string {
    const msg = err instanceof Error ? err.message : `Error al ${action}`
    if (msg === "Unauthorized") {
      return "No autorizado — la clave secreta no coincide con el servidor. Revisá que ADMIN_TOKEN esté bien configurado."
    }
    return msg
  }

  async function verifyToken(t: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/admin/verify?token=${encodeURIComponent(t)}`)
      const body = await res.json()
      return body.valid === true
    } catch {
      return false
    }
  }

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

    async function init() {
      if (effectiveToken) {
        /* eslint-disable react-hooks/set-state-in-effect */
        setToken(effectiveToken)
        /* eslint-enable react-hooks/set-state-in-effect */

        if (urlToken) {
          localStorage.setItem("admin_token", urlToken)
          window.history.replaceState(null, "", "/admin")
        }

        // Verificar que el token sea válido contra el servidor
        const valid = await verifyToken(effectiveToken)
        if (!valid) {
          localStorage.removeItem("admin_token")
          /* eslint-disable react-hooks/set-state-in-effect */
          setToken("")
          setLoginError("El token guardado ya no es válido. Ingresá la clave nuevamente.")
          setLoading(false)
          /* eslint-enable react-hooks/set-state-in-effect */
          return
        }

        /* eslint-disable react-hooks/set-state-in-effect */
        setAuthenticated(true)
        loadData()
        /* eslint-enable react-hooks/set-state-in-effect */
      } else {
        setLoading(false)
      }
    }

    init()

    const interval = setInterval(loadData, 5000)
    return () => clearInterval(interval)
  }, [loadData])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = token.trim()
    if (!trimmed) return

    setVerifying(true)
    setLoginError(null)

    const valid = await verifyToken(trimmed)
    if (!valid) {
      setVerifying(false)
      setLoginError("Clave inválida — revisá que coincida con ADMIN_TOKEN en el servidor.")
      return
    }

    localStorage.setItem("admin_token", trimmed)
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
      alert(formatError(err, "confirmar"))
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
      alert(formatError(err, "deshacer"))
    } finally {
      setUndoing(null)
    }
  }

  async function handleSaveName(num: string) {
    const trimmed = editNameValue.trim()
    if (!trimmed || trimmed === numbers[num]?.reservedBy) {
      setEditingName(null)
      return
    }
    setRenaming(num)
    try {
      await renameNumber(num, token, trimmed)
      await loadData()
    } catch (err) {
      alert(formatError(err, "renombrar"))
    } finally {
      setRenaming(null)
      setEditingName(null)
    }
  }

  function handleCancelEdit() {
    setEditingName(null)
    setEditNameValue("")
  }

  function handleStartEdit(num: string, currentName: string) {
    setEditingName(num)
    setEditNameValue(currentName)
  }

  async function handleCancelReservation(num: string) {
    setCancelling(num)
    try {
      await cancelReservation(num, token)
      await loadData()
    } catch (err) {
      alert(formatError(err, "cancelar"))
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
      const contact = [reserveName.trim(), reservePhone.trim()].filter(Boolean).join(" - ")
      const res = await fetch("/api/numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          num: reserveNum.trim().padStart(2, "0"),
          reservedBy: contact,
          adminToken: token,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (res.status === 401) {
          throw new Error("No autorizado — la clave secreta no coincide con el servidor.")
        }
        throw new Error(body.error ?? "Error al reservar")
      }
      setReserveNum("")
      setReserveName("")
      setReservePhone("")
      await loadData()
    } catch (err) {
      setReserveErr(err instanceof Error ? err.message : "Error al reservar")
    } finally {
      setReserving(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    try {
      const blob = await exportCsv(token)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "rifa-export.csv"
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(formatError(err, "exportar"))
    } finally {
      setExporting(false)
    }
  }

  async function handleGenerateImage() {
    setGenerating(true)
    try {
      const blob = await generateImage()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "rifa-solidaria.png"
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(formatError(err, "generar imagen"))
    } finally {
      setGenerating(false)
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
              onChange={(e) => {
                setToken(e.target.value)
                if (loginError) setLoginError(null)
              }}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Ingresa la clave"
              type="password"
              disabled={verifying}
            />
          </div>

          {loginError && (
            <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
              {loginError}
            </p>
          )}

          <button
            type="submit"
            disabled={verifying || !token.trim()}
            className="w-full rounded-lg bg-primary text-white py-2.5 font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
          >
            {verifying ? "Verificando..." : "Ingresar"}
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
      <header className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-center">
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
          >
            {exporting ? "Exportando..." : "Exportar CSV"}
          </button>
          <button
            onClick={handleGenerateImage}
            disabled={generating}
            className="rounded-lg border border-primary px-3 py-1.5 text-sm text-primary hover:bg-primary/5 disabled:opacity-50 transition-colors"
          >
            {generating ? "Generando..." : "Generar Imagen"}
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
          <form onSubmit={handleAdminReserve} className="flex flex-col gap-3">
            <div>
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
            <div>
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
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Teléfono <span className="text-zinc-400 font-normal">(opcional)</span>
              </label>
              <input
                value={reservePhone}
                onChange={(e) => setReservePhone(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="0412-1234567"
                type="tel"
              />
            </div>
            <button
              type="submit"
              disabled={reserving || !reserveNum.trim() || !reserveName.trim()}
              className="w-full rounded-lg bg-amber-500 text-white px-4 py-2.5 text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
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
                  className="bg-white rounded-xl p-4 shadow-sm border border-zinc-200 flex flex-col"
                >
                  <div>
                    <p className="text-lg font-bold text-zinc-800">{num}</p>
                    {data.reservedBy && (
                      <div className="flex items-center gap-2">
                        {editingName === num ? (
                          <div className="flex items-center gap-1">
                            <input
                              value={editNameValue}
                              onChange={(e) => setEditNameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveName(num)
                                if (e.key === "Escape") handleCancelEdit()
                              }}
                              className="w-40 rounded border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveName(num)}
                              disabled={renaming === num}
                              className="text-xs text-primary hover:underline disabled:opacity-50"
                            >
                              {renaming === num ? "..." : "Guardar"}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="text-xs text-zinc-500 hover:underline"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-zinc-500">{data.reservedBy}</p>
                            <button
                              onClick={() => handleStartEdit(num, data.reservedBy!)}
                              className="text-zinc-400 hover:text-primary transition-colors"
                              title="Editar nombre"
                              aria-label="Editar nombre"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
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
                  <div className="flex gap-2 items-center justify-end mt-3">
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
                      {confirming === num ? "..." : "Confirmar"}
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
                  className="bg-white rounded-xl p-4 shadow-sm border border-zinc-200 flex flex-col"
                >
                  <div>
                    <p className="text-lg font-bold text-zinc-800">{num}</p>
                    {data.reservedBy && (
                      <div className="flex items-center gap-2">
                        {editingName === num ? (
                          <div className="flex items-center gap-1">
                            <input
                              value={editNameValue}
                              onChange={(e) => setEditNameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveName(num)
                                if (e.key === "Escape") handleCancelEdit()
                              }}
                              className="w-40 rounded border border-zinc-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveName(num)}
                              disabled={renaming === num}
                              className="text-xs text-primary hover:underline disabled:opacity-50"
                            >
                              {renaming === num ? "..." : "Guardar"}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="text-xs text-zinc-500 hover:underline"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-zinc-500">{data.reservedBy}</p>
                            <button
                              onClick={() => handleStartEdit(num, data.reservedBy!)}
                              className="text-zinc-400 hover:text-primary transition-colors"
                              title="Editar nombre"
                              aria-label="Editar nombre"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    {data.confirmedAt && (
                      <p className="text-xs text-zinc-400">
                        Confirmado:{" "}
                        {new Date(data.confirmedAt).toLocaleString("es-VE")}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 items-center justify-end mt-3">
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
              Confirmar
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
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
