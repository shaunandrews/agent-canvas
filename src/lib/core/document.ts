import type { CanvasDocument, CanvasNode } from "../types";

const DEFAULT_WIDTH = 3200;
const DEFAULT_HEIGHT = 2200;

export function createCanvasDocument(input: Partial<CanvasDocument> & { nodes?: CanvasNode[] } = {}): CanvasDocument {
  return {
    schemaVersion: 1,
    id: input.id || makeCanvasId("canvas"),
    title: input.title || "Untitled canvas",
    width: input.width || DEFAULT_WIDTH,
    height: input.height || DEFAULT_HEIGHT,
    nodes: normalizeNodes(input.nodes || []),
    edges: input.edges || [],
    metadata: input.metadata
  };
}

export function sortNodes(nodes: CanvasNode[]): CanvasNode[] {
  return [...nodes].sort((a, b) => {
    const zOrder = (a.zIndex ?? 0) - (b.zIndex ?? 0);
    if (zOrder !== 0) return zOrder;
    if (a.type === "section" && b.type !== "section") return -1;
    if (a.type !== "section" && b.type === "section") return 1;
    return a.id.localeCompare(b.id);
  });
}

export function normalizeNodes(nodes: CanvasNode[]): CanvasNode[] {
  return sortNodes(
    nodes.map((node, index) => ({
      ...node,
      width: finiteNumber(node.width, 320),
      height: finiteNumber(node.height, 220),
      x: finiteNumber(node.x, 0),
      y: finiteNumber(node.y, 0),
      zIndex: finiteNumber(node.zIndex, index)
    }))
  );
}

export function makeCanvasId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${random}`;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
