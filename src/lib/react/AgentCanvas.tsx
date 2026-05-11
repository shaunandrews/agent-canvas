import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from "react";
import { AlignHorizontalSpaceBetween, Crosshair, LayoutGrid, LocateFixed, MousePointer2, ZoomIn, ZoomOut } from "lucide-react";
import { createAgentCanvasContext } from "../core/agent-context";
import { applyCanvasOperations } from "../core/operations";
import { fitRectInViewport, rectsIntersect, viewportToCanvasRect, clampScale } from "../core/geometry";
import { getDescendantIds, getNodePageRect, getNodesPageBounds, getTopLevelNodeIds, toParentPoint } from "../core/hierarchy";
import { snapCanvasRect } from "../core/snapping";
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
  CanvasRect,
  CanvasResizeHandle,
  CanvasResizeOptions,
  CanvasSnapGuide,
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
      excludedNodeIds: string[];
      origins: Record<string, { x: number; y: number }>;
      startBounds: CanvasRect;
    }
  | {
      mode: "node-select-or-pan";
      pointerId: number;
      startX: number;
      startY: number;
      nodeId: string;
      origin: CanvasViewport;
      moved: boolean;
    }
  | {
      mode: "resize";
      pointerId: number;
      startX: number;
      startY: number;
      nodeId: string;
      handle: CanvasResizeHandle;
      startRect: CanvasRect;
      minWidth: number;
      minHeight: number;
    };

const DEFAULT_VIEWPORT: CanvasViewport = { x: 72, y: 72, scale: 1 };
const DEFAULT_RESIZE_HANDLES: CanvasResizeHandle[] = ["nw", "ne", "sw", "se"];

