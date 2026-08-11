import type { DMTeleport, HexPosition, PathState, PathStep, PixelPoint } from '$lib/types';

type HexMap = ReadonlyMap<string, HexPosition>;

export function handleStep(step: PathStep, state: PathState, hexMap: HexMap, hexRadius: number): void {
  switch (step.type) {
    case 'player_move':
      addTile(getTileCenter(step.tileKey, hexMap), state, hexRadius * 0.4);
      break;
    case 'dm_path':
      for (const tile of step.tiles) addTile(getTileCenter(tile, hexMap), state, hexRadius * 0.4);
      break;
    case 'dm_teleport':
      addTeleport(step, state, hexMap, hexRadius * 0.5);
      break;
    default: {
      // Compile-time check that every PathStep variant is handled above. Unknown steps are
      // ignored at runtime rather than thrown on: a malformed step must not break map render.
      const _exhaustive: never = step;
      return _exhaustive;
    }
  }
}

// End current segment if it exists
export function flushSegment(state: PathState) {
  if (state.currentSegment.length >= 4) {
    state.segments.push({ points: state.currentSegment, isTeleport: false });
    state.currentSegment = [];
  }
}

function addTile(center: PixelPoint | null, state: PathState, arrowSize: number) {
  if (!center) return;
  state.startPoint ??= center;
  state.endPoint = center;

  state.stepDots.push(center);
  if (state.lastPoint) state.arrows.push({ points: midArrow(state.lastPoint, center, arrowSize) });
  state.currentSegment.push(center.x, center.y);

  state.lastPoint = center;
}

function addTeleport(step: DMTeleport, state: PathState, hexMap: HexMap, arrowSize: number) {
  flushSegment(state);

  const fromCenter = state.lastPoint ?? getTileCenter(step.fromTile, hexMap);
  const toCenter = getTileCenter(step.toTile, hexMap);
  if (!fromCenter || !toCenter) return;

  state.startPoint ??= fromCenter;
  state.endPoint = toCenter;

  state.stepDots.push(toCenter);
  state.arrows.push({ points: midArrow(fromCenter, toCenter, arrowSize) });

  state.segments.push({
    points: [fromCenter.x, fromCenter.y, toCenter.x, toCenter.y],
    isTeleport: true,
  });

  state.lastPoint = toCenter;
  // Start new segment from teleport destination
  state.currentSegment = [toCenter.x, toCenter.y];
}

// Get center coordinates for a tile key
function getTileCenter(tileKey: string, hexMap: HexMap): PixelPoint | null {
  const hex = hexMap.get(tileKey);
  return hex ? { x: hex.centerX, y: hex.centerY } : null;
}

// Calculate arrow points for direction indicator
function getArrowPoints(x1: number, y1: number, x2: number, y2: number, arrowSize: number): number[] {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrowAngle = Math.PI / 6; // 30 degrees

  return [
    x2,
    y2,
    x2 - arrowSize * Math.cos(angle - arrowAngle),
    y2 - arrowSize * Math.sin(angle - arrowAngle),
    x2 - arrowSize * Math.cos(angle + arrowAngle),
    y2 - arrowSize * Math.sin(angle + arrowAngle),
  ];
}

function midArrow(origin: PixelPoint, target: PixelPoint, size: number) {
  const midX = (origin.x + target.x) / 2;
  const midY = (origin.y + target.y) / 2;
  return getArrowPoints(origin.x, origin.y, midX, midY, size);
}
