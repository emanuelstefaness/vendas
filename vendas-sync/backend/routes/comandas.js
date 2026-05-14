import { Router } from 'express';
import { broadcastAll } from '../socket.js';

export const comandasRouter = Router();
const getDb = (req) => req.app.get('db');

comandasRouter.get('/', (req, res) => {
  const db = getDb(req);
  const list = db.prepare(`
    SELECT c.*,
      COALESCE(a.pedidos_count, 0) AS pedidos_count,
      COALESCE(a.total_pedidos, 0) AS total_pedidos
    FROM comandas c
    LEFT JOIN (
      SELECT comanda_id,
        COUNT(*) AS pedidos_count,
        SUM(quantity * unit_price) AS total_pedidos
      FROM pedidos
      WHERE status != 'cancelled'
      GROUP BY comanda_id
    ) a ON a.comanda_id = c.id
    ORDER BY c.id
  `).all();
  const map = new Map(list.map((row) => [Number(row.id), row]));
  const byId = {};
  const empty = (id) => ({
    id,
    mesa: null,
    status: 'closed',
    closed_at: null,
    pedidos_count: 0,
    total_pedidos: 0,
  });
  for (let i = 1; i <= 200; i++) {
    byId[i] = map.get(i) || empty(i);
  }
  list.filter((c) => Number(c.id) > 200).forEach((c) => {
    byId[c.id] = c;
  });
  res.json(byId);
});

// Agrupar comandas: move todos os pedidos das source para a target e fecha as source (só comandas abertas)
const OPEN_STATUSES = ['open', 'ordering', 'paying'];
function isOpen(c) {
  return c && c.mesa && OPEN_STATUSES.includes(c.status);
}

export function mergeComandasHandler(req, res, db) {
  try {
    const { target_id, source_ids } = req.body || {};
    const targetId = Number(target_id);
    let ids = [];
    if (Array.isArray(source_ids)) ids = source_ids.map(Number).filter((n) => n >= 1 && n <= 200);
    else if (source_ids != null) ids = [Number(source_ids)].filter((n) => n >= 1 && n <= 200);

    if (!targetId || targetId < 1 || targetId > 200) return res.status(400).json({ error: 'Comanda destino inválida' });
    if (ids.length === 0) return res.status(400).json({ error: 'Selecione ao menos uma comanda para agrupar' });
    if (ids.includes(targetId)) return res.status(400).json({ error: 'Comanda destino não pode estar na lista de origem' });

    const target = db.prepare('SELECT * FROM comandas WHERE id = ?').get(targetId);
    if (!target) return res.status(400).json({ error: 'Comanda destino não encontrada' });
    if (!isOpen(target)) return res.status(400).json({ error: 'Comanda destino deve estar aberta (com mesa)' });

    for (const sid of ids) {
      const src = db.prepare('SELECT * FROM comandas WHERE id = ?').get(sid);
      if (!src) return res.status(400).json({ error: `Comanda ${sid} não encontrada` });
      if (!isOpen(src)) return res.status(400).json({ error: `Comanda ${sid} não está aberta para agrupar` });
    }

    const updatePedido = db.prepare('UPDATE pedidos SET comanda_id = ?, updated_at = datetime(\'now\',\'localtime\') WHERE comanda_id = ?');
    const closeComanda = db.prepare("UPDATE comandas SET status = 'closed', mesa = NULL, updated_at = datetime('now','localtime') WHERE id = ?");

    for (const sid of ids) {
      updatePedido.run(targetId, sid);
      closeComanda.run(sid);
    }

    broadcastAll('comandas', {});
    broadcastAll('pedidos', {});
    return res.json({ target_id: targetId, merged: ids });
  } catch (err) {
    console.error('Erro ao agrupar comandas:', err);
    return res.status(500).json({ error: err.message || 'Erro ao agrupar comandas' });
  }
}

comandasRouter.post('/merge', (req, res) => mergeComandasHandler(req, res, getDb(req)));

