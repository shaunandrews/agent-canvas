import type {
  CanvasAlignmentSnapOptions,
  CanvasDocument,
  CanvasGridSnapOptions,
  CanvasRect,
  CanvasResizeHandle,
  CanvasSnapGuide,
  CanvasSnapOptions,
  CanvasSnapTarget
} from "../types";
import { nodeToRect } from "./geometry";

const DEFAULT_GRID_SIZE = 24;
const DEFAULT_THRESHOLD_PX = 8;
const DEFAULT_ALIGNMENT_TARGETS: CanvasSnapTarget[] = ["edge", "center"];

type Axis = "x" | "y";
type XPoint = "left" | "centerX" | "right";
type YPoint = "top" | "centerY" | "bottom";
type AxisPoint = XPoint | YPoint;

interface NormalizedSnapOptions {
  enabled: boolean;
  showGuides: boolean;
  thresholdPx: number;
  grid: Required<CanvasGridSnapOptions>;
  alignment: Required<CanvasAlignmentSnapOptions>;
}

interface SnapCandidate {
  position: number;
  start: number;
  end: number;
  source: CanvasSnapGuide["source"];
  priority: number;
}

interface AxisSnap {
  axis: Axis;
  delta: number;
  candidate: SnapCandidate;
}

export interface SnapCanvasRectInput {
  document: CanvasDocument;
  rect: CanvasRect;
  movingNodeIds: string[];
  options?: CanvasSnapOptions;
  viewportScale?: number;
  mode?: "move" | "resize";
  resizeHandle?: CanvasResizeHandle;
  minWidth?: number;
  minHeight?: number;
}

export interface SnapCanvasRectResult {
  rect: CanvasRect;
  guides: CanvasSnapGuide[];
}

export function snapCanvasRect({
  document,
  rect,
  movingNodeIds,
  options,
  viewportScale = 1,
  mode = "move",
  resizeHandle,
  minWidth = 1,
  minHeight = 1
}: SnapCanvasRectInput): SnapCanvasRectResult {
  const snapOptions = normalizeSnapOptions(options);
  if (!snapOptions.enabled) return { rect, guides: [] };

  const excludedIds = new Set(movingNodeIds);
  const candidates = getSnapCandidates(document, excludedIds, snapOptions.alignment);
  const threshold = snapOptions.thresholdPx / Math.max(0.001, viewportScale);
  const xSnap = findAxisSnap("x", rect, getActiveXPoints(mode, resizeHandle), candidates.x, snapOptions.grid, threshold);
  const ySnap = findAxisSnap("y", rect, getActiveYPoints(mode, resizeHandle), candidates.y, snapOptions.grid, threshold);
  let nextRect = { ...rect };
  const guides: CanvasSnapGuide[] = [];

  if (xSnap && canApplyAxisSnap(nextRect, xSnap, mode, resizeHandle, minWidth, minHeight)) {
    nextRect = applyAxisSnap(nextRect, xSnap, mode, resizeHandle);
    if (snapOptions.showGuides) guides.push(createGuide(xSnap, rect, "x"));
  }

  if (ySnap && canApplyAxisSnap(nextRect, ySnap, mode, resizeHandle, minWidth, minHeight)) {
    nextRect = applyAxisSnap(nextRect, ySnap, mode, resizeHandle);
    if (snapOptions.showGuides) guides.push(createGuide(ySnap, rect, "y"));
  }

  return { rect: nextRect, guides };
}

function normalizeSnapOptions(options?: CanvasSnapOptions): NormalizedSnapOptions {
  const enabled = options?.enabled === true;
  const grid = normalizeGridOptions(options?.grid);
  const alignment = normalizeAlignmentOptions(options?.alignment);

  return {
    enabled,
    showGuides: options?.showGuides ?? true,
    thresholdPx: Math.max(1, options?.thresholdPx ?? DEFAULT_THRESHOLD_PX),
    grid,
    alignment
  };
}

function normalizeGridOptions(options?: CanvasGridSnapOptions): Required<CanvasGridSnapOptions> {
  return {
    enabled: options?.enabled ?? false,
    size: Math.max(1, options?.size ?? DEFAULT_GRID_SIZE)
  };
}

function normalizeAlignmentOptions(options?: CanvasAlignmentSnapOptions): Required<CanvasAlignmentSnapOptions> {
  return {
    enabled: options?.enabled ?? true,
    targets: options?.targets?.length ? options.targets : DEFAULT_ALIGNMENT_TARGETS,
    includeGroups: options?.includeGroups ?? false
  };
}

