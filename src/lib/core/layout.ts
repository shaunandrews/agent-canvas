import type { CanvasDocument, CanvasLayoutOptions, CanvasNode, CanvasOperation, CanvasPlacementPolicy, CanvasRect } from "../types";
import { getNodesBounds, nodeToRect, rectsIntersect } from "./geometry";

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
  if (mode === "snap-grid") return snapNode(node, gridSize);

  const referenceNodes = getReferenceNodes(document, placement.referenceNodeIds, selectedNodeIds);
  const positioned = positionByMode(document, node, placement, referenceNodes, selectedNodeIds);
  const snapped = placement.gridSize ? snapNode(positioned, gridSize) : positioned;

  return findNonOverlappingNode(document, snapped, placement);
}

export function layoutCanvasNodes(document: CanvasDocument, ids: string[], layout: CanvasLayoutOptions): CanvasOperation[] {
  const nodes = orderedNodes(document, ids);
  if (!nodes.length) return [];

  const gap = layout.gap ?? DEFAULT_GAP;
  const origin = layout.origin || getNodesBounds(nodes);
  const mode = layout.mode === "list" ? "column" : layout.mode;

  if (mode === "row") return layoutRow(nodes, origin, gap);
  if (mode === "column") return layoutColumn(nodes, origin, gap);
  return layoutGrid(nodes, origin, gap, layout.columns);
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
    return referenceNode ? moveNode(node, referenceNode.x + referenceNode.width + gap, referenceNode.y) : node;
  }

  if (mode === "append-row") {
    if (!referenceNodes.length) return moveNode(node, origin.x, origin.y);
    const bounds = getNodesBounds(referenceNodes);
    return moveNode(node, bounds.x + bounds.width + gap, bounds.y);
  }

  if (mode === "append-column") {
    if (!referenceNodes.length) return moveNode(node, origin.x, origin.y);
    const bounds = getNodesBounds(referenceNodes);
    return moveNode(node, bounds.x, bounds.y + bounds.height + gap);
  }

  if (mode === "append-grid") {
    if (!referenceNodes.length) return moveNode(node, origin.x, origin.y);
    const columns = Math.max(1, placement.columns || Math.ceil(Math.sqrt(referenceNodes.length + 1)));
    const bounds = getNodesBounds(referenceNodes);
    const cellWidth = Math.max(node.width, ...referenceNodes.map((item) => item.width));
    const cellHeight = Math.max(node.height, ...referenceNodes.map((item) => item.height));
    const index = referenceNodes.length;
    return moveNode(node, bounds.x + (index % columns) * (cellWidth + gap), bounds.y + Math.floor(index / columns) * (cellHeight + gap));
  }

  return node;
}

function findNonOverlappingNode(document: CanvasDocument, node: CanvasNode, placement: CanvasPlacementPolicy): CanvasNode {
  if (!hasCollision(document, node, placement)) return node;

  const gap = placement.gap ?? DEFAULT_GAP;
  const gridSize = placement.gridSize || DEFAULT_GRID_SIZE;
  const maxAttempts = placement.maxAttempts || 900;
  const anchors = document.nodes
    .filter((item) => item.id !== node.id && item.type !== "group")
    .flatMap((item) => [
      { x: item.x + item.width + gap, y: item.y },
      { x: item.x, y: item.y + item.height + gap },
      { x: item.x + item.width + gap, y: item.y + item.height + gap }
    ])
    .sort((a, b) => distanceSquared(a, node) - distanceSquared(b, node));

  for (const anchor of anchors) {
    const candidate = placement.gridSize ? snapNode(moveNode(node, anchor.x, anchor.y), gridSize) : moveNode(node, anchor.x, anchor.y);
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

        const candidate = moveNode(node, node.x + dx * gridSize, node.y + dy * gridSize);
        if (!hasCollision(document, candidate, placement)) return candidate;
      }
    }
  }

  return node;
}

function hasCollision(document: CanvasDocument, node: CanvasNode, placement: CanvasPlacementPolicy) {
  if (placement.bounds && !rectContains(placement.bounds, nodeToRect(node))) return true;

  const gap = placement.gap ?? DEFAULT_GAP;
  const rect = nodeToRect(node);
  return document.nodes
    .filter((item) => item.id !== node.id && item.type !== "group")
    .some((item) => rectsIntersect(rect, inflateRect(nodeToRect(item), gap)));
}

function layoutRow(nodes: CanvasNode[], origin: Pick<CanvasRect, "x" | "y">, gap: number): CanvasOperation[] {
  let x = origin.x;
  return nodes.map((node) => {
    const operation = moveOperation(node, x, origin.y);
    x += node.width + gap;
    return operation;
  });
}

function layoutColumn(nodes: CanvasNode[], origin: Pick<CanvasRect, "x" | "y">, gap: number): CanvasOperation[] {
  let y = origin.y;
  return nodes.map((node) => {
    const operation = moveOperation(node, origin.x, y);
    y += node.height + gap;
    return operation;
  });
}

function layoutGrid(nodes: CanvasNode[], origin: Pick<CanvasRect, "x" | "y">, gap: number, columns?: number): CanvasOperation[] {
  const resolvedColumns = Math.max(1, columns || Math.ceil(Math.sqrt(nodes.length)));
  const cellWidth = Math.max(...nodes.map((node) => node.width));
  const cellHeight = Math.max(...nodes.map((node) => node.height));

  return nodes.map((node, index) =>
    moveOperation(node, origin.x + (index % resolvedColumns) * (cellWidth + gap), origin.y + Math.floor(index / resolvedColumns) * (cellHeight + gap))
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
    .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
}

function snapNode<TNode extends CanvasNode>(node: TNode, gridSize: number): TNode {
  if (gridSize <= 0) return node;
  return { ...node, x: snap(node.x, gridSize), y: snap(node.y, gridSize) };
}

function snap(value: number, gridSize: number) {
  return Math.round(value / gridSize) * gridSize;
}

function moveNode<TNode extends CanvasNode>(node: TNode, x: number, y: number): TNode {
  return { ...node, x, y };
}

function moveOperation(node: CanvasNode, x: number, y: number): CanvasOperation {
  return { type: "updateNode", id: node.id, patch: { x, y } };
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

function distanceSquared(point: Pick<CanvasRect, "x" | "y">, node: CanvasNode) {
  return (point.x - node.x) ** 2 + (point.y - node.y) ** 2;
}
