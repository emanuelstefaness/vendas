/**
 * Categorias cujos itens com is_bar vão para a fila da tela Bar
 * Produção do bar na tela: só caipirinhas, doses e drinks.
 * (Refrigerantes/chopp em outras categorias não entram nesta fila.)
 */
export const BAR_CATEGORY_SLUGS = ['caipirinhas', 'doses', 'drinks'];
const BAR_CATEGORY_SET = new Set(BAR_CATEGORY_SLUGS);

export function getPedidoSector(item) {
  if (!item) return null;
  if (item.is_bar) {
    if (item.category_slug && BAR_CATEGORY_SET.has(item.category_slug)) return 'bar';
    return null;
  }
  if (item.is_grill) return 'grill';
  if (item.is_kitchen || item.is_side) return 'kitchen';
  return null;
}
