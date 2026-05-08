import type { ReactNode } from "react";

export type CanvasNodeType = "document" | "text" | "image" | "video" | "website" | "file" | "group";

export interface CanvasDocument {
  schemaVersion: 1;
  id: string;
  title: string;
  width: number;
  height: number;
  nodes: CanvasNode[];
  edges?: CanvasEdge[];
  metadata?: Record<string, unknown>;
}

export interface CanvasNodeBase {
  id: string;
  type: CanvasNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  description?: string;
  locked?: boolean;
  zIndex?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface DocumentCanvasNode extends CanvasNodeBase {
  type: "document";
  content: {
    markdown?: string;
    html?: string;
    excerpt?: string;
  };
}

export interface TextCanvasNode extends CanvasNodeBase {
  type: "text";
  content: {
    text: string;
    tone?: "note" | "heading" | "code";
  };
}

export interface ImageCanvasNode extends CanvasNodeBase {
  type: "image";
  content: {
    src: string;
    alt?: string;
    caption?: string;
  };
}

export interface VideoCanvasNode extends CanvasNodeBase {
  type: "video";
  content: {
    src: string;
    poster?: string;
    caption?: string;
  };
}

export interface WebsiteCanvasNode extends CanvasNodeBase {
  type: "website";
  content: {
    url?: string;
    srcDoc?: string;
    sandbox?: string;
    caption?: string;
  };
}

export interface FileCanvasNode extends CanvasNodeBase {
  type: "file";
  content: {
    name: string;
    mimeType?: string;
    sizeLabel?: string;
    url?: string;
    summary?: string;
  };
}

export interface GroupCanvasNode extends CanvasNodeBase {
  type: "group";
  content: {
    children?: string[];
    label?: string;
  };
}

export type CanvasNode =
  | DocumentCanvasNode
  | TextCanvasNode
  | ImageCanvasNode
  | VideoCanvasNode
  | WebsiteCanvasNode
  | FileCanvasNode
  | GroupCanvasNode;

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface CanvasViewport {
  x: number;
  y: number;
  scale: number;
}

export interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CanvasOperation =
  | { type: "createNode"; node: CanvasNode }
  | { type: "updateNode"; id: string; patch: Partial<CanvasNode> }
  | { type: "deleteNode"; id: string }
  | { type: "bringToFront"; id: string }
  | { type: "sendToBack"; id: string }
  | { type: "select"; ids: string[] }
  | { type: "focus"; id: string }
  | { type: "setViewport"; viewport: CanvasViewport };

export interface CanvasOperationResult {
  operation: CanvasOperation["type"];
  ok: boolean;
  id?: string;
  error?: string;
}

export interface AgentCanvasSnapshot {
  document: CanvasDocument;
  viewport: CanvasViewport;
  selectedNodeIds: string[];
  visibleNodeIds: string[];
}

export interface AgentCanvasContext {
  canvas: {
    id: string;
    title: string;
    viewport: CanvasViewport;
  };
  selected: AgentCanvasNodeSummary[];
  visible: AgentCanvasNodeSummary[];
  offscreenCount: number;
}

export interface AgentCanvasNodeSummary {
  id: string;
  type: CanvasNodeType;
  title?: string;
  bounds: CanvasRect;
  text?: string;
  tags?: string[];
}

export interface AgentCanvasRendererProps<TNode extends CanvasNode = CanvasNode> {
  node: TNode;
  selected: boolean;
}

export type AgentCanvasRenderer<TNode extends CanvasNode = CanvasNode> = (
  props: AgentCanvasRendererProps<TNode>
) => ReactNode;

export type AgentCanvasRenderers = Partial<{
  [Type in CanvasNodeType]: AgentCanvasRenderer<Extract<CanvasNode, { type: Type }>>;
}>;

export interface AgentCanvasHandle {
  getSnapshot: () => AgentCanvasSnapshot;
  getAgentContext: () => AgentCanvasContext;
  applyOperations: (operations: CanvasOperation[]) => CanvasOperationResult[];
  fitView: () => void;
  focusNode: (id: string) => void;
}

export interface AgentCanvasProps {
  document: CanvasDocument;
  renderers?: AgentCanvasRenderers;
  initialViewport?: CanvasViewport;
  selectedNodeIds?: string[];
  readonly?: boolean;
  className?: string;
  onDocumentChange?: (document: CanvasDocument, results: CanvasOperationResult[]) => void;
  onSelectionChange?: (ids: string[]) => void;
  onViewportChange?: (viewport: CanvasViewport) => void;
}
