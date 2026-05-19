const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

const SALES_TABLE = "sales_records";

const CREATE_SALES_TABLE = `
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
)`;

const OPTIONAL_COLUMNS = [
  ["import_id", "TEXT"],
  ["operator", "TEXT NOT NULL DEFAULT ''"],
  ["source", "TEXT NOT NULL DEFAULT ''"],
  ["created_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"],
  ["updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"],
];

export function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

export function options() {
  return new Response(null, {
    status: 204,
    headers: JSON_HEADERS,
  });
}

export function methodNotAllowed() {
  return json({ error: "Method not allowed." }, 405);
}

export function getDb(env) {
  return env?.DB || null;
}

export function requireAdmin(request, env) {
  const expected = String(env?.SALES_ADMIN_TOKEN || "").trim();
  if (!expected) {
    return json({ error: "SALES_ADMIN_TOKEN is not configured." }, 500);
  }

  const header = request.headers.get("authorization") || "";
  const actual = header.replace(/^Bearer\s+/i, "").trim();
  if (!actual || actual !== expected) {
    return json({ error: "Invalid admin token." }, 401);
  }

  return null;
}

let schemaReady;

export async function ensureSchema(db) {
  if (!schemaReady) {
    schemaReady = ensureSchemaOnce(db).catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }

  return schemaReady;
}

async function ensureSchemaOnce(db) {
  const table = await db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .bind(SALES_TABLE)
    .first();

  if (!table) {
    await db.prepare(CREATE_SALES_TABLE).run();
  } else {
    const info = await db.prepare(`PRAGMA table_info(${SALES_TABLE})`).all();
    const existing = new Set((info.results || []).map((column) => column.name));

    for (const [name, definition] of OPTIONAL_COLUMNS) {
      if (!existing.has(name)) {
        await db.prepare(`ALTER TABLE ${SALES_TABLE} ADD COLUMN ${name} ${definition}`).run();
      }
    }
  }

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_sales_records_date ON ${SALES_TABLE}(date)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_sales_records_month ON ${SALES_TABLE}(month)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_sales_records_salesperson ON ${SALES_TABLE}(salesperson)`).run();
}

export async function parseRecord(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw new Error("Request body must be valid JSON.");
  }

  return normalizeRecord(body);
}

function normalizeRecord(body) {
  const date = text(body.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("A valid date is required.");
  }

  const salesperson = text(body.salesperson);
  if (!salesperson) {
    throw new Error("Salesperson is required.");
  }

  const operator = text(body.operator ?? body.source);
  const source = text(body.source ?? operator);

  return {
    date,
    month: text(body.month) || date.slice(0, 7),
    year: Number.parseInt(body.year || date.slice(0, 4), 10),
    salesperson,
    country: text(body.country),
    usd: amount(body.usd),
    rmb: amount(body.rmb),
    custType: text(body.custType),
    channel: text(body.channel),
    store: text(body.store),
    operator,
    source,
  };
}

function text(value) {
  return String(value ?? "").trim();
}

function amount(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function toRecord(row) {
  return {
    id: Number(row.id),
    importId: row.import_id || null,
    year: Number(row.year) || null,
    date: row.date || "",
    month: row.month || "",
    salesperson: row.salesperson || "",
    country: row.country || "",
    usd: Number(row.usd) || 0,
    rmb: Number(row.rmb) || 0,
    custType: row.cust_type || "",
    channel: row.channel || "",
    store: row.store || "",
    operator: row.operator || "",
    source: row.source || "",
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
  };
}

export function isoDate(value) {
  if (!value) return new Date().toISOString();
  const raw = String(value);
  const normalized = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.valueOf()) ? new Date().toISOString() : date.toISOString();
}

export async function getRecordById(db, id) {
  const row = await db
    .prepare(
      `SELECT
        id, import_id, year, date, month, salesperson, country, usd, rmb,
        cust_type, channel, store, operator, source, created_at, updated_at
       FROM ${SALES_TABLE}
       WHERE id = ?`
    )
    .bind(id)
    .first();

  return row ? toRecord(row) : null;
}

export function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
