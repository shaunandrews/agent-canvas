import "./styles.css";

export { AgentCanvas } from "./react/AgentCanvas";
export { createCanvasDocument, makeCanvasId, normalizeNodes, sortNodes } from "./core/document";
export { applyCanvasOperations } from "./core/operations";
export { createAgentCanvasContext, extractNodeText, summarizeNode } from "./core/agent-context";
export { fitRectInViewport, getNodesBounds, nodeToRect, rectsIntersect, viewportToCanvasRect } from "./core/geometry";
export type {
  AgentCanvasContext,
  AgentCanvasHandle,
  AgentCanvasNodeSummary,
  AgentCanvasProps,
  AgentCanvasRenderer,
  AgentCanvasRendererProps,
  AgentCanvasRenderers,
  AgentCanvasSnapshot,
  CanvasDocument,
  CanvasEdge,
  CanvasNode,
  CanvasNodeBase,
  CanvasNodeType,
  CanvasOperation,
  CanvasOperationResult,
  CanvasRect,
  CanvasViewport,
  DocumentCanvasNode,
  FileCanvasNode,
  GroupCanvasNode,
  ImageCanvasNode,
  TextCanvasNode,
  VideoCanvasNode,
  WebsiteCanvasNode
} from "./types";
