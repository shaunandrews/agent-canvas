import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import {
  AgentCanvas,
  placeCanvasNode,
  type AgentCanvasHandle,
  type AgentCanvasRendererProps,
  type AgentCanvasRenderers,
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
import { getNodeHeaderDescription, getNodeTypeIcon } from "../lib/react/defaultRenderers";
import { initialDocument } from "./sampleCanvas";

type RemoteOperationMessage = {
  id?: string;
  operations?: CanvasOperation[];
};

type DemoState = {
  document: CanvasDocument;
  selection: string[];
  viewport: CanvasViewport;
};

type StoredDemoState = Partial<DemoState> & {
  version: 5;
};

const DEMO_STATE_KEY = "agent-canvas-demo-state-v5";
const DEFAULT_VIEWPORT: CanvasViewport = { x: 72, y: 72, scale: 1 };
const ACTIVE_NODE_MS = 780;
const STREAM_NODE_ID = "live-synthesis";
const CONTROL_EVENTS_URL = "http://127.0.0.1:8787/events";
const CONTROL_SNAPSHOT_URL = "http://127.0.0.1:8787/snapshot";
const DEMO_SNAP_OPTIONS: CanvasSnapOptions = {
  enabled: true,
  grid: { enabled: true, size: 24 },
  alignment: { enabled: true, targets: ["edge", "center"] },
  showGuides: true,
  thresholdPx: 8
};

export function DemoApp() {
  const [initialDemoState] = useState<DemoState>(() => readDemoState());
  const canvasRef = useRef<AgentCanvasHandle>(null);
  const activeNodeTimeoutRef = useRef<number | undefined>(undefined);
  const remoteEventIdsRef = useRef<Set<string>>(new Set());
  const [document, setDocument] = useState<CanvasDocument>(initialDemoState.document);
  const [selection, setSelection] = useState<string[]>(initialDemoState.selection);
  const [viewport, setViewport] = useState<CanvasViewport>(initialDemoState.viewport);
  const [activeNodeIds, setActiveNodeIds] = useState<string[]>([]);
  const activeNodeIdSet = useMemo(() => new Set(activeNodeIds), [activeNodeIds]);
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

  const runOperations = useCallback((operations: CanvasOperation[]) => {
    const results = canvasRef.current?.applyOperations(operations) || [];
    const targetIds = getOperationTargetIds(operations);

    if (targetIds.length) {
      window.clearTimeout(activeNodeTimeoutRef.current);
      setActiveNodeIds(targetIds);
      activeNodeTimeoutRef.current = window.setTimeout(() => setActiveNodeIds([]), ACTIVE_NODE_MS);
    }

    return results;
  }, []);

  useEffect(() => {
    if (typeof EventSource === "undefined") return undefined;

    const source = new EventSource(CONTROL_EVENTS_URL);
    const handleOperations = (event: Event) => {
      try {
        const message = JSON.parse((event as MessageEvent<string>).data) as RemoteOperationMessage;
        if (!Array.isArray(message.operations) || !message.operations.length) return;

        const eventId = message.id ? String(message.id) : "";
        if (eventId && remoteEventIdsRef.current.has(eventId)) return;
        if (eventId) remoteEventIdsRef.current.add(eventId);

        runOperations(message.operations);
      } catch {
        // The local control bridge is optional; malformed messages should not break the demo.
      }
    };

    source.addEventListener("operations", handleOperations);

    return () => {
      source.removeEventListener("operations", handleOperations);
      source.close();
    };
  }, [runOperations]);

  useEffect(() => () => window.clearTimeout(activeNodeTimeoutRef.current), []);

  useEffect(() => {
    writeDemoState({ document, selection, viewport });
  }, [document, selection, viewport]);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      fetch(CONTROL_SNAPSHOT_URL, {
        body: JSON.stringify({
          document,
          selectedNodeIds: selection,
          viewport,
          agentContext: canvasRef.current?.getAgentContext(),
          updatedAt: new Date().toISOString()
        }),
        headers: { "content-type": "application/json" },
        method: "PUT"
      }).catch(() => {
        // The control server is optional; the demo still works without it.
      });
    });
  }, [document, selection, viewport]);

  return (
    <main className="demo-shell">
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
    </main>
  );
}

