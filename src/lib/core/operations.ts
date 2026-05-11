import type { CanvasDocument, CanvasNode, CanvasOperation, CanvasOperationResult, CanvasPlacementPolicy, CanvasViewport } from "../types";
import { sortNodes } from "./document";
import {
  findCanvasNode,
  getDescendantIds,
  getNodePagePosition,
  getSectionChildren,
  isSectionNode,
  toPagePoint,
  toParentPoint,
  wouldCreateParentCycle
} from "./hierarchy";
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
        const node = createNode(document, operation.node, operation.placement, selectedNodeIds);
        document = { ...document, nodes: sortNodes([...document.nodes, node]) };
        results.push({ operation: operation.type, ok: true, id: node.id });
        continue;
      }

      if (operation.type === "createSection") {
        const section = createNode(document, operation.section, operation.placement, selectedNodeIds);
        document = { ...document, nodes: sortNodes([...document.nodes, section]) };
        results.push({ operation: operation.type, ok: true, id: section.id });
        continue;
      }

      if (operation.type === "updateNode") {
        const currentNode = ensureNodeExists(document, operation.id);
        if ("parentId" in operation.patch) {
          ensureValidParent(document, currentNode.id, operation.patch.parentId);
        }
        document = {
          ...document,
          nodes: sortNodes(
            document.nodes.map((node) => (node.id === operation.id ? ({ ...node, ...operation.patch, id: node.id } as typeof node) : node))
          )
        };
        results.push({ operation: operation.type, ok: true, id: operation.id });
        continue;
      }

      if (operation.type === "deleteNode") {
        ensureNodeExists(document, operation.id);
        const deletedIds = new Set([operation.id, ...getDescendantIds(document, operation.id)]);
        document = {
          ...document,
          nodes: document.nodes.filter((node) => !deletedIds.has(node.id)),
          edges: document.edges?.filter((edge) => !deletedIds.has(edge.from) && !deletedIds.has(edge.to))
        };
        selectedNodeIds = selectedNodeIds.filter((id) => !deletedIds.has(id));
        results.push({ operation: operation.type, ok: true, id: operation.id });
        continue;
      }

      if (operation.type === "setNodeParent") {
        const node = ensureNodeExists(document, operation.id);
        ensureValidParent(document, operation.id, operation.parentId);
        const pagePosition = getNodePagePosition(document, node);
        const localPosition =
          operation.preservePagePosition === false ? { x: node.x, y: node.y } : toParentPoint(document, operation.parentId, pagePosition);
        document = {
          ...document,
          nodes: sortNodes(
            document.nodes.map((item) =>
              item.id === operation.id
                ? ({ ...item, parentId: operation.parentId, x: localPosition.x, y: localPosition.y } as typeof item)
                : item
            )
          )
        };
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

      if (operation.type === "layoutSection") {
        const section = ensureNodeExists(document, operation.id);
        if (!isSectionNode(section)) throw new Error(`Node is not a section: ${operation.id}`);
        const children = getSectionChildren(document, operation.id);
        const layout = {
          ...operation.layout,
          origin: operation.layout.origin ? toPagePoint(document, section.id, operation.layout.origin) : operation.layout.origin
        };
        const layoutOperations = layoutCanvasNodes(
          document,
          children.map((node) => node.id),
          layout
        );
        document = applyUpdateOperationsToDocument(document, layoutOperations);
        results.push({ operation: operation.type, ok: true, id: operation.id });
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

function createNode(
  document: CanvasDocument,
  inputNode: CanvasNode,
  placement: CanvasPlacementPolicy | undefined,
  selectedNodeIds: string[]
): CanvasNode {
  ensureUniqueNodeId(document, inputNode.id);
  ensureValidParent(document, inputNode.id, inputNode.parentId);
  const node = placement ? placeCanvasNode(document, inputNode, placement, selectedNodeIds) : inputNode;
  return { ...node, zIndex: node.zIndex ?? defaultZIndex(document, node) };
}

function ensureUniqueNodeId(document: CanvasDocument, id: string): void {
  if (document.nodes.some((node) => node.id === id)) throw new Error(`Node already exists: ${id}`);
}

function ensureNodeExists(document: CanvasDocument, id: string): CanvasNode {
  const node = findCanvasNode(document, id);
  if (!node) throw new Error(`Node not found: ${id}`);
  return node;
}

function ensureValidParent(document: CanvasDocument, nodeId: string, parentId: string | undefined): void {
  if (!parentId) return;
  const parent = ensureNodeExists(document, parentId);
  if (!isSectionNode(parent)) throw new Error(`Parent must be a section: ${parentId}`);
  if (wouldCreateParentCycle(document, nodeId, parentId)) throw new Error(`Cannot parent ${nodeId} to one of its descendants.`);
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

function defaultZIndex(document: CanvasDocument, node: CanvasNode): number {
  if (node.type === "section") return 0;
  return nextZIndex(document);
}
