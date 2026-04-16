import { useState, useEffect, useMemo, useRef } from 'react'
import { getPedidosGrill, getProductionGrill, setPedidoSectorStatus } from '../api'
import { useSocket } from '../socket'
import PedidoElapsed, { earliestCreatedAt } from '../components/PedidoElapsed'
import { churrasqueiraComandaColumnClass, comandaOnlineLabel } from '../utils/comandaOnlineVisual'

/** Agrupa por comanda mantendo ordem de lançamento (primeiro pedido na fila define a ordem dos cards). Não usar Object + comanda_id numérico: o JS reordena chaves inteiras. */
function groupByComanda(list) {
  const map = new Map()
  const order = []
  list.forEach((p) => {
    const key = p.comanda_id
    if (!map.has(key)) {
      map.set(key, { comanda_id: key, mesa: p.mesa, items: [] })
      order.push(key)
    }
    map.get(key).items.push(p)
  })
  return order.map((k) => map.get(k))
}

function groupItemsByProduct(items) {
  const map = {}
  items.forEach((p) => {
    const base = p.prato_feito_espetinho_name ? `Prato Feito — ${p.prato_feito_espetinho_name}` : p.item_name
    const obs = p.observations ? String(p.observations).trim() : ''
    const label = obs ? `${base} — ${obs}` : base
    if (!map[label]) {
      map[label] = { label, displayBase: base, observation: obs || null, total: 0, byPoint: {}, pedidos: [] }
    }
    const qty = p.quantity || 1
    map[label].total += qty
    const pt = p.meat_point || ''
    map[label].byPoint[pt] = (map[label].byPoint[pt] || 0) + qty
    map[label].pedidos.push(p)
  })
  return Object.values(map)
}

function formatByPoint(byPoint) {
  const parts = []
  if (byPoint['mal passado']) parts.push(`${byPoint['mal passado']} mal passado`)
  if (byPoint['ao ponto']) parts.push(`${byPoint['ao ponto']} ao ponto`)
  if (byPoint['bem passado']) parts.push(`${byPoint['bem passado']} bem passado`)
  return parts.length ? ` (${parts.join(', ')})` : ''
}

function groupProductionByItem(byItem) {
  const map = {}
  ;(byItem || []).forEach((p) => {
    const name = p.name
    if (!map[name]) map[name] = { name, total: 0, byPoint: {} }
    map[name].total += p.total || 0
    const pt = p.meat_point || ''
    map[name].byPoint[pt] = (map[name].byPoint[pt] || 0) + (p.total || 0)
  })
  return Object.values(map)
}

/** API nova: { pratos, espetinhos } | null; legado: [{ espetinho_name, total }] */
function normalizePratoFeitoSummary(pf) {
  if (!pf) return null
  if (typeof pf === 'object' && !Array.isArray(pf) && pf.pratos != null) {
    const pratos = Number(pf.pratos) || 0
    if (pratos <= 0) return null
    return { pratos, espetinhos: Math.max(0, Number(pf.espetinhos) || 0) }
  }
  if (Array.isArray(pf) && pf[0]?.total > 0 && pf[0]?.espetinho_name === 'Prato Feito') {
    const t = Number(pf[0].total) || 0
    return { pratos: t, espetinhos: t }
  }
  return null
}

