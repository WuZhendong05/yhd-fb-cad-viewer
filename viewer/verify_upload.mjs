import { chromium } from "playwright";
import { appendFileSync } from "node:fs";

const LOG = "D:/14418/step-viewer/verify_upload.log";
const log = (msg) => { appendFileSync(LOG, `${new Date().toISOString()} ${msg}\n`); console.log(msg); };

const URL = "http://127.0.0.1:3245/D:/14418/step-viewer/uploads/20260820_145409_de0292?file=%E6%B5%8B%E8%AF%951.STEP&features=%E6%B5%8B%E8%AF%951.%E7%89%B9%E5%BE%81%E8%AF%86%E5%88%AB.json";

try {
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(`console: ${msg.text()}`); });

  log("goto " + URL);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("canvas", { timeout: 90000 });
  // Wait for the STEP sheet toggle (model loaded) and the feature tree section.
  await page.waitForSelector('button[aria-label^="展开"]', { timeout: 120000 });
  await page.waitForFunction(
    () => [...document.querySelectorAll("h3,div,span,button")].some((el) => (el.textContent || "").includes("特征信息树")),
    { timeout: 30000 }
  );
  await page.waitForTimeout(4000);

  const state = await page.evaluate(() => {
    const body = document.body.innerText;
    const hasFeaturesSection = body.includes("特征信息树");
    const hasOverview = body.includes("整体信息");
    const hasGeometry = body.includes("几何信息");
    const hasSurface = body.includes("加工面信息");
    const hasContour = body.includes("轮廓信息");
    const hasPart = body.includes("零件");
    const canvas = document.querySelector("canvas");
    return {
      hasFeaturesSection,
      hasOverview,
      hasGeometry,
      hasSurface,
      hasContour,
      hasPart,
      canvas: canvas ? Math.round(canvas.getBoundingClientRect().width) : null,
      bodyHead: body.slice(0, 300).replace(/\n+/g, " | ")
    };
  });
  log("STATE: " + JSON.stringify(state, null, 1));
  log("ERRORS: " + JSON.stringify(errors));
  await page.screenshot({ path: "D:/14418/step-viewer/verify-upload.png" });
  await browser.close();
  log("done");
} catch (err) {
  log("FATAL: " + (err && err.stack ? err.stack : String(err)));
}
process.exit(0);
