import { chromium } from "file:///C:/Users/pure4/AppData/Roaming/npm/node_modules/@executeautomation/playwright-mcp-server/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, "icon.svg");
const pngPath = join(__dirname, "icon-600x600.png");

const svg = readFileSync(svgPath, "utf-8");
const html = `<!doctype html><html><body style="margin:0"><div id="root">${svg}</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
await page.setContent(html);
const el = await page.$("svg");
await el.screenshot({ path: pngPath });
await browser.close();
console.log("저장 완료:", pngPath);
