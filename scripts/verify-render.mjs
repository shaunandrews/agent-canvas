import { createRequire } from "node:module";

const require = createRequire("/Users/shaun/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/");
const { chromium } = require("playwright");

const url = process.argv[2] || process.env.AGENT_CANVAS_URL || "http://127.0.0.1:5173/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 980 },
  deviceScaleFactor: 1
});

const inspectorShortcut = process.platform === "darwin" ? "Meta+I" : "Control+I";
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.evaluate(() => window.localStorage.removeItem("agent-canvas-demo-state-v1"));
await page.reload({ waitUntil: "domcontentloaded" });
await page.locator("[data-agent-canvas-stage]").waitFor();
await page.locator("[data-agent-node-id='premise']").waitFor();

const inspectorHiddenByDefault = await page.locator(".demo-panel").evaluate((node) => node.hasAttribute("hidden"));
await page.keyboard.press(inspectorShortcut);
await page.locator(".demo-panel").waitFor({ state: "visible" });
const inspectorOpensWithShortcut = await page.locator(".demo-panel").isVisible();
await page.keyboard.press(inspectorShortcut);
await page.waitForFunction(() => document.querySelector(".demo-panel")?.hasAttribute("hidden"));
const inspectorClosesWithShortcut = await page.locator(".demo-panel").evaluate((node) => node.hasAttribute("hidden"));
await page.keyboard.press(inspectorShortcut);
await page.locator(".demo-panel").waitFor({ state: "visible" });

const premiseSelectedBeforeCanvasClick = await page
  .locator("[data-agent-node-id='premise']")
  .evaluate((node) => node.classList.contains("is-selected"));
await page.mouse.click(24, 24);
const canvasClickDeselects = (await page.locator(".ac-node.is-selected").count()) === 0;

const premiseBounds = await page.locator("[data-agent-node-id='premise']").boundingBox();
if (!premiseBounds) throw new Error("Could not read premise node bounds.");
const transformBeforeUnselectedNodeDrag = await page.locator("[data-agent-canvas-stage]").evaluate((node) => getComputedStyle(node).transform);
await page.mouse.move(premiseBounds.x + 48, premiseBounds.y + 48);
await page.mouse.down();
await page.mouse.move(premiseBounds.x + 128, premiseBounds.y + 96);
await page.mouse.up();
const transformAfterUnselectedNodeDrag = await page.locator("[data-agent-canvas-stage]").evaluate((node) => getComputedStyle(node).transform);
const unselectedNodeDragPans =
  transformAfterUnselectedNodeDrag !== transformBeforeUnselectedNodeDrag && (await page.locator(".ac-node.is-selected").count()) === 0;

const premiseBoundsAfterPan = await page.locator("[data-agent-node-id='premise']").boundingBox();
if (!premiseBoundsAfterPan) throw new Error("Could not read premise bounds after panning.");
await page.mouse.click(premiseBoundsAfterPan.x + 48, premiseBoundsAfterPan.y + 48);
const clickSelectsNode = await page.locator("[data-agent-node-id='premise']").evaluate((node) => node.classList.contains("is-selected"));
const premiseBoundsAfterClick = await page.locator("[data-agent-node-id='premise']").boundingBox();
if (!premiseBoundsAfterClick) throw new Error("Could not read premise bounds after selecting.");
const transformBeforeSelectedNodeDrag = await page.locator("[data-agent-canvas-stage]").evaluate((node) => getComputedStyle(node).transform);
await page.mouse.move(premiseBoundsAfterClick.x + 48, premiseBoundsAfterClick.y + 48);
await page.mouse.down();
await page.mouse.move(premiseBoundsAfterClick.x + 128, premiseBoundsAfterClick.y + 96);
await page.mouse.up();
const premiseBoundsAfterSelectedDrag = await page.locator("[data-agent-node-id='premise']").boundingBox();
const transformAfterSelectedNodeDrag = await page.locator("[data-agent-canvas-stage]").evaluate((node) => getComputedStyle(node).transform);
const selectedNodeCanDrag =
  premiseBoundsAfterSelectedDrag &&
  transformAfterSelectedNodeDrag === transformBeforeSelectedNodeDrag &&
  (Math.abs(premiseBoundsAfterSelectedDrag.x - premiseBoundsAfterClick.x) > 8 ||
    Math.abs(premiseBoundsAfterSelectedDrag.y - premiseBoundsAfterClick.y) > 8);

