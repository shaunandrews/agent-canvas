import type { CanvasDocument, CanvasLayoutOptions, CanvasNode, CanvasOperation, CanvasPlacementPolicy, CanvasRect } from "../types";
import { rectsIntersect } from "./geometry";
import { getNodePageRect, getNodesPageBounds, toParentPoint } from "./hierarchy";

const DEFAULT_GAP = 24;
const DEFAULT_GRID_SIZE = 24;

export function createNodeWithPlacement(
  document: CanvasDocument,
  node: CanvasNode,
  placement: CanvasPlacementPolicy = {},
  selectedNodeIds: string[] = []
): CanvasOperation[] {
  return [{ type: "createNode", node: placeCanvasNode(document, node, placement, selectedNodeIds) }];
}

export function placeCanvasNode(
  document: CanvasDocument,
  node: CanvasNode,
  placement: CanvasPlacementPolicy = {},
  selectedNodeIds: string[] = []
): CanvasNode {
  const mode = placement.mode || "freeform";
  const gridSize = placement.gridSize || DEFAULT_GRID_SIZE;

  if (mode === "freeform") return node;
  if (mode === "snap-grid") return snapNodeToPageGrid(document, node, gridSize);

  const referenceNodes = getReferenceNodes(document, placement.referenceNodeIds, selectedNodeIds);
  const positioned = positionByMode(document, node, placement, referenceNodes, selectedNodeIds);
  const snapped = placement.gridSize ? snapNodeToPageGrid(document, positioned, gridSize) : positioned;

  return findNonOverlappingNode(document, snapped, placement);
}

export function layoutCanvasNodes(document: CanvasDocument, ids: string[], layout: CanvasLayoutOptions): CanvasOperation[] {
  const nodes = orderedNodes(document, ids);
  if (!nodes.length) return [];

  const gap = layout.gap ?? DEFAULT_GAP;
  const origin = layout.origin || getNodesPageBounds(document, nodes);
  const mode = layout.mode === "list" ? "column" : layout.mode;

  if (mode === "row") return layoutRow(document, nodes, origin, gap);
  if (mode === "column") return layoutColumn(document, nodes, origin, gap);
  return layoutGrid(document, nodes, origin, gap, layout.columns);
}

export function tidyCanvasNodes(document: CanvasDocument, ids: string[], layout?: CanvasLayoutOptions): CanvasOperation[] {
  const nodes = orderedNodes(document, ids);
  if (!nodes.length) return [];

  const inferredLayout: CanvasLayoutOptions =
    layout ||
    (nodes.length <= 3
      ? { mode: "row", gap: DEFAULT_GAP }
      : { mode: "grid", gap: DEFAULT_GAP, columns: Math.ceil(Math.sqrt(nodes.length)) });

  return layoutCanvasNodes(document, ids, inferredLayout);
}

function positionByMode(
  document: CanvasDocument,
  node: CanvasNode,
  placement: CanvasPlacementPolicy,
  referenceNodes: CanvasNode[],
  selectedNodeIds: string[]
): CanvasNode {
  const mode = placement.mode || "freeform";
  const gap = placement.gap ?? DEFAULT_GAP;
  const origin = placement.origin || { x: node.x, y: node.y };

  if (mode === "near-selection") {
    const referenceId = placement.referenceNodeIds?.at(-1) || selectedNodeIds.at(-1);
    const referenceNode = document.nodes.find((item) => item.id === referenceId) || referenceNodes.at(-1);
    if (!referenceNode) return node;
    const rect = getNodePageRect(document, referenceNode);
    return moveNodeToPage(document, node, rect.x + rect.width + gap, rect.y);
  }

  if (mode === "append-row") {
    if (!referenceNodes.length) return moveNodeToPage(document, node, origin.x, origin.y);
    const bounds = getNodesPageBounds(document, referenceNodes);
    return moveNodeToPage(document, node, bounds.x + bounds.width + gap, bounds.y);
  }

  if (mode === "append-column") {
    if (!referenceNodes.length) return moveNodeToPage(document, node, origin.x, origin.y);
    const bounds = getNodesPageBounds(document, referenceNodes);
    return moveNodeToPage(document, node, bounds.x, bounds.y + bounds.height + gap);
  }

  if (mode === "append-grid") {
    if (!referenceNodes.length) return moveNodeToPage(document, node, origin.x, origin.y);
    const columns = Math.max(1, placement.columns || Math.ceil(Math.sqrt(referenceNodes.length + 1)));
    const bounds = getNodesPageBounds(document, referenceNodes);
    const cellWidth = Math.max(node.width, ...referenceNodes.map((item) => item.width));
    const cellHeight = Math.max(node.height, ...referenceNodes.map((item) => item.height));
    const index = referenceNodes.length;
    return moveNodeToPage(
      document,
      node,
      bounds.x + (index % columns) * (cellWidth + gap),
      bounds.y + Math.floor(index / columns) * (cellHeight + gap)
    );
  }

  return node;
}

