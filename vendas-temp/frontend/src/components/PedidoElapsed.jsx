import { useState, useEffect } from 'react'

/** SQLite localtime 'YYYY-MM-DD HH:MM:SS' → Date local */
function parseSqlLocalDate(sql) {
  if (!sql) return null
  const m = String(sql).trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) {
    const d = new Date(sql)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    m[6] != null ? Number(m[6]) : 0
  )
}

/** Texto tipo "há 5 min" a partir do created_at do pedido */
export function formatTempoDesdePedido(sqlCreatedAt) {
  const t = parseSqlLocalDate(sqlCreatedAt)
  if (!t) return ''
  const sec = Math.floor((Date.now() - t.getTime()) / 1000)
  if (sec < 0) return 'agora'
  if (sec < 60) return `há ${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `há ${h} h`
  const d = Math.floor(h / 24)
  return `há ${d} dia${d > 1 ? 's' : ''}`
}

/** Menor created_at (mais antigo) entre vários pedidos */
export function earliestCreatedAt(items) {
  if (!items?.length) return null
  return items.reduce((oldest, p) => {
    const c = p?.created_at
    if (!c) return oldest
    if (!oldest) return c
    return String(c) < String(oldest) ? c : oldest
  }, null)
}

function useNowInterval(ms) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), ms)
    return () => clearInterval(id)
  }, [ms])
}

/**
 * Tempo desde o lançamento do pedido; atualiza a cada 15s.
 * A partir de 20 min em vermelho para chamar atenção.
 */
export default function PedidoElapsed({ createdAt, className = '' }) {
  useNowInterval(15000)
  const text = formatTempoDesdePedido(createdAt)
  if (!text) return null
  const t = parseSqlLocalDate(createdAt)
  const min = t ? Math.floor((Date.now() - t.getTime()) / 60000) : 0
  const urgent = min >= 20
  return (
    <span
      className={`tabular-nums ${urgent ? 'font-semibold text-red-600' : 'text-slate-500'} ${className}`}
      title={createdAt ? `Lançado: ${createdAt}` : undefined}
    >
      {text}
    </span>
  )
}
