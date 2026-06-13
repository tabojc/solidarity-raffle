import type { NumbersMap, RaffleConfig } from "./types"

export async function fetchNumbers(): Promise<NumbersMap> {
  const res = await fetch("/api/numbers")
  if (!res.ok) throw new Error("Failed to fetch numbers")
  return res.json()
}

export async function fetchConfig(): Promise<RaffleConfig> {
  const res = await fetch("/api/config")
  if (!res.ok) throw new Error("Failed to fetch config")
  return res.json()
}

export async function reserveNumber(
  num: string,
  reservedBy?: string
): Promise<{ success: boolean }> {
  const res = await fetch("/api/numbers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ num, reservedBy }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? "Error al reservar")
  }
  return { success: true }
}

export async function confirmNumber(
  num: string,
  token: string
): Promise<{ success: boolean }> {
  const res = await fetch(`/api/numbers/${num}?token=${token}`, {
    method: "PUT",
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? "Error al confirmar")
  }
  return { success: true }
}

export async function undoConfirmNumber(
  num: string,
  token: string
): Promise<{ success: boolean }> {
  const res = await fetch(`/api/numbers/${num}?token=${token}&action=undo`, {
    method: "PUT",
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? "Error al deshacer")
  }
  return { success: true }
}

export async function exportCsv(token: string): Promise<Blob> {
  const res = await fetch(`/api/export?token=${token}`)
  if (!res.ok) throw new Error("Error al exportar")
  return res.blob()
}
