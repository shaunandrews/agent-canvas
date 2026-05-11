import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  FilePlus2,
  Focus,
  Globe2,
  ListTree,
  LocateFixed,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  RotateCcw,
  SquarePlus,
  StepForward
} from "lucide-react";
import {
  AgentCanvas,
  placeCanvasNode,
  type AgentCanvasHandle,
  type AgentCanvasRendererProps,
  type AgentCanvasRenderers,
  type AgentCanvasSnapshot,
  type CanvasDocument,
  type CanvasNode,
  type CanvasOperation,
  type CanvasSnapOptions,
  type CanvasViewport,
  type DocumentCanvasNode,
  type FileCanvasNode,
  type TextCanvasNode,
  type WebsiteCanvasNode
} from "../lib";
import { initialDocument } from "./sampleCanvas";

type LiveStep = {
  label: string;
  detail: string;
  targetLabel: string;
  makeOperations: (snapshot: AgentCanvasSnapshot) => CanvasOperation[];
};

type OperationLogEntry = {
  id: string;
  label: string;
  detail: string;
  operations: string[];
  ok: boolean;
  time: string;
};

type RemoteOperationMessage = {
  id?: string;
  label?: string;
  detail?: string;
  operations?: CanvasOperation[];
};

type ControlStatus = "connecting" | "connected" | "offline";

type DemoState = {
  document: CanvasDocument;
  selection: string[];
  viewport: CanvasViewport;
  agentContext: string;
  followLiveFocus: boolean;
  inspectorOpen: boolean;
  liveStepIndex: number;
  lastLiveStepIndex: number | null;
  operationLog: OperationLogEntry[];
};

type StoredDemoState = DemoState & {
  version: 1;
};

