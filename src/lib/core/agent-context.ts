import type { AgentCanvasContext, AgentCanvasNodeSummary, CanvasDocument, CanvasNode, CanvasViewport } from "../types";
import { nodeToRect, rectsIntersect, viewportToCanvasRect } from "./geometry";

export function createAgentCanvasContext(
  document: CanvasDocument,
  viewport: CanvasViewport,
  selectedNodeIds: string[],
  screenWidth: number,
  screenHeight: number
): AgentCanvasContext {
  const visibleRect = viewportToCanvasRect(viewport, screenWidth, screenHeight);
  const visibleNodes = document.nodes.filter((node) => rectsIntersect(nodeToRect(node), visibleRect));
  const selectedNodes = document.nodes.filter((node) => selectedNodeIds.includes(node.id));

  return {
    canvas: {
      id: document.id,
      title: document.title,
      viewport
    },
    selected: selectedNodes.map(summarizeNode),
    visible: visibleNodes.map(summarizeNode),
    offscreenCount: Math.max(0, document.nodes.length - visibleNodes.length)
  };
}

export function summarizeNode(node: CanvasNode): AgentCanvasNodeSummary {
  return {
    id: node.id,
    type: node.type,
    title: node.title,
    bounds: nodeToRect(node),
    text: extractNodeText(node),
    tags: node.tags
  };
}

export function extractNodeText(node: CanvasNode): string | undefined {
  if (node.type === "document") return node.content.excerpt || node.content.markdown || stripHtml(node.content.html);
  if (node.type === "text") return node.content.text;
  if (node.type === "image" || node.type === "video") return node.content.caption || node.description;
  if (node.type === "website") return node.content.caption || node.content.url || node.description;
  if (node.type === "file") return node.content.summary || node.content.name;
  if (node.type === "group") return node.content.label || node.description;
  return undefined;
}

function stripHtml(html?: string): string | undefined {
  return html?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
