import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = "http://127.0.0.1:8788/";
const OUT_DIR = "D:/sales-dashboard-cloudflare/.preview-screenshots";
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  defaultViewport: { width: 1500, height: 1200, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));

// Overview: capture KPI grid + filter bar
{
  const clip = await page.evaluate(() => {
    const f = document.querySelector(".filters");
    const k = document.querySelector(".kpi-grid");
    if (!f || !k) return null;
    const fr = f.getBoundingClientRect();
    const kr = k.getBoundingClientRect();
    return {
      x: 0,
      y: Math.min(fr.top, kr.top) + window.scrollY,
      width: Math.max(fr.right, kr.right),
      height: Math.max(fr.bottom, kr.bottom) - Math.min(fr.top, kr.top) + 12,
    };
  });
  if (clip) {
    await page.screenshot({
      path: `${OUT_DIR}/zoom-filters-kpis.png`,
      clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height },
    });
    console.log("saved filters + KPIs");
  }
}

// Growth tab: capture the 3 new charts (Cumulative Yearly, Growth Rate, Avg by Type)
{
  await page.evaluate(() => {
    const el = document.querySelector('.nav-tab[onclick*="\'growth\'"]');
    if (el) el.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  const clip = await page.evaluate(() => {
    const yc = document.querySelector("#chartCumulativeYearly");
    const at = document.querySelector("#chartAvgByType");
    if (!yc || !at) return null;
    const ycR = yc.closest(".grid2").getBoundingClientRect();
    const atR = at.closest(".card").getBoundingClientRect();
    return {
      x: 0,
      y: ycR.top + window.scrollY,
      width: Math.max(ycR.right, atR.right),
      height: atR.bottom - ycR.top + 12,
    };
  });
  if (clip) {
    await page.evaluate((y) => window.scrollTo(0, y - 12), clip.y);
    await new Promise((r) => setTimeout(r, 300));
    const clip2 = await page.evaluate(() => {
      const yc = document.querySelector("#chartCumulativeYearly");
      const at = document.querySelector("#chartAvgByType");
      const ycR = yc.closest(".grid2").getBoundingClientRect();
      const atR = at.closest(".card").getBoundingClientRect();
      return { x: 0, y: ycR.top + window.scrollY, width: Math.max(ycR.right, atR.right), height: atR.bottom - ycR.top + 12 };
    });
    await page.screenshot({
      path: `${OUT_DIR}/zoom-growth-new-charts.png`,
      clip: { x: clip2.x, y: clip2.y, width: clip2.width, height: clip2.height },
    });
    console.log("saved growth new charts");
  }
}

// Trend chart on overview (back to overview to see forecast)
{
  await page.evaluate(() => {
    const el = document.querySelector('.nav-tab[onclick*="\'overview\'"]');
    if (el) el.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 300));
  const clip = await page.evaluate(() => {
    const c = document.querySelector("#chartTrend").closest(".card");
    const r = c.getBoundingClientRect();
    return { x: 0, y: r.top + window.scrollY, width: r.right, height: r.height + 8 };
  });
  await page.evaluate((y) => window.scrollTo(0, y - 12), clip.y);
  await new Promise((r) => setTimeout(r, 300));
  const clip2 = await page.evaluate(() => {
    const c = document.querySelector("#chartTrend").closest(".card");
    const r = c.getBoundingClientRect();
    return { x: 0, y: r.top + window.scrollY, width: r.right, height: r.height + 8 };
  });
  await page.screenshot({
    path: `${OUT_DIR}/zoom-trend-with-forecast.png`,
    clip: { x: clip2.x, y: clip2.y, width: clip2.width, height: clip2.height },
  });
  console.log("saved trend with forecast");
}

// Market: capture Top Stores chart
{
  await page.evaluate(() => {
    const el = document.querySelector('.nav-tab[onclick*="\'market\'"]');
    if (el) el.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.evaluate(() => {
    const c = document.querySelector("#chartTopStores").closest(".card");
    c.scrollIntoView({ block: "center" });
  });
  await new Promise((r) => setTimeout(r, 300));
  const clip2 = await page.evaluate(() => {
    const c = document.querySelector("#chartTopStores").closest(".card");
    const r = c.getBoundingClientRect();
    return { x: 0, y: r.top + window.scrollY, width: r.right, height: r.height + 8 };
  });
  await page.screenshot({
    path: `${OUT_DIR}/zoom-top-stores.png`,
    clip: { x: clip2.x, y: clip2.y, width: clip2.width, height: clip2.height },
  });
  console.log("saved top stores");
}

await browser.close();