const initialTransform = await page.locator("[data-agent-canvas-stage]").evaluate((node) => getComputedStyle(node).transform);
await page.getByRole("button", { name: "Zoom in", exact: true }).click();
const zoomedTransform = await page.locator("[data-agent-canvas-stage]").evaluate((node) => getComputedStyle(node).transform);
const hasToolbarTidyButtons =
  (await page.getByRole("button", { name: "Tidy row", exact: true }).count()) === 1 &&
  (await page.getByRole("button", { name: "Tidy grid", exact: true }).count()) === 1;
const toolbarHasTooltips =
  (await page.getByRole("button", { name: "Tidy row", exact: true }).getAttribute("data-tooltip")) === "Tidy row" &&
  (await page.getByRole("button", { name: "Zoom in", exact: true }).getAttribute("data-tooltip")) === "Zoom in";
const toolbarStyle = await page.locator(".ac-toolbar").evaluate((node) => {
  const styles = getComputedStyle(node);
  const rect = node.getBoundingClientRect();
  const shellRect = document.querySelector(".ac-shell")?.getBoundingClientRect();
  return {
    backdropFilter: styles.backdropFilter || styles.webkitBackdropFilter,
    background: styles.background,
    backgroundColor: styles.backgroundColor,
    backgroundImage: styles.backgroundImage,
    buttonHeight: Math.round(node.querySelector("button")?.getBoundingClientRect().height || 0),
    centerOffset: shellRect ? Math.abs(rect.left + rect.width / 2 - (shellRect.left + shellRect.width / 2)) : 999
  };
});
await page.getByRole("button", { name: "Add document", exact: true }).click();
await page.locator("[data-agent-node-id^='doc-']").first().waitFor();
await page.getByRole("button", { name: "Context", exact: true }).click();
const liveTransformBefore = await page.locator("[data-agent-canvas-stage]").evaluate((node) => getComputedStyle(node).transform);
await page.getByRole("button", { name: "Step", exact: true }).click();
await page.waitForFunction(() => document.querySelector(".demo-live-readout")?.textContent?.includes("Read visible context"));
const liveReadoutAfterFirst = await page.locator(".demo-live-readout").textContent();
const agentNoteUpdating = await page.locator("[data-agent-node-id='agent-note']").textContent();
await page.getByRole("button", { name: "Step", exact: true }).click();
await page.locator("[data-agent-node-id='live-synthesis']").waitFor();
const liveTransformAfter = await page.locator("[data-agent-canvas-stage]").evaluate((node) => getComputedStyle(node).transform);
const liveContentBefore = await page.locator("[data-agent-node-id='live-synthesis']").textContent();
await page.getByRole("button", { name: "Step", exact: true }).click();
await page.waitForFunction(() => document.querySelector("[data-agent-node-id='live-synthesis']")?.textContent?.includes("shared answer"));
const liveContentAfter = await page.locator("[data-agent-node-id='live-synthesis']").textContent();
const liveTransformAfterStream = await page.locator("[data-agent-canvas-stage]").evaluate((node) => getComputedStyle(node).transform);
await page.getByLabel("Follow focus", { exact: true }).check();
await page.getByRole("button", { name: "Step", exact: true }).click();
await page.waitForFunction(
  (previousTransform) => {
    const stage = document.querySelector("[data-agent-canvas-stage]");
    return stage && getComputedStyle(stage).transform !== previousTransform;
  },
  liveTransformAfterStream
);
const liveFollowTransform = await page.locator("[data-agent-canvas-stage]").evaluate((node) => getComputedStyle(node).transform);
await page.waitForFunction(() => {
  const raw = window.localStorage.getItem("agent-canvas-demo-state-v1");
  const stage = document.querySelector("[data-agent-canvas-stage]");
  if (!raw || !stage) return false;

  const stored = JSON.parse(raw);
  const viewport = stored.viewport;
  const transform = getComputedStyle(stage).transform;
  const matrix = transform.match(/^matrix\((.+)\)$/)?.[1]?.split(",").map((value) => Number(value.trim()));
  if (!viewport || !matrix || matrix.length < 6) return false;

  return (
    Math.abs(viewport.scale - matrix[0]) < 0.001 &&
    Math.abs(viewport.x - matrix[4]) < 0.5 &&
    Math.abs(viewport.y - matrix[5]) < 0.5
  );
});
const persistedTransformBeforeReload = liveFollowTransform;
await page.reload({ waitUntil: "domcontentloaded" });
await page.locator("[data-agent-canvas-stage]").waitFor();
await page.locator("[data-agent-node-id='live-synthesis']").waitFor();
const persistedTransformAfterReload = await page.locator("[data-agent-canvas-stage]").evaluate((node) => getComputedStyle(node).transform);

