import type { CanvasDocument, CanvasNode, CanvasOperation, CanvasOperationResult, CanvasViewport } from "../types";
import { sortNodes } from "./document";

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
        document = {
          ...document,
          nodes: sortNodes([...document.nodes, { ...operation.node, zIndex: operation.node.zIndex ?? nextZIndex(document) }])
        };
        results.push({ operation: operation.type, ok: true, id: operation.node.id });
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

function nextZIndex(document: CanvasDocument): number {
  return Math.max(0, ...document.nodes.map((node) => node.zIndex ?? 0)) + 1;
}
