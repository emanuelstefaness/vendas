import { initDb, db } from './db.js';

initDb();

const categories = [
  { name: 'Espetinhos', slug: 'espetinhos', sort_order: 1 },
  { name: 'Porções', slug: 'porcoes', sort_order: 2 },
  { name: 'Lanches', slug: 'lanches', sort_order: 3 },
  { name: 'Bebidas', slug: 'bebidas', sort_order: 4 },
  { name: 'Caipirinhas', slug: 'caipirinhas', sort_order: 5 },
  { name: 'Chopp / Cerveja', slug: 'chopp-cerveja', sort_order: 6 },
  { name: 'Acompanhamentos', slug: 'acompanhamentos', sort_order: 7 },
  { name: 'Doses', slug: 'doses', sort_order: 8 },
  { name: 'Pratos', slug: 'pratos', sort_order: 9 },
  { name: 'Sobremesas', slug: 'sobremesas', sort_order: 10 },
  { name: 'Drinks', slug: 'drinks', sort_order: 12 },
];

const insCat = db.prepare('INSERT OR IGNORE INTO categories (name, slug, sort_order) VALUES (?, ?, ?)');
categories.forEach((c, i) => insCat.run(c.name, c.slug, c.sort_order + (i * 10)));

function getCatId(slug) {
  return db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug).id;
}

const items = [
  // ESPETINHOS - grill, requires_meat_point (exceto mandioca, queijo, pão alho)
  { cat: 'espetinhos', name: 'Gado com Bacon', price: 15.90, requires_meat_point: 1, is_grill: 1 },
  { cat: 'espetinhos', name: 'Gado com Bacon e Legumes', price: 15.90, requires_meat_point: 1, is_grill: 1 },
  { cat: 'espetinhos', name: 'Coração de Frango', price: 15.90, requires_meat_point: 1, is_grill: 1 },
  { cat: 'espetinhos', name: 'Kafta', price: 13.00, requires_meat_point: 1, is_grill: 1 },
  { cat: 'espetinhos', name: 'Medalhão Suíno', price: 15.90, requires_meat_point: 1, is_grill: 1 },
  { cat: 'espetinhos', name: 'Medalhão de Frango', price: 15.90, requires_meat_point: 1, is_grill: 1 },
  { cat: 'espetinhos', name: 'Medalhão de Mandioca', price: 13.90, is_grill: 1 },
  { cat: 'espetinhos', name: 'Queijo Coalho', price: 13.90, is_grill: 1 },
  { cat: 'espetinhos', name: 'Pão de Alho', price: 13.90, is_grill: 1 },
  // PORÇÕES
  { cat: 'porcoes', name: 'Linguiça Toscana', price: 46.90, desc: '600g linguiça. Acompanha 200g maionese + pão.', is_kitchen: 1, is_grill: 1 },
  { cat: 'porcoes', name: 'Asinha de Frango', price: 44.90, desc: '600g asinha. Acompanha 200g maionese + pão.', is_kitchen: 1, is_grill: 1 },
  { cat: 'porcoes', name: 'Entrevero', price: 52.90, desc: 'Carne suína, frango, calabresa e bovina com pimentão e cebola ao shoyu.', is_kitchen: 1, is_grill: 1 },
  { cat: 'porcoes', name: 'Alcatra 600g', price: 119.90, desc: 'Alcatra na tábua quente. Acompanha pão e maionese.', requires_meat_point: 1, is_grill: 1, is_kitchen: 1 },
  // LANCHES - grill + kitchen
  { cat: 'lanches', name: 'X-Bosque', price: 32.90, desc: 'Pão estrela, maionese, alface, cebola caramelizada, cheddar, burger kafta na brasa.', is_grill: 1, is_kitchen: 1 },
  { cat: 'lanches', name: 'Churraspão', price: 36.90, desc: 'Pão baguete, maionese, alface, carne com bacon, mussarela gratinada.', is_grill: 1, is_kitchen: 1 },
  // ACOMPANHAMENTOS
  { cat: 'acompanhamentos', name: 'Arroz', price: 12.00, is_kitchen: 1, is_side: 1 },
  { cat: 'acompanhamentos', name: 'Maionese Caseira', price: 15.00, is_kitchen: 1, is_side: 1 },
  { cat: 'acompanhamentos', name: 'Salada do Bosque', price: 35.90, desc: 'Alface americana e roxa, pepino, cenoura, bacon, queijo e molho.', is_kitchen: 1 },
  // PRATOS
  { cat: 'pratos', name: 'Prato Feito do Bosque', price: 39.90, desc: 'Espetinho da preferência + arroz + maionese + salada.', is_prato_feito: 1, is_kitchen: 1, is_grill: 1 },
  { cat: 'pratos', name: 'Arvoredo', price: 219.90, desc: '700g filé argentino na brasa. Arroz, maionese, salada. Serve 2 pessoas.', requires_meat_point: 1, is_arvoredo: 1, is_grill: 1, is_kitchen: 1 },
  // BEBIDAS
  { cat: 'bebidas', name: 'Coca-Cola 350ml', price: 8.00, is_bar: 1 },
  { cat: 'bebidas', name: 'Guaraná 350ml', price: 8.00, is_bar: 1 },
  { cat: 'bebidas', name: 'Fanta 350ml', price: 8.00, is_bar: 1 },
  { cat: 'bebidas', name: 'Suco Prats', price: 15.00, is_bar: 1 },
  { cat: 'bebidas', name: 'Água com ou sem gás', price: 5.00, is_bar: 1 },
  { cat: 'bebidas', name: 'Redbull', price: 18.00, is_bar: 1 },
  // CHOPP / CERVEJA
  { cat: 'chopp-cerveja', name: 'Jordana Pilsen', price: 16.00, is_bar: 1 },
  { cat: 'chopp-cerveja', name: 'Submarino Steinhaeger', price: 24.00, is_bar: 1 },
  { cat: 'chopp-cerveja', name: 'Submarino Jagermeister', price: 29.00, is_bar: 1 },
  { cat: 'chopp-cerveja', name: 'Original 600ml', price: 18.90, is_bar: 1 },
  { cat: 'chopp-cerveja', name: 'Heineken 600ml', price: 19.90, is_bar: 1 },
  // CAIPIRINHAS - opções base (cachaça/vodka) e picolé
  { cat: 'caipirinhas', name: 'Caipirinha Limão', price: 34.90, is_bar: 1 },
  { cat: 'caipirinhas', name: 'Caipirinha Morango', price: 34.90, is_bar: 1 },
  { cat: 'caipirinhas', name: 'Caipirinha Maracujá', price: 34.90, is_bar: 1 },
  { cat: 'caipirinhas', name: 'Caipirinha Mista', price: 34.90, is_bar: 1 },
  { cat: 'caipirinhas', name: 'Caipirinha Kiwi', price: 34.90, is_bar: 1 },
  { cat: 'caipirinhas', name: 'Caipirinha Abacaxi', price: 34.90, is_bar: 1 },
  { cat: 'caipirinhas', name: 'Caipirinha Yakult', price: 34.90, is_bar: 1 },
  // DRINKS
  { cat: 'drinks', name: 'Caipicerva', price: 37.90, desc: 'Caipira de limão + longneck', is_bar: 1 },
  { cat: 'drinks', name: 'Jack Tropical', price: 39.90, desc: 'Jack Daniels + Abacaxi + Suco de Laranja', is_bar: 1 },
  { cat: 'drinks', name: 'Soda Italiana de Cranberry', price: 20.00, desc: 'Sem Álcool', is_bar: 1 },
  { cat: 'drinks', name: 'Soda Italiana de Maçã Verde', price: 20.00, desc: 'Sem Álcool', is_bar: 1 },
  // DOSES
  { cat: 'doses', name: 'Jack Daniels 100ml', price: 34.90, is_bar: 1 },
  { cat: 'doses', name: 'Jagermeister 100ml', price: 34.90, is_bar: 1 },
  { cat: 'doses', name: 'Smirnoff 100ml', price: 19.00, is_bar: 1 },
  { cat: 'doses', name: 'Campari', price: 19.00, is_bar: 1 },
  { cat: 'doses', name: 'Pinga da Casa', price: 4.00, is_bar: 1 },
  { cat: 'doses', name: 'Cú de Burro', price: 3.00, desc: 'Limão espremido + sal', is_bar: 1 },
  // SOBREMESAS
  { cat: 'sobremesas', name: 'Petit Gateau', price: 29.90, desc: 'Petit gateau com duas bolas de sorvete e morango. +R$5 picolé.', is_kitchen: 1 },
  // Doses avulsas (bar — mesmo preço que refrigerantes; IDs novos no fim do seed)
  { cat: 'doses', name: 'Red Bull', price: 18.0, is_bar: 1 },
  { cat: 'doses', name: 'Coca-Cola 350ml', price: 8.0, is_bar: 1 },
];

