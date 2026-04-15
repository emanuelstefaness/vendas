import { Router } from 'express';

export const menuRouter = Router();
const getDb = (req) => req.app.get('db');

function slugFromName(name) {
  return String(name || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'categoria';
}

// ——— Categorias ———
menuRouter.get('/categories', (req, res) => {
  const db = getDb(req);
  const list = db.prepare('SELECT * FROM categories ORDER BY sort_order, name').all();
  res.json(list);
});

menuRouter.post('/categories', (req, res) => {
  const db = getDb(req);
  const { name, slug, sort_order } = req.body || {};
  const nome = String(name || '').trim();
  if (!nome) return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
  const slugVal = (slug && String(slug).trim()) || slugFromName(nome);
  const order = sort_order != null ? Number(sort_order) : 0;
  try {
    const r = db.prepare('INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, ?)').run(nome, slugVal, order);
    res.status(201).json({ id: r.lastInsertRowid, name: nome, slug: slugVal, sort_order: order });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Nome ou slug já existe' });
    throw e;
  }
});

menuRouter.patch('/categories/:id', (req, res) => {
  const db = getDb(req);
  const id = Number(req.params.id);
  const { name, slug, sort_order } = req.body || {};
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!cat) return res.status(404).json({ error: 'Categoria não encontrada' });
  const updates = [];
  const values = [];
  if (name !== undefined) { updates.push('name = ?'); values.push(String(name).trim()); }
  if (slug !== undefined) { updates.push('slug = ?'); values.push(String(slug).trim()); }
  if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(Number(sort_order)); }
  if (updates.length === 0) return res.json(cat);
  values.push(id);
  db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  res.json(updated);
});

menuRouter.delete('/categories/:id', (req, res) => {
  const db = getDb(req);
  const id = Number(req.params.id);
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!cat) return res.status(404).json({ error: 'Categoria não encontrada' });
  const count = db.prepare('SELECT COUNT(*) as n FROM items WHERE category_id = ?').get(id);
  if (count.n > 0) return res.status(400).json({ error: 'Não é possível excluir categoria com itens. Mova ou exclua os itens antes.' });
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  res.json({ deleted: id });
});

// ——— Itens (GET já existentes; manter /items e /items/:id antes de /espetinhos) ———
menuRouter.get('/items', (req, res) => {
  const db = getDb(req);
  const categoryId = req.query.category_id;
  let list;
  if (categoryId) {
    list = db.prepare('SELECT i.*, c.name as category_name FROM items i LEFT JOIN categories c ON c.id = i.category_id WHERE i.category_id = ? ORDER BY i.name').all(Number(categoryId));
  } else {
    list = db.prepare('SELECT i.*, c.name as category_name FROM items i LEFT JOIN categories c ON c.id = i.category_id ORDER BY i.category_id, i.name').all();
  }
  res.json(list);
});

menuRouter.get('/items/:id', (req, res) => {
  const db = getDb(req);
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(Number(req.params.id));
  if (!item) return res.status(404).json({ error: 'Item não encontrado' });
  res.json(item);
});

menuRouter.post('/items', (req, res) => {
  const db = getDb(req);
  const { category_id, name, price, description, requires_meat_point, is_grill, is_kitchen, is_bar, is_side, is_prato_feito } = req.body || {};
  const cid = Number(category_id);
  const nome = String(name || '').trim();
  const preco = Number(price);
  if (!cid) return res.status(400).json({ error: 'Categoria é obrigatória' });
  if (!nome) return res.status(400).json({ error: 'Nome do item é obrigatório' });
  if (Number.isNaN(preco) || preco < 0) return res.status(400).json({ error: 'Preço inválido' });
  const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(cid);
  if (!cat) return res.status(400).json({ error: 'Categoria não encontrada' });
  const r = db.prepare(`
    INSERT INTO items (category_id, name, price, description, requires_meat_point, is_grill, is_kitchen, is_bar, is_side, is_prato_feito)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cid, nome, preco,
    description != null ? String(description).trim() : null,
    requires_meat_point ? 1 : 0,
    is_grill ? 1 : 0,
    is_kitchen ? 1 : 0,
    is_bar ? 1 : 0,
    is_side ? 1 : 0,
    is_prato_feito ? 1 : 0
  );
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(r.lastInsertRowid);
  res.status(201).json(item);
});

menuRouter.patch('/items/:id', (req, res) => {
  const db = getDb(req);
  const id = Number(req.params.id);
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!item) return res.status(404).json({ error: 'Item não encontrado' });
  const { category_id, name, price, description, requires_meat_point, is_grill, is_kitchen, is_bar, is_side, is_prato_feito } = req.body || {};
  const updates = [];
  const values = [];
  if (category_id !== undefined) { updates.push('category_id = ?'); values.push(Number(category_id)); }
  if (name !== undefined) { updates.push('name = ?'); values.push(String(name).trim()); }
  if (price !== undefined) { updates.push('price = ?'); values.push(Number(price)); }
  if (description !== undefined) { updates.push('description = ?'); values.push(description ? String(description).trim() : null); }
  if (requires_meat_point !== undefined) { updates.push('requires_meat_point = ?'); values.push(requires_meat_point ? 1 : 0); }
  if (is_grill !== undefined) { updates.push('is_grill = ?'); values.push(is_grill ? 1 : 0); }
  if (is_kitchen !== undefined) { updates.push('is_kitchen = ?'); values.push(is_kitchen ? 1 : 0); }
  if (is_bar !== undefined) { updates.push('is_bar = ?'); values.push(is_bar ? 1 : 0); }
  if (is_side !== undefined) { updates.push('is_side = ?'); values.push(is_side ? 1 : 0); }
  if (is_prato_feito !== undefined) { updates.push('is_prato_feito = ?'); values.push(is_prato_feito ? 1 : 0); }
  if (updates.length === 0) return res.json(item);
  values.push(id);
  db.prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  res.json(updated);
});

menuRouter.delete('/items/:id', (req, res) => {
  const db = getDb(req);
  const id = Number(req.params.id);
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(id);
  if (!item) return res.status(404).json({ error: 'Item não encontrado' });
  db.prepare('DELETE FROM items WHERE id = ?').run(id);
  db.prepare('DELETE FROM espetinhos_for_prato_feito WHERE item_id = ? OR espetinho_id = ?').run(id, id);
  res.json({ deleted: id });
});

menuRouter.get('/espetinhos', (req, res) => {
  const db = getDb(req);
  const cat = db.prepare('SELECT id FROM categories WHERE slug = ?').get('espetinhos');
  if (!cat) return res.json([]);
  const list = db.prepare('SELECT * FROM items WHERE category_id = ? ORDER BY name').all(cat.id);
  res.json(list);
});
