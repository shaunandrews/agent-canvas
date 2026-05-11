import { createCanvasDocument, type CanvasDocument } from "../lib";

const homeMobileHtml = buildHomeScreenHtml("mobile");
const homeDesktopHtml = buildHomeScreenHtml("desktop");
const createFamMobileHtml = buildCreateFamScreenHtml("mobile");
const createFamDesktopHtml = buildCreateFamScreenHtml("desktop");
const famWallMobileHtml = buildFamWallScreenHtml("mobile");
const famWallDesktopHtml = buildFamWallScreenHtml("desktop");
const componentSpecHtml = buildComponentSpecHtml();
const designTokensHtml = buildDesignTokensHtml();

export const initialDocument: CanvasDocument = createCanvasDocument({
  id: "agent-canvas-demo",
  title: "HeyFam product board",
  width: 3600,
  height: 2600,
  nodes: [
    {
      id: "project-section",
      type: "section",
      x: 70,
      y: 80,
      width: 590,
      height: 600,
      title: "Project summary",
      zIndex: 0,
      content: {
        label: "Project summary",
        description: "North star, product scope, and next design questions."
      }
    },
    {
      id: "screens-section",
      type: "section",
      x: 720,
      y: 80,
      width: 2700,
      height: 1570,
      title: "Product screens",
      zIndex: 0,
      content: {
        label: "Product screens",
        description: "Logged-out home, Create a Fam, and Fam Wall across mobile and desktop."
      }
    },
    {
      id: "components-section",
      type: "section",
      x: 70,
      y: 730,
      width: 590,
      height: 920,
      title: "Component specs",
      zIndex: 0,
      content: {
        label: "Component specs",
        description: "Reusable UI primitives for buttons, inputs, cards, and text."
      }
    },
    {
      id: "tokens-section",
      type: "section",
      x: 70,
      y: 1710,
      width: 2580,
      height: 760,
      title: "Design system",
      zIndex: 0,
      content: {
        label: "Design system",
        description: "Color, space, elevation, and type tokens for HeyFam."
      }
    },
    {
      id: "project-summary",
      type: "document",
      parentId: "project-section",
      x: 50,
      y: 70,
      width: 490,
      height: 460,
      title: "HeyFam summary",
      tags: ["heyfam", "summary"],
      zIndex: 2,
      content: {
        markdown: `# HeyFam product summary

HeyFam is a private family space for shared plans, lightweight updates, and the questions that usually get scattered across texts.

This board captures the current design direction:

- Home is for logged-out users and explains the private family hub
- Create a Fam collects name, icon, color, and people in one focused setup flow
- Fam Wall shows people, posts, threaded comments, and reactions
- Component and token specs make the design easier for agents to extend consistently`
      }
    },
    {
      id: "home-mobile",
      type: "website",
      parentId: "screens-section",
      x: 60,
      y: 80,
      width: 360,
      height: 650,
      title: "Home, mobile",
      tags: ["heyfam", "screen", "home", "mobile", "logged-out"],
      zIndex: 3,
      content: {
        srcDoc: homeMobileHtml,
        caption: "Create your fam logged-out mobile home screen."
      }
    },
    {
      id: "home-desktop",
      type: "website",
      parentId: "screens-section",
      x: 460,
      y: 80,
      width: 720,
      height: 520,
      title: "Home, desktop",
      tags: ["heyfam", "screen", "home", "desktop", "logged-out"],
      zIndex: 4,
      content: {
        srcDoc: homeDesktopHtml,
        caption: "Logged-out desktop home screen with product positioning and sign-in entry."
      }
    },
    {
      id: "create-fam-mobile",
      type: "website",
      parentId: "screens-section",
      x: 1220,
      y: 80,
      width: 360,
      height: 650,
      title: "Create a Fam, mobile",
      tags: ["heyfam", "screen", "create-fam", "mobile", "form"],
      zIndex: 5,
      content: {
        srcDoc: createFamMobileHtml,
        caption: "Fam name, icon, color, and people form fields."
      }
    },
    {
      id: "create-fam-desktop",
      type: "website",
      parentId: "screens-section",
      x: 1620,
      y: 80,
      width: 720,
      height: 520,
      title: "Create a Fam, desktop",
      tags: ["heyfam", "screen", "create-fam", "desktop", "form"],
      zIndex: 6,
      content: {
        srcDoc: createFamDesktopHtml,
        caption: "Desktop setup flow with a live fam preview."
      }
    },
    {
      id: "fam-wall-mobile",
      type: "website",
      parentId: "screens-section",
      x: 60,
      y: 800,
      width: 360,
      height: 650,
      title: "Fam Wall, mobile",
      tags: ["heyfam", "screen", "fam-wall", "mobile", "feed"],
      zIndex: 7,
      content: {
        srcDoc: famWallMobileHtml,
        caption: "Dinner tonight post with avatars, threaded comments, and reactions."
      }
    },
    {
      id: "fam-wall-desktop",
      type: "website",
      parentId: "screens-section",
      x: 460,
      y: 800,
      width: 1180,
      height: 620,
      title: "Fam Wall, desktop",
      tags: ["heyfam", "screen", "fam-wall", "desktop", "feed"],
      zIndex: 8,
      content: {
        srcDoc: famWallDesktopHtml,
        caption: "Desktop wall with active people, threaded comments, and reaction summaries."
      }
    },
    {
      id: "component-spec",
      type: "website",
      parentId: "components-section",
      x: 50,
      y: 70,
      width: 490,
      height: 770,
      title: "Component spec",
      tags: ["heyfam", "components", "spec"],
      zIndex: 9,
      content: {
        srcDoc: componentSpecHtml,
        caption: "Component rules for buttons, inputs, cards, and text."
      }
    },
    {
      id: "design-tokens",
      type: "website",
      parentId: "tokens-section",
      x: 50,
      y: 70,
      width: 1620,
      height: 600,
      title: "Design system tokens",
      tags: ["heyfam", "design-system", "tokens"],
      zIndex: 10,
      content: {
        srcDoc: designTokensHtml,
        caption: "Color, spacing, elevation, and type tokens."
      }
    },
    {
      id: "token-notes",
      type: "document",
      parentId: "tokens-section",
      x: 1720,
      y: 70,
      width: 760,
      height: 600,
      title: "Token guidance",
      tags: ["heyfam", "design-system", "agent"],
      zIndex: 11,
      content: {
        markdown: `# Design system guidance

Agents should use these tokens before inventing new visual decisions.

## Color

Use warm neutrals for surfaces, soft teal for primary action, rose only for reactions or human warmth, and amber only for reminders.

## Space

Favor compact but breathable rhythm. Mobile screens use 16 to 20px page padding. Dense feed cards use 12 to 16px internal gaps.

## Elevation

Use hairline borders first. Reserve shadows for active overlays, previews, and cards that sit above a colored page background.

## Type

Headlines should be plain and direct. Body copy should describe family utility, not abstract productivity.`
      }
    }
  ]
});

