import type { CanvasDocument, CanvasNode, CanvasOperation, CanvasOperationResult, CanvasViewport } from "../types";
import { sortNodes } from "./document";
import { layoutCanvasNodes, placeCanvasNode, tidyCanvasNodes } from "./layout";

export interface ApplyCanvasOperationsState {
  document: CanvasDocument;
  selectedNodeIds: string[];
  viewport: CanvasViewport;
}

export interface ApplyCanvasOperationsResult extends ApplyCanvasOperationsState {
  results: CanvasOperationResult[];
}

export function applyCanvasOperations(
  state: ApplyCanvasOperationsState,
  operations: CanvasOperation[]
): ApplyCanvasOperationsResult {
  let document = cloneDocument(state.document);
  let selectedNodeIds = [...state.selectedNodeIds];
  let viewport = { ...state.viewport };
  const results: CanvasOperationResult[] = [];

  for (const operation of operations) {
    try {
      if (operation.type === "createNode") {
        ensureUniqueNodeId(document, operation.node.id);
        const node = operation.placement ? placeCanvasNode(document, operation.node, operation.placement, selectedNodeIds) : operation.node;
        document = {
          ...document,
          nodes: sortNodes([...document.nodes, { ...node, zIndex: node.zIndex ?? nextZIndex(document) }])
        };
        results.push({ operation: operation.type, ok: true, id: node.id });
        continue;
      }

      if (operation.type === "updateNode") {
        document = {
          ...document,
          nodes: sortNodes(
            document.nodes.map((node) => (node.id === operation.id ? ({ ...node, ...operation.patch, id: node.id } as typeof node) : node))
          )
        };
        ensureNodeExists(document, operation.id);
        results.push({ operation: operation.type, ok: true, id: operation.id });
        continue;
      }

      if (operation.type === "deleteNode") {
        ensureNodeExists(document, operation.id);
        document = {
          ...document,
          nodes: document.nodes.filter((node) => node.id !== operation.id),
          edges: document.edges?.filter((edge) => edge.from !== operation.id && edge.to !== operation.id)
        };
        selectedNodeIds = selectedNodeIds.filter((id) => id !== operation.id);
        results.push({ operation: operation.type, ok: true, id: operation.id });
        continue;
      }

      if (operation.type === "bringToFront") {
        ensureNodeExists(document, operation.id);
        const zIndex = nextZIndex(document);
        document = {
          ...document,
          nodes: sortNodes(document.nodes.map((node) => (node.id === operation.id ? { ...node, zIndex } : node)))
        };
        results.push({ operation: operation.type, ok: true, id: operation.id });
        continue;
      }

      if (operation.type === "sendToBack") {
        ensureNodeExists(document, operation.id);
        const zIndex = Math.min(0, ...document.nodes.map((node) => node.zIndex ?? 0)) - 1;
        document = {
          ...document,
          nodes: sortNodes(document.nodes.map((node) => (node.id === operation.id ? { ...node, zIndex } : node)))
        };
        results.push({ operation: operation.type, ok: true, id: operation.id });
        continue;
      }

      if (operation.type === "layoutNodes") {
        operation.ids.forEach((id) => ensureNodeExists(document, id));
        const layoutOperations = layoutCanvasNodes(document, operation.ids, operation.layout);
        document = applyUpdateOperationsToDocument(document, layoutOperations);
        results.push({ operation: operation.type, ok: true });
        continue;
      }

      if (operation.type === "tidyNodes") {
        operation.ids.forEach((id) => ensureNodeExists(document, id));
        const layoutOperations = tidyCanvasNodes(document, operation.ids, operation.layout);
        document = applyUpdateOperationsToDocument(document, layoutOperations);
        results.push({ operation: operation.type, ok: true });
        continue;
      }

      if (operation.type === "select") {
        selectedNodeIds = operation.ids.filter((id) => document.nodes.some((node) => node.id === id));
        results.push({ operation: operation.type, ok: true });
        continue;
      }

      if (operation.type === "focus") {
        ensureNodeExists(document, operation.id);
        selectedNodeIds = [operation.id];
        results.push({ operation: operation.type, ok: true, id: operation.id });
        continue;
      }

      if (operation.type === "setViewport") {
        viewport = operation.viewport;
        results.push({ operation: operation.type, ok: true });
      }
    } catch (error) {
      results.push({
        operation: operation.type,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown operation error"
      });
    }
  }

  return { document, selectedNodeIds, viewport, results };
}

function cloneDocument(document: CanvasDocument): CanvasDocument {
  return {
    ...document,
    nodes: document.nodes.map(cloneNode),
    edges: document.edges?.map((edge) => ({ ...edge }))
  };
}

function cloneNode<TNode extends CanvasNode>(node: TNode): TNode {
  return { ...node, content: { ...node.content } } as TNode;
}

function ensureUniqueNodeId(document: CanvasDocument, id: string): void {
  if (document.nodes.some((node) => node.id === id)) throw new Error(`Node already exists: ${id}`);
}

function ensureNodeExists(document: CanvasDocument, id: string): void {
  if (!document.nodes.some((node) => node.id === id)) throw new Error(`Node not found: ${id}`);
}

function applyUpdateOperationsToDocument(document: CanvasDocument, operations: CanvasOperation[]): CanvasDocument {
  const patches = new Map<string, { x?: number; y?: number }>();
  for (const operation of operations) {
    if (operation.type === "updateNode") {
      const patch: { x?: number; y?: number } = {};
      if (typeof operation.patch.x === "number") patch.x = operation.patch.x;
      if (typeof operation.patch.y === "number") patch.y = operation.patch.y;
      patches.set(operation.id, { ...(patches.get(operation.id) || {}), ...patch });
    }
  }

  return {
    ...document,
    nodes: sortNodes(document.nodes.map((node) => (patches.has(node.id) ? ({ ...node, ...patches.get(node.id), id: node.id } as typeof node) : node)))
  };
}

function nextZIndex(document: CanvasDocument): number {
  return Math.max(0, ...document.nodes.map((node) => node.zIndex ?? 0)) + 1;
}
