-- Migração 0003: Ajuste para Plataforma de Venda de Sistemas
-- Focada no modelo onde a QRchef vende sistemas prontos para outros restaurantes

-- 1. Sistemas de Cardápio Disponíveis (Produtos da QRchef)
CREATE TABLE IF NOT EXISTS menu_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    base_price REAL NOT NULL,
    preview_url TEXT,
    image_url TEXT,
    category TEXT, -- 'Fine Dining', 'Fast Food', etc.
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Pedidos de Sistemas (Carrinho/Vendas da QRchef)
CREATE TABLE IF NOT EXISTS system_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    template_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, paid, cancelled, deployed
    amount_paid REAL NOT NULL,
    payment_method TEXT,
    purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (template_id) REFERENCES menu_templates(id)
);

-- 3. Tickets de Suporte
CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open', -- open, in_progress, closed
    admin_response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Inserindo alguns modelos iniciais de demonstração
INSERT INTO menu_templates (name, base_price, category)
SELECT 'Elite Gastronomy', 189.00, 'Premium'
WHERE NOT EXISTS (SELECT 1 FROM menu_templates WHERE name = 'Elite Gastronomy');

INSERT INTO menu_templates (name, base_price, category)
SELECT 'Quick Bite Express', 99.00, 'Pro'
WHERE NOT EXISTS (SELECT 1 FROM menu_templates WHERE name = 'Quick Bite Express');

INSERT INTO menu_templates (name, base_price, category)
SELECT 'Coffee & Co', 49.00, 'Basic'
WHERE NOT EXISTS (SELECT 1 FROM menu_templates WHERE name = 'Coffee & Co');
