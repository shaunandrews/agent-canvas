import type { CanvasNode, CanvasRect, CanvasViewport } from "../types";

export function nodeToRect(node: CanvasNode): CanvasRect {
  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height
  };
}

export function rectsIntersect(a: CanvasRect, b: CanvasRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function viewportToCanvasRect(viewport: CanvasViewport, screenWidth: number, screenHeight: number): CanvasRect {
  return {
    x: -viewport.x / viewport.scale,
    y: -viewport.y / viewport.scale,
    width: screenWidth / viewport.scale,
    height: screenHeight / viewport.scale
  };
}

export function clampScale(scale: number): number {
  return clamp(scale, 0.18, 2.8);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function fitRectInViewport(rect: CanvasRect, screenWidth: number, screenHeight: number, padding = 72): CanvasViewport {
  const scale = clampScale(Math.min((screenWidth - padding * 2) / rect.width, (screenHeight - padding * 2) / rect.height));
  return {
    scale,
    x: padding - rect.x * scale,
    y: padding - rect.y * scale
  };
}

export function getNodesBounds(nodes: CanvasNode[]): CanvasRect {
  if (!nodes.length) return { x: 0, y: 0, width: 1, height: 1 };

  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY)
  };
}
