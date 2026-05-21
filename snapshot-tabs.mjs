import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const URL = "http://127.0.0.1:8788/";
const OUT_DIR = "D:/sales-dashboard-cloudflare/.preview-screenshots";
fs.mkdirSync(OUT_DIR, { recursive: true });

const tabs = ["overview", "growth", "quarterly", "team", "market", "orders"];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  defaultViewport: { width: 1500, height: 1000, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push("console: " + msg.text());
});

await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));

for (const tab of tabs) {
  await page.evaluate((id) => {
    const el = document.querySelector(`.nav-tab[onclick*="'${id}'"]`);
    if (el) el.click();
  }, tab);
  await new Promise((r) => setTimeout(r, 1500));
  const out = `${OUT_DIR}/page-${tab}.png`;
  await page.screenshot({ path: out, fullPage: true });
  const empty = await page.evaluate(() => {
    const active = document.querySelector(".page.active");
    if (!active) return { error: "no active page" };
    const result = { charts: [] };
    active.querySelectorAll("canvas").forEach((c) => {
      const id = c.id;
      const ctx = c.getContext("2d");
      const img = ctx.getImageData(0, 0, c.width, c.height).data;
      let nonzero = 0;
      for (let i = 0; i < img.length; i += 4) {
        if (img[i] || img[i + 1] || img[i + 2]) {
          nonzero++;
          if (nonzero > 200) break;
        }
      }
      result.charts.push({ id, w: c.width, h: c.height, pixels: nonzero });
    });
    return result;
  });
  console.log(`[${tab}] saved ${out}`);
  for (const c of empty.charts || []) {
    const marker = c.pixels < 50 ? "BLANK" : "ok";
    console.log(`  ${marker.padEnd(6)} ${c.id.padEnd(22)} pixels=${c.pixels} (${c.w}x${c.h})`);
  }
}

if (errors.length) {
  console.log("\nJS errors observed:");
  errors.forEach((e) => console.log("  " + e));
} else {
  console.log("\nNo JS errors.");
}

await browser.close();
