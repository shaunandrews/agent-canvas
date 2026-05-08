import { createCanvasDocument, type CanvasDocument } from "../lib";

const sampleImage = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 460">
  <rect width="720" height="460" fill="oklch(0.94 0.006 255)" />
  <rect x="56" y="52" width="608" height="356" rx="18" fill="oklch(0.985 0.003 255)" stroke="oklch(0.78 0.01 255)" />
  <rect x="94" y="96" width="260" height="28" fill="oklch(0.34 0.04 188)" />
  <rect x="94" y="150" width="520" height="16" fill="oklch(0.72 0.01 255)" />
  <rect x="94" y="184" width="470" height="16" fill="oklch(0.78 0.008 255)" />
  <rect x="94" y="238" width="152" height="108" fill="oklch(0.9 0.025 188)" />
  <rect x="282" y="238" width="152" height="108" fill="oklch(0.86 0.025 80)" />
  <rect x="470" y="238" width="144" height="108" fill="oklch(0.9 0.02 330)" />
</svg>
`)}`;

const previewHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        color-scheme: light;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        color: oklch(0.22 0.006 260);
        background: oklch(0.99 0.003 260);
      }
      body {
        margin: 0;
        padding: 34px;
      }
      main {
        border: 1px solid oklch(0.84 0.004 260);
        min-height: 100vh;
        padding: 36px;
      }
      span {
        color: oklch(0.52 0.006 260);
        font-size: 12px;
        font-weight: 750;
        text-transform: uppercase;
      }
      h1 {
        font-size: 44px;
        letter-spacing: 0;
        line-height: 1;
        margin: 24px 0 18px;
        max-width: 600px;
      }
      p {
        font-size: 18px;
        line-height: 1.45;
        max-width: 610px;
      }
      nav {
        border-top: 1px solid oklch(0.84 0.004 260);
        display: grid;
        gap: 12px;
        margin-top: 36px;
        padding-top: 18px;
      }
      b {
        font-size: 15px;
      }
    </style>
  </head>
  <body>
    <main>
      <span>Family.blog</span>
      <h1>A private place for the plans your family keeps asking about.</h1>
      <p>Dinner, travel, forms, photos, and decisions stay findable without asking one person to route every update.</p>
      <nav>
        <b>Dinner tonight</b>
        <b>Summer trip</b>
        <b>College visits</b>
      </nav>
    </main>
  </body>
</html>
`;

export const initialDocument: CanvasDocument = createCanvasDocument({
  id: "agent-canvas-demo",
  title: "Agent Canvas demo",
  width: 2800,
  height: 1900,
  nodes: [
    {
      id: "context-cluster",
      type: "group",
      x: 70,
      y: 80,
      width: 1780,
      height: 1120,
      title: "Family.blog concept",
      description: "Working area for source notes, generated previews, and media.",
      zIndex: 0,
      content: {
        label: "Family.blog concept",
        children: ["premise", "site-preview", "dinner-media", "handoff"]
      }
    },
    {
      id: "premise",
      type: "document",
      x: 130,
      y: 150,
      width: 560,
      height: 410,
      title: "Premise",
      tags: ["family-blog", "source"],
      zIndex: 2,
      content: {
        markdown: `# Start with real family moments.

Not a family OS. Not pages. Dinner, vacation, and college prep are concrete situations where the family needs a shared answer that can change over time.

- Input: quick text or messy source material
- Family value: fewer repeated questions
- Canvas value: durable spatial artifacts`
      }
    },
    {
      id: "site-preview",
      type: "website",
      x: 760,
      y: 150,
      width: 720,
      height: 520,
      title: "Generated homepage",
      tags: ["preview", "website"],
      zIndex: 3,
      content: {
        srcDoc: previewHtml,
        caption: "A live website preview can sit beside the source notes that produced it."
      }
    },
    {
      id: "dinner-media",
      type: "image",
      x: 130,
      y: 650,
      width: 560,
      height: 360,
      title: "Dinner plan media",
      tags: ["media"],
      zIndex: 4,
      content: {
        src: sampleImage,
        alt: "Abstract document screenshot with three colored content blocks.",
        caption: "Media nodes keep screenshots, photos, and generated images in the same coordinate system."
      }
    },
    {
      id: "handoff",
      type: "file",
      x: 760,
      y: 740,
      width: 340,
      height: 260,
      title: "Homepage copy",
      tags: ["docx", "handoff"],
      zIndex: 5,
      content: {
        name: "family-blog-homepage.docx",
        mimeType: "DOCX",
        sizeLabel: "42 KB",
        summary: "A handoff artifact created from the board state."
      }
    },
    {
      id: "agent-note",
      type: "text",
      x: 1540,
      y: 220,
      width: 360,
      height: 220,
      title: "Agent note",
      tags: ["agent"],
      zIndex: 6,
      content: {
        tone: "note",
        text: "The model sees structured node records plus visible spatial context, then returns typed operations."
      }
    }
  ]
});