const DEMO_STATE_KEY = "agent-canvas-demo-state-v1";
const DEFAULT_VIEWPORT: CanvasViewport = { x: 72, y: 72, scale: 1 };
const LIVE_INTERVAL_MS = 900;
const STREAM_NODE_ID = "live-synthesis";
const CONTROL_EVENTS_URL = "http://127.0.0.1:8787/events";
const CONTROL_SNAPSHOT_URL = "http://127.0.0.1:8787/snapshot";
const CONTROL_LABEL = "127.0.0.1:8787";
const DEMO_SNAP_OPTIONS: CanvasSnapOptions = {
  enabled: true,
  grid: { enabled: true, size: 24 },
  alignment: { enabled: true, targets: ["edge", "center"] },
  showGuides: true,
  thresholdPx: 8
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

const STREAM_MARKDOWN = {
  empty: "",
  opening: `# Live synthesis

A shared answer should appear while the agent is still working, not only after the artifact is complete.`,
  context: `# Live synthesis

A shared answer should appear while the agent is still working, not only after the artifact is complete.

The source board points to three concrete family moments: dinner, travel, and deadlines. Each one benefits from a visible artifact that can be corrected in place.`,
  bullets: `# Live synthesis

A shared answer should appear while the agent is still working, not only after the artifact is complete.

The source board points to three concrete family moments: dinner, travel, and deadlines. Each one benefits from a visible artifact that can be corrected in place.

- Create the document shell immediately
- Mark the node as editing while patches arrive
- Stream content through updateNode operations
- Leave the viewer's camera alone unless follow focus is enabled`,
  complete: `# Live synthesis

A shared answer should appear while the agent is still working, not only after the artifact is complete.

The source board points to three concrete family moments: dinner, travel, and deadlines. Each one benefits from a visible artifact that can be corrected in place.

- Create the document shell immediately
- Mark the node as editing while patches arrive
- Stream content through updateNode operations
- Leave the viewer's camera alone unless follow focus is enabled

The host app can persist every intermediate snapshot or only the final one. The canvas can show both.`
};

const LIVE_STEPS: LiveStep[] = [
  {
    label: "Read visible context",
    detail: "Updates the agent note from the current canvas state.",
    targetLabel: "Agent note",
    makeOperations: ({ document }) => [
      {
        type: "updateNode",
        id: "agent-note",
        patch: {
          title: "Agent reading context",
          content: {
            tone: "note",
            text: `Context pass complete. ${document.nodes.length} nodes are available, with source notes and generated artifacts kept as typed records.`
          }
        } as Partial<CanvasNode>
      },
      { type: "focus", id: "agent-note" }
    ]
  },
  {
    label: "Open draft container",
    detail: "Creates the document shell before the content is ready.",
    targetLabel: "Live synthesis",
    makeOperations: (snapshot) => makeStreamingDocumentOperations(snapshot, STREAM_MARKDOWN.empty, 5, "Opening editable container")
  },
  {
    label: "Stream opening",
    detail: "Patches the same document with the first generated paragraph.",
    targetLabel: "Live synthesis",
    makeOperations: (snapshot) => makeStreamingDocumentOperations(snapshot, STREAM_MARKDOWN.opening, 28, "Writing opening")
  },
  {
    label: "Stream context",
    detail: "Adds context notes into the existing node.",
    targetLabel: "Live synthesis",
    makeOperations: (snapshot) => makeStreamingDocumentOperations(snapshot, STREAM_MARKDOWN.context, 52, "Adding source context")
  },
  {
    label: "Stream checklist",
    detail: "Adds the working checklist while the node remains editable.",
    targetLabel: "Live synthesis",
    makeOperations: (snapshot) => makeStreamingDocumentOperations(snapshot, STREAM_MARKDOWN.bullets, 78, "Adding checklist")
  },
  {
    label: "Complete synthesis",
    detail: "Marks the streamed document complete without replacing it.",
    targetLabel: "Live synthesis",
    makeOperations: (snapshot) => makeStreamingDocumentOperations(snapshot, STREAM_MARKDOWN.complete, 100, "Complete", "complete")
  },
  {
    label: "Plan next edits",
    detail: "Creates a compact text node beside the synthesis.",
    targetLabel: "Next operations",
    makeOperations: ({ document }) => {
      const streamNode = document.nodes.find((item) => item.id === STREAM_NODE_ID);
      const node: CanvasNode = {
        id: "live-plan",
        type: "text",
        x: (streamNode?.x || 1540) + (streamNode?.width || 540) + 40,
        y: streamNode?.y || 520,
        width: 360,
        height: 210,
        title: "Next operations",
        tags: ["agent", "live"],
        content: {
          tone: "note",
          text: "Tighten homepage copy, update the handoff summary, then export the current board state."
        }
      };

      return nodeExists(document, node.id)
        ? [
            {
              type: "updateNode",
              id: node.id,
              patch: {
                content: node.content,
                title: node.title
              } as Partial<CanvasNode>
            },
            { type: "focus", id: node.id }
          ]
        : [{ type: "createNode", node }, { type: "focus", id: node.id }];
    }
  },
  {
    label: "Refresh prototype",
    detail: "Rewrites the website preview srcDoc in place.",
    targetLabel: "Website preview",
    makeOperations: () => [
      {
        type: "updateNode",
        id: "site-preview",
        patch: {
          title: "Updated homepage draft",
          content: {
            srcDoc: buildLivePreviewHtml(),
            caption: "Updated by a live operation from the demo runner."
          }
        } as Partial<CanvasNode>
      },
      { type: "focus", id: "site-preview" }
    ]
  },
  {
    label: "Reposition handoff",
    detail: "Moves the file node into the active work area.",
    targetLabel: "Homepage copy package",
    makeOperations: ({ document }) => {
      const streamNode = document.nodes.find((item) => item.id === STREAM_NODE_ID);
      return [
        {
          type: "updateNode",
          id: "handoff",
          patch: {
            x: streamNode?.x || 1540,
            y: (streamNode?.y || 520) + (streamNode?.height || 380) + 40,
            width: 390,
            height: 260
          }
        },
        { type: "bringToFront", id: "handoff" },
        { type: "focus", id: "handoff" }
      ];
    }
  },
  {
    label: "Update handoff",
    detail: "Patches file metadata after the prototype changes.",
    targetLabel: "Homepage copy package",
    makeOperations: () => [
      {
        type: "updateNode",
        id: "handoff",
        patch: {
          title: "Homepage copy package",
          content: {
            name: "family-blog-homepage-v2.docx",
            mimeType: "DOCX",
            sizeLabel: "48 KB",
            summary: "Copy package refreshed from the live synthesis and updated website preview."
          }
        } as Partial<CanvasNode>
      },
      { type: "focus", id: "handoff" }
    ]
  },
  {
    label: "Export board state",
    detail: "Adds a file artifact that represents a host-side save.",
    targetLabel: "Canvas snapshot",
    makeOperations: ({ document }) => {
      const streamNode = document.nodes.find((item) => item.id === STREAM_NODE_ID);
      const node: CanvasNode = {
        id: "live-export",
        type: "file",
        x: (streamNode?.x || 1540) + 430,
        y: (streamNode?.y || 520) + (streamNode?.height || 380) + 40,
        width: 370,
        height: 260,
        title: "Canvas snapshot",
        tags: ["agent", "live", "snapshot"],
        content: {
          name: "agent-canvas-snapshot.json",
          mimeType: "JSON",
          sizeLabel: `${document.nodes.length + 1} nodes`,
          summary: "A portable CanvasDocument snapshot ready for the host app to persist."
        }
      };

      return nodeExists(document, node.id)
        ? [
            {
              type: "updateNode",
              id: node.id,
              patch: {
                content: node.content,
                title: node.title
              } as Partial<CanvasNode>
            },
            { type: "focus", id: node.id }
          ]
        : [{ type: "createNode", node }, { type: "focus", id: node.id }];
    }
  },
  {
    label: "Select outputs",
    detail: "Selects the produced nodes and refreshes agent context.",
    targetLabel: "Produced nodes",
    makeOperations: () => [{ type: "select", ids: [STREAM_NODE_ID, "site-preview", "live-export"] }]
  }
];

export function DemoApp() {
  const [initialDemoState] = useState<DemoState>(() => readDemoState());
  const canvasRef = useRef<AgentCanvasHandle>(null);
  const liveStepRef = useRef(initialDemoState.liveStepIndex);
  const activeNodeTimeoutRef = useRef<number | undefined>(undefined);
  const remoteEventIdsRef = useRef<Set<string>>(new Set());
  const [document, setDocument] = useState<CanvasDocument>(initialDemoState.document);
  const [selection, setSelection] = useState<string[]>(initialDemoState.selection);
  const [viewport, setViewport] = useState<CanvasViewport>(initialDemoState.viewport);
  const [agentContext, setAgentContext] = useState(initialDemoState.agentContext);
  const [liveRunning, setLiveRunning] = useState(false);
  const [followLiveFocus, setFollowLiveFocus] = useState(initialDemoState.followLiveFocus);
  const [inspectorOpen, setInspectorOpen] = useState(initialDemoState.inspectorOpen);
  const [controlStatus, setControlStatus] = useState<ControlStatus>("connecting");
  const [liveStepIndex, setLiveStepIndex] = useState(initialDemoState.liveStepIndex);
  const [lastLiveStepIndex, setLastLiveStepIndex] = useState<number | null>(initialDemoState.lastLiveStepIndex);
  const [activeNodeIds, setActiveNodeIds] = useState<string[]>([]);
  const [operationLog, setOperationLog] = useState<OperationLogEntry[]>(initialDemoState.operationLog);
  const selectedNode = useMemo(
    () => document.nodes.find((node) => node.id === selection[0]),
    [document.nodes, selection]
  );
  const activeNodeIdSet = useMemo(() => new Set(activeNodeIds), [activeNodeIds]);
  const lastLiveStep = lastLiveStepIndex === null ? undefined : LIVE_STEPS[lastLiveStepIndex];
  const nextLiveStep = LIVE_STEPS[liveStepIndex];
  const demoRenderers = useMemo<AgentCanvasRenderers>(
    () => ({
      document: (props) => <DemoDocumentRenderer {...props} transientEditing={activeNodeIdSet.has(props.node.id)} />,
      file: (props) => <DemoFileRenderer {...props} transientEditing={activeNodeIdSet.has(props.node.id)} />,
      text: (props) => <DemoTextRenderer {...props} transientEditing={activeNodeIdSet.has(props.node.id)} />,
      website: (props) => <DemoWebsiteRenderer {...props} transientEditing={activeNodeIdSet.has(props.node.id)} />
    }),
    [activeNodeIdSet]
  );
  const handleViewportChange = useCallback((nextViewport: CanvasViewport) => {
    window.requestAnimationFrame(() => setViewport(nextViewport));
  }, []);

  const runOperations = useCallback((operations: CanvasOperation[], entry?: Pick<OperationLogEntry, "label" | "detail">) => {
    const results = canvasRef.current?.applyOperations(operations) || [];
    const ok = results.every((result) => result.ok);
    const targetIds = getOperationTargetIds(operations);

    if (entry) {
      setOperationLog((current) =>
        [
          {
            id: `${Date.now()}-${current.length}`,
            label: entry.label,
            detail: entry.detail,
            operations: operations.map((operation) => operation.type),
            ok,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
          },
          ...current
        ].slice(0, 8)
      );
    }

    if (targetIds.length) {
      window.clearTimeout(activeNodeTimeoutRef.current);
      setActiveNodeIds(targetIds);
      activeNodeTimeoutRef.current = window.setTimeout(() => setActiveNodeIds([]), Math.max(500, LIVE_INTERVAL_MS - 120));
    }

    window.requestAnimationFrame(() => {
      setAgentContext(JSON.stringify({ results, context: canvasRef.current?.getAgentContext() }, null, 2));
    });
  }, []);

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      setControlStatus("offline");
      return undefined;
    }

    setControlStatus("connecting");
    const source = new EventSource(CONTROL_EVENTS_URL);
    const handleOpen = () => setControlStatus("connected");
    const handleError = () => setControlStatus("offline");
    const handleOperations = (event: Event) => {
      try {
        const message = JSON.parse((event as MessageEvent<string>).data) as RemoteOperationMessage;
        if (!Array.isArray(message.operations) || !message.operations.length) return;

        const eventId = message.id ? String(message.id) : "";
        if (eventId && remoteEventIdsRef.current.has(eventId)) return;
        if (eventId) remoteEventIdsRef.current.add(eventId);

        runOperations(message.operations, {
          label: message.label || "Remote operation",
          detail: message.detail || `Applied ${message.operations.length} operation${message.operations.length === 1 ? "" : "s"} from the control API.`
        });
      } catch {
        setControlStatus("offline");
      }
    };

    source.addEventListener("open", handleOpen);
    source.addEventListener("error", handleError);
    source.addEventListener("operations", handleOperations);

    return () => {
      source.removeEventListener("open", handleOpen);
      source.removeEventListener("error", handleError);
      source.removeEventListener("operations", handleOperations);
      source.close();
    };
  }, [runOperations]);

  const advanceLiveRun = useCallback(() => {
    const snapshot = canvasRef.current?.getSnapshot();
    if (!snapshot) return;

    const index = liveStepRef.current;
    const step = LIVE_STEPS[index];
    const operations = step.makeOperations(snapshot);
    runOperations(followLiveFocus ? operations : operations.filter((operation) => operation.type !== "focus"), {
      label: step.label,
      detail: step.detail
    });

    const nextIndex = (index + 1) % LIVE_STEPS.length;
    liveStepRef.current = nextIndex;
    setLastLiveStepIndex(index);
    setLiveStepIndex(nextIndex);
  }, [followLiveFocus, runOperations]);

  useEffect(() => {
    if (!liveRunning) return undefined;
    const interval = window.setInterval(advanceLiveRun, LIVE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [advanceLiveRun, liveRunning]);

  useEffect(() => () => window.clearTimeout(activeNodeTimeoutRef.current), []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "i" || isEditableTarget(event.target)) return;
      event.preventDefault();
      setInspectorOpen((current) => !current);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    writeDemoState({
      document,
      selection,
      viewport,
      agentContext,
      followLiveFocus,
      inspectorOpen,
      liveStepIndex,
      lastLiveStepIndex,
      operationLog
    });
  }, [agentContext, document, followLiveFocus, inspectorOpen, lastLiveStepIndex, liveStepIndex, operationLog, selection, viewport]);

  useEffect(() => {
    fetch(CONTROL_SNAPSHOT_URL, {
      body: JSON.stringify({
        document,
        selectedNodeIds: selection,
        viewport,
        agentContext: parseAgentContext(agentContext),
        updatedAt: new Date().toISOString()
      }),
      headers: { "content-type": "application/json" },
      method: "PUT"
    }).catch(() => {
      // The control server is optional; the demo still works without it.
    });
  }, [agentContext, document, selection, viewport]);

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
    runOperations([{ type: "createNode", node, placement: { mode: "avoid-overlap", gap: 28, gridSize: 24 } }, { type: "focus", id }], {
      label: "Manual document",
      detail: "Created a document node from the demo controls."
    });
  }

  function addWebsiteNode() {
    const id = `website-${Date.now()}`;
    runOperations([
      {
        type: "createNode",
        placement: { mode: "avoid-overlap", gap: 28, gridSize: 24 },
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
    ], {
      label: "Manual website",
      detail: "Created an inline website preview from the demo controls."
    });
  }

  function summarizeContext() {
    setAgentContext(JSON.stringify(canvasRef.current?.getAgentContext(), null, 2));
  }

  function focusSelected() {
    if (selection[0]) canvasRef.current?.focusNode(selection[0]);
  }

  function toggleLiveRun() {
    if (liveRunning) {
      setLiveRunning(false);
      return;
    }

    setLiveRunning(true);
    advanceLiveRun();
  }

  function resetLiveRun() {
    setLiveRunning(false);
    liveStepRef.current = 0;
    setLiveStepIndex(0);
    setLastLiveStepIndex(null);
    setActiveNodeIds([]);
    window.clearTimeout(activeNodeTimeoutRef.current);
    clearDemoState();
    setDocument(cloneDemoDocument());
    setSelection(["premise"]);
    setViewport(DEFAULT_VIEWPORT);
    setAgentContext("{}");
    setInspectorOpen(false);
    setOperationLog([]);
    window.requestAnimationFrame(() => canvasRef.current?.focusNode("premise"));
  }

  return (
    <main className={`demo-shell${inspectorOpen ? " is-inspector-open" : ""}`}>
      <AgentCanvas
        ref={canvasRef}
        document={document}
        initialViewport={viewport}
        renderers={demoRenderers}
        selectedNodeIds={selection}
        snap={DEMO_SNAP_OPTIONS}
        onDocumentChange={(nextDocument) => setDocument(nextDocument)}
        onSelectionChange={setSelection}
        onViewportChange={handleViewportChange}
      />

      <button
        aria-controls="demo-inspector"
        aria-expanded={inspectorOpen}
        aria-label={inspectorOpen ? "Hide inspector" : "Show inspector"}
        className="demo-inspector-toggle"
        onClick={() => setInspectorOpen((current) => !current)}
        title={inspectorOpen ? "Hide inspector" : "Show inspector"}
        type="button"
      >
        {inspectorOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
      </button>

      <aside className="demo-panel" id="demo-inspector" aria-label="Canvas inspector" hidden={!inspectorOpen}>
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

        <section className="demo-live">
          <h2>Live Run</h2>
          <div className="demo-live-status">
            <span className={`demo-live-dot${liveRunning ? " is-running" : ""}`} aria-hidden="true" />
            <strong>{liveRunning ? "Streaming operations" : "Ready to stream"}</strong>
            <span>
              Next {liveStepIndex + 1}/{LIVE_STEPS.length}
            </span>
          </div>
          <div className="demo-control-status">
            <span className={`demo-live-dot is-control-${controlStatus}`} aria-hidden="true" />
            <strong>Control API</strong>
            <span>{controlStatus === "connected" ? `Listening on ${CONTROL_LABEL}` : "Run npm run control"}</span>
          </div>
          <div className="demo-live-readout">
            <span>Current</span>
            <strong>{lastLiveStep ? lastLiveStep.label : "Nothing applied yet"}</strong>
            <small>{lastLiveStep ? lastLiveStep.targetLabel : "Press Step or Play to begin"}</small>
            <span>Next</span>
            <strong>{nextLiveStep.label}</strong>
            <small>{nextLiveStep.targetLabel}</small>
          </div>
          <div className="demo-progress" aria-label="Live run progress">
            {LIVE_STEPS.map((step, index) => (
              <span
                aria-label={step.label}
                className={index === liveStepIndex ? "is-active" : lastLiveStepIndex !== null && index <= lastLiveStepIndex ? "is-complete" : ""}
                key={step.label}
              />
            ))}
          </div>
          <label className="demo-toggle">
            <input checked={followLiveFocus} onChange={(event) => setFollowLiveFocus(event.currentTarget.checked)} type="checkbox" />
            <span>Follow focus</span>
          </label>
          <div className="demo-actions demo-actions--live">
            <button type="button" onClick={toggleLiveRun}>
              {liveRunning ? <Pause size={15} /> : <Play size={15} />}
              {liveRunning ? "Pause" : "Play"}
            </button>
            <button type="button" onClick={advanceLiveRun}>
              <StepForward size={15} />
              Step
            </button>
            <button type="button" onClick={resetLiveRun}>
              <RotateCcw size={15} />
              Reset
            </button>
          </div>
          <div className="demo-operation-log" aria-live="polite">
            {operationLog.length ? (
              operationLog.map((entry) => (
                <article className="demo-log-entry" key={entry.id}>
                  <header>
                    <Activity size={14} />
                    <strong>{entry.label}</strong>
                    <span className={`demo-log-state${entry.ok ? " is-ok" : " is-error"}`}>{entry.ok ? "ok" : "failed"}</span>
                    <span>{entry.time}</span>
                  </header>
                  <p>{entry.detail}</p>
                  <code>{entry.operations.join(" + ")}</code>
                </article>
              ))
            ) : (
              <p className="demo-muted">No operations streamed yet.</p>
            )}
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

function makeStreamingDocumentOperations(
  snapshot: AgentCanvasSnapshot,
  markdown: string,
  progress: number,
  streamLabel: string,
  status: "editing" | "complete" = "editing"
): CanvasOperation[] {
  const existing = snapshot.document.nodes.find((node) => node.id === STREAM_NODE_ID);
  const metadata = {
    ...(existing?.metadata || {}),
    demoStatus: status,
    demoProgress: progress,
    demoStreamLabel: streamLabel
  };
  const patch = {
    title: "Live synthesis",
    tags: ["agent", "live", status === "editing" ? "streaming" : "complete"],
    content: { markdown },
    metadata
  } as Partial<CanvasNode>;

  if (existing) {
    const placed = placeCanvasNode(snapshot.document, { ...existing, ...patch, id: STREAM_NODE_ID } as CanvasNode, {
      mode: "avoid-overlap",
      gap: 32,
      gridSize: 24,
      maxAttempts: 1600
    });
    return [
      { type: "updateNode", id: STREAM_NODE_ID, patch: { ...patch, x: placed.x, y: placed.y } },
      { type: "focus", id: STREAM_NODE_ID }
    ];
  }

  const position = getViewportInsertionPoint(snapshot);
  const node: CanvasNode = {
    id: STREAM_NODE_ID,
    type: "document",
    x: position.x,
    y: position.y,
    width: 540,
    height: 380,
    title: "Live synthesis",
    tags: ["agent", "live", "streaming"],
    metadata,
    content: { markdown }
  };

  return [
    {
      type: "createNode",
      node,
      placement: { mode: "avoid-overlap", gap: 32, gridSize: 24, maxAttempts: 1600 }
    },
    { type: "focus", id: STREAM_NODE_ID }
  ];
}

function getViewportInsertionPoint(snapshot: AgentCanvasSnapshot) {
  const { viewport } = snapshot;
  return {
    x: Math.round((-viewport.x + 500) / viewport.scale),
    y: Math.round((-viewport.y + 150) / viewport.scale)
  };
}

function getOperationTargetIds(operations: CanvasOperation[]) {
  return [
    ...new Set(
      operations
        .map((operation) => {
          if (operation.type === "createNode") return operation.node.id;
          if (operation.type === "updateNode" || operation.type === "bringToFront" || operation.type === "sendToBack") return operation.id;
          if (operation.type === "layoutNodes" || operation.type === "tidyNodes") return operation.ids;
          return undefined;
        })
        .flat()
        .filter(Boolean) as string[]
    )
  ];
}

function DemoDocumentRenderer({
  node,
  transientEditing
}: AgentCanvasRendererProps<DocumentCanvasNode> & { transientEditing?: boolean }) {
  const status = node.metadata?.demoStatus === "editing" || node.metadata?.demoStatus === "complete" ? node.metadata.demoStatus : undefined;
  const streamLabel = typeof node.metadata?.demoStreamLabel === "string" ? node.metadata.demoStreamLabel : undefined;
  const isEditing = status === "editing";
  const text = node.content.markdown || node.content.excerpt || stripHtml(node.content.html) || "";

  return (
    <article className={`ac-node-content ac-document-node${status ? " demo-stream-node" : ""}`}>
      <DemoNodeHeader label="Document" node={node} transientEditing={transientEditing} />
      <div className="ac-document-body demo-stream-body" aria-live={isEditing ? "polite" : undefined}>
        {streamLabel && status && <p className="demo-stream-note">{streamLabel}</p>}
        {renderDemoTextBlocks(text, isEditing)}
        {isEditing && <span className="demo-stream-cursor" aria-hidden="true" />}
      </div>
    </article>
  );
}

function DemoTextRenderer({ node, transientEditing }: AgentCanvasRendererProps<TextCanvasNode> & { transientEditing?: boolean }) {
  return (
    <article className={`ac-node-content ac-text-node ac-text-node--${node.content.tone || "note"}`}>
      <DemoNodeHeader label="Text" node={node} transientEditing={transientEditing} />
      <p>{node.content.text}</p>
    </article>
  );
}

function DemoWebsiteRenderer({ node, transientEditing }: AgentCanvasRendererProps<WebsiteCanvasNode> & { transientEditing?: boolean }) {
  const sandbox = node.content.sandbox || "allow-forms allow-popups allow-scripts allow-same-origin";

  return (
    <article className="ac-node-content ac-website-node">
      <DemoNodeHeader label="Website" node={node} transientEditing={transientEditing} />
      <iframe
        title={node.title || node.content.url || "Website preview"}
        src={node.content.url}
        srcDoc={node.content.srcDoc}
        sandbox={sandbox}
      />
      {node.content.caption && <p>{node.content.caption}</p>}
    </article>
  );
}

function DemoFileRenderer({ node, transientEditing }: AgentCanvasRendererProps<FileCanvasNode> & { transientEditing?: boolean }) {
  return (
    <article className="ac-node-content ac-file-node">
      <DemoNodeHeader label={node.content.mimeType || "File"} node={node} transientEditing={transientEditing} />
      <div className="ac-file-glyph" aria-hidden="true">
        {fileInitials(node.content.name)}
      </div>
      <strong>{node.content.name}</strong>
      {node.content.sizeLabel && <span>{node.content.sizeLabel}</span>}
      {node.content.summary && <p>{node.content.summary}</p>}
    </article>
  );
}

function DemoNodeHeader({
  label,
  node,
  transientEditing
}: {
  label: string;
  node: CanvasNode;
  transientEditing?: boolean;
}) {
  const badge = getDemoBadge(node, transientEditing);

  return (
    <header className="ac-node-header">
      <span>{label}</span>
      {node.title && <strong>{node.title}</strong>}
      {badge && <span className={`demo-stream-badge is-${badge.status}`}>{badge.label}</span>}
    </header>
  );
}

function getDemoBadge(node: CanvasNode, transientEditing?: boolean) {
  if (node.metadata?.demoStatus === "editing") {
    const progress = typeof node.metadata.demoProgress === "number" ? Math.round(node.metadata.demoProgress) : 0;
    return { label: `Editing ${progress}%`, status: "editing" };
  }

  if (node.metadata?.demoStatus === "complete") return { label: "Complete", status: "complete" };
  if (transientEditing) return { label: "Updating", status: "updating" };
  return undefined;
}

function renderDemoTextBlocks(text: string, isEditing = false) {
  if (!text.trim()) {
    return <p className="demo-stream-placeholder">{isEditing ? "Waiting for streamed content..." : "No text content."}</p>;
  }

  return text
    .trim()
    .split(/\n{2,}/)
    .map((block, index) => {
      const trimmed = block.trim();
      if (trimmed.startsWith("# ")) return <h2 key={index}>{trimmed.replace(/^#\s+/, "")}</h2>;
      if (trimmed.startsWith("## ")) return <h3 key={index}>{trimmed.replace(/^##\s+/, "")}</h3>;
      if (/^[-*]\s/m.test(trimmed)) {
        return (
          <ul key={index}>
            {trimmed
              .split("\n")
              .map((line) => line.replace(/^[-*]\s+/, "").trim())
              .filter(Boolean)
              .map((item) => (
                <li key={item}>{item}</li>
              ))}
          </ul>
        );
      }
      return <p key={index}>{trimmed}</p>;
    });
}

function stripHtml(html?: string) {
  return html?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function cloneDemoDocument(): CanvasDocument {
  return {
    ...initialDocument,
    nodes: initialDocument.nodes.map((node) => ({ ...node, content: { ...node.content } }) as CanvasNode),
    edges: initialDocument.edges?.map((edge) => ({ ...edge })),
    metadata: initialDocument.metadata ? { ...initialDocument.metadata } : undefined
  };
}

function getDefaultDemoState(): DemoState {
  return {
    document: cloneDemoDocument(),
    selection: ["premise"],
    viewport: DEFAULT_VIEWPORT,
    agentContext: "{}",
    followLiveFocus: false,
    inspectorOpen: false,
    liveStepIndex: 0,
    lastLiveStepIndex: null,
    operationLog: []
  };
}

function readDemoState(): DemoState {
  const fallback = getDefaultDemoState();
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(DEMO_STATE_KEY);
    if (!raw) return fallback;

    const stored = JSON.parse(raw) as Partial<StoredDemoState>;
    if (stored.version !== 1 || !isCanvasDocument(stored.document)) return fallback;

    const document = repairDemoDocumentLayout(stored.document);
    const nodeIds = new Set(document.nodes.map((node) => node.id));
    const selection = Array.isArray(stored.selection)
      ? stored.selection.filter((id): id is string => typeof id === "string" && nodeIds.has(id))
      : fallback.selection;
    const liveStepIndex =
      typeof stored.liveStepIndex === "number" ? Math.max(0, Math.min(LIVE_STEPS.length - 1, Math.floor(stored.liveStepIndex))) : 0;
    const lastLiveStepIndex =
      typeof stored.lastLiveStepIndex === "number" && stored.lastLiveStepIndex >= 0 && stored.lastLiveStepIndex < LIVE_STEPS.length
        ? Math.floor(stored.lastLiveStepIndex)
        : null;

    return {
      document,
      selection,
      viewport: isCanvasViewport(stored.viewport) ? stored.viewport : fallback.viewport,
      agentContext: typeof stored.agentContext === "string" ? stored.agentContext : fallback.agentContext,
      followLiveFocus: Boolean(stored.followLiveFocus),
      inspectorOpen: Boolean(stored.inspectorOpen),
      liveStepIndex,
      lastLiveStepIndex,
      operationLog: Array.isArray(stored.operationLog) ? stored.operationLog.filter(isOperationLogEntry).slice(0, 8) : []
    };
  } catch {
    return fallback;
  }
}

function parseAgentContext(context: string) {
  try {
    return JSON.parse(context);
  } catch {
    return context;
  }
}

function repairDemoDocumentLayout(document: CanvasDocument): CanvasDocument {
  const liveNode = document.nodes.find((node) => node.id === STREAM_NODE_ID);
  if (!liveNode) return document;

  const placed = placeCanvasNode(document, liveNode, { mode: "avoid-overlap", gap: 32, gridSize: 24, maxAttempts: 1600 });
  if (placed.x === liveNode.x && placed.y === liveNode.y) return document;

  return {
    ...document,
    nodes: document.nodes.map((node) => (node.id === STREAM_NODE_ID ? placed : node))
  };
}

function writeDemoState(state: DemoState) {
  if (typeof window === "undefined") return;

  try {
    const stored: StoredDemoState = { version: 1, ...state, operationLog: state.operationLog.slice(0, 8) };
    window.localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(stored));
  } catch {
    // Demo persistence should never break the canvas.
  }
}

function clearDemoState() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(DEMO_STATE_KEY);
  } catch {
    // Ignore storage errors in the demo shell.
  }
}

function isCanvasDocument(value: unknown): value is CanvasDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as CanvasDocument;
  return (
    document.schemaVersion === 1 &&
    typeof document.id === "string" &&
    typeof document.title === "string" &&
    typeof document.width === "number" &&
    typeof document.height === "number" &&
    Array.isArray(document.nodes)
  );
}

function isCanvasViewport(value: unknown): value is CanvasViewport {
  if (!value || typeof value !== "object") return false;
  const viewport = value as CanvasViewport;
  return typeof viewport.x === "number" && typeof viewport.y === "number" && typeof viewport.scale === "number";
}

function isOperationLogEntry(value: unknown): value is OperationLogEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as OperationLogEntry;
  return (
    typeof entry.id === "string" &&
    typeof entry.label === "string" &&
    typeof entry.detail === "string" &&
    Array.isArray(entry.operations) &&
    typeof entry.ok === "boolean" &&
    typeof entry.time === "string"
  );
}

function nodeExists(document: CanvasDocument, id: string) {
  return document.nodes.some((node) => node.id === id);
}

function fileInitials(name: string) {
  const extension = name.split(".").pop();
  return extension ? extension.slice(0, 4).toUpperCase() : "FILE";
}

function buildLivePreviewHtml() {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      :root {
        color-scheme: light;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        color: oklch(0.21 0.007 255);
        background: oklch(0.99 0.003 255);
      }
      body {
        margin: 0;
        padding: 34px;
      }
      main {
        border: 1px solid oklch(0.82 0.006 255);
        min-height: 100vh;
        padding: 36px;
      }
      span {
        color: oklch(0.38 0.04 188);
        font-size: 12px;
        font-weight: 780;
        text-transform: uppercase;
      }
      h1 {
        font-size: 42px;
        letter-spacing: 0;
        line-height: 1.04;
        margin: 24px 0 18px;
        max-width: 610px;
      }
      p {
        color: oklch(0.38 0.008 255);
        font-size: 18px;
        line-height: 1.45;
        max-width: 620px;
      }
      nav {
        border-top: 1px solid oklch(0.84 0.006 255);
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
      <span>Live update</span>
      <h1>A shared place for family plans that keep changing.</h1>
      <p>The canvas keeps the source note, generated homepage, media, and handoff file visible while the agent edits each artifact.</p>
      <nav>
        <b>Dinner tonight</b>
        <b>Summer trip</b>
        <b>Forms and deadlines</b>
      </nav>
    </main>
  </body>
</html>
`;
}
