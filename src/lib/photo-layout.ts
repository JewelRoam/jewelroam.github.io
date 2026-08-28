import justifiedLayout from "justified-layout";

export type PhotoLayoutPreset = "export" | "reading";

type PhotoLayoutBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type PhotoLayoutGeometry = {
  containerHeight: number;
  boxes: PhotoLayoutBox[];
};

const READING_GAP = 16;

function clamp(minimum: number, value: number, maximum: number) {
  return Math.max(minimum, Math.min(value, maximum));
}

function readingRowHeight(aspectRatios: number[], containerWidth: number) {
  if (aspectRatios.every((ratio) => ratio < 0.9)) {
    return clamp(360, containerWidth / 3, 480);
  }
  if (aspectRatios.length === 2) {
    return clamp(280, containerWidth / 4, 380);
  }
  return clamp(260, containerWidth / 4.8, 340);
}

function centerIncompleteRows(boxes: PhotoLayoutBox[], containerWidth: number) {
  const rows = new Map<number, PhotoLayoutBox[]>();
  for (const box of boxes) {
    const row = rows.get(box.top) ?? [];
    row.push(box);
    rows.set(box.top, row);
  }

  for (const row of rows.values()) {
    const left = Math.min(...row.map((box) => box.left));
    const right = Math.max(...row.map((box) => box.left + box.width));
    const offset = (containerWidth - (right - left)) / 2 - left;
    if (offset <= 0.5) continue;
    for (const box of row) box.left += offset;
  }
}

export function createJustifiedGeometry(
  aspectRatios: number[],
  containerWidth: number,
  preset: PhotoLayoutPreset,
): PhotoLayoutGeometry {
  const ratios = aspectRatios.map((ratio) => Number.isFinite(ratio) && ratio > 0 ? ratio : 1);
  const geometry = justifiedLayout(ratios, preset === "export" ? {
    containerWidth,
    targetRowHeight: clamp(260, containerWidth / 2.5, 430),
    boxSpacing: 20,
    containerPadding: 0,
    showWidows: true,
  } : {
    containerWidth,
    targetRowHeight: readingRowHeight(ratios, containerWidth),
    targetRowHeightTolerance: 0.25,
    boxSpacing: READING_GAP,
    containerPadding: 0,
    showWidows: true,
  });

  if (preset === "reading") centerIncompleteRows(geometry.boxes, containerWidth);
  return geometry;
}
