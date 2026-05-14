import { Router } from 'express';

export const reportsRouter = Router();
const getDb = (req) => req.app.get('db');

/** Data do dia operacional (virada 01:00): igual ao financeiro — date(closed_at, '-1 hour'). */
function businessDayExpr(closedAtCol) {
  return `date(${closedAtCol}, '-1 hour')`;
}

/** Comandas que geram linha de venda no relatório (pagas / fechadas no caixa) */
function paidComandaWhere(alias) {
  const a = alias;
  return `
  ${a}.status = 'closed' AND ${a}.closed_at IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM pedidos ped WHERE ped.comanda_id = ${a}.id AND ped.status != 'cancelled')
    OR IFNULL(${a}.people_count, 0) > 0
  )
`;
}

/** @param {import('express').Request} req */
function resolveRange(req) {
  const today = new Date().toISOString().slice(0, 10);
  const month = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const to = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    return { from, to };
  }
  let from = (req.query.from || req.query.date || today).toString().trim().slice(0, 10);
  let to = (req.query.to || from).toString().trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) from = today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) to = from;
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

const PAID = paidComandaWhere('c');

reportsRouter.get('/vendas/dia', (req, res) => {
  const db = getDb(req);
  const { from, to } = resolveRange(req);
  const paid = paidComandaWhere('c');
  const rows = db.prepare(`
    SELECT c.id as comanda_id, c.mesa, c.status, c.closed_at,
      (SELECT COALESCE(SUM(px.quantity * px.unit_price), 0) FROM pedidos px WHERE px.comanda_id = c.id AND px.status != 'cancelled') as subtotal,
      (COALESCE(c.people_count, 0) * COALESCE(c.couvert_per_person, 5)) as couvert_valor,
      ((COALESCE(c.service_tax_percent, 0) / 100.0) * (SELECT COALESCE(SUM(px2.quantity * px2.unit_price), 0) FROM pedidos px2 WHERE px2.comanda_id = c.id AND px2.status != 'cancelled')) as taxa_servico_valor,
      (
        (SELECT COALESCE(SUM(px3.quantity * px3.unit_price), 0) FROM pedidos px3 WHERE px3.comanda_id = c.id AND px3.status != 'cancelled')
        + (COALESCE(c.people_count, 0) * COALESCE(c.couvert_per_person, 5))
        + ((COALESCE(c.service_tax_percent, 0) / 100.0) * (SELECT COALESCE(SUM(px4.quantity * px4.unit_price), 0) FROM pedidos px4 WHERE px4.comanda_id = c.id AND px4.status != 'cancelled'))
      ) as total
    FROM comandas c
    WHERE ${businessDayExpr('c.closed_at')} BETWEEN ? AND ? AND ${paid.trim()}
    ORDER BY c.closed_at
  `).all(from, to);
  res.json(rows);
});

/** Faturamento agregado por dia no intervalo (mesma base do faturamento total) */
reportsRouter.get('/vendas/mes', (req, res) => {
  const db = getDb(req);
  const { from, to } = resolveRange(req);
  const paid = paidComandaWhere('c');
  const rows = db.prepare(`
    SELECT ${businessDayExpr('c.closed_at')} as dia, SUM(
      IFNULL((SELECT SUM(p.quantity * p.unit_price) FROM pedidos p WHERE p.comanda_id = c.id AND p.status != 'cancelled'), 0)
      + (IFNULL(c.people_count, 0) * COALESCE(c.couvert_per_person, 5))
      + ((IFNULL(c.service_tax_percent, 0) / 100.0) * IFNULL((SELECT SUM(p.quantity * p.unit_price) FROM pedidos p WHERE p.comanda_id = c.id AND p.status != 'cancelled'), 0))
    ) as total
    FROM comandas c
    WHERE ${businessDayExpr('c.closed_at')} BETWEEN ? AND ? AND ${paid.trim()}
    GROUP BY ${businessDayExpr('c.closed_at')}
    ORDER BY dia
  `).all(from, to);
  res.json(rows);
});

reportsRouter.get('/itens-mais-vendidos', (req, res) => {
  const db = getDb(req);
  const { from, to } = resolveRange(req);
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const paid = paidComandaWhere('cmd');
  const rows = db.prepare(`
    SELECT i.name, SUM(p.quantity) as total_quantity, SUM(p.quantity * p.unit_price) as total_value
    FROM pedidos p
    JOIN comandas cmd ON cmd.id = p.comanda_id
    JOIN items i ON i.id = p.item_id
    WHERE ${businessDayExpr('cmd.closed_at')} BETWEEN ? AND ?
    AND ${paid.trim()}
    AND p.status != 'cancelled'
    GROUP BY p.item_id
    ORDER BY total_quantity DESC
    LIMIT ?
  `).all(from, to, limit);
  res.json(rows);
});

