declare module "justified-layout" {
  type Box = {
    left: number;
    top: number;
    width: number;
    height: number;
  };

  type Layout = {
    containerHeight: number;
    boxes: Box[];
  };

  type Options = {
    containerWidth?: number;
    containerPadding?: number | { top?: number; right?: number; bottom?: number; left?: number };
    boxSpacing?: number | { horizontal?: number; vertical?: number };
    targetRowHeight?: number;
    targetRowHeightTolerance?: number;
    showWidows?: boolean;
  };

  export default function justifiedLayout(aspectRatios: number[], options?: Options): Layout;
}