type ScreenMode = "mobile" | "desktop";

function buildHomeScreenHtml(mode: ScreenMode) {
  const isDesktop = mode === "desktop";
  return htmlPage(`
    <main class="${isDesktop ? "screen desktop home" : "screen mobile home"}">
      <nav class="topbar">
        <strong>HeyFam</strong>
        <span>Sign in</span>
      </nav>
      <section class="hero">
        <p class="eyebrow">Private family space</p>
        <h1>Plans, updates, and decisions where everyone can find them.</h1>
        <p class="lede">Create a fam for the people who need the same dinner plans, travel details, photos, reminders, and answers.</p>
        <div class="actions">
          <button class="primary">Create your fam</button>
          <button class="secondary">Sign in</button>
        </div>
      </section>
      <section class="${isDesktop ? "preview-grid" : "stack"}">
        <article class="moment">
          <span class="mini-label">Dinner tonight</span>
          <strong>Tacos at 6:30</strong>
          <p>Jordan brings tortillas. Maya has soccer until 5:45.</p>
        </article>
        <article class="moment">
          <span class="mini-label">Beach weekend</span>
          <strong>Pick dates by Friday</strong>
          <p>Three people voted. The rental link is pinned.</p>
        </article>
        <article class="moment">
          <span class="mini-label">Recital photos</span>
          <strong>14 new memories</strong>
          <p>Lena added an album and Grandma reacted.</p>
        </article>
      </section>
      <footer>Invite-only, shared by text or email.</footer>
    </main>
  `);
}

