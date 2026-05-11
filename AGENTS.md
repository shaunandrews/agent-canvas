# Agent Canvas Instructions

This repo contains the reusable `@agent-canvas/react` package. When another project should use Agent Canvas, prefer a direct native integration instead of keeping adapter layers unless the user asks for caution.

## Mental Model

- The canvas is a `CanvasDocument`: `{ schemaVersion, id, title, width, height, nodes, edges?, metadata? }`.
- Every visible artifact is a `CanvasNode`.
- AI changes should be expressed as typed `CanvasOperation` records.
- Host apps own storage, sync, auth, and agent runtime. This package owns canvas rendering, viewport behavior, operation helpers, and context summaries.

## Common Integration Steps

1. Build this package:
   ```bash
   npm run build
   ```

2. Add it to the host app:
   ```bash
   npm install /Users/shaun/Developer/Projects/agent-canvas
   ```

3. Import the canvas and styles:
   ```tsx
   import { AgentCanvas } from "@agent-canvas/react";
   import "@agent-canvas/react/styles.css";
   ```

4. Store native Agent Canvas JSON in the host app. Do not keep old `frames` or app-specific canvas schemas unless explicitly requested.

5. Render:
   ```tsx
   <AgentCanvas
     document={document}
     onDocumentChange={setDocument}
     onSelectionChange={setSelection}
   />
   ```

6. Let agents send operations such as:
   ```json
   { "type": "createNode", "node": { "id": "brief", "type": "document", "x": 120, "y": 120, "width": 480, "height": 320, "content": { "markdown": "# Brief" } } }
   ```

7. Use `getAgentContext()` when constructing prompts. It returns selected nodes, visible nodes, viewport, and offscreen count.

## Node Types

Use these native types before inventing custom types:

- `document`: markdown, html, or excerpt
- `text`: short notes and labels
- `image`: screenshots, generated images, photos
- `video`: playable media
- `website`: URL or `srcDoc` preview
- `file`: artifact handoff records
- `section`: spatial containers for related nodes

Put nodes inside sections by setting `parentId` to the section id. Do not maintain separate `children` arrays.

When app-specific rendering is needed, keep the node type native and pass custom renderers through `renderers`.

## Server Notes

The helpers in `src/lib/core` are pure and can run in non-React environments. The package is ESM. If a host server is still CommonJS, either migrate it to ESM or mirror the small operation logic locally until the server is converted.

## Verification

Always run:

```bash
npm run verify
```

For visual changes, run the demo and then:

```bash
npm run verify:render -- http://127.0.0.1:<port>/
```
