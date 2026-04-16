import { Router } from 'express';

export const printRouter = Router();
const getDb = (req) => req.app.get('db');

printRouter.get('/comanda/:id', (req, res) => {
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
  pedidos.forEach((p) => { subtotal += p.quantity * p.unit_price; });
  const peopleCount = comanda.people_count || 0;
  const couvertPerPerson = comanda.couvert_per_person || 5;
  const couvertRow = db.prepare(`
    SELECT COALESCE(SUM(p.quantity), 0) as qty, COALESCE(SUM(p.quantity * p.unit_price), 0) as val
    FROM pedidos p JOIN items i ON i.id = p.item_id
    WHERE p.comanda_id = ? AND p.status != 'cancelled' AND TRIM(LOWER(i.name)) = 'couvert'
  `).get(id);
  const couvertLancadoQty = couvertRow?.qty || 0;
  const couvertLancadoValor = couvertRow?.val || 0;
  const couvertPrevisto = peopleCount * couvertPerPerson;
  const couvertPendente = Math.max(0, couvertPrevisto - couvertLancadoValor);
  const serviceTaxPercent = comanda.service_tax_percent || 0;
  const serviceTaxValor = (serviceTaxPercent / 100) * subtotal;
  const totalSemTaxaGarcom = subtotal + couvertPendente;
  const totalComTaxa = subtotal + serviceTaxValor + couvertPendente;
  const printedAt = db.prepare(`SELECT datetime('now','localtime') as t`).get()?.t || '';

  res.json({
    logo: 'BOSQUE DA CARNE',
    comanda: id,
    mesa: comanda.mesa,
    pedidos,
    subtotal,
    people_count: peopleCount,
    couvert_per_person: couvertPerPerson,
    couvert_previsto: couvertPrevisto,
    couvert_lancado_qty: couvertLancadoQty,
    couvert_lancado_valor: couvertLancadoValor,
    couvert_pendente: couvertPendente,
    service_tax_percent: serviceTaxPercent,
    service_tax: serviceTaxValor,
    total_sem_taxa_garcom: totalSemTaxaGarcom,
    total: totalComTaxa,
    printed_at: printedAt
  });
});

// Comanda para motoboy (pedido online delivery)
printRouter.get('/order/:id', (req, res) => {
  const db = getDb(req);
  const id = Number(req.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
  const items = db.prepare(`
    SELECT oi.*, i.name as item_name
    FROM order_items oi
    JOIN items i ON i.id = oi.item_id
    WHERE oi.order_id = ?
    ORDER BY oi.id
  `).all(id);
  res.json({
    logo: 'BOSQUE DA CARNE',
    tipo: order.tipo,
    numero: order.id,
    cliente_nome: order.cliente_nome,
    cliente_telefone: order.cliente_telefone,
    cliente_email: order.cliente_email,
    forma_pagamento: order.forma_pagamento,
    endereco_rua: order.endereco_rua,
    endereco_numero: order.endereco_numero,
    endereco_complemento: order.endereco_complemento,
    endereco_bairro: order.endereco_bairro,
    endereco_referencia: order.endereco_referencia,
    observacoes: order.observacoes,
    items,
    valor_total: order.valor_total,
    created_at: order.created_at
  });
});