const result = await page.evaluate(() => {
  const stage = document.querySelector("[data-agent-canvas-stage]");
  const nodes = [...document.querySelectorAll("[data-agent-node-id]")];
  const context = document.querySelector(".demo-context pre")?.textContent || "";
  const shell = document.querySelector(".ac-shell")?.getBoundingClientRect();
  const shellElement = document.querySelector(".ac-shell");
  const lightProbe = document.createElement("div");
  const darkProbe = document.createElement("div");
  lightProbe.className = "ac-theme-light";
  darkProbe.className = "ac-theme-dark";
  document.body.append(lightProbe, darkProbe);
  const lightCanvasColor = getComputedStyle(lightProbe).getPropertyValue("--ac-canvas");
  const darkCanvasColor = getComputedStyle(darkProbe).getPropertyValue("--ac-canvas");
  lightProbe.remove();
  darkProbe.remove();
  const nodeAvoidsOverlap = (id) => {
    const target = document.querySelector(`[data-agent-node-id='${id}']`);
    if (!target) return false;

    const targetRect = target.getBoundingClientRect();
    return [...document.querySelectorAll("[data-agent-node-id]")]
      .filter((node) => node !== target && !node.classList.contains("ac-node--group"))
      .every((node) => {
        const rect = node.getBoundingClientRect();
        return (
          targetRect.right <= rect.left ||
          targetRect.left >= rect.right ||
          targetRect.bottom <= rect.top ||
          targetRect.top >= rect.bottom
        );
      });
  };

  return {
    hasStage: Boolean(stage),
    nodeCount: nodes.length,
    hasWebsite: Boolean(document.querySelector("[data-agent-node-id='site-preview'] iframe")),
    hasGeneratedDocument: nodes.some((node) => node.getAttribute("data-agent-node-id")?.startsWith("doc-")),
    hasLiveSynthesis: Boolean(document.querySelector("[data-agent-node-id='live-synthesis']")),
    liveSynthesisAvoidsOverlap: nodeAvoidsOverlap("live-synthesis"),
    liveSynthesisEditing: document.querySelector("[data-agent-node-id='live-synthesis']")?.textContent?.includes("Editing") || false,
    liveReadoutHasCurrentAndNext: document.querySelector(".demo-live-readout")?.textContent?.includes("Current") || false,
    liveLogEntries: document.querySelectorAll(".demo-log-entry").length,
    contextMentionsVisible: context.includes('"visible"'),
    canvasThemeAttribute: shellElement?.getAttribute("data-agent-canvas-theme") === "system",
    themeVariablesDiffer: lightCanvasColor !== darkCanvasColor,
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
      firstStepShownAsCurrent: liveReadoutAfterFirst?.includes("Read visible context") && liveReadoutAfterFirst?.includes("Open draft container"),
      touchedNodeShowsUpdating: agentNoteUpdating?.includes("Updating") || false,
      liveContentStreamed: liveContentBefore !== liveContentAfter,
      liveStepDoesNotAutofocus: liveTransformBefore === liveTransformAfter && liveTransformAfter === liveTransformAfterStream,
      liveFollowFocusWorks: liveFollowTransform !== liveTransformAfterStream,
      demoStatePersistsAfterReload: persistedTransformBeforeReload === persistedTransformAfterReload,
      inspectorHiddenByDefault,
      inspectorOpensWithShortcut,
      inspectorClosesWithShortcut,
      canvasClickDeselects: premiseSelectedBeforeCanvasClick && canvasClickDeselects,
      unselectedNodeDragPans,
      clickSelectsNode,
      selectedNodeCanDrag,
      hasToolbarTidyButtons,
      toolbarHasTooltips,
      toolbarIsCompact: toolbarStyle.buttonHeight <= 32,
      toolbarIsCentered: toolbarStyle.centerOffset <= 2,
      toolbarHasGlassEffect:
        toolbarStyle.backdropFilter.includes("blur") &&
        (toolbarStyle.background.includes("rgba") ||
          toolbarStyle.backgroundColor.includes("rgba") ||
          toolbarStyle.backgroundImage.includes("rgba")),
      zoomControlWorks: initialTransform !== zoomedTransform
    },
    null,
    2
  )
);