function findNonOverlappingNode(document: CanvasDocument, node: CanvasNode, placement: CanvasPlacementPolicy): CanvasNode {
  if (!hasCollision(document, node, placement)) return node;

  const gap = placement.gap ?? DEFAULT_GAP;
  const gridSize = placement.gridSize || DEFAULT_GRID_SIZE;
  const maxAttempts = placement.maxAttempts || 900;
  const anchors = document.nodes
    .filter((item) => item.id !== node.id && item.type !== "section")
    .flatMap((item) => {
      const rect = getNodePageRect(document, item);
      return [
        { x: rect.x + rect.width + gap, y: rect.y },
        { x: rect.x, y: rect.y + rect.height + gap },
        { x: rect.x + rect.width + gap, y: rect.y + rect.height + gap }
      ];
    })
    .sort((a, b) => distanceSquared(document, a, node) - distanceSquared(document, b, node));

  for (const anchor of anchors) {
    const moved = moveNodeToPage(document, node, anchor.x, anchor.y);
    const candidate = placement.gridSize ? snapNodeToPageGrid(document, moved, gridSize) : moved;
    if (!hasCollision(document, candidate, placement)) return candidate;
  }

  let attempts = 0;
  const rings = Math.ceil(Math.sqrt(maxAttempts));
  for (let ring = 1; ring <= rings; ring += 1) {
    for (let dx = -ring; dx <= ring; dx += 1) {
      for (let dy = -ring; dy <= ring; dy += 1) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        attempts += 1;
        if (attempts > maxAttempts) return node;

        const rect = getNodePageRect(document, node);
        const candidate = moveNodeToPage(document, node, rect.x + dx * gridSize, rect.y + dy * gridSize);
        if (!hasCollision(document, candidate, placement)) return candidate;
      }
    }
  }

  return node;
}

function hasCollision(document: CanvasDocument, node: CanvasNode, placement: CanvasPlacementPolicy) {
  const rect = getNodePageRect(document, node);
  if (placement.bounds && !rectContains(placement.bounds, rect)) return true;

  const gap = placement.gap ?? DEFAULT_GAP;
  return document.nodes
    .filter((item) => item.id !== node.id && item.type !== "section")
    .some((item) => rectsIntersect(rect, inflateRect(getNodePageRect(document, item), gap)));
}

function layoutRow(document: CanvasDocument, nodes: CanvasNode[], origin: Pick<CanvasRect, "x" | "y">, gap: number): CanvasOperation[] {
  let x = origin.x;
  return nodes.map((node) => {
    const operation = moveOperationToPage(document, node, x, origin.y);
    x += node.width + gap;
    return operation;
  });
}

function layoutColumn(document: CanvasDocument, nodes: CanvasNode[], origin: Pick<CanvasRect, "x" | "y">, gap: number): CanvasOperation[] {
  let y = origin.y;
  return nodes.map((node) => {
    const operation = moveOperationToPage(document, node, origin.x, y);
    y += node.height + gap;
    return operation;
  });
}

function layoutGrid(
  document: CanvasDocument,
  nodes: CanvasNode[],
  origin: Pick<CanvasRect, "x" | "y">,
  gap: number,
  columns?: number
): CanvasOperation[] {
  const resolvedColumns = Math.max(1, columns || Math.ceil(Math.sqrt(nodes.length)));
  const cellWidth = Math.max(...nodes.map((node) => node.width));
  const cellHeight = Math.max(...nodes.map((node) => node.height));

  return nodes.map((node, index) =>
    moveOperationToPage(
      document,
      node,
      origin.x + (index % resolvedColumns) * (cellWidth + gap),
      origin.y + Math.floor(index / resolvedColumns) * (cellHeight + gap)
    )
  );
}

function getReferenceNodes(document: CanvasDocument, referenceNodeIds?: string[], selectedNodeIds: string[] = []) {
  const ids = referenceNodeIds?.length ? referenceNodeIds : selectedNodeIds.length ? selectedNodeIds : document.nodes.map((node) => node.id);
  const idSet = new Set(ids);
  return orderedNodes(document, [...idSet]);
}

function orderedNodes(document: CanvasDocument, ids: string[]) {
  const idSet = new Set(ids);
  return document.nodes
    .filter((node) => idSet.has(node.id))
    .sort((a, b) => {
      const aRect = getNodePageRect(document, a);
      const bRect = getNodePageRect(document, b);
      return aRect.y - bRect.y || aRect.x - bRect.x || a.id.localeCompare(b.id);
    });
}

function snapNodeToPageGrid<TNode extends CanvasNode>(document: CanvasDocument, node: TNode, gridSize: number): TNode {
  if (gridSize <= 0) return node;
  const rect = getNodePageRect(document, node);
  return moveNodeToPage(document, node, snap(rect.x, gridSize), snap(rect.y, gridSize));
}

function snap(value: number, gridSize: number) {
  return Math.round(value / gridSize) * gridSize;
}

function moveNodeToPage<TNode extends CanvasNode>(document: CanvasDocument, node: TNode, x: number, y: number): TNode {
  const localPoint = toParentPoint(document, node.parentId, { x, y });
  return { ...node, x: localPoint.x, y: localPoint.y };
}

function moveOperationToPage(document: CanvasDocument, node: CanvasNode, x: number, y: number): CanvasOperation {
  const localPoint = toParentPoint(document, node.parentId, { x, y });
  return { type: "updateNode", id: node.id, patch: { x: localPoint.x, y: localPoint.y } };
}

function inflateRect(rect: CanvasRect, amount: number): CanvasRect {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2
  };
}

function rectContains(container: CanvasRect, rect: CanvasRect) {
  return (
    rect.x >= container.x &&
    rect.y >= container.y &&
    rect.x + rect.width <= container.x + container.width &&
    rect.y + rect.height <= container.y + container.height
  );
}

function distanceSquared(document: CanvasDocument, point: Pick<CanvasRect, "x" | "y">, node: CanvasNode) {
  const rect = getNodePageRect(document, node);
  return (point.x - rect.x) ** 2 + (point.y - rect.y) ** 2;
}
