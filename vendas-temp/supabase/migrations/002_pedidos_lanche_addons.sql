-- Adicionais opcionais: Churraspão (cebola caramelizada), X-Bosque (hambúrguer extra)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS extra_caramelized_onion INTEGER DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS extra_hamburger INTEGER DEFAULT 0;
