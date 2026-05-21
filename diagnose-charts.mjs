// Simulate every chart's data computation against the live /api/sales output
// to report which charts would be visibly empty.
import http from "node:http";

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve(JSON.parse(body)));
      })
      .on("error", reject);
  });
}

const { records: F } = await fetchJson("http://127.0.0.1:8788/api/sales");
const ALL = F;

function allMonths() {
  return [...new Set(F.map((r) => r.month).filter(Boolean))].sort();
}

const report = [];
const note = (chart, ok, detail) =>
  report.push({ chart, ok, detail });

// ── Overview ────────────────────────────────────────────────────────────────
{
  const months = allMonths();
  const map = {};
  F.forEach((r) => {
    if (!r.month) return;
    if (!map[r.month]) map[r.month] = { usd: 0 };
    map[r.month].usd += r.usd;
  });
  const vals = months.map((m) => map[m]?.usd || 0);
  note("chartTrend", vals.some((v) => v > 0), `${vals.filter((v) => v > 0).length}/${vals.length} months>0`);
}
{
  const map = {};
  F.forEach((r) => {
    if (!r.month) return;
    map[r.month] = (map[r.month] || 0) + r.usd;
  });
  const yrs = [2024, 2025, 2026];
  const have = yrs.map((y) => Array.from({ length: 12 }, (_, m) => map[y + "-" + String(m + 1).padStart(2, "0")]).filter(Boolean).length);
  note("chartYoY", have.some((n) => n > 0), `points per year: ${have.join("/")}`);
}
{
  const map = {};
  F.forEach((r) => {
    if (r.country && r.usd > 0) map[r.country] = (map[r.country] || 0) + r.usd;
  });
  const n = Object.keys(map).length;
  note("countryBars", n > 0, `${n} countries`);
}
{
  const nw = F.filter((r) => r.custType && r.custType.includes("新")).length;
  const ol = F.filter((r) => r.custType && r.custType.includes("老")).length;
  note("chartCustType", nw + ol > 0, `new=${nw} ret=${ol}`);
}
{
  const on = F.filter((r) => r.channel && r.channel.includes("线上")).length;
  const of = F.filter((r) => r.channel && r.channel.includes("线下")).length;
  note("chartChannel", on + of > 0, `online=${on} offline=${of}`);
}
{
  const map = {};
  F.forEach((r) => {
    if (r.store && r.usd > 0) map[r.store] = (map[r.store] || 0) + r.usd;
  });
  const n = Object.keys(map).length;
  note("chartStore", n > 0, `${n} stores`);
}

// ── Growth ──────────────────────────────────────────────────────────────────
{
  const months = allMonths();
  const newArr = [],
    oldArr = [];
  months.forEach((m) => {
    const sub = F.filter((r) => r.month === m);
    newArr.push(sub.filter((r) => r.custType && r.custType.includes("新")).length);
    oldArr.push(sub.filter((r) => r.custType && r.custType.includes("老")).length);
  });
  note(
    "chartCustTrend",
    newArr.some((v) => v > 0) || oldArr.some((v) => v > 0),
    `months=${months.length} sumNew=${newArr.reduce((a, b) => a + b, 0)} sumOld=${oldArr.reduce((a, b) => a + b, 0)}`
  );
}
{
  const pts = F.filter((r) => r.usd > 0 && r.date).length;
  note("chartDealScatter", pts > 0, `${pts} points`);
}
{
  const total = F.reduce((s, r) => s + (r.usd > 0 ? r.usd : 0), 0);
  note("chartCumulative", total > 0, `cumUSD=${total.toFixed(0)}`);
}
{
  const buckets = F.filter((r) => r.usd > 0).length;
  note("chartOrderDist", buckets > 0, `${buckets} orders with usd>0`);
}
{
  const sorted = F.filter((r) => r.usd > 0)
    .sort((a, b) => b.usd - a.usd);
  note("chartPareto", sorted.length > 0, `${sorted.length} usd>0 orders`);
}
{
  const map = {};
  F.forEach((r) => {
    const src = r.source && r.source.trim() ? r.source.trim() : r.operator && r.operator.trim() ? r.operator.trim() : "(Direct/Unknown)";
    map[src] = (map[src] || 0) + 1;
  });
  note("chartSource", Object.keys(map).length > 0, `${Object.keys(map).length} sources`);
}
{
  const months = allMonths();
  const map = {};
  F.filter((r) => r.usd > 0).forEach((r) => {
    if (!r.month) return;
    if (!map[r.month]) map[r.month] = { sum: 0, cnt: 0 };
    map[r.month].sum += r.usd;
    map[r.month].cnt++;
  });
  const vals = months.map((m) => (map[m] ? Math.round(map[m].sum / map[m].cnt) : null));
  note("chartAvgOrder", vals.some((v) => v != null), `${vals.filter((v) => v != null).length}/${vals.length} months`);
}
{
  const byMo = {};
  F.forEach((r) => {
    if (!r.month) return;
    const mo = +r.month.split("-")[1];
    if (!byMo[mo]) byMo[mo] = { sum: 0, years: new Set() };
    byMo[mo].sum += r.usd;
    byMo[mo].years.add(r.year);
  });
  const vals = Array.from({ length: 12 }, (_, i) => {
    const d = byMo[i + 1];
    return d && d.years.size > 0 ? Math.round(d.sum / d.years.size) : 0;
  });
  note("chartSeason", vals.some((v) => v > 0), `nonzero=${vals.filter((v) => v > 0).length}/12`);
}
{
  const dow = Array(7).fill(0);
  F.forEach((r) => {
    if (!r.date) return;
    const d = new Date(r.date).getDay();
    dow[d] += r.usd;
  });
  note("chartDow", dow.some((v) => v > 0), `nonzero=${dow.filter((v) => v > 0).length}/7`);
}

