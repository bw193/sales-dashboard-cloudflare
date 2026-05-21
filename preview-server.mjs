import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8788;
const HOST = process.env.HOST || "127.0.0.1";
const DB_NAME = "sales-dashboard-db";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

function isoDate(value) {
  if (!value) return new Date().toISOString();
  const raw = String(value);
  const normalized = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.valueOf()) ? new Date().toISOString() : date.toISOString();
}

function toRecord(row) {
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

function extractJsonArray(stdout) {
  const start = stdout.indexOf("[");
  if (start < 0) throw new Error("No JSON array in wrangler output.");
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < stdout.length; i++) {
    const c = stdout[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return stdout.slice(start, i + 1);
    }
  }
  throw new Error("Unbalanced JSON in wrangler output.");
}

function runWrangler(sql) {
  if (/["`$]/.test(sql)) {
    return Promise.reject(new Error("SQL contains characters unsafe for shell quoting."));
  }
  const oneLineSql = sql.replace(/\s+/g, " ").trim();
  const cmdLine = `npx wrangler d1 execute ${DB_NAME} --remote --json --command "${oneLineSql}"`;
  return new Promise((resolve, reject) => {
    exec(
      cmdLine,
      {
        cwd: __dirname,
        maxBuffer: 1024 * 1024 * 128,
        windowsHide: true,
      },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr?.toString() || err.message));
          return;
        }
        try {
          const jsonText = extractJsonArray(stdout);
          const parsed = JSON.parse(jsonText);
          const block = Array.isArray(parsed) ? parsed[0] : parsed;
          resolve(block?.results || []);
        } catch (e) {
          reject(new Error(`Could not parse wrangler output: ${e.message}`));
        }
      }
    );
  });
}

let cachedPayload = null;
let pendingLoad = null;

async function loadPayload({ force = false } = {}) {
  if (!force && cachedPayload) return cachedPayload;
  if (pendingLoad) return pendingLoad;
  pendingLoad = (async () => {
    const [records, summaryRows] = await Promise.all([
      runWrangler(
        "SELECT id, import_id, year, date, month, salesperson, country, usd, rmb, " +
          "cust_type, channel, store, operator, source, created_at, updated_at " +
          "FROM sales_records ORDER BY date DESC, id DESC"
      ),
      runWrangler(
        "SELECT COUNT(*) AS totalOrders, COALESCE(SUM(usd), 0) AS totalUSD, " +
          "COALESCE(SUM(rmb), 0) AS totalRMB, " +
          "MAX(COALESCE(updated_at, created_at)) AS generatedAt FROM sales_records"
      ),
    ]);
    const summary = summaryRows[0] || {};
    cachedPayload = {
      summary: {
        totalOrders: Number(summary.totalOrders) || 0,
        totalUSD: Number(summary.totalUSD) || 0,
        totalRMB: Number(summary.totalRMB) || 0,
        generatedAt: isoDate(summary.generatedAt),
      },
      records: records.map(toRecord),
    };
    return cachedPayload;
  })().finally(() => {
    pendingLoad = null;
  });
  return pendingLoad;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function serveStatic(req, res) {
  let rel = decodeURI(req.url.split("?")[0]);
  if (rel === "/" || rel === "") rel = "/index.html";
  const filePath = path.normalize(path.join(__dirname, rel));
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }
    const ext = path.extname(filePath);
    const isHtml = ext === ".html";
    const isVendor = rel.startsWith("/vendor/");
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": isHtml
        ? "no-store, must-revalidate"
        : isVendor
        ? "public, max-age=3600"
        : "no-cache",
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (url.pathname === "/api/sales") {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "content-type, authorization",
      });
      res.end();
      return;
    }
    if (req.method === "GET") {
      try {
        const force = url.searchParams.get("refresh") === "1";
        const payload = await loadPayload({ force });
        sendJson(res, 200, payload);
      } catch (e) {
        sendJson(res, 500, { error: e.message || "Failed to load sales data." });
      }
      return;
    }
    sendJson(res, 405, { error: "Preview server is read-only (GET only)." });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(res, 405, { error: "Preview server only implements GET /api/sales." });
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, HOST, async () => {
  console.log(`Sales dashboard preview ready at http://${HOST}:${PORT}`);
  try {
    const p = await loadPayload();
    console.log(
      `Loaded ${p.records.length} records from Cloudflare D1 ` +
        `(totalUSD=$${p.summary.totalUSD.toFixed(2)}, generatedAt=${p.summary.generatedAt}).`
    );
  } catch (e) {
    console.error("Failed to preload sales data:", e.message);
  }
});
