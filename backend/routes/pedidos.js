import { Router } from 'express';
import { broadcastAll } from '../socket.js';
import { getPedidoSector, BAR_CATEGORY_SLUGS } from '../itemSector.js';

export const pedidosRouter = Router();
const getDb = (req) => req.app.get('db');

// Cancelar vários pedidos (cobrança separada) — rota estática antes de /:id
pedidosRouter.post('/cancel-many', (req, res) => {
  const db = getDb(req);
  const { ids } = req.body || {};
  const idList = Array.isArray(ids) ? ids.map(Number).filter((n) => n > 0) : [];
  if (idList.length === 0) return res.status(400).json({ error: 'Informe os ids dos pedidos (ids: [])' });
  const stmt = db.prepare(
    "UPDATE pedidos SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?"
  );
  for (const pid of idList) stmt.run('cancelled', pid);
  broadcastAll('pedidos', {});
  broadcastAll('comandas', {});
  res.json({ ok: true, cancelled: idList.length });
});

pedidosRouter.post('/', (req, res) => {
  try {
    const db = getDb(req);
    const { comanda_id, item_id, quantity: qtyRaw = 1, observations, meat_point, caipirinha_base, caipirinha_picole, dose_accompaniment, prato_feito_espetinho_id } = req.body || {};
    const cid = Number(comanda_id);
    const iid = Number(item_id);
    if (!Number.isFinite(cid) || cid < 1 || !Number.isFinite(iid) || iid < 1) {
      return res.status(400).json({ error: 'comanda_id e item_id obrigatórios (números válidos)' });
    }
    const quantity = Math.max(1, Math.min(999, parseInt(String(qtyRaw), 10) || 1));
    const item = db.prepare(`
      SELECT i.*, c.slug AS category_slug
      FROM items i
      LEFT JOIN categories c ON c.id = i.category_id
      WHERE i.id = ?
    `).get(iid);
    if (!item) return res.status(404).json({ error: 'Item não encontrado' });
    const comandaRow = db.prepare('SELECT status, closed_at FROM comandas WHERE id = ?').get(cid);
    if (!comandaRow) {
      return res.status(400).json({ error: 'Comanda não encontrada. Abra a comanda no garçom (mesa) antes de lançar.' });
    }
    const st = String(comandaRow.status || '').toLowerCase();
    if (st === 'closed' || comandaRow.closed_at) {
      return res.status(400).json({ error: 'Esta comanda já foi fechada no caixa. Use uma comanda livre ou reabra informando a mesa.' });
    }
    const sector = getPedidoSector(item);
    const unit_price = item.price;

    const run = db.transaction(() => {
      const info = db.prepare(`
        INSERT INTO pedidos (comanda_id, item_id, quantity, unit_price, observations, meat_point, caipirinha_base, caipirinha_picole, dose_accompaniment, prato_feito_espetinho_id, sector)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(cid, iid, quantity, unit_price, observations != null && String(observations).trim() ? String(observations).trim() : null, meat_point || null, caipirinha_base || null, caipirinha_picole ? 1 : 0, dose_accompaniment || null, prato_feito_espetinho_id != null ? Number(prato_feito_espetinho_id) || null : null, sector);
      const pedidoId = info.lastInsertRowid;
      const insStatus = db.prepare('INSERT OR REPLACE INTO pedido_sector_status (pedido_id, sector, status) VALUES (?, ?, ?)');
      if (sector) insStatus.run(pedidoId, sector, 'pending');
      if (item.is_grill && item.is_kitchen && sector === 'kitchen') insStatus.run(pedidoId, 'grill', 'pending');
      if (item.is_grill && item.is_kitchen && sector === 'grill') insStatus.run(pedidoId, 'kitchen', 'pending');
      db.prepare("UPDATE comandas SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?").run('ordering', cid);
      return pedidoId;
    });
    const pedidoId = run();
    broadcastAll('pedidos', {});
    broadcastAll('comandas', {});
    return res.status(201).json({ id: pedidoId, comanda_id: cid, item_id: iid, quantity, unit_price, sector });
  } catch (err) {
    console.error('Erro ao criar pedido:', err);
    return res.status(500).json({ error: err.message || 'Erro ao adicionar pedido' });
  }
});

pedidosRouter.get('/by-comanda/:comanda_id', (req, res) => {
  const db = getDb(req);
  const list = db.prepare(`
    SELECT p.*, i.name as item_name, i.price
    FROM pedidos p
    JOIN items i ON i.id = p.item_id
    WHERE p.comanda_id = ? AND p.status != 'cancelled'
    ORDER BY p.created_at
  `).all(Number(req.params.comanda_id));
  res.json(list);
});

pedidosRouter.get('/kitchen', (req, res) => {
  const db = getDb(req);
  const list = db.prepare(`
    SELECT p.*, i.name as item_name, i.is_grill, i.is_prato_feito, c.mesa, c.id as comanda_id, s.status as sector_status,
      ei.name as prato_feito_espetinho_name, w.name as waiter_name
    FROM pedido_sector_status s
    JOIN pedidos p ON p.id = s.pedido_id
    JOIN items i ON i.id = p.item_id
    JOIN comandas c ON c.id = p.comanda_id
    LEFT JOIN items ei ON ei.id = p.prato_feito_espetinho_id
    LEFT JOIN waiters w ON w.id = c.waiter_id
    WHERE s.sector = 'kitchen' AND s.status != 'ready' AND p.status != 'cancelled' AND p.status != 'delivered'
    ORDER BY p.created_at
  `).all();
  const grillStatus = db.prepare('SELECT pedido_id, status FROM pedido_sector_status WHERE sector = ?').all('grill');
  const grillMap = {};
  grillStatus.forEach(g => { grillMap[g.pedido_id] = g.status; });
  list.forEach(p => {
    p.waiting_grill = !!(p.is_grill && grillMap[p.id] !== 'ready');
  });
  res.json(list);
});

pedidosRouter.get('/grill', (req, res) => {
  const db = getDb(req);
  const list = db.prepare(`
    SELECT p.*, i.name as item_name, i.is_prato_feito as item_is_prato_feito, c.mesa, c.id as comanda_id, s.status as sector_status,
      ei.name as prato_feito_espetinho_name, w.name as waiter_name
    FROM pedido_sector_status s
    JOIN pedidos p ON p.id = s.pedido_id
    JOIN items i ON i.id = p.item_id
    JOIN comandas c ON c.id = p.comanda_id
    LEFT JOIN items ei ON ei.id = p.prato_feito_espetinho_id
    LEFT JOIN waiters w ON w.id = c.waiter_id
    WHERE s.sector = 'grill' AND s.status != 'ready' AND p.status != 'cancelled' AND p.status != 'delivered'
    ORDER BY p.created_at, p.id
  `).all();
  res.json(list);
});

pedidosRouter.get('/bar', (req, res) => {
  const db = getDb(req);
  const barIn = BAR_CATEGORY_SLUGS.map(() => '?').join(', ');
  const list = db.prepare(`
    SELECT p.*, i.name as item_name, c.mesa, c.id as comanda_id, COALESCE(s.status, 'pending') as sector_status,
      w.name as waiter_name
    FROM pedidos p
    JOIN items i ON i.id = p.item_id
    JOIN categories cat ON cat.id = i.category_id AND cat.slug IN (${barIn})
    JOIN comandas c ON c.id = p.comanda_id
    LEFT JOIN pedido_sector_status s ON s.pedido_id = p.id AND s.sector = 'bar'
    LEFT JOIN waiters w ON w.id = c.waiter_id
    WHERE p.sector = 'bar' AND p.status != 'cancelled' AND p.status != 'delivered' AND (s.status IS NULL OR s.status != 'ready')
    ORDER BY p.created_at, p.id
  `).all(...BAR_CATEGORY_SLUGS);
  list.forEach(p => { p.sector_status = p.sector_status || 'pending'; });
  res.json(list);
});

pedidosRouter.get('/production/kitchen', (req, res) => {
  const db = getDb(req);
  /* Conta tudo que a cozinha precisa fazer (quem tem status kitchen), não só p.sector = 'kitchen' */
  const items = db.prepare(`
    SELECT i.name, SUM(p.quantity) as total
    FROM pedido_sector_status s
    JOIN pedidos p ON p.id = s.pedido_id
    JOIN items i ON i.id = p.item_id
    WHERE s.sector = 'kitchen' AND s.status != 'ready' AND (i.is_prato_feito = 0 OR i.is_prato_feito IS NULL) AND p.status != 'cancelled' AND p.status != 'delivered'
    GROUP BY p.item_id
    ORDER BY total DESC
  `).all();
  const pratoFeitoRow = db.prepare(`
    SELECT COALESCE(SUM(p.quantity), 0) as total
    FROM pedido_sector_status s
    JOIN pedidos p ON p.id = s.pedido_id
    JOIN items it ON it.id = p.item_id
    WHERE s.sector = 'kitchen' AND s.status != 'ready' AND it.is_prato_feito = 1 AND p.status != 'cancelled' AND p.status != 'delivered'
  `).get();
  const pratoFeito = (pratoFeitoRow?.total > 0) ? [{ espetinho_name: 'Prato Feito', total: pratoFeitoRow.total }] : [];
  res.json({ items, pratoFeito });
});

pedidosRouter.get('/production/grill', (req, res) => {
  const db = getDb(req);
  /* Carnes diretas na churrasqueira — exclui o prato PF em si (o nome do cardápio); os cortes do PF entram via fromPratoFeito */
  const directGrill = db.prepare(`
    SELECT i.name, p.meat_point, SUM(p.quantity) as total
    FROM pedidos p
    JOIN items i ON i.id = p.item_id
    JOIN pedido_sector_status s ON s.pedido_id = p.id AND s.sector = 'grill'
    WHERE p.sector = 'grill' AND p.status != 'cancelled' AND p.status != 'delivered' AND s.status != 'ready'
      AND (i.is_prato_feito = 0 OR i.is_prato_feito IS NULL)
    GROUP BY p.item_id, p.meat_point
  `).all();
  const fromPratoFeito = db.prepare(`
    SELECT ei.name, p.meat_point, SUM(p.quantity) as total
    FROM pedidos p
    JOIN items it ON it.id = p.item_id
    JOIN items ei ON ei.id = p.prato_feito_espetinho_id
    JOIN pedido_sector_status s ON s.pedido_id = p.id AND s.sector = 'grill'
    WHERE it.is_prato_feito = 1 AND p.status != 'cancelled' AND p.status != 'delivered' AND p.prato_feito_espetinho_id IS NOT NULL AND s.status != 'ready'
    GROUP BY p.prato_feito_espetinho_id, p.meat_point
  `).all();
  const key = (name, meat) => `${name}|${meat || ''}`;
  const map = {};
  directGrill.forEach((r) => {
    const k = key(r.name, r.meat_point);
    map[k] = { name: r.name, meat_point: r.meat_point || null, total: (map[k]?.total || 0) + r.total };
  });
  fromPratoFeito.forEach((r) => {
    const k = key(r.name, r.meat_point);
    map[k] = { name: r.name, meat_point: r.meat_point || null, total: (map[k]?.total || 0) + r.total };
  });
  const byItem = Object.values(map).sort((a, b) => b.total - a.total);
  const pfPratosRow = db.prepare(`
    SELECT COALESCE(SUM(p.quantity), 0) as total
    FROM pedidos p
    JOIN items it ON it.id = p.item_id
    JOIN pedido_sector_status s ON s.pedido_id = p.id AND s.sector = 'grill'
    WHERE it.is_prato_feito = 1 AND p.status != 'cancelled' AND p.status != 'delivered' AND s.status != 'ready'
  `).get();
  const pfEspRow = db.prepare(`
    SELECT COALESCE(SUM(p.quantity), 0) as total
    FROM pedidos p
    JOIN items it ON it.id = p.item_id
    JOIN pedido_sector_status s ON s.pedido_id = p.id AND s.sector = 'grill'
    WHERE it.is_prato_feito = 1 AND p.prato_feito_espetinho_id IS NOT NULL
      AND p.status != 'cancelled' AND p.status != 'delivered' AND s.status != 'ready'
  `).get();
  const pratos = pfPratosRow?.total ?? 0;
  const espetinhos = pfEspRow?.total ?? 0;
  const pratoFeito = pratos > 0 ? { pratos, espetinhos } : null;
  res.json({ byItem, pratoFeito });
});

pedidosRouter.patch('/:id/sector-status', (req, res) => {
  const db = getDb(req);
  const io = req.app.get('io');
  const { sector, status } = req.body || {};
  if (!sector || !status) return res.status(400).json({ error: 'sector e status obrigatórios' });
  db.prepare("INSERT OR REPLACE INTO pedido_sector_status (pedido_id, sector, status, updated_at) VALUES (?, ?, ?, datetime('now','localtime'))").run(Number(req.params.id), sector, status);
  broadcastAll('pedidos', {});
  io.to('kitchen').emit('pedidos', {});
  io.to('grill').emit('pedidos', {});
  io.to('bar').emit('pedidos', {});
  res.json({ ok: true });
});

pedidosRouter.patch('/:id', (req, res) => {
  const db = getDb(req);
  const { quantity, unit_price, observations, status } = req.body || {};
  const updates = [];
  const values = [];
  if (quantity !== undefined) { updates.push('quantity = ?'); values.push(quantity); }
  if (unit_price !== undefined) { updates.push('unit_price = ?'); values.push(unit_price); }
  if (observations !== undefined) { updates.push('observations = ?'); values.push(observations); }
  if (status !== undefined) { updates.push('status = ?'); values.push(status); }
  if (!updates.length) return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  updates.push("updated_at = datetime('now','localtime')");
  values.push(Number(req.params.id));
  db.prepare(`UPDATE pedidos SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  broadcastAll('pedidos', {});
  broadcastAll('comandas', {});
  res.json({ ok: true });
});

pedidosRouter.delete('/:id', (req, res) => {
  const db = getDb(req);
  db.prepare(
    "UPDATE pedidos SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?"
  ).run('cancelled', Number(req.params.id));
  broadcastAll('pedidos', {});
  broadcastAll('comandas', {});
  res.json({ ok: true });
});