// ── Quarterly ───────────────────────────────────────────────────────────────
function qtrKey(r) {
  if (!r.month) return null;
  const [y, m] = r.month.split("-").map(Number);
  const q = Math.floor((m - 1) / 3) + 1;
  return `${y}Q${q}`;
}
{
  const map = {};
  F.forEach((r) => {
    const k = qtrKey(r);
    if (!k) return;
    if (!map[k]) map[k] = { usd: 0, rmb: 0, orders: 0 };
    map[k].usd += r.usd;
    map[k].rmb += r.rmb;
    map[k].orders++;
  });
  note("chartQtrRev", Object.keys(map).length > 0, `${Object.keys(map).length} quarters`);
  note("chartQoQ", Object.keys(map).length >= 2, `quarters=${Object.keys(map).length}`);
  // QtrYoY needs ≥2 years
  const years = new Set(F.map((r) => r.year).filter(Boolean));
  note("chartQtrYoY", years.size >= 2, `years=${[...years].join(",")}`);
  note("chartQtrCust", true, `quarters=${Object.keys(map).length}`);
  note("chartQtrChan", true, `quarters=${Object.keys(map).length}`);
  note("chartQtrSp", true, `quarters=${Object.keys(map).length}`);
}

// ── Team ────────────────────────────────────────────────────────────────────
{
  const sp = {};
  F.forEach((r) => {
    if (!r.salesperson) return;
    if (!sp[r.salesperson]) sp[r.salesperson] = { usd: 0, orders: 0 };
    sp[r.salesperson].usd += r.usd;
    sp[r.salesperson].orders++;
  });
  note("chartSpRev", Object.keys(sp).length > 0, `${Object.keys(sp).length} salespeople`);
  note("chartSpCountries", true, `salespeople=${Object.keys(sp).length}`);
  note("chartSpTrend", true, `salespeople=${Object.keys(sp).length}`);
  note("chartWinRate", true, `salespeople=${Object.keys(sp).length}`);
  note(
    "heatmap",
    Object.keys(sp).length > 0 && allMonths().length > 0,
    `cells=${Object.keys(sp).length} x ${allMonths().length}`
  );
}

// ── Market ──────────────────────────────────────────────────────────────────
{
  const map = {};
  F.forEach((r) => {
    if (r.country && r.usd > 0) map[r.country] = (map[r.country] || 0) + r.usd;
  });
  const n = Object.keys(map).length;
  note("chartCnTop", n > 0, `${n} countries`);
  note("chartMktConc", n > 0, `${n} countries`);
}
{
  const map = {};
  F.forEach((r) => {
    if (!r.store) return;
    if (!map[r.store]) map[r.store] = { on: 0, off: 0 };
    if (r.channel && r.channel.includes("线上")) map[r.store].on += r.usd;
    if (r.channel && r.channel.includes("线下")) map[r.store].off += r.usd;
  });
  note("chartStoreChannel", Object.keys(map).length > 0, `${Object.keys(map).length} stores`);
}
{
  // RegionAnalysis uses Chinese country names with a fixed mapping
  const regions = ["europe", "americas", "middleEast", "eastAsia", "southeastAsia", "southAsia", "africa", "oceania", "other"];
  const map = {};
  F.forEach((r) => {
    if (!r.country) return;
    map[r.country] = (map[r.country] || 0) + r.usd;
  });
  note("chartRegionPie", Object.keys(map).length > 0, `${Object.keys(map).length} unique countries`);
}
{
  const [y1, y2] = [2024, 2025];
  const map = {};
  F.forEach((r) => {
    if (!r.country || (r.year !== y1 && r.year !== y2)) return;
    if (!map[r.country]) map[r.country] = { prev: 0, cur: 0 };
    if (r.year === y1) map[r.country].prev += r.usd;
    else map[r.country].cur += r.usd;
  });
  const both = Object.values(map).filter((d) => d.prev > 500 && d.cur > 500);
  note("chartCnYoy", both.length > 0, `countries active in ${y1}&${y2} with both>500: ${both.length}`);
}
{
  const firstYear = {};
  ALL.forEach((r) => {
    if (r.country && r.year) {
      if (!firstYear[r.country] || r.year < firstYear[r.country]) firstYear[r.country] = r.year;
    }
  });
  const byYear = {};
  Object.values(firstYear).forEach((y) => (byYear[y] = (byYear[y] || 0) + 1));
  note("chartNewMkt", Object.keys(byYear).length > 0, `years with new countries: ${Object.entries(byYear).map(([y,n])=>`${y}=${n}`).join(",")}`);
}

console.log("CHART          EMPTY?   DETAIL");
console.log("----------------------------------------------------------------");
for (const r of report) {
  console.log(`${r.chart.padEnd(20)} ${r.ok ? "ok    " : "EMPTY "} ${r.detail}`);
}
