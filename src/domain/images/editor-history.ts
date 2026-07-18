export type QuarterTurn = 0 | 90 | 180 | 270;

export interface Point {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditorSnapshot {
  rotation: QuarterTurn;
  crop: Rectangle | null;
  redactions: Rectangle[];
}

export interface EditorHistory {
  past: EditorSnapshot[];
  present: EditorSnapshot;
  future: EditorSnapshot[];
}

export interface Dimensions {
  width: number;
  height: number;
}

export function createEditorSnapshot(): EditorSnapshot {
  return {
    rotation: 0,
    crop: null,
    redactions: [],
  };
}

export function createEditorHistory(): EditorHistory {
  return {
    past: [],
    present: createEditorSnapshot(),
    future: [],
  };
}

export function commitEditorSnapshot(
  history: EditorHistory,
  next: EditorSnapshot,
): EditorHistory {
  return {
    past: [...history.past, cloneSnapshot(history.present)],
    present: cloneSnapshot(next),
    future: [],
  };
}

export function undoEditorChange(history: EditorHistory): EditorHistory {
  const previous = history.past.at(-1);

  if (previous === undefined) {
    return history;
  }

  return {
    past: history.past.slice(0, -1),
    present: cloneSnapshot(previous),
    future: [cloneSnapshot(history.present), ...history.future],
  };
}

export function redoEditorChange(history: EditorHistory): EditorHistory {
  const next = history.future[0];

  if (next === undefined) {
    return history;
  }

  return {
    past: [...history.past, cloneSnapshot(history.present)],
    present: cloneSnapshot(next),
    future: history.future.slice(1),
  };
}

export function normalizeRectangle(
  start: Point,
  end: Point,
  bounds: Dimensions,
): Rectangle {
  const startX = clamp(start.x, 0, bounds.width);
  const startY = clamp(start.y, 0, bounds.height);
  const endX = clamp(end.x, 0, bounds.width);
  const endY = clamp(end.y, 0, bounds.height);

  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  };
}

export function getRotatedDimensions(
  sourceWidth: number,
  sourceHeight: number,
  rotation: QuarterTurn,
): Dimensions {
  return rotation === 90 || rotation === 270
    ? { width: sourceHeight, height: sourceWidth }
    : { width: sourceWidth, height: sourceHeight };
}

export function getEditorOutputDimensions(
  sourceWidth: number,
  sourceHeight: number,
  snapshot: EditorSnapshot,
): Dimensions {
  if (snapshot.crop !== null) {
    return {
      width: Math.max(1, Math.round(snapshot.crop.width)),
      height: Math.max(1, Math.round(snapshot.crop.height)),
    };
  }

  return getRotatedDimensions(sourceWidth, sourceHeight, snapshot.rotation);
}

function cloneSnapshot(snapshot: EditorSnapshot): EditorSnapshot {
  return {
    rotation: snapshot.rotation,
    crop: snapshot.crop === null ? null : { ...snapshot.crop },
    redactions: snapshot.redactions.map((redaction) => ({ ...redaction })),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
