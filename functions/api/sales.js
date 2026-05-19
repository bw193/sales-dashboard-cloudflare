import {
  ensureSchema,
  getDb,
  getRecordById,
  isoDate,
  json,
  methodNotAllowed,
  options,
  parseRecord,
  requireAdmin,
  toRecord,
} from "./_sales.js";

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") return options();

  const db = getDb(env);
  if (!db) return json({ error: "D1 binding DB is not configured." }, 500);

  try {
    await ensureSchema(db);

    if (request.method === "GET") return listSales(db);
    if (request.method === "POST") return createSale(request, env, db);

    return methodNotAllowed();
  } catch (error) {
    return json({ error: error.message || "Sales API error." }, 500);
  }
}

async function listSales(db) {
  const [rows, summary] = await Promise.all([
    db
      .prepare(
        `SELECT
          id, import_id, year, date, month, salesperson, country, usd, rmb,
          cust_type, channel, store, operator, source, created_at, updated_at
         FROM sales_records
         ORDER BY date DESC, id DESC`
      )
      .all(),
    db
      .prepare(
        `SELECT
          COUNT(*) AS totalOrders,
          COALESCE(SUM(usd), 0) AS totalUSD,
          COALESCE(SUM(rmb), 0) AS totalRMB,
          MAX(COALESCE(updated_at, created_at)) AS generatedAt
         FROM sales_records`
      )
      .first(),
  ]);

  return json({
    summary: {
      totalOrders: Number(summary?.totalOrders) || 0,
      totalUSD: Number(summary?.totalUSD) || 0,
      totalRMB: Number(summary?.totalRMB) || 0,
      generatedAt: isoDate(summary?.generatedAt),
    },
    records: (rows.results || []).map(toRecord),
  });
}

async function createSale(request, env, db) {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const record = await parseRecord(request);

  const result = await db
    .prepare(
      `INSERT INTO sales_records (
        year, date, month, salesperson, country, usd, rmb, cust_type, channel,
        store, operator, source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
    .bind(
      record.year,
      record.date,
      record.month,
      record.salesperson,
      record.country,
      record.usd,
      record.rmb,
      record.custType,
      record.channel,
      record.store,
      record.operator,
      record.source
    )
    .run();

  const saved = await getRecordById(db, result.meta.last_row_id);
  return json({ record: saved }, 201);
}