export default function Churrasqueira() {
  const [list, setList] = useState([])
  const [production, setProduction] = useState({ byItem: [], pratoFeito: null })
  const [totalMinimized, setTotalMinimized] = useState(false)

  const load = async () => {
    const [pedidos, prod] = await Promise.all([getPedidosGrill(), getProductionGrill()])
    setList(pedidos)
    setProduction({
      byItem: prod.byItem || [],
      pratoFeito: normalizePratoFeitoSummary(prod.pratoFeito)
    })
  }

  const loadTimeoutRef = useRef(null)
  useEffect(() => { load(); return () => { if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current) } }, [])
  useSocket(() => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current)
    loadTimeoutRef.current = setTimeout(() => { load(); loadTimeoutRef.current = null }, 400)
  })

  const cards = useMemo(() => groupByComanda(list), [list])
  const totalCards = cards.length

  const subtractFromProduction = (itemsToRemove) => {
    const byKey = {}
    let pfPratosSub = 0
    let pfEspSub = 0
    itemsToRemove.forEach((p) => {
      const qty = p.quantity || 1
      const isPf = Number(p.item_is_prato_feito) === 1
      if (isPf) {
        pfPratosSub += qty
        if (p.prato_feito_espetinho_id) pfEspSub += qty
        if (p.prato_feito_espetinho_name) {
          byKey[`${p.prato_feito_espetinho_name}|${p.meat_point || ''}`] =
            (byKey[`${p.prato_feito_espetinho_name}|${p.meat_point || ''}`] || 0) + qty
        }
      } else {
        byKey[`${p.item_name}|${p.meat_point || ''}`] = (byKey[`${p.item_name}|${p.meat_point || ''}`] || 0) + qty
      }
    })
    setProduction((prev) => {
      let nextPf = prev.pratoFeito
      const cur = prev.pratoFeito
      if (cur && typeof cur === 'object' && !Array.isArray(cur) && cur.pratos != null) {
        const np = Math.max(0, cur.pratos - pfPratosSub)
        const ne = Math.max(0, cur.espetinhos - pfEspSub)
        nextPf = np > 0 ? { pratos: np, espetinhos: ne } : null
      }
      return {
        ...prev,
        byItem: (prev.byItem || [])
          .map((p) => {
            const key = `${p.name}|${p.meat_point || ''}`
            return { ...p, total: Math.max(0, (p.total || 0) - (byKey[key] || 0)) }
          })
          .filter((p) => p.total > 0),
        pratoFeito: nextPf
      }
    })
  }

  const setStatus = async (pedidoId, status) => {
    if (status === 'ready') {
      const pedido = list.find((p) => p.id === pedidoId)
      if (pedido) subtractFromProduction([pedido])
      setList((prev) => prev.filter((p) => p.id !== pedidoId))
    }
    try {
      await setPedidoSectorStatus(pedidoId, 'grill', status)
      load()
    } catch {
      load()
    }
  }

  const setCardAllReady = async (items) => {
    const ids = new Set(items.map((i) => i.id))
    subtractFromProduction(items)
    setList((prev) => prev.filter((p) => !ids.has(p.id)))
    try {
      await Promise.all(items.map((p) => setPedidoSectorStatus(p.id, 'grill', 'ready')))
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current)
      loadTimeoutRef.current = setTimeout(() => { load(); loadTimeoutRef.current = null }, 150)
    } catch {
      load()
    }
  }

  const markOneReady = async (pedidos) => {
    if (!pedidos.length) return
    const one = pedidos[0]
    subtractFromProduction([one])
    setList((prev) => prev.filter((p) => p.id !== one.id))
    try {
      await setPedidoSectorStatus(one.id, 'grill', 'ready')
      load()
    } catch {
      load()
    }
  }

  const productionGrouped = useMemo(() => groupProductionByItem(production.byItem), [production.byItem])

  return (
    <div className="relative flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-gradient-to-br from-stone-200 via-amber-100/90 to-amber-50">
      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden px-1 transition-[padding] sm:px-2 ${totalMinimized ? 'pr-0' : 'pr-52'}`}>
        <h1 className="mb-3 shrink-0 px-1 text-xl font-bold text-amber-900/90">Churrasqueira</h1>
        <div className="flex min-h-0 flex-1 flex-row gap-4 overflow-x-auto overflow-y-auto pb-3">
        {cards.map((card) => (
          <div
            key={card.comanda_id}
            className={churrasqueiraComandaColumnClass(card.items[0]?.comanda_tipo_online)}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className={`text-base font-bold ${card.items[0]?.comanda_tipo_online === 'delivery' ? 'text-sky-800' : card.items[0]?.comanda_tipo_online === 'retirada' ? 'text-teal-900' : 'text-amber-700'}`}>
                  Comanda {card.comanda_id} — Mesa {card.mesa}
                </span>
                {comandaOnlineLabel(card.items[0]?.comanda_tipo_online) && (
                  <span className="ml-2 inline-block rounded-full bg-black/10 px-2 py-0.5 text-[11px] font-bold text-slate-800">
                    {comandaOnlineLabel(card.items[0]?.comanda_tipo_online)}
                  </span>
                )}
                {card.items[0]?.waiter_name && <span className="ml-2 text-slate-500 text-xs">Garçom: {card.items[0].waiter_name}</span>}
                <div className="mt-0.5" title="Tempo desde o pedido mais antigo desta comanda na fila">
                  <PedidoElapsed createdAt={earliestCreatedAt(card.items)} className="text-xs" />
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-green-500"
                onClick={() => setCardAllReady(card.items)}
              >
                Tudo pronto
              </button>
            </div>
            <ul className="space-y-2">
              {groupItemsByProduct(card.items).map((g) => (
                <li key={g.label} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200/70 bg-amber-50/90 px-2.5 py-2 shadow-sm">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-semibold text-slate-800">{g.total}</span>{' '}
                    <span className="text-slate-800">{g.displayBase}</span>
                    <span className="ml-1 text-amber-600 text-xs">{formatByPoint(g.byPoint)}</span>
                    {g.observation && (
                      <p className="mt-1 rounded-md border border-violet-200/80 bg-violet-50 px-2 py-1 text-xs font-semibold leading-snug text-violet-800">
                        {g.observation}
                      </p>
                    )}
                    <span className="mt-0.5 block">
                      <PedidoElapsed createdAt={earliestCreatedAt(g.pedidos)} className="text-xs" />
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    {g.pedidos.length > 1 && (
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-300 text-sm font-bold text-slate-800 hover:bg-slate-400"
                        onClick={() => markOneReady(g.pedidos)}
                        title="Menos 1 (entregue)"
                      >
                        −
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-500"
                      onClick={() => setCardAllReady(g.pedidos)}
                    >
                      Pronto
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
        </div>
        {cards.length === 0 && (
          <p className="py-8 text-center text-slate-500">Nenhum pedido no momento.</p>
        )}
      </div>

      {totalMinimized ? (
        <button
          type="button"
          onClick={() => setTotalMinimized(false)}
          className="fixed right-4 z-30 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-amber-600 shadow-lg hover:border-amber-400 hover:bg-slate-50"
          title="Abrir total para produção"
          style={{ top: '4.5rem' }}
        >
          Total produção
        </button>
      ) : (
        <div
          className="fixed right-0 top-16 z-20 flex h-[calc(100vh-4rem)] w-52 flex-col border-l border-amber-200/80 bg-gradient-to-b from-stone-50 to-amber-50/95 shadow-xl"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
            <h2 className="text-sm font-semibold text-amber-600">Total para produção</h2>
            <button
              type="button"
              onClick={() => setTotalMinimized(true)}
              className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              title="Minimizar"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
          <div className="flex-1 space-y-1 overflow-auto p-2 text-xs">
            {productionGrouped.map((g) => (
              <div key={g.name} className="rounded-lg bg-slate-100 px-2 py-1.5">
                <span className="font-medium text-slate-800">{g.total} {g.name}</span>
                {Object.keys(g.byPoint || {}).length > 0 && (
                  <span className="text-amber-600">{formatByPoint(g.byPoint)}</span>
                )}
              </div>
            ))}
            {production.pratoFeito &&
              typeof production.pratoFeito === 'object' &&
              !Array.isArray(production.pratoFeito) &&
              production.pratoFeito.pratos > 0 && (
                <div className="mt-3 border-t-2 border-amber-400/70 pt-2">
                  <div className="rounded-lg bg-amber-100 px-2 py-2">
                    <span className="font-semibold text-amber-900">
                      {production.pratoFeito.pratos} Prato Feito /{' '}
                      {production.pratoFeito.espetinhos === 1
                        ? '1 espetinho'
                        : `${production.pratoFeito.espetinhos} espetinhos`}
                    </span>
                  </div>
                </div>
              )}
            {productionGrouped.length === 0 && !production.pratoFeito && (
              <p className="p-2 text-slate-500">Nenhum pedido</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
