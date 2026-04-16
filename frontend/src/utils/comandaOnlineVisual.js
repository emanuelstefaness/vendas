/** `comanda_tipo_online` vindo do JOIN em pedidos: 'delivery' | 'retirada' | null (salão). */
export function tipoOnlineFromPedido(p) {
  return p?.comanda_tipo_online ?? null
}

export function comandaOnlineLabel(tipo) {
  if (tipo === 'delivery') return '🚚 Delivery'
  if (tipo === 'retirada') return '🛍 Retirada'
  return null
}

/** Linha de pedido na Cozinha (e TVs que listam pedido a pedido). */
export function cozinhaPedidoCardClass(p) {
  const t = tipoOnlineFromPedido(p)
  const base = 'flex items-center justify-between gap-2 rounded-xl border-2 p-3 '
  if (t === 'delivery') {
    return base + (p.waiting_grill
      ? 'border-sky-500 bg-sky-100 shadow-sm'
      : 'border-sky-300 bg-sky-50/95 shadow-sm ring-1 ring-sky-200/60')
  }
  if (t === 'retirada') {
    return base + (p.waiting_grill
      ? 'border-teal-500 bg-teal-50 shadow-sm'
      : 'border-teal-300 bg-teal-50/90 shadow-sm ring-1 ring-teal-200/70')
  }
  return base + (p.waiting_grill ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white shadow-sm')
}

/** Coluna de comanda na Churrasqueira. */
export function churrasqueiraComandaColumnClass(tipoOnline) {
  if (tipoOnline === 'delivery') {
    return 'flex w-[min(272px,70vw)] min-w-[224px] shrink-0 flex-col self-start rounded-2xl border-2 border-sky-500 bg-gradient-to-b from-sky-50 to-white p-4 shadow-[0_8px_30px_rgb(14,165,233,0.14)] ring-1 ring-sky-300/40'
  }
  if (tipoOnline === 'retirada') {
    return 'flex w-[min(272px,70vw)] min-w-[224px] shrink-0 flex-col self-start rounded-2xl border-2 border-teal-500/95 bg-gradient-to-b from-teal-50/95 to-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-teal-800/15'
  }
  return 'flex w-[min(272px,70vw)] min-w-[224px] shrink-0 flex-col self-start rounded-2xl border-2 border-amber-500/90 bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-amber-900/10'
}

/** Coluna de comanda no Bar. */
export function barComandaColumnClass(tipoOnline) {
  if (tipoOnline === 'delivery') {
    return 'flex w-[min(300px,85vw)] min-w-[240px] shrink-0 flex-col rounded-xl border-2 border-sky-500 bg-gradient-to-b from-sky-50 to-white p-3 shadow-md ring-1 ring-sky-200/50'
  }
  if (tipoOnline === 'retirada') {
    return 'flex w-[min(300px,85vw)] min-w-[240px] shrink-0 flex-col rounded-xl border-2 border-teal-500/90 bg-gradient-to-b from-teal-50 to-white p-3 shadow-md ring-1 ring-teal-200/50'
  }
  return 'flex w-[min(300px,85vw)] min-w-[240px] shrink-0 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm'
}

/** Card grande nas TVs (um pedido por card). */
export function tvPedidoCardClass(p) {
  const t = tipoOnlineFromPedido(p)
  if (t === 'delivery') {
    return `rounded-2xl border-2 p-6 text-xl shadow-md border-sky-500 bg-gradient-to-br from-sky-50 to-white ${p.waiting_grill ? 'ring-2 ring-sky-300' : 'ring-1 ring-sky-200/80'}`
  }
  if (t === 'retirada') {
    return 'rounded-2xl border-2 border-teal-500 bg-gradient-to-br from-teal-50 to-white p-6 text-xl shadow-md ring-1 ring-teal-200/70'
  }
  return `rounded-2xl border-2 p-6 text-xl shadow-md ${p.waiting_grill ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white'}`
}
