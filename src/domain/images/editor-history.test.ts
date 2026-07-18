import { describe, expect, it } from "vitest";

import {
  commitEditorSnapshot,
  createEditorHistory,
  getEditorOutputDimensions,
  getRotatedDimensions,
  normalizeRectangle,
  redoEditorChange,
  undoEditorChange,
} from "./editor-history";

describe("editor history", () => {
  it("commits, undoes, and redoes immutable snapshots", () => {
    const initial = createEditorHistory();
    const redaction = { x: 10, y: 20, width: 30, height: 40 };
    const changed = commitEditorSnapshot(initial, {
      ...initial.present,
      redactions: [redaction],
    });

    expect(changed.present.redactions).toEqual([redaction]);
    expect(initial.present.redactions).toEqual([]);

    const undone = undoEditorChange(changed);
    expect(undone.present.redactions).toEqual([]);
    expect(undone.future).toHaveLength(1);

    const redone = redoEditorChange(undone);
    expect(redone.present.redactions).toEqual([redaction]);
    expect(redone.future).toEqual([]);
  });

  it("returns the same history when undo or redo is unavailable", () => {
    const initial = createEditorHistory();

    expect(undoEditorChange(initial)).toBe(initial);
    expect(redoEditorChange(initial)).toBe(initial);
  });
});

describe("editor geometry", () => {
  it("normalizes a reverse drag and clamps it to canvas bounds", () => {
    expect(
      normalizeRectangle(
        { x: 90, y: 70 },
        { x: -10, y: 120 },
        { width: 100, height: 80 },
      ),
    ).toEqual({
      x: 0,
      y: 70,
      width: 90,
      height: 10,
    });
  });

  it("swaps dimensions for quarter turns", () => {
    expect(getRotatedDimensions(320, 180, 0)).toEqual({
      width: 320,
      height: 180,
    });
    expect(getRotatedDimensions(320, 180, 90)).toEqual({
      width: 180,
      height: 320,
    });
    expect(getRotatedDimensions(320, 180, 270)).toEqual({
      width: 180,
      height: 320,
    });
  });

  it("uses the current crop for output dimensions", () => {
    expect(
      getEditorOutputDimensions(320, 180, {
        rotation: 90,
        crop: { x: 5, y: 10, width: 80.4, height: 120.6 },
        redactions: [],
      }),
    ).toEqual({ width: 80, height: 121 });
  });
});