function getOperationTargetIds(operations: CanvasOperation[]) {
  return [
    ...new Set(
      operations
        .map((operation) => {
          if (operation.type === "createNode") return operation.node.id;
          if (operation.type === "createSection") return operation.section.id;
          if (
            operation.type === "updateNode" ||
            operation.type === "setNodeParent" ||
            operation.type === "bringToFront" ||
            operation.type === "sendToBack" ||
            operation.type === "layoutSection"
          ) {
            return operation.id;
          }
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
      <div className="ac-node-surface">
        <div className="ac-document-body demo-stream-body" aria-live={isEditing ? "polite" : undefined}>
          {streamLabel && status && <p className="demo-stream-note">{streamLabel}</p>}
          {renderDemoTextBlocks(text, isEditing)}
          {isEditing && <span className="demo-stream-cursor" aria-hidden="true" />}
        </div>
      </div>
    </article>
  );
}

function DemoTextRenderer({ node, transientEditing }: AgentCanvasRendererProps<TextCanvasNode> & { transientEditing?: boolean }) {
  return (
    <article className={`ac-node-content ac-text-node ac-text-node--${node.content.tone || "note"}`}>
      <DemoNodeHeader label="Text" node={node} transientEditing={transientEditing} />
      <div className="ac-node-surface">
        <p>{node.content.text}</p>
      </div>
    </article>
  );
}

function DemoWebsiteRenderer({
  node,
  selected,
  transientEditing
}: AgentCanvasRendererProps<WebsiteCanvasNode> & { transientEditing?: boolean }) {
  const sandbox = node.content.sandbox || "allow-forms allow-popups allow-scripts allow-same-origin";

  return (
    <article className="ac-node-content ac-website-node">
      <DemoNodeHeader label="Website" node={node} transientEditing={transientEditing} />
      <div className="ac-node-surface ac-website-surface">
        <iframe
          title={node.title || node.content.url || "Website preview"}
          src={node.content.url}
          srcDoc={node.content.srcDoc}
          sandbox={sandbox}
          style={{ pointerEvents: selected ? "auto" : "none" }}
        />
      </div>
    </article>
  );
}

function DemoFileRenderer({ node, transientEditing }: AgentCanvasRendererProps<FileCanvasNode> & { transientEditing?: boolean }) {
  return (
    <article className="ac-node-content ac-file-node">
      <DemoNodeHeader label={node.content.mimeType || "File"} node={node} transientEditing={transientEditing} />
      <div className="ac-node-surface">
        <div className="ac-file-glyph" aria-hidden="true">
          {fileInitials(node.content.name)}
        </div>
        <strong>{node.content.name}</strong>
        {node.content.sizeLabel && <span>{node.content.sizeLabel}</span>}
        {node.content.summary && <p>{node.content.summary}</p>}
      </div>
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
  const TypeIcon = getNodeTypeIcon(node.type);
  const description = getNodeHeaderDescription(node);
  const showTypeIcon = node.type !== "section";

  return (
    <header className="ac-node-header">
      <strong {...(node.type === "section" ? { "data-agent-section-title": "" } : {})}>{node.title || label}</strong>
      <span className="ac-node-header-actions">
        {badge && <span className={`demo-stream-badge is-${badge.status}`}>{badge.label}</span>}
        {description && (
          <span
            aria-label={`Description: ${description}`}
            className="ac-node-header-icon"
            data-agent-node-description-icon=""
            title={description}
          >
            <Info size={14} strokeWidth={2} />
          </span>
        )}
        {showTypeIcon && (
          <span aria-label={`${label} node`} className="ac-node-header-icon" data-agent-node-type-icon={node.type} title={label}>
            <TypeIcon size={14} strokeWidth={2} />
          </span>
        )}
      </span>
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
    selection: ["project-summary"],
    viewport: DEFAULT_VIEWPORT
  };
}

function readDemoState(): DemoState {
  const fallback = getDefaultDemoState();
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(DEMO_STATE_KEY);
    if (!raw) return fallback;

    const stored = JSON.parse(raw) as StoredDemoState;
    if (stored.version !== 5 || !isCanvasDocument(stored.document) || !isCurrentDemoDocument(stored.document)) return fallback;

    const document = repairDemoDocumentLayout(stored.document);
    const nodeIds = new Set(document.nodes.map((node) => node.id));
    const selection = Array.isArray(stored.selection)
      ? stored.selection.filter((id): id is string => typeof id === "string" && nodeIds.has(id))
      : fallback.selection;

    return {
      document,
      selection,
      viewport: isCanvasViewport(stored.viewport) ? stored.viewport : fallback.viewport
    };
  } catch {
    return fallback;
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
    const stored: StoredDemoState = { version: 5, ...state };
    window.localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(stored));
  } catch {
    // Demo persistence should never break the canvas.
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

function isCurrentDemoDocument(document: CanvasDocument) {
  const sections = ["project-section", "screens-section", "components-section", "tokens-section"];
  if (sections.some((id) => document.nodes.find((node) => node.id === id)?.type !== "section")) return false;

  const screenChildIds = ["home-mobile", "home-desktop", "create-fam-mobile", "create-fam-desktop", "fam-wall-mobile", "fam-wall-desktop"];
  const tokenChildIds = ["design-tokens", "token-notes"];

  return (
    document.nodes.find((node) => node.id === "project-summary")?.parentId === "project-section" &&
    screenChildIds.every((id) => document.nodes.find((node) => node.id === id)?.parentId === "screens-section") &&
    document.nodes.find((node) => node.id === "component-spec")?.parentId === "components-section" &&
    tokenChildIds.every((id) => document.nodes.find((node) => node.id === id)?.parentId === "tokens-section")
  );
}

function isCanvasViewport(value: unknown): value is CanvasViewport {
  if (!value || typeof value !== "object") return false;
  const viewport = value as CanvasViewport;
  return typeof viewport.x === "number" && typeof viewport.y === "number" && typeof viewport.scale === "number";
}

function fileInitials(name: string) {
  const extension = name.split(".").pop();
  return extension ? extension.slice(0, 4).toUpperCase() : "FILE";
}
