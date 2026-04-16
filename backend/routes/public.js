import { Router } from 'express';
import { broadcastAll } from '../socket.js';
import { getPedidoSector } from '../itemSector.js';

export const publicRouter = Router();
const getDb = (req) => req.app.get('db');

/** Taxa fixa de entrega (R$), somada ao total em pedidos `tipo === 'delivery'`. */
const TAXA_ENTREGA_DELIVERY = 10;

// Diagnóstico: confirma que a API pública está no ar
publicRouter.get('/', (req, res) => {
  res.json({ ok: true, message: 'API pública pedidos online' });
});

// Cardápio para pedidos online (categorias + itens, sem dados internos)
publicRouter.get('/menu', (req, res) => {
  const db = getDb(req);
  const categories = db.prepare('SELECT id, name, slug, sort_order FROM categories ORDER BY sort_order, name').all();
  const items = db.prepare(`
    SELECT i.id, i.category_id, i.name, i.price, i.description, i.is_prato_feito
    FROM items i
    ORDER BY i.category_id, i.name
  `).all();
  res.json({ categories, items });
});

// Criar pedido online → cria order, comanda (id 201+), pedidos; emite alerta
publicRouter.post('/orders', (req, res) => {
  try {
  const db = getDb(req);
  if (!db) return res.status(500).json({ error: 'Banco de dados não disponível' });
  const {
    tipo,
    cliente_nome,
    cliente_telefone,
    cliente_email,
    observacoes,
    endereco_rua,
    endereco_numero,
    endereco_complemento,
    endereco_bairro,
    endereco_referencia,
    items: cartItems
  } = req.body || {};

  if (!tipo || !['delivery', 'retirada'].includes(tipo)) {
    return res.status(400).json({ error: 'tipo deve ser delivery ou retirada' });
  }
  const nome = String(cliente_nome || '').trim();
  const telefone = String(cliente_telefone || '').trim();
  if (!nome || !telefone) {
    return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
  }
  if (tipo === 'delivery') {
    const rua = String(endereco_rua || '').trim();
    const numero = String(endereco_numero || '').trim();
    const bairro = String(endereco_bairro || '').trim();
    if (!rua || !numero || !bairro) {
      return res.status(400).json({ error: 'Para delivery informe rua, número e bairro' });
    }
  }
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ error: 'Adicione ao menos um item ao pedido' });
  }

  let valorTotal = 0;
  const validItems = [];
  const espetinhosCategory = db.prepare('SELECT id FROM categories WHERE slug = ?').get('espetinhos');
  const espetinhosCategoryId = espetinhosCategory?.id || null;
  for (const row of cartItems) {
    const itemId = Number(row.item_id);
    const qty = Math.max(1, Math.floor(Number(row.quantity) || 1));
    const item = db.prepare('SELECT id, price, name, is_prato_feito FROM items WHERE id = ?').get(itemId);
    if (!item) continue;
    let pratoFeitoEspetinhoId = null;
    if (Number(item.is_prato_feito) === 1) {
      const selectedEsp = Number(row.prato_feito_espetinho_id);
      if (!Number.isFinite(selectedEsp) || selectedEsp < 1) {
        return res.status(400).json({ error: `Selecione o espetinho para o item "${item.name}".` });
      }
      const esp = db.prepare(`
        SELECT i.id
        FROM items i
        WHERE i.id = ? AND (? IS NOT NULL AND i.category_id = ?)
      `).get(selectedEsp, espetinhosCategoryId, espetinhosCategoryId);
      if (!esp) {
        return res.status(400).json({ error: `Espetinho inválido para o item "${item.name}".` });
      }
      pratoFeitoEspetinhoId = selectedEsp;
    }
    const unitPrice = item.price;
    validItems.push({
      item_id: itemId,
      quantity: qty,
      unit_price: unitPrice,
      observations: row.observations || null,
      prato_feito_espetinho_id: pratoFeitoEspetinhoId
    });
    valorTotal += qty * unitPrice;
  }
  if (validItems.length === 0) {
    return res.status(400).json({ error: 'Nenhum item válido no pedido' });
  }
  if (tipo === 'delivery') {
    valorTotal += TAXA_ENTREGA_DELIVERY;
  }

  const run = db.transaction(() => {
    const nextId = db.prepare('SELECT COALESCE(MAX(id), 200) + 1 AS next FROM comandas WHERE id >= 200').get();
    const comandaId = nextId.next;

    // orders.comanda_id referencia comandas(id): inserir pedido sem comanda_id, criar comanda, depois vincular (FK com foreign_keys=ON)
    const orderInfo = db.prepare(`
      INSERT INTO orders (tipo, status, cliente_nome, cliente_telefone, cliente_email, observacoes,
        endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_referencia, valor_total, comanda_id)
      VALUES (?, 'recebido', ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      tipo,
      nome,
      telefone,
      cliente_email ? String(cliente_email).trim() : null,
      observacoes ? String(observacoes).trim() : null,
      tipo === 'delivery' ? String(endereco_rua || '').trim() : null,
      tipo === 'delivery' ? String(endereco_numero || '').trim() : null,
      tipo === 'delivery' ? (endereco_complemento ? String(endereco_complemento).trim() : null) : null,
      tipo === 'delivery' ? String(endereco_bairro || '').trim() : null,
      tipo === 'delivery' ? (endereco_referencia ? String(endereco_referencia).trim() : null) : null,
      valorTotal
    );
    const orderId = orderInfo.lastInsertRowid;

    db.prepare(`
      INSERT INTO comandas (id, mesa, status, origin_order_id, tipo_online, cliente_nome, cliente_telefone, cliente_email,
        endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_referencia)
      VALUES (?, ?, 'ordering', ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?)
    `).run(
      comandaId,
      `Online #${orderId}`,
      orderId,
      tipo,
      nome,
      telefone,
      cliente_email ? String(cliente_email).trim() : null,
      tipo === 'delivery' ? String(endereco_rua || '').trim() : null,
      tipo === 'delivery' ? String(endereco_numero || '').trim() : null,
      tipo === 'delivery' ? (endereco_complemento ? String(endereco_complemento).trim() : null) : null,
      tipo === 'delivery' ? String(endereco_bairro || '').trim() : null,
      tipo === 'delivery' ? (endereco_referencia ? String(endereco_referencia).trim() : null) : null
    );

    db.prepare('UPDATE orders SET comanda_id = ? WHERE id = ?').run(comandaId, orderId);

    const insOrderItem = db.prepare('INSERT INTO order_items (order_id, item_id, quantity, unit_price, observations) VALUES (?, ?, ?, ?, ?)');
    const insPedido = db.prepare(`
      INSERT INTO pedidos (comanda_id, item_id, quantity, unit_price, observations, prato_feito_espetinho_id, sector)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insStatus = db.prepare('INSERT OR REPLACE INTO pedido_sector_status (pedido_id, sector, status) VALUES (?, ?, ?)');

    for (const row of validItems) {
      insOrderItem.run(orderId, row.item_id, row.quantity, row.unit_price, row.observations);
      const item = db.prepare(`
        SELECT i.*, c.slug AS category_slug
        FROM items i
        LEFT JOIN categories c ON c.id = i.category_id
        WHERE i.id = ?
      `).get(row.item_id);
      const sector = item ? getPedidoSector(item) : null;
      const r = insPedido.run(
        comandaId,
        row.item_id,
        row.quantity,
        row.unit_price,
        row.observations,
        row.prato_feito_espetinho_id || null,
        sector
      );
      const pedidoId = r.lastInsertRowid;
      if (sector) insStatus.run(pedidoId, sector, 'pending');
      if (item && item.is_grill && item.is_kitchen && sector === 'kitchen') insStatus.run(pedidoId, 'grill', 'pending');
      if (item && item.is_grill && item.is_kitchen && sector === 'grill') insStatus.run(pedidoId, 'kitchen', 'pending');
    }

    return { orderId, comandaId };
  });

  const { orderId, comandaId } = run();
  broadcastAll('pedidos', {});
  broadcastAll('comandas', {});
  broadcastAll('novo-pedido-online', {
    orderId,
    comandaId,
    tipo,
    cliente_nome: nome,
    cliente_telefone: telefone,
    valor_total: valorTotal
  });

  res.status(201).json({
    id: orderId,
    comanda_id: comandaId,
    valor_total: valorTotal,
    message: tipo === 'retirada' ? 'Seu pedido estará disponível para retirada no balcão.' : 'Pedido recebido.'
  });
  } catch (err) {
    console.error('Erro ao criar pedido online:', err);
    res.status(500).json({ error: err.message || 'Erro ao processar pedido. Tente novamente.' });
  }
});

// Status do pedido (opcional, para cliente consultar)
publicRouter.get('/orders/:id', (req, res) => {
  const db = getDb(req);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
  const items = db.prepare(`
    SELECT oi.*, i.name as item_name
    FROM order_items oi
    JOIN items i ON i.id = oi.item_id
    WHERE oi.order_id = ?
  `).all(order.id);
  res.json({ ...order, items });
});
