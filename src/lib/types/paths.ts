import type { PixelPoint } from '#lib/types/canvas.ts';

export interface PathSegment {
  points: number[];
  isTeleport: boolean;
}

export interface PathArrow {
  points: number[];
}

export interface PathState {
  segments: PathSegment[];
  stepDots: PixelPoint[];
  arrows: PathArrow[];
  currentSegment: number[];
  startPoint: PixelPoint | null;
  endPoint: PixelPoint | null;
  lastPoint: PixelPoint | null;
}
