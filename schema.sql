CREATE TABLE IF NOT EXISTS requisitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0),
  price_satang INTEGER NOT NULL CHECK (price_satang >= 0),
  request_ref TEXT,
  po_number TEXT,
  delivery_date TEXT,
  area TEXT,
  created_date TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_requisitions_created_date ON requisitions(created_date DESC);
CREATE INDEX IF NOT EXISTS idx_requisitions_order_number ON requisitions(order_number);
CREATE INDEX IF NOT EXISTS idx_requisitions_delivery_date ON requisitions(delivery_date);
CREATE INDEX IF NOT EXISTS idx_requisitions_area ON requisitions(area);
CREATE INDEX IF NOT EXISTS idx_requisitions_archived_at ON requisitions(archived_at);