const insItem = db.prepare(`
  INSERT OR REPLACE INTO items (id, category_id, name, price, description, requires_meat_point, is_grill, is_kitchen, is_bar, is_side, is_prato_feito, is_arvoredo)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let itemId = 1;
const espetinhoIds = [];
let pratoFeitoId = null;

for (const it of items) {
  const cid = getCatId(it.cat);
  const id = itemId++;
  insItem.run(
    id,
    cid,
    it.name,
    it.price,
    it.desc || null,
    it.requires_meat_point ? 1 : 0,
    it.is_grill ? 1 : 0,
    it.is_kitchen ? 1 : 0,
    it.is_bar ? 1 : 0,
    it.is_side ? 1 : 0,
    it.is_prato_feito ? 1 : 0,
    it.is_arvoredo ? 1 : 0
  );
  if (it.cat === 'espetinhos') espetinhoIds.push(id);
  if (it.is_prato_feito) pratoFeitoId = id;
}

if (pratoFeitoId) {
  const insPf = db.prepare('INSERT OR IGNORE INTO espetinhos_for_prato_feito (item_id, espetinho_id) VALUES (?, ?)');
  espetinhoIds.forEach(eid => insPf.run(pratoFeitoId, eid));
}

// Comandas 1-200 (só estrutura, status closed)
const insComanda = db.prepare('INSERT OR IGNORE INTO comandas (id, status) VALUES (?, ?)');
for (let i = 1; i <= 200; i++) {
  insComanda.run(i, 'closed');
}

console.log('Seed concluído. Categorias:', categories.length, 'Itens:', items.length);
process.exit(0);
