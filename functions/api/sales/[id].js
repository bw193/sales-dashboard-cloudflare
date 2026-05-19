import {
  ensureSchema,
  getDb,
  getRecordById,
  json,
  methodNotAllowed,
  options,
  parseId,
  parseRecord,
  requireAdmin,
} from "../_sales.js";

export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method === "OPTIONS") return options();

  const db = getDb(env);
  if (!db) return json({ error: "D1 binding DB is not configured." }, 500);

  const id = parseId(params.id);
  if (!id) return json({ error: "Invalid sales record id." }, 400);

  try {
    await ensureSchema(db);

    if (request.method === "PUT") return updateSale(request, env, db, id);
    if (request.method === "DELETE") return deleteSale(request, env, db, id);

    return methodNotAllowed();
  } catch (error) {
    return json({ error: error.message || "Sales API error." }, 500);
  }
}

async function updateSale(request, env, db, id) {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const record = await parseRecord(request);

  const result = await db
    .prepare(
      `UPDATE sales_records
       SET year = ?,
           date = ?,
           month = ?,
           salesperson = ?,
           country = ?,
           usd = ?,
           rmb = ?,
           cust_type = ?,
           channel = ?,
           store = ?,
           operator = ?,
           source = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
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
      record.source,
      id
    )
    .run();

  if (!result.meta.changes) {
    return json({ error: "Sales record not found." }, 404);
  }

  const saved = await getRecordById(db, id);
  return json({ record: saved });
}

async function deleteSale(request, env, db, id) {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  const result = await db.prepare("DELETE FROM sales_records WHERE id = ?").bind(id).run();
  if (!result.meta.changes) {
    return json({ error: "Sales record not found." }, 404);
  }

  return json({ ok: true });
}
