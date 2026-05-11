import type { CanvasDocument, CanvasNode, CanvasRect } from "../types";

export function findCanvasNode(document: CanvasDocument, id: string): CanvasNode | undefined {
  return document.nodes.find((node) => node.id === id);
}

export function isSectionNode(node: CanvasNode | undefined): boolean {
  return node?.type === "section";
}

export function getSectionChildren(document: CanvasDocument, sectionId: string): CanvasNode[] {
  return document.nodes.filter((node) => node.parentId === sectionId);
}

export function getNodeDepth(document: CanvasDocument, node: CanvasNode): number {
  return getAncestorIds(document, node.id).length;
}

export function getAncestorIds(document: CanvasDocument, nodeId: string): string[] {
  const ancestors: string[] = [];
  const seen = new Set<string>([nodeId]);
  let parentId = findCanvasNode(document, nodeId)?.parentId;

  while (parentId && !seen.has(parentId)) {
    const parent = findCanvasNode(document, parentId);
    if (!parent) break;
    ancestors.push(parent.id);
    seen.add(parent.id);
    parentId = parent.parentId;
  }

  return ancestors;
}

export function getDescendantIds(document: CanvasDocument, nodeId: string): string[] {
  const descendants: string[] = [];
  const pending = document.nodes.filter((node) => node.parentId === nodeId).map((node) => node.id);
  const seen = new Set<string>([nodeId]);

  while (pending.length) {
    const id = pending.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    descendants.push(id);
    pending.push(...document.nodes.filter((node) => node.parentId === id).map((node) => node.id));
  }

  return descendants;
}

export function getTopLevelNodeIds(document: CanvasDocument, ids: string[]): string[] {
  const idSet = new Set(ids);
  return ids.filter((id) => !getAncestorIds(document, id).some((ancestorId) => idSet.has(ancestorId)));
}

export function getNodePagePosition(document: CanvasDocument, node: CanvasNode): Pick<CanvasRect, "x" | "y"> {
  return toPagePoint(document, node.parentId, { x: node.x, y: node.y });
}

export function getNodePageRect(document: CanvasDocument, node: CanvasNode): CanvasRect {
  const position = getNodePagePosition(document, node);
  return {
    x: position.x,
    y: position.y,
    width: node.width,
    height: node.height
  };
}

export function getNodesPageBounds(document: CanvasDocument, nodes: CanvasNode[]): CanvasRect {
  if (!nodes.length) return { x: 0, y: 0, width: 1, height: 1 };

  const rects = nodes.map((node) => getNodePageRect(document, node));
  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  };
}

export function toPagePoint(
  document: CanvasDocument,
  parentId: string | undefined,
  localPoint: Pick<CanvasRect, "x" | "y">
): Pick<CanvasRect, "x" | "y"> {
  let x = localPoint.x;
  let y = localPoint.y;
  const seen = new Set<string>();
  let currentParentId = parentId;

  while (currentParentId && !seen.has(currentParentId)) {
    const parent = findCanvasNode(document, currentParentId);
    if (!parent) break;
    x += parent.x;
    y += parent.y;
    seen.add(parent.id);
    currentParentId = parent.parentId;
  }

  return { x, y };
}

export function toParentPoint(
  document: CanvasDocument,
  parentId: string | undefined,
  pagePoint: Pick<CanvasRect, "x" | "y">
): Pick<CanvasRect, "x" | "y"> {
  const parentPagePoint = toPagePoint(document, parentId, { x: 0, y: 0 });
  return {
    x: pagePoint.x - parentPagePoint.x,
    y: pagePoint.y - parentPagePoint.y
  };
}

export function wouldCreateParentCycle(document: CanvasDocument, nodeId: string, parentId: string | undefined): boolean {
  if (!parentId) return false;
  if (nodeId === parentId) return true;
  const seen = new Set<string>();
  let currentParentId: string | undefined = parentId;

  while (currentParentId) {
    if (currentParentId === nodeId) return true;
    if (seen.has(currentParentId)) return true;
    seen.add(currentParentId);
    currentParentId = findCanvasNode(document, currentParentId)?.parentId;
  }

  return false;
}
