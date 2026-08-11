<script lang="ts">
  import type { GameSessionResponse, Hex, HexPosition, Path, PathState } from '$lib/types';
  import { flushSegment, handleStep } from '$lib/utils/movementPaths';
  import { Circle, Group, Line } from 'svelte-konva';
  import { SvelteMap } from 'svelte/reactivity';

  interface Props {
    sessions: GameSessionResponse[];
    pathsMap: SvelteMap<number, Path>;
    visibleSessionIds: Set<number>;
    showPaths: boolean;
    hexRadius: number;
    hexGrid: readonly Hex[];
  }

  let { sessions, pathsMap, visibleSessionIds, showPaths, hexRadius, hexGrid }: Props = $props();

  // Create map for quick hex lookups
  let hexMap = $derived.by(() => {
    const map = new SvelteMap<string, HexPosition>();
    for (const hex of hexGrid) {
      map.set(`${hex.col}-${hex.row}`, { centerX: hex.centerX, centerY: hex.centerY });
    }
    return map;
  });

  // Get color and opacity based on session age
  function getSessionStyle(sessionIndex: number, totalSessions: number): { color: string; opacity: number } {
    // sessionIndex 0 = newest, higher index = older
    const age = sessionIndex / (totalSessions || 1);

    if (age < 0.2) {
      // Current/recent: bright blue
      return { color: 'rgb(59, 130, 246)', opacity: 1.0 };
    } else if (age < 0.5) {
      // Recent: green
      return { color: 'rgb(34, 197, 94)', opacity: 0.7 };
    } else {
      // Old: purple, faded
      return { color: 'rgb(168, 85, 247)', opacity: 0.5 };
    }
  }

  // Render path segments for a session
  function renderSessionPath(session: GameSessionResponse, sessionIndex: number) {
    const path = pathsMap.get(session.id);
    if (!path || path.steps.length === 0) return null;

    const { color, opacity } = getSessionStyle(sessionIndex, sessions.length);

    const state: PathState = {
      segments: [],
      stepDots: [],
      arrows: [],
      currentSegment: [],
      startPoint: null,
      endPoint: null,
      lastPoint: null,
    };

    // Build segments from steps
    for (const step of path.steps) handleStep(step, state, hexMap, hexRadius);
    flushSegment(state);

    return { ...state, color, opacity };
  }

  // Split path into individual line segments with gaps around dots
  function getLineSegments(points: number[], gap: number): number[][] {
    if (points.length < 4) return [];

    const segments: number[][] = [];

    // Process each consecutive pair of points
    for (let i = 0; i < points.length - 2; i += 2) {
      const x1 = points[i];
      const y1 = points[i + 1];
      const x2 = points[i + 2];
      const y2 = points[i + 3];

      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Skip if segment too short to shorten
      if (dist <= gap * 2) continue;

      const ratio = gap / dist;

      // Shorten from both ends to create gap around dots
      const newX1 = x1 + dx * ratio;
      const newY1 = y1 + dy * ratio;
      const newX2 = x2 - dx * ratio;
      const newY2 = y2 - dy * ratio;

      // Each segment is a separate array
      segments.push([newX1, newY1, newX2, newY2]);
    }

    return segments;
  }

  // Filter visible sessions
  let visibleSessions = $derived(
    sessions.filter((s) => visibleSessionIds.has(s.id)).sort((a, b) => b.sessionNumber - a.sessionNumber)
  );
</script>

{#if showPaths && visibleSessions.length > 0}
  <Group listening={false}>
    {#each visibleSessions as session, index (session.id)}
      {@const pathData = renderSessionPath(session, index)}
      {#if pathData && pathData.segments.length > 0}
        <Group>
          <!-- Path segments (lines with stroke for visibility) -->
          {#each pathData.segments as segment, segIndex (`segment-${session.id}-${segIndex}`)}
            {#if segment.points.length >= 4}
              {@const lineSegments = getLineSegments(segment.points, hexRadius * 0.3)}
              {#each lineSegments as lineSeg, lineIdx (`line-${session.id}-${segIndex}-${lineIdx}`)}
                <!-- Background stroke (white outline) -->
                <Line
                  points={lineSeg}
                  stroke="white"
                  strokeWidth={5}
                  opacity={pathData.opacity * 0.8}
                  lineCap="round"
                  lineJoin="round"
                  dash={segment.isTeleport ? [10, 5] : undefined}
                  shadowEnabled={false}
                  perfectDrawEnabled={false} />
                <!-- Foreground line (colored) -->
                <Line
                  points={lineSeg}
                  stroke={pathData.color}
                  strokeWidth={2.5}
                  opacity={pathData.opacity}
                  lineCap="round"
                  lineJoin="round"
                  dash={segment.isTeleport ? [10, 5] : undefined}
                  shadowEnabled={false}
                  perfectDrawEnabled={false} />
              {/each}
            {/if}
          {/each}

          <!-- Direction arrows -->
          {#each pathData.arrows as arrow, arrowIndex (`arrow-${session.id}-${arrowIndex}`)}
            <Line
              points={arrow.points}
              fill={pathData.color}
              closed={true}
              stroke="white"
              strokeWidth={1}
              opacity={pathData.opacity} />
          {/each}

          <!-- Step dots -->
          {#each pathData.stepDots as dot, dotIndex (`dot-${session.id}-${dotIndex}`)}
            <Circle
              x={dot.x}
              y={dot.y}
              radius={hexRadius * 0.15}
              fill={pathData.color}
              stroke="white"
              strokeWidth={1}
              opacity={pathData.opacity} />
          {/each}

          <!-- Start marker (green) -->
          {#if pathData.startPoint}
            <Circle
              x={pathData.startPoint.x}
              y={pathData.startPoint.y}
              radius={hexRadius * 0.35}
              fill="rgb(34, 197, 94)"
              stroke="white"
              strokeWidth={2}
              opacity={pathData.opacity} />
          {/if}

          <!-- End marker (red) -->
          {#if pathData.endPoint}
            <Circle
              x={pathData.endPoint.x}
              y={pathData.endPoint.y}
              radius={hexRadius * 0.35}
              fill="rgb(239, 68, 68)"
              stroke="white"
              strokeWidth={2}
              opacity={pathData.opacity} />
          {/if}
        </Group>
      {/if}
    {/each}
  </Group>
{/if}