function buildCreateFamScreenHtml(mode: ScreenMode) {
  const isDesktop = mode === "desktop";
  return htmlPage(`
    <main class="${isDesktop ? "screen desktop create" : "screen mobile create"}">
      <nav class="topbar">
        <strong>Create a fam</strong>
        <span>Step 1 of 2</span>
      </nav>
      <section class="form-layout">
        <form class="form-card">
          <p class="eyebrow">New fam</p>
          <h1>Start with the people.</h1>
          ${inputRow("Fam name", "The Parkers")}
          ${iconPicker()}
          ${colorPicker()}
          ${peopleInput()}
          <button class="primary wide">Create fam</button>
        </form>
        ${
          isDesktop
            ? `<aside class="live-preview">
                <span class="mini-label">Preview</span>
                <div class="preview-icon">P</div>
                <strong>The Parkers</strong>
                <p>Mom, Dad, Lena, Jordan, Kai</p>
                <div class="preview-feed">
                  <span>Dinner tonight</span>
                  <span>Beach weekend</span>
                  <span>School reminders</span>
                </div>
              </aside>`
            : ""
        }
      </section>
    </main>
  `);
}

function buildFamWallScreenHtml(mode: ScreenMode) {
  const isDesktop = mode === "desktop";
  return htmlPage(`
    <main class="${isDesktop ? "screen desktop wall" : "screen mobile wall"}">
      <nav class="topbar">
        <strong>The Parkers</strong>
        <button class="ghost">Post</button>
      </nav>
      <section class="${isDesktop ? "wall-layout" : "stack"}">
        <aside class="people-panel">
          <p class="eyebrow">People</p>
          <div class="avatars">
            ${avatar("Mom", "M", "sage")}
            ${avatar("Dad", "D", "amber")}
            ${avatar("Lena", "L", "rose")}
            ${avatar("Jordan", "J", "teal")}
            ${avatar("Kai", "K", "ink")}
          </div>
        </aside>
        <section class="feed">
          ${post({
            author: "Mom",
            title: "Dinner tonight",
            text: "Tacos are still the plan for 6:30. Can someone grab limes and sparkling water on the way?",
            reactions: "5 reactions",
            comments: [
              ["Jordan", "I can get both after practice."],
              ["Lena", "Please get the mango sparkling water."]
            ]
          })}
          ${post({
            author: "Dad",
            title: "Beach weekend rooms",
            text: "I pinned the rental layout. Grandma wants the quiet room if nobody minds.",
            reactions: "3 reactions",
            comments: [["Mom", "Works for me. Kai can sleep in the bunk room."]]
          })}
          ${post({
            author: "Lena",
            title: "Recital photos",
            text: "Added the best photos. The group shot is my favorite.",
            reactions: "8 reactions",
            comments: [["Grandma", "Saved it. Beautiful."]]
          })}
        </section>
      </section>
    </main>
  `);
}

function buildComponentSpecHtml() {
  return htmlPage(`
    <main class="spec-page">
      <header>
        <p class="eyebrow">Component spec</p>
        <h1>HeyFam UI primitives</h1>
        <p>Use small, direct controls that feel private and calm.</p>
      </header>
      <section class="spec-stack">
        <article class="spec-card">
          <span class="mini-label">Buttons</span>
          <div class="button-row">
            <button class="primary">Primary</button>
            <button class="secondary">Secondary</button>
            <button class="ghost">Ghost</button>
          </div>
          <p>Primary for creation and posting. Secondary for alternate routes. Ghost for low-risk utility actions.</p>
        </article>
        <article class="spec-card">
          <span class="mini-label">Inputs</span>
          ${inputRow("Label", "Value")}
          <p>Labels stay above the value. Helper text is specific and never repeats the label.</p>
        </article>
        <article class="spec-card">
          <span class="mini-label">Cards</span>
          <div class="moment compact">
            <strong>Dinner tonight</strong>
            <p>Important family content should be readable in one scan.</p>
          </div>
          <p>Cards use hairline borders, subtle fill, and 16px radius on product screens.</p>
        </article>
        <article class="spec-card">
          <span class="mini-label">Text</span>
          <h2>Plain family utility.</h2>
          <p>Copy should say what the family can do now: decide, answer, remember, or plan.</p>
        </article>
      </section>
    </main>
  `);
}

