import "./styles.css";

export { AgentCanvas } from "./react/AgentCanvas";
export { createCanvasDocument, makeCanvasId, normalizeNodes, sortNodes } from "./core/document";
export { applyCanvasOperations } from "./core/operations";
export { createNodeWithPlacement, layoutCanvasNodes, placeCanvasNode, tidyCanvasNodes } from "./core/layout";
export { snapCanvasRect } from "./core/snapping";
export type { SnapCanvasRectInput, SnapCanvasRectResult } from "./core/snapping";
export { createAgentCanvasContext, extractNodeText, summarizeNode, summarizeSection } from "./core/agent-context";
export {
  findCanvasNode,
  getAncestorIds,
  getDescendantIds,
  getNodeDepth,
  getNodePagePosition,
  getNodePageRect,
  getNodesPageBounds,
  getSectionChildren,
  getTopLevelNodeIds,
  isSectionNode,
  toPagePoint,
  toParentPoint,
  wouldCreateParentCycle
} from "./core/hierarchy";
export { fitRectInViewport, getNodesBounds, nodeToRect, rectsIntersect, viewportToCanvasRect } from "./core/geometry";
export type {
  AgentCanvasContext,
  AgentCanvasHandle,
  AgentCanvasNodeSummary,
  AgentCanvasSectionSummary,
  AgentCanvasProps,
  AgentCanvasRenderer,
  AgentCanvasRendererProps,
  AgentCanvasRenderers,
  AgentCanvasSnapshot,
  AgentCanvasTheme,
  CanvasDocument,
  CanvasEdge,
  CanvasLayoutMode,
  CanvasLayoutOptions,
  CanvasNode,
  CanvasNodeBase,
  CanvasNodeType,
  CanvasOperation,
  CanvasOperationResult,
  CanvasPlacementMode,
  CanvasPlacementPolicy,
  CanvasRect,
  CanvasResizeHandle,
  CanvasResizeOptions,
  CanvasSnapGuide,
  CanvasSnapOptions,
  CanvasSnapTarget,
  CanvasViewport,
  DocumentCanvasNode,
  FileCanvasNode,
  ImageCanvasNode,
  SectionCanvasNode,
  TextCanvasNode,
  VideoCanvasNode,
  WebsiteCanvasNode
} from "./types";
