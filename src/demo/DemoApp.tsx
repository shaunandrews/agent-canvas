import { useMemo, useRef, useState } from "react";
import { FilePlus2, Focus, Globe2, ListTree, LocateFixed, SquarePlus } from "lucide-react";
import {
  AgentCanvas,
  type AgentCanvasHandle,
  type CanvasDocument,
  type CanvasNode,
  type CanvasOperation
} from "../lib";
import { initialDocument } from "./sampleCanvas";

export function DemoApp() {
  const canvasRef = useRef<AgentCanvasHandle>(null);
  const [document, setDocument] = useState<CanvasDocument>(initialDocument);
  const [selection, setSelection] = useState<string[]>(["premise"]);
  const [agentContext, setAgentContext] = useState("{}");
  const selectedNode = useMemo(
    () => document.nodes.find((node) => node.id === selection[0]),
    [document.nodes, selection]
  );

  function runOperations(operations: CanvasOperation[]) {
    const results = canvasRef.current?.applyOperations(operations) || [];
    setAgentContext(JSON.stringify({ results, context: canvasRef.current?.getAgentContext() }, null, 2));
  }

  function addDocumentNode() {
    const viewport = canvasRef.current?.getSnapshot().viewport || { x: 0, y: 0, scale: 1 };
    const id = `doc-${Date.now()}`;
    const node: CanvasNode = {
      id,
      type: "document",
      x: (-viewport.x + 180) / viewport.scale,
      y: (-viewport.y + 180) / viewport.scale,
      width: 440,
      height: 320,
      title: "New agent document",
      tags: ["agent-created"],
      content: {
        markdown: `# Draft artifact

This node was created through the same operation API an AI agent can call.

- Operation: createNode
- Renderer: document
- Next step: host app persists the snapshot`
      }
    };
    runOperations([{ type: "createNode", node }, { type: "focus", id }]);
  }

  function addWebsiteNode() {
    const id = `website-${Date.now()}`;
    runOperations([
      {
        type: "createNode",
        node: {
          id,
          type: "website",
          x: 1220,
          y: 760,
          width: 520,
          height: 360,
          title: "Inline prototype",
          tags: ["agent-created", "website"],
          content: {
            srcDoc: "<main style='font-family:system-ui;padding:32px;color:oklch(0.22 0.006 260);background:oklch(0.99 0.003 260)'><h1 style='font-size:34px;line-height:1;margin:0 0 16px'>Generated prototype</h1><p style='font-size:18px;line-height:1.4'>A website node can render srcDoc or a URL.</p><button style='font:inherit;padding:10px 14px;border:1px solid oklch(0.7 0.004 260);background:oklch(0.96 0.003 260)'>Review</button></main>",
            caption: "Generated HTML preview."
          }
        }
      },
      { type: "focus", id }
    ]);
  }

  function summarizeContext() {
    setAgentContext(JSON.stringify(canvasRef.current?.getAgentContext(), null, 2));
  }

  function focusSelected() {
    if (selection[0]) canvasRef.current?.focusNode(selection[0]);
  }

  return (
    <main className="demo-shell">
      <AgentCanvas
        ref={canvasRef}
        document={document}
        selectedNodeIds={selection}
        onDocumentChange={(nextDocument) => setDocument(nextDocument)}
        onSelectionChange={setSelection}
      />

      <aside className="demo-panel" aria-label="Canvas inspector">
        <header>
          <span>Agent Canvas</span>
          <strong>Artifact board</strong>
        </header>

        <section>
          <h2>Selection</h2>
          {selectedNode ? (
            <dl>
              <dt>ID</dt>
              <dd>{selectedNode.id}</dd>
              <dt>Type</dt>
              <dd>{selectedNode.type}</dd>
              <dt>Bounds</dt>
              <dd>
                {Math.round(selectedNode.x)}, {Math.round(selectedNode.y)} · {selectedNode.width} × {selectedNode.height}
              </dd>
            </dl>
          ) : (
            <p className="demo-muted">No node selected.</p>
          )}
        </section>

        <section>
          <h2>Operations</h2>
          <div className="demo-actions">
            <button type="button" onClick={addDocumentNode}>
              <FilePlus2 size={15} />
              Add document
            </button>
            <button type="button" onClick={addWebsiteNode}>
              <Globe2 size={15} />
              Add website
            </button>
            <button type="button" onClick={() => runOperations([{ type: "bringToFront", id: selection[0] }])} disabled={!selection[0]}>
              <SquarePlus size={15} />
              Bring front
            </button>
            <button type="button" onClick={focusSelected} disabled={!selection[0]}>
              <Focus size={15} />
              Focus
            </button>
            <button type="button" onClick={summarizeContext}>
              <ListTree size={15} />
              Context
            </button>
            <button type="button" onClick={() => canvasRef.current?.fitView()}>
              <LocateFixed size={15} />
              Fit
            </button>
          </div>
        </section>

        <section className="demo-context">
          <h2>Agent Context</h2>
          <pre>{agentContext}</pre>
        </section>
      </aside>
    </main>
  );
}
