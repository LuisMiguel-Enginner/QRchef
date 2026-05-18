-- Solicitações de aquisição de sistemas (aguardam confirmação do admin)
CREATE TABLE IF NOT EXISTS purchase_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    template_id TEXT NOT NULL,
    system_name TEXT NOT NULL,
    restaurant_name TEXT NOT NULL,
    cor_primaria TEXT DEFAULT '#e63946',
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT DEFAULT 'awaiting_admin',
    restaurant_slug TEXT,
    menu_link TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_user ON purchase_requests(user_id);