function buildDesignTokensHtml() {
  return htmlPage(`
    <main class="tokens-page">
      <header>
        <p class="eyebrow">Design system</p>
        <h1>Tokens for a warm, practical family product</h1>
      </header>
      <section class="token-grid">
        <article class="token-card">
          <span class="mini-label">Color</span>
          <div class="swatches">
            ${swatch("Canvas", "oklch(0.985 0.012 78)", "canvas")}
            ${swatch("Surface", "oklch(0.996 0.006 78)", "surface")}
            ${swatch("Ink", "oklch(0.22 0.012 252)", "ink")}
            ${swatch("Teal", "oklch(0.46 0.062 172)", "teal")}
            ${swatch("Rose", "oklch(0.64 0.09 28)", "rose")}
            ${swatch("Amber", "oklch(0.72 0.11 74)", "amber")}
          </div>
        </article>
        <article class="token-card">
          <span class="mini-label">Space</span>
          <div class="space-row"><i style="width:4px"></i><span>4</span></div>
          <div class="space-row"><i style="width:8px"></i><span>8</span></div>
          <div class="space-row"><i style="width:12px"></i><span>12</span></div>
          <div class="space-row"><i style="width:16px"></i><span>16</span></div>
          <div class="space-row"><i style="width:24px"></i><span>24</span></div>
        </article>
        <article class="token-card">
          <span class="mini-label">Elevation</span>
          <div class="elevation e0">Hairline only</div>
          <div class="elevation e1">Raised preview</div>
          <div class="elevation e2">Active overlay</div>
        </article>
        <article class="token-card">
          <span class="mini-label">Type</span>
          <h2>Display 34/1.02</h2>
          <h3>Section 20/1.2</h3>
          <p>Body 15/1.45 for everyday reading.</p>
          <small>Meta 12 uppercase for state labels.</small>
        </article>
      </section>
    </main>
  `);
}

function inputRow(label: string, value: string) {
  return `
    <label class="field">
      <span>${label}</span>
      <input value="${value}" readonly />
    </label>
  `;
}

function iconPicker() {
  return `
    <div class="field">
      <span>Icon</span>
      <div class="icon-options">
        <button type="button" class="icon-option is-active">P</button>
        <button type="button" class="icon-option">H</button>
        <button type="button" class="icon-option">S</button>
        <button type="button" class="icon-option">+</button>
      </div>
    </div>
  `;
}

function colorPicker() {
  return `
    <div class="field">
      <span>Color</span>
      <div class="color-options">
        <i class="color-dot teal"></i>
        <i class="color-dot rose"></i>
        <i class="color-dot amber"></i>
        <i class="color-dot sage"></i>
      </div>
    </div>
  `;
}

function peopleInput() {
  return `
    <div class="field">
      <span>People</span>
      <div class="chips">
        <b>Mom</b>
        <b>Dad</b>
        <b>Lena</b>
        <b>Jordan</b>
        <b>+ Add person</b>
      </div>
    </div>
  `;
}

function avatar(label: string, initial: string, tone: string) {
  return `<span class="avatar ${tone}" title="${label}">${initial}</span>`;
}

function post({
  author,
  title,
  text,
  reactions,
  comments
}: {
  author: string;
  title: string;
  text: string;
  reactions: string;
  comments: [string, string][];
}) {
  return `
    <article class="post">
      <header>
        <span class="author">${author}</span>
        <span>Just now</span>
      </header>
      <strong>${title}</strong>
      <p>${text}</p>
      <div class="reaction-row">
        <button class="reaction">Heart</button>
        <button class="reaction">Thanks</button>
        <span>${reactions}</span>
      </div>
      <div class="comments">
        ${comments.map(([name, comment]) => `<p><b>${name}</b> ${comment}</p>`).join("")}
      </div>
    </article>
  `;
}

function swatch(label: string, value: string, tone: string) {
  return `
    <div class="swatch">
      <i class="${tone}"></i>
      <span>${label}</span>
      <code>${value}</code>
    </div>
  `;
}

