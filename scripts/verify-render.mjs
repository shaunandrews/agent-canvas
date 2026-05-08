import { createRequire } from "node:module";

const require = createRequire("/Users/shaun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/");
const { chromium } = require("playwright");

const url = process.argv[2] || process.env.AGENT_CANVAS_URL || "http://127.0.0.1:5173/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 980 },
  deviceScaleFactor: 1
});

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.locator("[data-agent-canvas-stage]").waitFor();
await page.locator("[data-agent-node-id='premise']").waitFor();

const initialTransform = await page.locator("[data-agent-canvas-stage]").evaluate((node) => getComputedStyle(node).transform);
await page.getByRole("button", { name: "Zoom in", exact: true }).click();
const zoomedTransform = await page.locator("[data-agent-canvas-stage]").evaluate((node) => getComputedStyle(node).transform);
await page.getByRole("button", { name: "Add document", exact: true }).click();
await page.locator("[data-agent-node-id^='doc-']").first().waitFor();
await page.getByRole("button", { name: "Context", exact: true }).click();

const result = await page.evaluate(() => {
  const stage = document.querySelector("[data-agent-canvas-stage]");
  const nodes = [...document.querySelectorAll("[data-agent-node-id]")];
  const context = document.querySelector(".demo-context pre")?.textContent || "";
  const shell = document.querySelector(".ac-shell")?.getBoundingClientRect();

  return {
    hasStage: Boolean(stage),
    nodeCount: nodes.length,
    hasWebsite: Boolean(document.querySelector("[data-agent-node-id='site-preview'] iframe")),
    hasGeneratedDocument: nodes.some((node) => node.getAttribute("data-agent-node-id")?.startsWith("doc-")),
    contextMentionsVisible: context.includes('"visible"'),
    shellWidth: shell ? Math.round(shell.width) : 0,
    shellHeight: shell ? Math.round(shell.height) : 0,
    bodyOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
  };
});

await page.screenshot({ path: "agent-canvas-demo.png", fullPage: true });
await browser.close();

console.log(
  JSON.stringify(
    {
      ...result,
      zoomControlWorks: initialTransform !== zoomedTransform
    },
    null,
    2
  )
);
