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
await page.evaluate(() => {
  window.localStorage.removeItem("agent-canvas-demo-state-v1");
  window.localStorage.removeItem("agent-canvas-demo-state-v2");
  window.localStorage.removeItem("agent-canvas-demo-state-v3");
  window.localStorage.removeItem("agent-canvas-demo-state-v4");
  window.localStorage.removeItem("agent-canvas-demo-state-v5");
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.locator("[data-agent-canvas-stage]").waitFor();
await page.locator("[data-agent-node-id='project-summary']").waitFor();

const summarySelectedBeforeCanvasClick = await page
  .locator("[data-agent-node-id='project-summary']")
  .evaluate((node) => node.classList.contains("is-selected"));
await page.mouse.click(24, 24);
const canvasClickDeselects = (await page.locator(".ac-node.is-selected").count()) === 0;

const summaryBounds = await page.locator("[data-agent-node-id='project-summary']").boundingBox();
if (!summaryBounds) throw new Error("Could not read project summary node bounds.");
const transformBeforeUnselectedNodeDrag = await page.locator("[data-agent-canvas-stage]").evaluate((node) => getComputedStyle(node).transform);
await page.mouse.move(summaryBounds.x + 48, summaryBounds.y + 48);
await page.mouse.down();
await page.mouse.move(summaryBounds.x + 128, summaryBounds.y + 96);
await page.mouse.up();
const transformAfterUnselectedNodeDrag = await page.locator("[data-agent-canvas-stage]").evaluate((node) => getComputedStyle(node).transform);
const unselectedNodeDragPans =
  transformAfterUnselectedNodeDrag !== transformBeforeUnselectedNodeDrag && (await page.locator(".ac-node.is-selected").count()) === 0;

const summaryBoundsAfterPan = await page.locator("[data-agent-node-id='project-summary']").boundingBox();
if (!summaryBoundsAfterPan) throw new Error("Could not read project summary bounds after panning.");
await page.mouse.click(summaryBoundsAfterPan.x + 48, summaryBoundsAfterPan.y + 48);
const clickSelectsNode = await page.locator("[data-agent-node-id='project-summary']").evaluate((node) => node.classList.contains("is-selected"));
const summaryBoundsAfterClick = await page.locator("[data-agent-node-id='project-summary']").boundingBox();
if (!summaryBoundsAfterClick) throw new Error("Could not read project summary bounds after selecting.");
const transformBeforeSelectedNodeDrag = await page.locator("[data-agent-canvas-stage]").evaluate((node) => getComputedStyle(node).transform);
await page.mouse.move(summaryBoundsAfterClick.x + 48, summaryBoundsAfterClick.y + 48);
await page.mouse.down();
await page.mouse.move(summaryBoundsAfterClick.x + 128, summaryBoundsAfterClick.y + 96);
await page.mouse.up();
const summaryBoundsAfterSelectedDrag = await page.locator("[data-agent-node-id='project-summary']").boundingBox();
const transformAfterSelectedNodeDrag = await page.locator("[data-agent-canvas-stage]").evaluate((node) => getComputedStyle(node).transform);
const selectedNodeCanDrag =
  summaryBoundsAfterSelectedDrag &&
  transformAfterSelectedNodeDrag === transformBeforeSelectedNodeDrag &&
  (Math.abs(summaryBoundsAfterSelectedDrag.x - summaryBoundsAfterClick.x) > 8 ||
    Math.abs(summaryBoundsAfterSelectedDrag.y - summaryBoundsAfterClick.y) > 8);
const summaryDocumentRectAfterDrag = await readNodeDocumentRect(page, "project-summary");
const selectedDragSnapsToGrid = hasGridAlignedPoint(summaryDocumentRectAfterDrag, 24);
const resizeHandlesVisible = (await page.locator("[data-agent-node-id='project-summary'] [data-agent-resize-handle]").count()) === 4;
const summaryDocumentRectBeforeResize = await readNodeDocumentRect(page, "project-summary");
const seResizeHandle = page.locator("[data-agent-node-id='project-summary'] [data-agent-resize-handle='se']");
let selectedNodeCanResize = false;
let resizeSnapsToGrid = false;
let resizeShowsSnapGuide = false;
let snapGuidesClearAfterRelease = false;
const resizeHandleBounds = await seResizeHandle.boundingBox();
if (resizeHandleBounds) {
  await page.mouse.move(resizeHandleBounds.x + resizeHandleBounds.width / 2, resizeHandleBounds.y + resizeHandleBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(resizeHandleBounds.x + resizeHandleBounds.width / 2 + 30, resizeHandleBounds.y + resizeHandleBounds.height / 2 + 30);
  resizeShowsSnapGuide = (await page.locator("[data-agent-snap-guide]").count()) > 0;
  await page.mouse.up();
  await page.waitForTimeout(50);
  snapGuidesClearAfterRelease = (await page.locator("[data-agent-snap-guide]").count()) === 0;

  const summaryDocumentRectAfterResize = await readNodeDocumentRect(page, "project-summary");
  selectedNodeCanResize =
    summaryDocumentRectAfterResize.width > summaryDocumentRectBeforeResize.width + 10 &&
    summaryDocumentRectAfterResize.height > summaryDocumentRectBeforeResize.height + 10;
  resizeSnapsToGrid =
    isMultiple(summaryDocumentRectAfterResize.x + summaryDocumentRectAfterResize.width, 24) ||
    isMultiple(summaryDocumentRectAfterResize.y + summaryDocumentRectAfterResize.height, 24);
}

const homeFrame = page.locator("[data-agent-node-id='home-mobile'] iframe");
const homeFramePointerEventsWhenUnselected = await homeFrame.evaluate((node) => getComputedStyle(node).pointerEvents);
const homeFrameBounds = await homeFrame.boundingBox();
if (!homeFrameBounds) throw new Error("Could not read home frame bounds.");
await page.mouse.click(homeFrameBounds.x + homeFrameBounds.width / 2, homeFrameBounds.y + homeFrameBounds.height / 2);
const homeFrameSelected = await page.locator("[data-agent-node-id='home-mobile']").evaluate((node) => node.classList.contains("is-selected"));
const homeFramePointerEventsWhenSelected = await homeFrame.evaluate((node) => getComputedStyle(node).pointerEvents);
const websiteFramesAreInteractiveOnlyWhenSelected =
  homeFramePointerEventsWhenUnselected === "none" && homeFrameSelected && homeFramePointerEventsWhenSelected === "auto";

await page.mouse.click(24, 24);
const sectionBoundsBeforeMove = await page.locator("[data-agent-node-id='screens-section']").boundingBox();
if (!sectionBoundsBeforeMove) throw new Error("Could not read section bounds before moving.");
const sectionRectBeforeMove = await readNodeDocumentRect(page, "screens-section");
const homeRectBeforeSectionMove = await readNodeDocumentRect(page, "home-mobile");
await page.mouse.click(sectionBoundsBeforeMove.x + 24, sectionBoundsBeforeMove.y + 24);
const sectionClickSelects = await page
  .locator("[data-agent-node-id='screens-section']")
  .evaluate((node) => node.classList.contains("is-selected"));
await page.mouse.move(sectionBoundsBeforeMove.x + 24, sectionBoundsBeforeMove.y + 24);
await page.mouse.down();
await page.mouse.move(sectionBoundsBeforeMove.x + 120, sectionBoundsBeforeMove.y + 72);
await page.mouse.up();
const sectionRectAfterMove = await readNodeDocumentRect(page, "screens-section");
const homeRectAfterSectionMove = await readNodeDocumentRect(page, "home-mobile");
const sectionDx = sectionRectAfterMove.x - sectionRectBeforeMove.x;
const sectionDy = sectionRectAfterMove.y - sectionRectBeforeMove.y;
const sectionMoveCarriesChildren =
  sectionClickSelects &&
  Math.abs(sectionDx) > 8 &&
  Math.abs(sectionDy) > 8 &&
  Math.abs(homeRectAfterSectionMove.x - homeRectBeforeSectionMove.x - sectionDx) < 0.5 &&
  Math.abs(homeRectAfterSectionMove.y - homeRectBeforeSectionMove.y - sectionDy) < 0.5;
const tokenNotesRect = await readNodeDocumentRect(page, "token-notes");
const tokenGuidanceWidthReasonable = tokenNotesRect.width <= 900;

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

await page.waitForFunction(() => {
  const raw = window.localStorage.getItem("agent-canvas-demo-state-v5");
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
const persistedTransformBeforeReload = zoomedTransform;
await page.reload({ waitUntil: "domcontentloaded" });
await page.locator("[data-agent-canvas-stage]").waitFor();
const persistedTransformAfterReload = await page.locator("[data-agent-canvas-stage]").evaluate((node) => getComputedStyle(node).transform);

const result = await page.evaluate(() => {
  const stage = document.querySelector("[data-agent-canvas-stage]");
  const nodes = [...document.querySelectorAll("[data-agent-node-id]")];
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

  return {
    hasStage: Boolean(stage),
    nodeCount: nodes.length,
    hasWebsite: Boolean(document.querySelector("[data-agent-node-id='home-mobile'] iframe")),
    hasHeyFamSummary: document.querySelector("[data-agent-node-id='project-summary']")?.textContent?.includes("HeyFam product summary") || false,
    hasHeyFamScreens:
      Boolean(document.querySelector("[data-agent-node-id='home-mobile'] iframe")) &&
      Boolean(document.querySelector("[data-agent-node-id='home-desktop'] iframe")) &&
      Boolean(document.querySelector("[data-agent-node-id='create-fam-mobile'] iframe")) &&
      Boolean(document.querySelector("[data-agent-node-id='create-fam-desktop'] iframe")) &&
      Boolean(document.querySelector("[data-agent-node-id='fam-wall-mobile'] iframe")) &&
      Boolean(document.querySelector("[data-agent-node-id='fam-wall-desktop'] iframe")),
    hasSections:
      document.querySelectorAll(".ac-node--section").length === 4 &&
      Boolean(document.querySelector("[data-agent-node-id='screens-section'].ac-node--section")) &&
      Boolean(document.querySelector("[data-agent-node-id='components-section'].ac-node--section")) &&
      Boolean(document.querySelector("[data-agent-node-id='tokens-section'].ac-node--section")),
    hasComponentSpec: document.querySelector("[data-agent-node-id='component-spec']")?.textContent?.includes("Component spec") || false,
    hasDesignTokens: document.querySelector("[data-agent-node-id='design-tokens']")?.textContent?.includes("Design system") || false,
    hasDinnerPost: document.querySelector("[data-agent-node-id='fam-wall-mobile']")?.textContent?.includes("Dinner tonight") || false,
    hasLoggedOutHome: document.querySelector("[data-agent-node-id='home-mobile']")?.textContent?.includes("Create your fam") || false,
    hasCreateFamFields: document.querySelector("[data-agent-node-id='create-fam-mobile']")?.textContent?.includes("Fam name") || false,
    canvasThemeAttribute: shellElement?.getAttribute("data-agent-canvas-theme") === "system",
    themeVariablesDiffer: lightCanvasColor !== darkCanvasColor,
    shellWidth: shell ? Math.round(shell.width) : 0,
    shellHeight: shell ? Math.round(shell.height) : 0,
    bodyOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    demoPanelRemoved: !document.querySelector(".demo-panel"),
    demoInspectorToggleRemoved: !document.querySelector(".demo-inspector-toggle")
  };
});

await browser.close();

console.log(
  JSON.stringify(
    {
      ...result,
      demoStatePersistsAfterReload: persistedTransformBeforeReload === persistedTransformAfterReload,
      canvasClickDeselects: summarySelectedBeforeCanvasClick && canvasClickDeselects,
      unselectedNodeDragPans,
      clickSelectsNode,
      selectedNodeCanDrag,
      selectedDragSnapsToGrid,
      resizeHandlesVisible,
      selectedNodeCanResize,
      resizeSnapsToGrid,
      resizeShowsSnapGuide,
      snapGuidesClearAfterRelease,
      websiteFramesAreInteractiveOnlyWhenSelected,
      sectionClickSelects,
      sectionMoveCarriesChildren,
      tokenGuidanceWidthReasonable,
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

async function readNodeDocumentRect(page, id) {
  return page.locator(`[data-agent-node-id='${id}']`).evaluate((node) => ({
    x: Number(node.style.left.replace("px", "")),
    y: Number(node.style.top.replace("px", "")),
    width: Number(node.style.width.replace("px", "")),
    height: Number(node.style.height.replace("px", ""))
  }));
}

function hasGridAlignedPoint(rect, gridSize) {
  return [rect.x, rect.x + rect.width / 2, rect.x + rect.width, rect.y, rect.y + rect.height / 2, rect.y + rect.height].some((value) =>
    isMultiple(value, gridSize)
  );
}

function isMultiple(value, gridSize) {
  return Math.abs(value / gridSize - Math.round(value / gridSize)) < 0.01;
}
