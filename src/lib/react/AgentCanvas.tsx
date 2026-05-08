import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from "react";
import { AlignHorizontalSpaceBetween, Crosshair, LayoutGrid, LocateFixed, MousePointer2, ZoomIn, ZoomOut } from "lucide-react";
import { createAgentCanvasContext } from "../core/agent-context";
import { applyCanvasOperations } from "../core/operations";
import { fitRectInViewport, getNodesBounds, nodeToRect, rectsIntersect, viewportToCanvasRect, clampScale } from "../core/geometry";
import { sortNodes } from "../core/document";
import type {
  AgentCanvasContext,
  AgentCanvasHandle,
  AgentCanvasProps,
  AgentCanvasSnapshot,
  CanvasDocument,
  CanvasNode,
  CanvasOperation,
  CanvasOperationResult,
  CanvasViewport
} from "../types";
import { defaultRenderers, getNodeAccessibleLabel } from "./defaultRenderers";

type DragState =
  | {
      mode: "pan";
      pointerId: number;
      startX: number;
      startY: number;
      origin: CanvasViewport;
      moved: boolean;
    }
  | {
      mode: "node";
      pointerId: number;
      startX: number;
      startY: number;
      nodeIds: string[];
      origins: Record<string, { x: number; y: number }>;
    }
  | {
      mode: "node-select-or-pan";
      pointerId: number;
      startX: number;
      startY: number;
      nodeId: string;
      origin: CanvasViewport;
      moved: boolean;
    };

const DEFAULT_VIEWPORT: CanvasViewport = { x: 72, y: 72, scale: 1 };

