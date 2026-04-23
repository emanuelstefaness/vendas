export const PRECO_CEbola_CARAMELIZADA = 5
export const PRECO_HAMBURGUER_EXTRA = 12

function normName(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function itemAceitaCebolaCaramelizada(nameOrItem) {
  const n = normName(typeof nameOrItem === 'string' ? nameOrItem : nameOrItem?.name)
  if (n.includes('coracao') || n.includes('coração')) return false
  return n.includes('churraspao') || n.includes('churras pao')
}

export function itemAceitaHamburguerExtra(nameOrItem) {
  const n = normName(typeof nameOrItem === 'string' ? nameOrItem : nameOrItem?.name)
  return n.includes('x-bosque') || n.includes('x bosque') || n.includes('xbosque')
}

/** Indica se o fluxo de lanche precisa de tela com adicionais (Churraspão / X-Bosque). */
export function lancheComOpcionaisAdicionais(item, categorySlug) {
  if (categorySlug !== 'lanches' || !item?.name) return false
  return itemAceitaCebolaCaramelizada(item) || itemAceitaHamburguerExtra(item)
}

export function unitPrecoComAddons(itemBasePrice, nameOrItem, flags) {
  let u = Number(itemBasePrice) || 0
  const name = typeof nameOrItem === 'string' ? nameOrItem : nameOrItem?.name
  if (flags?.extra_caramelized_onion && itemAceitaCebolaCaramelizada(name)) u += PRECO_CEbola_CARAMELIZADA
  if (flags?.extra_hamburger && itemAceitaHamburguerExtra(name)) u += PRECO_HAMBURGUER_EXTRA
  return u
}

/** Texto curto para cozinha / comanda (ex.: " · +cebola caramelizada"). */
export function textoResumoAddonsPedido(p) {
  const parts = []
  if (Number(p.extra_caramelized_onion) === 1) parts.push('cebola caramelizada')
  if (Number(p.extra_hamburger) === 1) parts.push('hambúrguer extra')
  if (parts.length === 0) return ''
  return ' · +' + parts.join(', +')
}