export const AgentCanvas = forwardRef<AgentCanvasHandle, AgentCanvasProps>(function AgentCanvas(
  {
    document,
    renderers,
    initialViewport = DEFAULT_VIEWPORT,
    selectedNodeIds,
    readonly = false,
    theme = "system",
    snap,
    resize = {},
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
  const [snapGuides, setSnapGuides] = useState<CanvasSnapGuide[]>([]);
  const [screenSize, setScreenSize] = useState({ width: 1, height: 1 });
  const mergedRenderers = useMemo(() => ({ ...defaultRenderers, ...renderers }), [renderers]);
  const currentSelection = selectedNodeIds || internalSelection;
  const resizeOptions = useMemo(() => resolveResizeOptions(resize), [resize]);

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

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const syncSurfaceMetrics = () => {
      shell.querySelectorAll<HTMLElement>("[data-agent-node-id]").forEach((nodeElement) => {
        const surface = nodeElement.querySelector<HTMLElement>(".ac-node-surface");
        if (!surface) {
          nodeElement.style.setProperty("--ac-node-surface-top", "0px");
          nodeElement.style.setProperty("--ac-node-surface-right", "0px");
          nodeElement.style.setProperty("--ac-node-surface-bottom", "0px");
          nodeElement.style.setProperty("--ac-node-surface-left", "0px");
          return;
        }

        nodeElement.style.setProperty("--ac-node-surface-top", `${surface.offsetTop}px`);
        nodeElement.style.setProperty("--ac-node-surface-right", `${nodeElement.clientWidth - surface.offsetLeft - surface.offsetWidth}px`);
        nodeElement.style.setProperty("--ac-node-surface-bottom", `${nodeElement.clientHeight - surface.offsetTop - surface.offsetHeight}px`);
        nodeElement.style.setProperty("--ac-node-surface-left", `${surface.offsetLeft}px`);
      });
    };

    syncSurfaceMetrics();
    const observer = new ResizeObserver(syncSurfaceMetrics);
    shell.querySelectorAll("[data-agent-node-id], .ac-node-surface").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [canvasDocument, viewport.scale, mergedRenderers]);

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
    return documentRef.current.nodes.filter((node) => rectsIntersect(getNodePageRect(documentRef.current, node), rect)).map((node) => node.id);
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
      setViewport(fitRectInViewport(getNodePageRect(documentRef.current, node), screenSizeRef.current.width, screenSizeRef.current.height, 96));
    },
    [setSelection, setViewport]
  );

  const fitView = useCallback<AgentCanvasHandle["fitView"]>(() => {
    const bounds = getNodesPageBounds(documentRef.current, documentRef.current.nodes);
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
    const nodeElement = target.closest<HTMLElement>("[data-agent-node-id]");
    const isSectionNonTitle = nodeElement?.dataset.agentNodeType === "section" && !target.closest("[data-agent-section-title]");
    if (event.button !== 0 || target.closest("button") || (nodeElement && !isSectionNonTitle)) return;

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
    const target = event.target as HTMLElement;
    if (node.type === "section" && !target.closest("[data-agent-section-title]")) return;
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

    const nodeIds = getTopLevelNodeIds(canvasDocument, currentSelection);
    const origins = Object.fromEntries(
      nodeIds
        .map((id) => canvasDocument.nodes.find((item) => item.id === id))
        .filter((item) => item && !item.locked)
        .map((item) => {
          const rect = getNodePageRect(canvasDocument, item!);
          return [item!.id, { x: rect.x, y: rect.y }];
        })
    );
    const draggedNodes = canvasDocument.nodes.filter((item) => item.id in origins);
    if (!draggedNodes.length) return;
    const excludedNodeIds = [...new Set(draggedNodes.flatMap((item) => [item.id, ...getDescendantIds(canvasDocument, item.id)]))];

    dragRef.current = {
      mode: "node",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      nodeIds: draggedNodes.map((item) => item.id),
      excludedNodeIds,
      origins,
      startBounds: getNodesPageBounds(canvasDocument, draggedNodes)
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleResizePointerDown(event: ReactPointerEvent<HTMLElement>, node: CanvasNode, handle: CanvasResizeHandle) {
    if (event.button !== 0 || readonly || node.locked || !canResizeNode(node, currentSelection, resizeOptions)) return;
    event.preventDefault();
    event.stopPropagation();

    const minSize = getNodeMinSize(node, resizeOptions);
    dragRef.current = {
      mode: "resize",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      nodeId: node.id,
      handle,
      startRect: getNodePageRect(documentRef.current, node),
      minWidth: minSize.minWidth,
      minHeight: minSize.minHeight
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

    if (drag.mode === "resize") {
      const proposedRect = resizeRectFromHandle(drag.startRect, drag.handle, dx, dy, drag.minWidth, drag.minHeight);
      const snapResult = snapCanvasRect({
        document: documentRef.current,
        rect: proposedRect,
        movingNodeIds: [drag.nodeId],
        options: snap,
        viewportScale: viewportRef.current.scale,
        mode: "resize",
        resizeHandle: drag.handle,
        minWidth: drag.minWidth,
        minHeight: drag.minHeight
      });

      setSnapGuides(snapResult.guides);
      setCanvasDocument((current) => {
        const next = {
          ...current,
          nodes: current.nodes.map((node) => {
            if (node.id !== drag.nodeId) return node;
            const point = toParentPoint(current, node.parentId, snapResult.rect);
            return { ...node, x: point.x, y: point.y, width: snapResult.rect.width, height: snapResult.rect.height } as typeof node;
          })
        };
        documentRef.current = next;
        return next;
      });
      return;
    }

    const proposedBounds = { ...drag.startBounds, x: drag.startBounds.x + dx, y: drag.startBounds.y + dy };
    const snapResult = snapCanvasRect({
      document: documentRef.current,
      rect: proposedBounds,
      movingNodeIds: drag.excludedNodeIds,
      options: snap,
      viewportScale: viewportRef.current.scale,
      mode: "move"
    });
    const snappedDx = snapResult.rect.x - drag.startBounds.x;
    const snappedDy = snapResult.rect.y - drag.startBounds.y;

    setSnapGuides(snapResult.guides);
    setCanvasDocument((current) => {
      const next = {
        ...current,
        nodes: current.nodes.map((node) => {
          const origin = drag.origins[node.id];
          if (!origin) return node;
          const point = toParentPoint(current, node.parentId, { x: origin.x + snappedDx, y: origin.y + snappedDy });
          return { ...node, x: point.x, y: point.y };
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
    setSnapGuides([]);
    if (drag.mode === "pan" && !drag.moved) {
      setSelection([]);
    }
    if (drag.mode === "node-select-or-pan" && !drag.moved) {
      setSelection([drag.nodeId]);
    }
    if (drag.mode === "node" || drag.mode === "resize") {
      const result: CanvasOperationResult = { operation: "updateNode", ok: true };
      onDocumentChange?.(documentRef.current, [result]);
    }
  }

  const visibleNodeIds = useMemo(() => getVisibleNodeIds(), [canvasDocument, getVisibleNodeIds, screenSize, viewport]);
  const sortedNodes = useMemo(() => sortNodes(canvasDocument.nodes), [canvasDocument.nodes]);
  const layoutTargetIds = useMemo(
    () =>
      currentSelection.length > 1
        ? getTopLevelNodeIds(canvasDocument, currentSelection)
        : canvasDocument.nodes.filter((node) => node.type !== "section").map((node) => node.id),
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
      <div
        className="ac-stage"
        data-agent-canvas-stage
        data-agent-header-density={viewport.scale < 0.72 ? "summary" : "full"}
        style={{
          width: canvasDocument.width,
          height: canvasDocument.height,
          "--ac-viewport-scale": viewport.scale,
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`
        } as CSSProperties}
      >
        {sortedNodes.map((node) => {
          const Renderer = mergedRenderers[node.type];
          const selected = currentSelection.includes(node.id);
          const showResizeHandles = canResizeNode(node, currentSelection, resizeOptions);
          const rect = getNodePageRect(canvasDocument, node);
          return (
            <article
              aria-label={getNodeAccessibleLabel(node)}
              aria-selected={selected}
              className={`ac-node ac-node--${node.type}${selected ? " is-selected" : ""}${node.locked ? " is-locked" : ""}`}
              data-agent-node-id={node.id}
              data-agent-node-type={node.type}
              key={node.id}
              onPointerDown={(event) => handleNodePointerDown(event, node)}
              role="button"
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.width,
                height: rect.height,
                zIndex: node.zIndex
              }}
              tabIndex={0}
            >
              {Renderer ? <Renderer node={node as never} selected={selected} /> : null}
              {showResizeHandles ? (
                <div className="ac-resize-layer">
                  {resizeOptions.handles.map((handle) => (
                    <button
                      aria-label={`Resize ${node.title || node.id} from ${getResizeHandleLabel(handle)}`}
                      className={`ac-resize-handle ac-resize-handle--${handle}`}
                      data-agent-resize-handle={handle}
                      key={handle}
                      onPointerDown={(event) => handleResizePointerDown(event, node, handle)}
                      type="button"
                    />
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
        {snapGuides.map((guide) => (
          <div
            aria-hidden="true"
            className={`ac-snap-guide ac-snap-guide--${guide.orientation} ac-snap-guide--${guide.source}`}
            data-agent-snap-guide={guide.source}
            key={guide.id}
            style={
              guide.orientation === "vertical"
                ? { left: guide.position, top: guide.start, height: Math.max(1, guide.end - guide.start) }
                : { top: guide.position, left: guide.start, width: Math.max(1, guide.end - guide.start) }
            }
          />
        ))}
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

interface NormalizedResizeOptions {
  enabled: boolean;
  handles: CanvasResizeHandle[];
  minWidth?: number;
  minHeight?: number;
}

const NODE_MIN_SIZE: Record<CanvasNode["type"], { minWidth: number; minHeight: number }> = {
  document: { minWidth: 240, minHeight: 160 },
  text: { minWidth: 160, minHeight: 96 },
  image: { minWidth: 160, minHeight: 120 },
  video: { minWidth: 160, minHeight: 120 },
  website: { minWidth: 240, minHeight: 160 },
  file: { minWidth: 220, minHeight: 140 },
  section: { minWidth: 260, minHeight: 180 }
};

function resolveResizeOptions(resize: CanvasResizeOptions | false): NormalizedResizeOptions {
  if (resize === false) return { enabled: false, handles: DEFAULT_RESIZE_HANDLES };

  return {
    enabled: resize.enabled ?? true,
    handles: resize.handles?.length ? [...new Set(resize.handles)] : DEFAULT_RESIZE_HANDLES,
    minWidth: resize.minWidth,
    minHeight: resize.minHeight
  };
}

function canResizeNode(node: CanvasNode, selection: string[], resizeOptions: NormalizedResizeOptions) {
  return resizeOptions.enabled && selection.length === 1 && selection[0] === node.id && !node.locked;
}

function getNodeMinSize(node: CanvasNode, resizeOptions: NormalizedResizeOptions) {
  const nodeDefault = NODE_MIN_SIZE[node.type];
  return {
    minWidth: Math.max(1, resizeOptions.minWidth ?? nodeDefault.minWidth),
    minHeight: Math.max(1, resizeOptions.minHeight ?? nodeDefault.minHeight)
  };
}

function resizeRectFromHandle(
  rect: CanvasRect,
  handle: CanvasResizeHandle,
  dx: number,
  dy: number,
  minWidth: number,
  minHeight: number
): CanvasRect {
  let x = rect.x;
  let y = rect.y;
  let width = rect.width;
  let height = rect.height;

  if (handle.includes("w")) {
    const resolvedDx = Math.min(dx, rect.width - minWidth);
    x = rect.x + resolvedDx;
    width = rect.width - resolvedDx;
  } else {
    width = Math.max(minWidth, rect.width + dx);
  }

  if (handle.includes("n")) {
    const resolvedDy = Math.min(dy, rect.height - minHeight);
    y = rect.y + resolvedDy;
    height = rect.height - resolvedDy;
  } else {
    height = Math.max(minHeight, rect.height + dy);
  }

  return { x, y, width, height };
}

function getResizeHandleLabel(handle: CanvasResizeHandle) {
  if (handle === "nw") return "top left";
  if (handle === "ne") return "top right";
  if (handle === "sw") return "bottom left";
  return "bottom right";
}
