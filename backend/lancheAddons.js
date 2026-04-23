/** Adicionais opcionais em lanches específicos (valores alinhados ao operador). */
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

export function itemAceitaCebolaCaramelizada(itemLike) {
  const n = normName(typeof itemLike === 'string' ? itemLike : itemLike?.name)
  if (n.includes('coracao') || n.includes('coração')) return false
  return n.includes('churraspao') || n.includes('churras pao')
}

export function itemAceitaHamburguerExtra(itemLike) {
  const n = normName(typeof itemLike === 'string' ? itemLike : itemLike?.name)
  return n.includes('x-bosque') || n.includes('x bosque') || n.includes('xbosque')
}

/**
 * @param {object} item - linha de `items` (precisa de `name`, `price`)
 * @param {object} body - req.body parcial
 * @returns {{ extra_caramelized_onion: 0|1, extra_hamburger: 0|1, unit_addon: number }}
 */
export function resolveLancheAddonsFromBody(item, body) {
  const onionReq =
    body?.extra_caramelized_onion === true ||
    body?.extra_caramelized_onion === 1 ||
    body?.extra_caramelized_onion === '1'
  const burgerReq =
    body?.extra_hamburger === true ||
    body?.extra_hamburger === 1 ||
    body?.extra_hamburger === '1'
  const onion = onionReq && itemAceitaCebolaCaramelizada(item) ? 1 : 0
  const burger = burgerReq && itemAceitaHamburguerExtra(item) ? 1 : 0
  const unit_addon = onion * PRECO_CEbola_CARAMELIZADA + burger * PRECO_HAMBURGUER_EXTRA
  return { extra_caramelized_onion: onion, extra_hamburger: burger, unit_addon }
}