/** Usado em server.js antes do router (garante POST /api/comandas/:id/clear) e pode ser reutilizado */
export function clearComandaHandler(req, res, db) {
  try {
    if (!db) return res.status(500).json({ error: 'Banco de dados não disponível' });
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: 'Comanda inválida' });

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE pedidos SET status = 'cancelled', updated_at = datetime('now','localtime')
        WHERE comanda_id = ? AND status != 'cancelled'
      `).run(id);
      const existing = db.prepare('SELECT * FROM comandas WHERE id = ?').get(id);
      if (existing) {
        db.prepare(`
          UPDATE comandas SET status = 'closed', mesa = NULL, people_count = 0, service_tax_percent = 0, client_cpf = NULL,
            closed_at = datetime('now','localtime'), updated_at = datetime('now','localtime')
          WHERE id = ?
        `).run(id);
      } else if (id <= 200) {
        db.prepare(`
          INSERT INTO comandas (id, mesa, status, people_count, service_tax_percent, client_cpf, closed_at, updated_at)
          VALUES (?, NULL, 'closed', 0, 0, NULL, datetime('now','localtime'), datetime('now','localtime'))
        `).run(id);
      }
    });
    tx();
    broadcastAll('pedidos', {});
    broadcastAll('comandas', {});
    return res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao limpar comanda:', err);
    return res.status(500).json({ error: err.message || 'Erro ao excluir comanda' });
  }
}

comandasRouter.get('/:id', (req, res) => {
  const db = getDb(req);
  const c = db.prepare('SELECT * FROM comandas WHERE id = ?').get(Number(req.params.id));
  if (!c) return res.status(404).json({ error: 'Comanda não encontrada' });
  res.json(c);
});

comandasRouter.post('/:id/open', (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(500).json({ error: 'Banco de dados não disponível' });
    const id = Number(req.params.id);
    if (id < 1 || id > 200) return res.status(400).json({ error: 'Comanda inválida (use 1 a 200)' });
    const { mesa, waiter_id } = req.body || {};
    const mesaStr = mesa != null ? String(mesa).trim() : '';
    if (!mesaStr) return res.status(400).json({ error: 'Número da mesa é obrigatório' });
    const wid = waiter_id != null ? Number(waiter_id) : null;
    const existing = db.prepare('SELECT * FROM comandas WHERE id = ?').get(id);
    if (existing) {
      db.prepare("UPDATE comandas SET mesa = ?, status = ?, waiter_id = ?, closed_at = NULL, updated_at = datetime('now','localtime') WHERE id = ?")
        .run(mesaStr, 'open', wid, id);
    } else {
      db.prepare('INSERT INTO comandas (id, mesa, status, waiter_id) VALUES (?, ?, ?, ?)')
        .run(id, mesaStr, 'open', wid);
    }
    broadcastAll('comandas', {});
    return res.json({ id, mesa: mesaStr, status: 'open' });
  } catch (err) {
    console.error('Erro ao abrir comanda:', err);
    return res.status(500).json({ error: err.message || 'Erro ao abrir comanda' });
  }
});

comandasRouter.patch('/:id', (req, res) => {
  try {
    const db = getDb(req);
    if (!db) return res.status(500).json({ error: 'Banco de dados não disponível' });
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) return res.status(400).json({ error: 'Comanda inválida' });
    const exists = db.prepare('SELECT id FROM comandas WHERE id = ?').get(id);
    if (!exists) return res.status(404).json({ error: 'Comanda não encontrada' });

    const { mesa, status, people_count, service_tax_percent, couvert_per_person, client_cpf } = req.body || {};
    const updates = [];
    const values = [];
    if (mesa !== undefined) { updates.push('mesa = ?'); values.push(mesa != null ? String(mesa).trim() : null); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (people_count !== undefined) { updates.push('people_count = ?'); values.push(people_count); }
    if (service_tax_percent !== undefined) { updates.push('service_tax_percent = ?'); values.push(service_tax_percent); }
    if (couvert_per_person !== undefined) { updates.push('couvert_per_person = ?'); values.push(couvert_per_person); }
    if (client_cpf !== undefined) { updates.push('client_cpf = ?'); values.push(client_cpf); }
    if (status === 'closed') {
      updates.push("closed_at = datetime('now','localtime')");
      if (mesa === undefined) {
        updates.push('mesa = ?');
        values.push(null);
      }
    }
    updates.push("updated_at = datetime('now','localtime')");
    values.push(id);
    db.prepare(`UPDATE comandas SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    broadcastAll('comandas', {});
    res.json({ id, updated: true });
  } catch (err) {
    console.error('Erro ao atualizar comanda:', err);
    return res.status(500).json({ error: err.message || 'Erro ao atualizar comanda' });
  }
});

