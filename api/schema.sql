CREATE TABLE IF NOT EXISTS sales_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id TEXT UNIQUE,
  year INTEGER NOT NULL,
  date TEXT NOT NULL,
  month TEXT NOT NULL,
  salesperson TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  usd REAL NOT NULL DEFAULT 0,
  rmb REAL NOT NULL DEFAULT 0,
  cust_type TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT '',
  store TEXT NOT NULL DEFAULT '',
  operator TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_records_date ON sales_records(date);
CREATE INDEX IF NOT EXISTS idx_sales_records_month ON sales_records(month);
CREATE INDEX IF NOT EXISTS idx_sales_records_salesperson ON sales_records(salesperson);