function htmlPage(body: string) {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        color-scheme: light;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        color: oklch(0.22 0.012 252);
        background: oklch(0.982 0.012 78);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
      }

      button,
      input {
        font: inherit;
      }

      button {
        border-radius: 14px;
        border: 1px solid transparent;
        font-size: 14px;
        font-weight: 760;
        height: 42px;
        padding: 0 16px;
      }

      .screen,
      .spec-page,
      .tokens-page {
        background: oklch(0.982 0.012 78);
        min-height: 100vh;
      }

      .screen {
        padding: 20px;
      }

      .screen.mobile {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .screen.desktop {
        display: grid;
        gap: 24px;
        grid-template-rows: auto 1fr;
        padding: 28px 34px;
      }

      .topbar {
        align-items: center;
        display: flex;
        justify-content: space-between;
      }

      .topbar strong {
        font-size: 16px;
      }

      .topbar span,
      .topbar button {
        color: oklch(0.44 0.014 252);
        font-size: 13px;
      }

      .hero {
        max-width: 600px;
      }

      .desktop.home {
        background:
          linear-gradient(90deg, oklch(0.994 0.007 78) 0 58%, oklch(0.948 0.03 172) 58% 100%);
      }

      .desktop.home .hero {
        align-self: center;
        grid-column: 1;
      }

      .desktop.home .preview-grid {
        align-self: center;
        display: grid;
        gap: 14px;
        grid-column: 2;
      }

      .eyebrow,
      .mini-label {
        color: oklch(0.44 0.062 172);
        font-size: 11px;
        font-weight: 820;
        letter-spacing: 0;
        text-transform: uppercase;
      }

      h1 {
        font-size: clamp(32px, 6vw, 54px);
        letter-spacing: 0;
        line-height: 1.02;
        margin: 12px 0;
      }

      .desktop h1 {
        font-size: 48px;
        max-width: 12ch;
      }

      h2 {
        font-size: 24px;
        letter-spacing: 0;
        line-height: 1.1;
        margin: 8px 0;
      }

      h3 {
        font-size: 18px;
        margin: 8px 0;
      }

      p {
        color: oklch(0.43 0.014 252);
        font-size: 15px;
        line-height: 1.45;
        margin: 0;
      }

      .lede {
        font-size: 17px;
        max-width: 48ch;
      }

      .actions,
      .button-row,
      .reaction-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }

      .actions {
        margin-top: 22px;
      }

      .primary {
        background: oklch(0.46 0.062 172);
        border-color: oklch(0.42 0.06 172);
        color: oklch(0.985 0.01 78);
      }

      .secondary {
        background: oklch(0.996 0.006 78);
        border-color: oklch(0.82 0.018 78);
        color: oklch(0.24 0.012 252);
      }

      .ghost,
      .reaction {
        background: transparent;
        border-color: oklch(0.82 0.018 78);
        color: oklch(0.3 0.012 252);
      }

      .wide {
        width: 100%;
      }

      .stack,
      .feed,
      .spec-stack {
        display: grid;
        gap: 12px;
      }

      .moment,
      .form-card,
      .live-preview,
      .people-panel,
      .post,
      .spec-card,
      .token-card {
        background: oklch(0.997 0.005 78);
        border: 1px solid oklch(0.84 0.018 78);
        border-radius: 18px;
      }

      .moment,
      .people-panel,
      .post,
      .spec-card,
      .token-card {
        padding: 16px;
      }

      .moment.compact {
        margin: 10px 0;
      }

      .moment strong,
      .post strong {
        display: block;
        font-size: 18px;
        line-height: 1.18;
        margin: 5px 0;
      }

      footer {
        color: oklch(0.47 0.014 252);
        font-size: 12px;
        margin-top: auto;
      }

      .form-layout {
        display: grid;
        gap: 20px;
      }

      .desktop .form-layout {
        align-items: start;
        grid-template-columns: 1fr 0.78fr;
      }

      .form-card {
        display: grid;
        gap: 14px;
        padding: 18px;
      }

      .field {
        display: grid;
        gap: 7px;
      }

      .field > span {
        color: oklch(0.42 0.014 252);
        font-size: 12px;
        font-weight: 760;
      }

      input {
        background: oklch(0.985 0.008 78);
        border: 1px solid oklch(0.8 0.018 78);
        border-radius: 12px;
        color: oklch(0.22 0.012 252);
        height: 42px;
        padding: 0 12px;
        width: 100%;
      }

      .icon-options,
      .color-options,
      .chips,
      .avatars,
      .swatches {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .icon-option,
      .avatar,
      .preview-icon {
        align-items: center;
        border-radius: 999px;
        display: inline-flex;
        font-weight: 820;
        justify-content: center;
      }

      .icon-option {
        background: oklch(0.965 0.018 78);
        border: 1px solid oklch(0.82 0.018 78);
        height: 40px;
        padding: 0;
        width: 40px;
      }

      .icon-option.is-active,
      .preview-icon {
        background: oklch(0.46 0.062 172);
        color: oklch(0.985 0.01 78);
      }

      .color-dot {
        border: 2px solid oklch(0.997 0.005 78);
        border-radius: 999px;
        box-shadow: 0 0 0 1px oklch(0.78 0.018 78);
        height: 30px;
        width: 30px;
      }

      .teal {
        background: oklch(0.46 0.062 172);
      }

      .rose {
        background: oklch(0.64 0.09 28);
      }

      .amber {
        background: oklch(0.72 0.11 74);
      }

      .sage {
        background: oklch(0.62 0.05 142);
      }

      .ink {
        background: oklch(0.22 0.012 252);
      }

      .surface {
        background: oklch(0.996 0.006 78);
      }

      .canvas {
        background: oklch(0.985 0.012 78);
      }

      .chips b {
        background: oklch(0.965 0.018 78);
        border: 1px solid oklch(0.82 0.018 78);
        border-radius: 999px;
        font-size: 12px;
        padding: 8px 10px;
      }

      .live-preview {
        display: grid;
        gap: 12px;
        padding: 20px;
      }

      .preview-icon {
        font-size: 22px;
        height: 58px;
        width: 58px;
      }

      .preview-feed {
        display: grid;
        gap: 8px;
      }

      .preview-feed span {
        border-top: 1px solid oklch(0.84 0.018 78);
        font-size: 13px;
        font-weight: 720;
        padding-top: 8px;
      }

      .wall-layout {
        display: grid;
        gap: 18px;
        grid-template-columns: 240px 1fr;
      }

      .people-panel {
        align-self: start;
        display: grid;
        gap: 14px;
      }

      .avatar {
        color: oklch(0.985 0.01 78);
        font-size: 13px;
        height: 34px;
        width: 34px;
      }

      .post {
        display: grid;
        gap: 10px;
      }

      .post header {
        align-items: center;
        color: oklch(0.5 0.014 252);
        display: flex;
        font-size: 12px;
        justify-content: space-between;
      }

      .author {
        color: oklch(0.26 0.012 252);
        font-weight: 800;
      }

      .reaction {
        font-size: 12px;
        height: 30px;
        padding: 0 10px;
      }

      .reaction-row span {
        align-self: center;
        color: oklch(0.48 0.014 252);
        font-size: 12px;
      }

      .comments {
        border-top: 1px solid oklch(0.86 0.018 78);
        display: grid;
        gap: 7px;
        padding-top: 10px;
      }

      .comments p {
        font-size: 13px;
      }

      .spec-page,
      .tokens-page {
        padding: 24px;
      }

      .spec-page header,
      .tokens-page header {
        margin-bottom: 18px;
      }

      .spec-page h1,
      .tokens-page h1 {
        font-size: 30px;
        line-height: 1.05;
        margin: 8px 0;
      }

      .spec-card {
        display: grid;
        gap: 10px;
      }

      .token-grid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .token-card {
        min-height: 260px;
      }

      .swatches {
        margin-top: 12px;
      }

      .swatch {
        display: grid;
        gap: 6px;
        width: calc(50% - 4px);
      }

      .swatch i {
        border: 1px solid oklch(0.78 0.018 78);
        border-radius: 12px;
        display: block;
        height: 46px;
      }

      .swatch span {
        font-size: 12px;
        font-weight: 800;
      }

      code,
      small {
        color: oklch(0.48 0.014 252);
        font-size: 11px;
      }

      .space-row {
        align-items: center;
        display: flex;
        gap: 10px;
        margin-top: 10px;
      }

      .space-row i {
        background: oklch(0.46 0.062 172);
        border-radius: 3px;
        display: block;
        height: 20px;
      }

      .space-row span {
        font-size: 12px;
        font-weight: 800;
      }

      .elevation {
        background: oklch(0.997 0.005 78);
        border: 1px solid oklch(0.84 0.018 78);
        border-radius: 14px;
        font-size: 13px;
        font-weight: 760;
        margin-top: 12px;
        padding: 14px;
      }

      .e1 {
        box-shadow: 0 10px 24px oklch(0.34 0.018 70 / 0.1);
      }

      .e2 {
        box-shadow: 0 18px 46px oklch(0.34 0.018 70 / 0.16);
      }
    </style>
  </head>
  <body>${body}</body>
</html>
`;
}
