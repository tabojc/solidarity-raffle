"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body className="flex items-center justify-center min-h-screen bg-zinc-50">
        <div className="text-center space-y-4 p-8">
          <h2 className="text-xl font-semibold text-zinc-800">
            Algo salió mal
          </h2>
          <p className="text-sm text-zinc-500">{error.message}</p>
          <button
            onClick={() => reset()}
            className="rounded-lg bg-primary text-white px-4 py-2 text-sm hover:bg-primary-dark transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  )
}