comandasRouter.get('/:id/summary', (req, res) => {
  const db = getDb(req);
  const id = Number(req.params.id);
  const comanda = db.prepare('SELECT * FROM comandas WHERE id = ?').get(id);
  if (!comanda) return res.status(404).json({ error: 'Comanda não encontrada' });
  const pedidos = db.prepare(`
    SELECT p.*, i.name as item_name
    FROM pedidos p
    JOIN items i ON i.id = p.item_id
    WHERE p.comanda_id = ? AND p.status != 'cancelled'
    ORDER BY p.created_at
  `).all(id);
  let subtotal = 0;
  pedidos.forEach(p => { subtotal += p.quantity * p.unit_price; });
  const peopleCount = comanda.people_count || 0;
  const couvertPerPerson = comanda.couvert_per_person || 5;
  const couvertRow = db.prepare(`
    SELECT COALESCE(SUM(p.quantity), 0) as qty, COALESCE(SUM(p.quantity * p.unit_price), 0) as val
    FROM pedidos p JOIN items i ON i.id = p.item_id
    WHERE p.comanda_id = ? AND p.status != 'cancelled' AND TRIM(LOWER(i.name)) = 'couvert'
  `).get(id);
  const couvertLancadoQty = couvertRow?.qty || 0;
  const couvertLancado = couvertRow?.val || 0;
  const couvertPendente = Math.max(0, peopleCount * couvertPerPerson - couvertLancado);
  const serviceTax = (comanda.service_tax_percent || 0) / 100 * subtotal;
  const total = subtotal + serviceTax + couvertPendente;
  res.json({
    comanda,
    pedidos,
    subtotal,
    couvert: peopleCount * couvertPerPerson,
    couvertLancado,
    couvertPendente,
    serviceTax,
    total
  });
});

