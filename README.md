# Agent Canvas

Reusable React infinite canvas for AI-generated documents, media, websites, and visual artifacts.

This package starts from the useful Family.blog prototype ideas: a plain working surface, pan and zoom, JSON-driven frames, live-updatable state, and a small command surface an AI can drive. It borrows architectural lessons from tldraw without depending on it: shape records, an editor-like imperative API, snapshots, custom renderers, and structured summaries for model context.

## Install

```bash
npm install @agent-canvas/react
```

## Use

```tsx
import { AgentCanvas, createCanvasDocument } from "@agent-canvas/react";
import "@agent-canvas/react/styles.css";

const document = createCanvasDocument({
  title: "Research board",
  nodes: [
    {
      id: "brief",
      type: "document",
      x: 120,
      y: 120,
      width: 520,
      height: 360,
      title: "Brief",
      content: { markdown: "Collect the important findings here." }
    }
  ]
});

export function App() {
  return <AgentCanvas document={document} />;
}
```

## AI Control

`AgentCanvas` exposes a small imperative handle:

- `getSnapshot()` returns the full document, viewport, selection, and visible node ids.
- `applyOperations(operations)` applies validated create/update/delete/select/focus operations.
- `getAgentContext()` returns compact structured context for an AI prompt.
- `fitView()` and `focusNode(id)` control the camera.

The pure helpers in `src/lib/core` can also run on a server before broadcasting updated snapshots to clients.

## Integrating Into Another App

Use the native Agent Canvas document shape in the host app. Avoid long-lived adapters from older `frames` or whiteboard schemas unless you need a staged migration.

1. Build this package:
   ```bash
   npm run build
   ```

2. Install it into the host app:
   ```bash
   npm install /Users/shaun/Developer/Projects/agent-canvas
   ```

3. Import the component and CSS:
   ```tsx
   import { AgentCanvas } from "@agent-canvas/react";
   import "@agent-canvas/react/styles.css";
   ```

4. Store canvas JSON like this:
   ```json
   {
     "schemaVersion": 1,
     "id": "family-blog",
     "title": "Family.blog planning board",
     "width": 2800,
     "height": 3600,
     "nodes": []
   }
   ```

5. Replace old routes and scripts around `frames` with native node operations:
   - `POST /api/nodes`
   - `PATCH /api/nodes/:id`
   - `DELETE /api/nodes/:id`
   - `POST /api/operations` with `createNode`, `updateNode`, `deleteNode`, `bringToFront`, `sendToBack`, `select`, `focus`, and `setViewport`

6. Give agents these rules:
   - Use native node types: `document`, `text`, `image`, `video`, `website`, `file`, `group`.
   - Put app-specific details in `metadata`, not in custom top-level fields.
   - Use custom React renderers for app-specific presentation while keeping the data schema portable.
   - Call `getAgentContext()` before deciding what to change.

See [AGENTS.md](./AGENTS.md) for a more operational checklist.

## Why Not Use tldraw Directly?

tldraw is excellent and much deeper. This package is intentionally narrower: first-class AI artifacts, permissive package ownership, host-controlled persistence, and a smaller API surface that can be embedded in other agent tools. A future adapter could render Agent Canvas records inside tldraw, but the core schema here stays independent.