reportsRouter.get('/por-categoria', (req, res) => {
  const db = getDb(req);
  const { from, to } = resolveRange(req);
  const paid = paidComandaWhere('cmd');
  const rows = db.prepare(`
    SELECT cat.name as category_name, SUM(p.quantity * p.unit_price) as total
    FROM pedidos p
    JOIN comandas cmd ON cmd.id = p.comanda_id
    JOIN items i ON i.id = p.item_id
    JOIN categories cat ON cat.id = i.category_id
    WHERE ${businessDayExpr('cmd.closed_at')} BETWEEN ? AND ?
    AND ${paid.trim()}
    AND p.status != 'cancelled'
    GROUP BY i.category_id
    ORDER BY total DESC
  `).all(from, to);
  res.json(rows);
});

reportsRouter.get('/faturamento', (req, res) => {
  const db = getDb(req);
  const { from, to } = resolveRange(req);
  const comandas = db.prepare(`
    SELECT c.* FROM comandas c
    WHERE ${businessDayExpr('c.closed_at')} BETWEEN ? AND ? AND ${PAID.trim()}
  `).all(from, to);
  let faturamento = 0;
  let taxaServico = 0;
  let couvert = 0;
  let totalPessoas = 0;
  comandas.forEach((c) => {
    const sub = db.prepare('SELECT SUM(quantity * unit_price) as s FROM pedidos WHERE comanda_id = ? AND status != ?').get(c.id, 'cancelled');
    const subTotal = sub?.s || 0;
    taxaServico += (c.service_tax_percent || 0) / 100 * subTotal;
    const cv = (c.people_count || 0) * (c.couvert_per_person || 5);
    couvert += cv;
    faturamento += subTotal + (c.service_tax_percent || 0) / 100 * subTotal + cv;
    totalPessoas += c.people_count || 0;
  });
  const n = comandas.length;
  res.json({
    from,
    to,
    faturamento,
    taxaServico,
    couvert,
    comandasCount: n,
    totalPessoas,
    ticketMedio: n > 0 ? faturamento / n : 0,
    ticketPorPessoa: totalPessoas > 0 ? faturamento / totalPessoas : 0,
    business_day_note:
      'Dia operacional (virada 01:00): vendas são agrupadas pela data date(closed_at, -1 hour), alinhado ao financeiro.',
  });
});

reportsRouter.get('/churrasqueira', (req, res) => {
  const db = getDb(req);
  const { from, to } = resolveRange(req);
  const paid = paidComandaWhere('cmd');
  const rows = db.prepare(`
    SELECT i.name, SUM(p.quantity) as total
    FROM pedidos p
    JOIN comandas cmd ON cmd.id = p.comanda_id
    JOIN items i ON i.id = p.item_id
    WHERE ${businessDayExpr('cmd.closed_at')} BETWEEN ? AND ?
    AND ${paid.trim()}
    AND p.sector = 'grill' AND p.status != 'cancelled'
    GROUP BY p.item_id
    ORDER BY total DESC
  `).all(from, to);
  res.json(rows);
});

reportsRouter.get('/por-garcom', (req, res) => {
  const db = getDb(req);
  const { from, to } = resolveRange(req);
  const paid = paidComandaWhere('c');
  const rows = db.prepare(`
    SELECT
      COALESCE(w.name, '(Sem garçom)') as waiter_name,
      COUNT(*) as comandas_count,
      SUM(
        IFNULL((SELECT SUM(p.quantity * p.unit_price) FROM pedidos p WHERE p.comanda_id = c.id AND p.status != 'cancelled'), 0)
        + (IFNULL(c.people_count, 0) * COALESCE(c.couvert_per_person, 5))
        + ((IFNULL(c.service_tax_percent, 0) / 100.0) * IFNULL((SELECT SUM(p.quantity * p.unit_price) FROM pedidos p WHERE p.comanda_id = c.id AND p.status != 'cancelled'), 0))
      ) as total_faturamento
    FROM comandas c
    LEFT JOIN waiters w ON w.id = c.waiter_id
    WHERE ${businessDayExpr('c.closed_at')} BETWEEN ? AND ? AND ${paid.trim()}
    GROUP BY IFNULL(c.waiter_id, -1), COALESCE(w.name, '(Sem garçom)')
    ORDER BY total_faturamento DESC
  `).all(from, to);
  res.json(rows);
});

reportsRouter.get('/cancelamentos', (req, res) => {
  const db = getDb(req);
  const { from, to } = resolveRange(req);
  const resumo = db.prepare(`
    SELECT
      COUNT(*) as linhas_canceladas,
      COALESCE(SUM(p.quantity * p.unit_price), 0) as valor_cancelado
    FROM pedidos p
    WHERE p.status = 'cancelled'
    AND date(COALESCE(NULLIF(TRIM(p.updated_at), ''), p.created_at)) BETWEEN ? AND ?
  `).get(from, to);
  const porItem = db.prepare(`
    SELECT i.name,
      SUM(p.quantity) as total_quantity,
      COALESCE(SUM(p.quantity * p.unit_price), 0) as total_value
    FROM pedidos p
    JOIN items i ON i.id = p.item_id
    WHERE p.status = 'cancelled'
    AND date(COALESCE(NULLIF(TRIM(p.updated_at), ''), p.created_at)) BETWEEN ? AND ?
    GROUP BY p.item_id
    ORDER BY total_quantity DESC
    LIMIT 40
  `).all(from, to);
  res.json({ from, to, resumo, porItem });
});
