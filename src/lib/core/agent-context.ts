import type {
  AgentCanvasContext,
  AgentCanvasNodeSummary,
  AgentCanvasSectionSummary,
  CanvasDocument,
  CanvasNode,
  CanvasViewport
} from "../types";
import { nodeToRect, rectsIntersect, viewportToCanvasRect } from "./geometry";
import { getNodePageRect, getSectionChildren } from "./hierarchy";

export function createAgentCanvasContext(
  document: CanvasDocument,
  viewport: CanvasViewport,
  selectedNodeIds: string[],
  screenWidth: number,
  screenHeight: number
): AgentCanvasContext {
  const visibleRect = viewportToCanvasRect(viewport, screenWidth, screenHeight);
  const visibleNodes = document.nodes.filter((node) => rectsIntersect(getNodePageRect(document, node), visibleRect));
  const selectedNodes = document.nodes.filter((node) => selectedNodeIds.includes(node.id));
  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));

  return {
    canvas: {
      id: document.id,
      title: document.title,
      viewport
    },
    sections: document.nodes.filter((node) => node.type === "section").map((node) => summarizeSection(document, node, visibleNodeIds)),
    selected: selectedNodes.map((node) => summarizeNode(node, document)),
    visible: visibleNodes.map((node) => summarizeNode(node, document)),
    offscreenCount: Math.max(0, document.nodes.length - visibleNodes.length)
  };
}

export function summarizeNode(node: CanvasNode, document?: CanvasDocument): AgentCanvasNodeSummary {
  return {
    id: node.id,
    type: node.type,
    title: node.title,
    parentId: node.parentId,
    bounds: document ? getNodePageRect(document, node) : nodeToRect(node),
    text: extractNodeText(node),
    tags: node.tags
  };
}

export function summarizeSection(
  document: CanvasDocument,
  section: CanvasNode,
  visibleNodeIds: Set<string> = new Set()
): AgentCanvasSectionSummary {
  const children = getSectionChildren(document, section.id);
  return {
    id: section.id,
    title: section.title,
    label: section.type === "section" ? section.content.label : undefined,
    description: section.type === "section" ? section.content.description || section.description : section.description,
    bounds: getNodePageRect(document, section),
    childNodeIds: children.map((node) => node.id),
    visibleChildNodeIds: children.filter((node) => visibleNodeIds.has(node.id)).map((node) => node.id),
    childCount: children.length
  };
}

export function extractNodeText(node: CanvasNode): string | undefined {
  if (node.type === "document") return node.content.excerpt || node.content.markdown || stripHtml(node.content.html);
  if (node.type === "text") return node.content.text;
  if (node.type === "image" || node.type === "video") return node.content.caption || node.description;
  if (node.type === "website") return node.content.caption || node.content.url || node.description;
  if (node.type === "file") return node.content.summary || node.content.name;
  if (node.type === "section") return node.content.label || node.content.description || node.description;
  return undefined;
}

function stripHtml(html?: string): string | undefined {
  return html?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