function getSnapCandidates(
  document: CanvasDocument,
  excludedIds: Set<string>,
  alignment: Required<CanvasAlignmentSnapOptions>
): { x: SnapCandidate[]; y: SnapCandidate[] } {
  if (!alignment.enabled) return { x: [], y: [] };

  const includeEdges = alignment.targets.includes("edge");
  const includeCenters = alignment.targets.includes("center");
  const x: SnapCandidate[] = [];
  const y: SnapCandidate[] = [];

  for (const node of document.nodes) {
    if (excludedIds.has(node.id) || (!alignment.includeGroups && node.type === "group")) continue;
    const rect = nodeToRect(node);
    const xRange = { start: rect.y, end: rect.y + rect.height };
    const yRange = { start: rect.x, end: rect.x + rect.width };

    if (includeEdges) {
      x.push(axisCandidate(rect.x, xRange), axisCandidate(rect.x + rect.width, xRange));
      y.push(axisCandidate(rect.y, yRange), axisCandidate(rect.y + rect.height, yRange));
    }

    if (includeCenters) {
      x.push(axisCandidate(rect.x + rect.width / 2, xRange));
      y.push(axisCandidate(rect.y + rect.height / 2, yRange));
    }
  }

  return { x, y };
}

function axisCandidate(position: number, range: { start: number; end: number }): SnapCandidate {
  return {
    position,
    start: range.start,
    end: range.end,
    source: "alignment",
    priority: 1
  };
}

function findAxisSnap(
  axis: Axis,
  rect: CanvasRect,
  points: AxisPoint[],
  candidates: SnapCandidate[],
  grid: Required<CanvasGridSnapOptions>,
  threshold: number
): AxisSnap | undefined {
  const allCandidates = grid.enabled ? [...candidates, ...getGridCandidates(axis, rect, points, grid.size)] : candidates;
  let best: AxisSnap | undefined;

  for (const point of points) {
    const pointPosition = getPointPosition(rect, point);
    for (const candidate of allCandidates) {
      const delta = candidate.position - pointPosition;
      if (Math.abs(delta) > threshold) continue;
      if (
        !best ||
        Math.abs(delta) < Math.abs(best.delta) ||
        (Math.abs(delta) === Math.abs(best.delta) && candidate.priority > best.candidate.priority)
      ) {
        best = { axis, delta, candidate };
      }
    }
  }

  return best;
}

function getGridCandidates(axis: Axis, rect: CanvasRect, points: AxisPoint[], gridSize: number): SnapCandidate[] {
  return points.map((point) => {
    const position = snapNumber(getPointPosition(rect, point), gridSize);
    return {
      position,
      start: axis === "x" ? rect.y : rect.x,
      end: axis === "x" ? rect.y + rect.height : rect.x + rect.width,
      source: "grid",
      priority: 0
    };
  });
}

function getActiveXPoints(mode: "move" | "resize", handle?: CanvasResizeHandle): XPoint[] {
  if (mode === "resize") return handle?.includes("w") ? ["left"] : ["right"];
  return ["left", "centerX", "right"];
}

function getActiveYPoints(mode: "move" | "resize", handle?: CanvasResizeHandle): YPoint[] {
  if (mode === "resize") return handle?.includes("n") ? ["top"] : ["bottom"];
  return ["top", "centerY", "bottom"];
}

function getPointPosition(rect: CanvasRect, point: AxisPoint) {
  if (point === "left") return rect.x;
  if (point === "centerX") return rect.x + rect.width / 2;
  if (point === "right") return rect.x + rect.width;
  if (point === "top") return rect.y;
  if (point === "centerY") return rect.y + rect.height / 2;
  return rect.y + rect.height;
}

function canApplyAxisSnap(
  rect: CanvasRect,
  snap: AxisSnap,
  mode: "move" | "resize",
  handle: CanvasResizeHandle | undefined,
  minWidth: number,
  minHeight: number
) {
  if (mode === "move") return true;
  if (snap.axis === "x" && handle?.includes("w")) return rect.width - snap.delta >= minWidth;
  if (snap.axis === "x") return rect.width + snap.delta >= minWidth;
  if (handle?.includes("n")) return rect.height - snap.delta >= minHeight;
  return rect.height + snap.delta >= minHeight;
}

function applyAxisSnap(rect: CanvasRect, snap: AxisSnap, mode: "move" | "resize", handle?: CanvasResizeHandle): CanvasRect {
  if (mode === "move") {
    return snap.axis === "x" ? { ...rect, x: rect.x + snap.delta } : { ...rect, y: rect.y + snap.delta };
  }

  if (snap.axis === "x") {
    if (handle?.includes("w")) return { ...rect, x: rect.x + snap.delta, width: rect.width - snap.delta };
    return { ...rect, width: rect.width + snap.delta };
  }

  if (handle?.includes("n")) return { ...rect, y: rect.y + snap.delta, height: rect.height - snap.delta };
  return { ...rect, height: rect.height + snap.delta };
}

function createGuide(snap: AxisSnap, rect: CanvasRect, axis: Axis): CanvasSnapGuide {
  const start = Math.min(snap.candidate.start, axis === "x" ? rect.y : rect.x);
  const end = Math.max(snap.candidate.end, axis === "x" ? rect.y + rect.height : rect.x + rect.width);

  return {
    id: `${snap.candidate.source}-${axis}-${snap.candidate.position}`,
    orientation: axis === "x" ? "vertical" : "horizontal",
    position: snap.candidate.position,
    start,
    end,
    source: snap.candidate.source
  };
}

function snapNumber(value: number, gridSize: number) {
  return Math.round(value / gridSize) * gridSize;
}
