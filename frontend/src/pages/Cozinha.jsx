import { useState, useEffect, useRef, useMemo } from 'react'
import { getPedidosKitchen, setPedidoSectorStatus, updatePedido } from '../api'
import { useSocket } from '../socket'
import PedidoElapsed, { earliestCreatedAt } from '../components/PedidoElapsed'
import { cozinhaPedidoCardClass, comandaOnlineLabel } from '../utils/comandaOnlineVisual'

/** Totais por item + linhas "q — descrição" quando há observations */
function buildKitchenProductionCards(pedidos) {
  const byName = new Map()
  for (const p of pedidos) {
    const name = p.item_name || '—'
    const qty = Math.max(1, Number(p.quantity) || 1)
    const obsRaw = p.observations != null ? String(p.observations).trim() : ''
    if (!byName.has(name)) byName.set(name, { name, total: 0, descMap: new Map() })
    const row = byName.get(name)
    row.total += qty
    if (obsRaw) row.descMap.set(obsRaw, (row.descMap.get(obsRaw) || 0) + qty)
  }
  return Array.from(byName.values())
    .map((row) => ({
      name: row.name,
      total: row.total,
      lines: [...row.descMap.entries()]
        .map(([text, q]) => ({ qty: q, text }))
        .sort((a, b) => b.qty - a.qty || a.text.localeCompare(b.text))
    }))
    .sort((a, b) => b.total - a.total)
}

/** Card Prato Feito: total + só linhas de descrição livre (observations); sem espetinho nem ponto */
function buildPratoFeitoProductionSummary(pedidos) {
  let total = 0
  const descMap = new Map()
  for (const p of pedidos) {
    const qty = Math.max(1, Number(p.quantity) || 1)
    total += qty
    const obs = p.observations != null ? String(p.observations).trim() : ''
    if (obs) descMap.set(obs, (descMap.get(obs) || 0) + qty)
  }
  if (total <= 0) return null
  const lines = [...descMap.entries()]
    .map(([text, q]) => ({ qty: q, text }))
    .sort((a, b) => b.qty - a.qty || a.text.localeCompare(b.text))
  return { total, lines }
}