// Lançar couvert na comanda: adiciona pedido(s) de item "Couvert" conforme people_count
comandasRouter.post('/:id/lancar-couvert', (req, res) => {
  const db = getDb(req);
  const id = Number(req.params.id);
  const comanda = db.prepare('SELECT * FROM comandas WHERE id = ?').get(id);
  if (!comanda) return res.status(404).json({ error: 'Comanda não encontrada' });
  const stLc = String(comanda.status || '').toLowerCase();
  if (stLc === 'closed' || comanda.closed_at) {
    return res.status(400).json({ error: 'Comanda fechada. Não é possível lançar couvert.' });
  }
  const peopleCount = Math.max(0, Number(comanda.people_count) || 0);
  const couvertPerPerson = Number(comanda.couvert_per_person) || 5;
  if (peopleCount === 0) return res.status(400).json({ error: 'Informe a quantidade de pessoas antes de lançar o couvert' });

  let categoryId = db.prepare('SELECT id FROM categories WHERE slug = ?').get('diversos')?.id;
  if (!categoryId) {
    db.prepare('INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, ?)').run('Diversos', 'diversos', 999);
    categoryId = db.prepare('SELECT id FROM categories WHERE slug = ?').get('diversos').id;
  }
  let item = db.prepare('SELECT * FROM items WHERE name = ? AND category_id = ?').get('Couvert', categoryId);
  if (!item) {
    db.prepare(`
      INSERT INTO items (category_id, name, price, description, requires_meat_point, is_grill, is_kitchen, is_bar, is_side, is_prato_feito)
      VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0)
    `).run(categoryId, 'Couvert', couvertPerPerson, null);
    item = db.prepare('SELECT * FROM items WHERE name = ? AND category_id = ?').get('Couvert', categoryId);
  }
  const couvertLancadoRow = db.prepare(`
    SELECT COALESCE(SUM(p.quantity), 0) as qty FROM pedidos p
    JOIN items i ON i.id = p.item_id
    WHERE p.comanda_id = ? AND p.status != 'cancelled' AND i.id = ?
  `).get(id, item.id);
  const alreadyQty = couvertLancadoRow?.qty || 0;
  const toAdd = Math.max(0, peopleCount - alreadyQty);
  if (toAdd === 0) {
    return res.json({ ok: true, message: 'Couvert já lançado para esta quantidade de pessoas' });
  }
  db.prepare(`
    INSERT INTO pedidos (comanda_id, item_id, quantity, unit_price, sector)
    VALUES (?, ?, ?, ?, NULL)
  `).run(id, item.id, toAdd, couvertPerPerson);
  db.prepare("UPDATE comandas SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?").run('ordering', id);
  broadcastAll('pedidos', {});
  broadcastAll('comandas', {});
  res.json({ ok: true, added: toAdd });
});

// Trocar número da comanda: transfere esta comanda para outro id (1-200)
comandasRouter.post('/:id/change-number', (req, res) => {
  const db = getDb(req);
  const id = Number(req.params.id);
  const { new_id } = req.body || {};
  const newId = Number(new_id);
  if (id < 1 || id > 200 || newId < 1 || newId > 200) return res.status(400).json({ error: 'IDs devem ser entre 1 e 200' });
  if (id === newId) return res.status(400).json({ error: 'Número novo deve ser diferente do atual' });

  const comanda = db.prepare('SELECT * FROM comandas WHERE id = ?').get(id);
  if (!comanda) return res.status(404).json({ error: 'Comanda não encontrada' });

  const existing = db.prepare('SELECT * FROM comandas WHERE id = ?').get(newId);
  const pedidosNew = existing ? db.prepare('SELECT COUNT(*) as n FROM pedidos WHERE comanda_id = ? AND status != ?').get(newId, 'cancelled') : { n: 0 };
  if (existing && (OPEN_STATUSES.includes(existing.status) || (pedidosNew && pedidosNew.n > 0))) {
    return res.status(400).json({ error: `Comanda ${newId} já está em uso. Escolha outro número.` });
  }

  const updPedidos = db.prepare('UPDATE pedidos SET comanda_id = ? WHERE comanda_id = ?');

  if (existing) {
    db.prepare(`
      UPDATE comandas SET mesa = ?, status = ?, waiter_id = ?, people_count = ?, service_tax_percent = ?, couvert_per_person = ?, client_cpf = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(comanda.mesa, comanda.status, comanda.waiter_id, comanda.people_count ?? 0, comanda.service_tax_percent ?? 0, comanda.couvert_per_person ?? 5, comanda.client_cpf ?? null, newId);
  } else {
    db.prepare(
      'INSERT INTO comandas (id, mesa, status, waiter_id, people_count, service_tax_percent, couvert_per_person, client_cpf, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\',\'localtime\'))'
    ).run(newId, comanda.mesa, comanda.status, comanda.waiter_id, comanda.people_count ?? 0, comanda.service_tax_percent ?? 0, comanda.couvert_per_person ?? 5, comanda.client_cpf ?? null);
  }

  updPedidos.run(newId, id);
  db.prepare("UPDATE comandas SET status = 'closed', mesa = NULL, updated_at = datetime('now','localtime') WHERE id = ?").run(id);

  broadcastAll('comandas', {});
  broadcastAll('pedidos', {});
  return res.json({ old_id: id, new_id: newId });
});
