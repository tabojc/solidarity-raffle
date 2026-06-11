"use client"

import { useState, useRef, useEffect } from "react"
import { reserveNumber } from "@/lib/api"

interface ReserveModalProps {
  num: string | null
  onClose: () => void
  onSuccess: () => void
}

export default function ReserveModal({
  num,
  onClose,
  onSuccess,
}: ReserveModalProps) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (num) {
      setName("")
      setPhone("")
      setError(null)
      setDone(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [num])

  if (!num) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const contact = [name.trim(), phone.trim()].filter(Boolean).join(" - ")

    setSending(true)
    setError(null)
    try {
      await reserveNumber(num, contact || undefined)
      setDone(true)
      setTimeout(() => {
        onSuccess()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reservar")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600 text-xl leading-none"
        >
          ✕
        </button>

        {done ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-lg font-semibold text-emerald-700">
              ¡Reservado!
            </p>
            <p className="text-zinc-500 mt-1">
              Número <span className="font-bold">{num}</span>
            </p>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-zinc-800 mb-1">
              Reservar número
            </h3>
            <p className="text-3xl font-bold text-emerald-600 mb-4">{num}</p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Nombre
                </label>
                <input
                  ref={inputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Tu nombre"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Teléfono
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="0412-1234567"
                  type="tel"
                />
              </div>

              {error && (
                <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-lg bg-emerald-600 text-white py-2.5 font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {sending ? "Reservando..." : "Reservar"}
              </button>

              <p className="text-xs text-zinc-400 text-center">
                Tienes 24h para confirmar el pago
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