export default function Cozinha() {
  const [list, setList] = useState([])
  const loadTimeoutRef = useRef(null)

  const load = async () => {
    const pedidos = await getPedidosKitchen()
    setList(pedidos)
  }

  useEffect(() => { load(); return () => { if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current) } }, [])
  useSocket(() => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current)
    loadTimeoutRef.current = setTimeout(() => { load(); loadTimeoutRef.current = null }, 350)
  })

  /** Marca o pedido inteiro como pronto na cozinha (mantém quantity na comanda). */
  const markKitchenFullyReady = async (pedidoId) => {
    setList((prev) => prev.filter((p) => p.id !== pedidoId))
    try {
      await setPedidoSectorStatus(pedidoId, 'kitchen', 'ready')
      load()
    } catch {
      load()
    }
  }

  /** Retira 1 unidade da produção: se quantity > 1, diminui no pedido; se for 1, equivale a pronto. */
  const fulfillOneKitchenUnit = async (p) => {
    const q = Math.max(1, Number(p.quantity) || 1)
    if (q > 1) {
      setList((prev) => prev.map((x) => (x.id === p.id ? { ...x, quantity: q - 1 } : x)))
      try {
        await updatePedido(p.id, { quantity: q - 1 })
        load()
      } catch {
        load()
      }
    } else {
      await markKitchenFullyReady(p.id)
    }
  }

  const pratoFeitoMinusOne = async () => {
    if (pratoFeitoPedidos.length === 0) return
    const sorted = [...pratoFeitoPedidos].sort(
      (a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')) || a.id - b.id
    )
    await fulfillOneKitchenUnit(sorted[0])
  }

  const setAllPratoFeitoReady = async () => {
    if (pratoFeitoPedidos.length === 0) return
    setList((prev) => prev.filter((p) => !p.prato_feito_espetinho_name))
    try {
      await Promise.all(pratoFeitoPedidos.map((p) => setPedidoSectorStatus(p.id, 'kitchen', 'ready')))
      load()
    } catch {
      load()
    }
  }

  const outrosPedidos = list.filter((p) => !p.prato_feito_espetinho_name)
  const pratoFeitoPedidos = list.filter((p) => p.prato_feito_espetinho_name)
  const totalPratoFeito = pratoFeitoPedidos.reduce((s, p) => s + (p.quantity || 1), 0)

  const productionByItem = useMemo(() => buildKitchenProductionCards(outrosPedidos), [outrosPedidos])
  const pratoFeitoSummary = useMemo(() => buildPratoFeitoProductionSummary(pratoFeitoPedidos), [pratoFeitoPedidos])
  const pratoFeitoTemDelivery = useMemo(
    () => pratoFeitoPedidos.some((p) => p.comanda_tipo_online === 'delivery'),
    [pratoFeitoPedidos]
  )

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <h1 className="mb-3 shrink-0 text-xl font-bold text-slate-800">Cozinha</h1>
      <div className="mb-4 shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-4 text-xl font-bold text-amber-600 md:text-2xl">Total para produção</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {productionByItem.map((p) => (
            <div key={p.name} className="flex flex-col rounded-xl bg-slate-100 px-3 py-3 text-center">
              <span className="block text-2xl font-bold text-slate-800 md:text-3xl">{p.total}</span>
              <span className="text-base font-medium text-slate-600">{p.name}</span>
              {p.lines.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-slate-200/90 pt-2 text-left text-xs font-medium text-slate-600">
                  {p.lines.map((l) => (
                    <li key={l.text} className="leading-snug">
                      {l.qty} — {l.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {pratoFeitoSummary && (
            <div key="prato-feito" className="flex flex-col rounded-xl bg-amber-100 px-3 py-3 text-center">
              <span className="block text-2xl font-bold text-amber-700 md:text-3xl">{pratoFeitoSummary.total}</span>
              <span className="text-base font-medium text-slate-700">Prato Feito</span>
              {pratoFeitoSummary.lines.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-amber-200/90 pt-2 text-left text-xs font-medium text-amber-900/90">
                  {pratoFeitoSummary.lines.map((l) => (
                    <li key={l.text} className="leading-snug">
                      {l.qty} — {l.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        {productionByItem.length === 0 && !pratoFeitoSummary && (
          <p className="mt-4 text-center text-slate-500 text-lg">Nenhum pedido</p>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-auto pb-4">
        {outrosPedidos.map((p) => (
          <div
            key={p.id}
            className={cozinhaPedidoCardClass(p)}
          >
            <div className="min-w-0 flex-1">
              {p.comanda_tipo_online === 'delivery' && (
                <div className="mb-2 rounded-lg border-2 border-sky-600 bg-sky-200 px-3 py-2 text-center shadow-sm">
                  <p className="text-sm font-black uppercase tracking-wide text-sky-950">🚚 Delivery</p>
                  <p className="mt-0.5 text-xs font-semibold leading-snug text-sky-900">
                    Embalar / preparar para envio — não é consumo na mesa
                  </p>
                </div>
              )}
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                <span className="font-medium text-slate-800">{p.quantity}x {p.item_name}</span>
                {p.comanda_tipo_online !== 'delivery' && comandaOnlineLabel(p.comanda_tipo_online) && (
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                    {comandaOnlineLabel(p.comanda_tipo_online)}
                  </span>
                )}
                <PedidoElapsed createdAt={p.created_at} className="text-xs" />
              </div>
              {p.mesa && p.comanda_tipo_online === 'delivery' && (
                <p className="mt-1 text-xs font-medium text-sky-900">{p.mesa}</p>
              )}
              {p.waiting_grill && <span className="text-amber-600 text-sm">(aguard. churrasq.)</span>}
              {p.waiter_name && <span className="ml-2 text-slate-500 text-xs">— {p.waiter_name}</span>}
              {p.observations && <p className="text-amber-800 text-sm font-medium">Descrição: {p.observations}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {(p.quantity || 1) > 1 && (
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-600 text-lg font-bold text-white hover:bg-slate-500"
                  title="Menos 1 na produção"
                  onClick={() => fulfillOneKitchenUnit(p)}
                >
                  −
                </button>
              )}
              {(p.quantity || 1) > 1 ? (
                <button
                  type="button"
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
                  title="Marcar todas as unidades deste pedido"
                  onClick={() => markKitchenFullyReady(p.id)}
                >
                  Tudo pronto
                </button>
              ) : (
                <button
                  type="button"
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
                  onClick={() => markKitchenFullyReady(p.id)}
                >
                  Pronto
                </button>
              )}
            </div>
          </div>
        ))}
        {pratoFeitoPedidos.length > 0 && (
          <div
            className={`flex items-center justify-between gap-2 rounded-xl border-2 p-3 ${
              pratoFeitoTemDelivery
                ? 'border-sky-500 bg-gradient-to-r from-sky-100 to-amber-50'
                : 'border-amber-400 bg-amber-50'
            }`}
          >
            <div className="min-w-0 flex-1">
              {pratoFeitoTemDelivery && (
                <div className="mb-2 rounded-md border border-sky-600 bg-sky-200 px-2 py-1.5 text-center">
                  <span className="text-xs font-black uppercase tracking-wide text-sky-950">
                    🚚 Há Prato Feito para delivery — embalar para envio
                  </span>
                </div>
              )}
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                <span className="font-medium text-amber-800">{totalPratoFeito}x Prato Feito</span>
                <PedidoElapsed createdAt={earliestCreatedAt(pratoFeitoPedidos)} className="text-xs" />
              </div>
              {pratoFeitoPedidos[0]?.waiter_name && <span className="ml-2 text-slate-500 text-xs">— {pratoFeitoPedidos[0].waiter_name}</span>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="rounded bg-amber-600 px-3 py-2 text-lg font-bold text-white hover:bg-amber-500"
                title="Diminuir 1"
                onClick={() => pratoFeitoMinusOne()}
              >
                −
              </button>
              <button
                type="button"
                className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
                onClick={setAllPratoFeitoReady}
              >
                Pronto (todos)
              </button>
            </div>
          </div>
        )}
        {list.length === 0 && (
          <p className="py-8 text-center text-slate-500">Nenhum pedido no momento.</p>
        )}
      </div>
    </div>
  )
}
