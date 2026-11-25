CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    cor_primaria TEXT NOT NULL DEFAULT '#e63946',
    ativo INTEGER NOT NULL DEFAULT 1,
    template_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_restaurants_user_id ON restaurants(user_id);

CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL,
    categoria TEXT NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT,
    preco REAL NOT NULL CHECK (preco >= 0),
    foto_url TEXT,
    disponivel INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_category
    ON menu_items(restaurant_id, categoria);

CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'completed',
    payment_method TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);

ALTER TABLE subscriptions ADD COLUMN created_at DATETIME;

UPDATE subscriptions
SET created_at = CURRENT_TIMESTAMP
WHERE created_at IS NULL;

CREATE TRIGGER IF NOT EXISTS subscriptions_set_created_at
AFTER INSERT ON subscriptions
WHEN NEW.created_at IS NULL
BEGIN
    UPDATE subscriptions
    SET created_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;