export const AgentCanvas = forwardRef<AgentCanvasHandle, AgentCanvasProps>(function AgentCanvas(
  {
    document,
    renderers,
    initialViewport = DEFAULT_VIEWPORT,
    selectedNodeIds,
    readonly = false,
    theme = "system",
    className,
    onDocumentChange,
    onSelectionChange,
    onViewportChange
  },
  ref
) {
  const shellRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [canvasDocument, setCanvasDocument] = useState<CanvasDocument>(document);
  const [viewport, setViewportState] = useState<CanvasViewport>(initialViewport);
  const [internalSelection, setInternalSelection] = useState<string[]>(selectedNodeIds || []);
  const [isPanning, setIsPanning] = useState(false);
  const [screenSize, setScreenSize] = useState({ width: 1, height: 1 });
  const mergedRenderers = useMemo(() => ({ ...defaultRenderers, ...renderers }), [renderers]);
  const currentSelection = selectedNodeIds || internalSelection;

  const documentRef = useRef(canvasDocument);
  const viewportRef = useRef(viewport);
  const selectionRef = useRef(currentSelection);
  const screenSizeRef = useRef(screenSize);

  useEffect(() => {
    setCanvasDocument(document);
  }, [document]);

  useEffect(() => {
    if (selectedNodeIds) setInternalSelection(selectedNodeIds);
  }, [selectedNodeIds]);

  useEffect(() => {
    documentRef.current = canvasDocument;
  }, [canvasDocument]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    selectionRef.current = currentSelection;
  }, [currentSelection]);

  useEffect(() => {
    screenSizeRef.current = screenSize;
  }, [screenSize]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const updateSize = () => {
      const rect = shell.getBoundingClientRect();
      setScreenSize({ width: rect.width || 1, height: rect.height || 1 });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);

  const setViewport = useCallback(
    (next: CanvasViewport | ((current: CanvasViewport) => CanvasViewport)) => {
      setViewportState((current) => {
        const resolved = typeof next === "function" ? next(current) : next;
        const normalized = { ...resolved, scale: clampScale(resolved.scale) };
        onViewportChange?.(normalized);
        return normalized;
      });
    },
    [onViewportChange]
  );

  const setSelection = useCallback(
    (ids: string[]) => {
      const existingIds = ids.filter((id) => documentRef.current.nodes.some((node) => node.id === id));
      setInternalSelection(existingIds);
      onSelectionChange?.(existingIds);
    },
    [onSelectionChange]
  );

  const getVisibleNodeIds = useCallback(() => {
    const { width, height } = screenSizeRef.current;
    const rect = viewportToCanvasRect(viewportRef.current, width, height);
    return documentRef.current.nodes.filter((node) => rectsIntersect(nodeToRect(node), rect)).map((node) => node.id);
  }, []);

  const getSnapshot = useCallback<AgentCanvasHandle["getSnapshot"]>(
    () => ({
      document: documentRef.current,
      viewport: viewportRef.current,
      selectedNodeIds: selectionRef.current,
      visibleNodeIds: getVisibleNodeIds()
    }),
    [getVisibleNodeIds]
  );

  const getAgentContext = useCallback<AgentCanvasHandle["getAgentContext"]>(() => {
    const { width, height } = screenSizeRef.current;
    return createAgentCanvasContext(documentRef.current, viewportRef.current, selectionRef.current, width, height);
  }, []);

  const focusNode = useCallback<AgentCanvasHandle["focusNode"]>(
    (id) => {
      const node = documentRef.current.nodes.find((item) => item.id === id);
      if (!node) return;
      setSelection([id]);
      setViewport(fitRectInViewport(nodeToRect(node), screenSizeRef.current.width, screenSizeRef.current.height, 96));
    },
    [setSelection, setViewport]
  );

  const fitView = useCallback<AgentCanvasHandle["fitView"]>(() => {
    const bounds = getNodesBounds(documentRef.current.nodes);
    setViewport(fitRectInViewport(bounds, screenSizeRef.current.width, screenSizeRef.current.height, 80));
  }, [setViewport]);

  const applyOperations = useCallback<AgentCanvasHandle["applyOperations"]>(
    (operations) => {
      const next = applyCanvasOperations(
        {
          document: documentRef.current,
          selectedNodeIds: selectionRef.current,
          viewport: viewportRef.current
        },
        operations
      );

      setCanvasDocument(next.document);
      setInternalSelection(next.selectedNodeIds);
      setViewportState(next.viewport);
      onDocumentChange?.(next.document, next.results);
      onSelectionChange?.(next.selectedNodeIds);
      onViewportChange?.(next.viewport);

      const focusOperation = findLastFocusOperation(operations);
      if (focusOperation?.type === "focus" && next.results.some((result) => result.ok && result.id === focusOperation.id)) {
        requestAnimationFrame(() => focusNode(focusOperation.id));
      }

      return next.results;
    },
    [focusNode, onDocumentChange, onSelectionChange, onViewportChange]
  );

  useImperativeHandle(
    ref,
    () => ({
      getSnapshot,
      getAgentContext,
      applyOperations,
      fitView,
      focusNode
    }),
    [applyOperations, fitView, focusNode, getAgentContext, getSnapshot]
  );

  function zoomBy(factor: number, origin?: { x: number; y: number }) {
    setViewport((current) => {
      const scale = clampScale(current.scale * factor);
      const point = origin || {
        x: screenSizeRef.current.width / 2,
        y: screenSizeRef.current.height / 2
      };
      const canvasX = (point.x - current.x) / current.scale;
      const canvasY = (point.y - current.y) / current.scale;

      return {
        scale,
        x: point.x - canvasX * scale,
        y: point.y - canvasY * scale
      };
    });
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.metaKey || event.ctrlKey) {
      const rect = shellRef.current?.getBoundingClientRect();
      zoomBy(Math.exp(-event.deltaY * 0.0012), {
        x: event.clientX - (rect?.left || 0),
        y: event.clientY - (rect?.top || 0)
      });
      return;
    }

    setViewport((current) => ({
      ...current,
      x: current.x - event.deltaX,
      y: current.y - event.deltaY
    }));
  }

  function handleBackgroundPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (event.button !== 0 || target.closest("[data-agent-node-id]") || target.closest("button")) return;

    dragRef.current = {
      mode: "pan",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: viewportRef.current,
      moved: false
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleNodePointerDown(event: ReactPointerEvent<HTMLElement>, node: CanvasNode) {
    if (event.button !== 0) return;
    event.stopPropagation();

    const alreadySelected = currentSelection.includes(node.id);

    if (!alreadySelected) {
      dragRef.current = {
        mode: "node-select-or-pan",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        nodeId: node.id,
        origin: viewportRef.current,
        moved: false
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (readonly || node.locked) return;

    const origins = Object.fromEntries(
      currentSelection
        .map((id) => canvasDocument.nodes.find((item) => item.id === id))
        .filter(Boolean)
        .map((item) => [item!.id, { x: item!.x, y: item!.y }])
    );

    dragRef.current = {
      mode: "node",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      nodeIds: currentSelection,
      origins
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (drag.mode === "pan") {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) {
        drag.moved = true;
      }
      setViewport({
        ...drag.origin,
        x: drag.origin.x + event.clientX - drag.startX,
        y: drag.origin.y + event.clientY - drag.startY
      });
      return;
    }

    if (drag.mode === "node-select-or-pan") {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) {
        drag.moved = true;
        setIsPanning(true);
      }

      if (drag.moved) {
        setViewport({
          ...drag.origin,
          x: drag.origin.x + event.clientX - drag.startX,
          y: drag.origin.y + event.clientY - drag.startY
        });
      }
      return;
    }

    const dx = (event.clientX - drag.startX) / viewportRef.current.scale;
    const dy = (event.clientY - drag.startY) / viewportRef.current.scale;
    setCanvasDocument((current) => {
      const next = {
        ...current,
        nodes: current.nodes.map((node) => {
          const origin = drag.origins[node.id];
          return origin ? { ...node, x: origin.x + dx, y: origin.y + dy } : node;
        })
      };
      documentRef.current = next;
      return next;
    });
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    dragRef.current = null;
    setIsPanning(false);
    if (drag.mode === "pan" && !drag.moved) {
      setSelection([]);
    }
    if (drag.mode === "node-select-or-pan" && !drag.moved) {
      setSelection([drag.nodeId]);
    }
    if (drag.mode === "node") {
      const result: CanvasOperationResult = { operation: "updateNode", ok: true };
      onDocumentChange?.(documentRef.current, [result]);
    }
  }

  const visibleNodeIds = useMemo(() => getVisibleNodeIds(), [canvasDocument, getVisibleNodeIds, screenSize, viewport]);
  const sortedNodes = useMemo(() => sortNodes(canvasDocument.nodes), [canvasDocument.nodes]);
  const layoutTargetIds = useMemo(
    () => (currentSelection.length > 1 ? currentSelection : canvasDocument.nodes.filter((node) => node.type !== "group").map((node) => node.id)),
    [canvasDocument.nodes, currentSelection]
  );
  const context: AgentCanvasContext = useMemo(
    () => createAgentCanvasContext(canvasDocument, viewport, currentSelection, screenSize.width, screenSize.height),
    [canvasDocument, currentSelection, screenSize.height, screenSize.width, viewport]
  );

  function tidyRow() {
    if (layoutTargetIds.length < 2) return;
    applyOperations([{ type: "layoutNodes", ids: layoutTargetIds, layout: { mode: "row", gap: 32 } }]);
  }

  function tidyGrid() {
    if (layoutTargetIds.length < 2) return;
    applyOperations([{ type: "tidyNodes", ids: layoutTargetIds, layout: { mode: "grid", gap: 32, columns: 3 } }]);
  }

  return (
    <section
      ref={shellRef}
      className={["ac-shell", theme !== "system" ? `ac-theme-${theme}` : "", isPanning ? "is-panning" : "", readonly ? "is-readonly" : "", className || ""].join(" ")}
      data-agent-canvas-theme={theme}
      aria-label={`${canvasDocument.title} canvas`}
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onWheel={handleWheel}
      tabIndex={0}
    >
      <div className="ac-grid" aria-hidden="true" />
      <div
        className="ac-stage"
        data-agent-canvas-stage
        style={{
          width: canvasDocument.width,
          height: canvasDocument.height,
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`
        }}
      >
        {sortedNodes.map((node) => {
          const Renderer = mergedRenderers[node.type];
          const selected = currentSelection.includes(node.id);
          return (
            <article
              aria-label={getNodeAccessibleLabel(node)}
              aria-selected={selected}
              className={`ac-node ac-node--${node.type}${selected ? " is-selected" : ""}${node.locked ? " is-locked" : ""}`}
              data-agent-node-id={node.id}
              key={node.id}
              onPointerDown={(event) => handleNodePointerDown(event, node)}
              role="button"
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                zIndex: node.zIndex
              }}
              tabIndex={0}
            >
              {Renderer ? <Renderer node={node as never} selected={selected} /> : null}
            </article>
          );
        })}
      </div>

      <div className="ac-toolbar" role="toolbar" aria-label="Canvas controls">
        <button type="button" onClick={() => setSelection([])} data-tooltip="Selection tool" aria-label="Selection tool">
          <MousePointer2 size={14} />
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.18)} data-tooltip="Zoom out" aria-label="Zoom out">
          <ZoomOut size={14} />
        </button>
        <span aria-label="Zoom level">{Math.round(viewport.scale * 100)}%</span>
        <button type="button" onClick={() => zoomBy(1.18)} data-tooltip="Zoom in" aria-label="Zoom in">
          <ZoomIn size={14} />
        </button>
        <button type="button" onClick={fitView} data-tooltip="Fit canvas" aria-label="Fit canvas">
          <LocateFixed size={14} />
        </button>
        <button type="button" onClick={tidyRow} data-tooltip="Tidy row" aria-label="Tidy row" disabled={layoutTargetIds.length < 2}>
          <AlignHorizontalSpaceBetween size={14} />
        </button>
        <button type="button" onClick={tidyGrid} data-tooltip="Tidy grid" aria-label="Tidy grid" disabled={layoutTargetIds.length < 2}>
          <LayoutGrid size={14} />
        </button>
        <button
          type="button"
          onClick={() => currentSelection[0] && focusNode(currentSelection[0])}
          data-tooltip="Focus selection"
          aria-label="Focus selection"
          disabled={!currentSelection.length}
        >
          <Crosshair size={14} />
        </button>
      </div>

      <div className="ac-status" aria-live="polite">
        <strong>{canvasDocument.title}</strong>
        <span>{canvasDocument.nodes.length} nodes</span>
        <span>{visibleNodeIds.length} visible</span>
        <span>{context.offscreenCount} offscreen</span>
      </div>
    </section>
  );
});

function findLastFocusOperation(operations: CanvasOperation[]) {
  for (let index = operations.length - 1; index >= 0; index -= 1) {
    const operation = operations[index];
    if (operation.type === "focus") return operation;
  }
  return undefined;
}
