<script lang="ts">
	import type { GameSessionResponse, Path } from '$lib/types';
	import { Circle, Group, Layer, Line } from 'svelte-konva';
	import { SvelteMap } from 'svelte/reactivity';

	interface Props {
		sessions: GameSessionResponse[];
		pathsMap: SvelteMap<number, Path>;
		visibleSessionIds: Set<number>;
		showPaths: boolean;
		hexRadius: number;
		hexGrid: readonly { id: string; col: number; row: number; centerX: number; centerY: number }[];
		xOffset: number;
		yOffset: number;
	}

	let {
		sessions,
		pathsMap,
		visibleSessionIds,
		showPaths,
		hexRadius,
		hexGrid,
		xOffset,
		yOffset
	}: Props = $props();

	// Create map for quick hex lookups
	let hexMap = $derived.by(() => {
		const map = new SvelteMap<string, { centerX: number; centerY: number }>();
		for (const hex of hexGrid) {
			map.set(`${hex.col}-${hex.row}`, { centerX: hex.centerX, centerY: hex.centerY });
		}
		return map;
	});

	// Get center coordinates for a tile key
	function getTileCenter(tileKey: string): { x: number; y: number } | null {
		const hex = hexMap.get(tileKey);
		return hex ? { x: hex.centerX, y: hex.centerY } : null;
	}

	// Get color and opacity based on session age
	function getSessionStyle(
		sessionIndex: number,
		totalSessions: number
	): { color: string; opacity: number } {
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

	// Calculate arrow points for direction indicator
	function getArrowPoints(
		x1: number,
		y1: number,
		x2: number,
		y2: number,
		arrowSize: number
	): number[] {
		const angle = Math.atan2(y2 - y1, x2 - x1);
		const arrowAngle = Math.PI / 6; // 30 degrees

		return [
			x2,
			y2,
			x2 - arrowSize * Math.cos(angle - arrowAngle),
			y2 - arrowSize * Math.sin(angle - arrowAngle),
			x2 - arrowSize * Math.cos(angle + arrowAngle),
			y2 - arrowSize * Math.sin(angle + arrowAngle)
		];
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

	// Render path segments for a session
	function renderSessionPath(session: GameSessionResponse, sessionIndex: number) {
		const path = pathsMap.get(session.id);
		if (!path || path.steps.length === 0) return null;

		const { color, opacity } = getSessionStyle(sessionIndex, sessions.length);

		interface PathSegment {
			points: number[];
			isTeleport: boolean;
		}

		interface StepDot {
			x: number;
			y: number;
		}

		interface Arrow {
			points: number[];
		}

		const segments: PathSegment[] = [];
		const stepDots: StepDot[] = [];
		const arrows: Arrow[] = [];
		let currentSegment: number[] = [];
		let startPoint: { x: number; y: number } | null = null;
		let endPoint: { x: number; y: number } | null = null;
		let lastPoint: { x: number; y: number } | null = null;

		// Build segments from steps
		for (const step of path.steps) {
			switch (step.type) {
				case 'player_move': {
					const center = getTileCenter(step.tileKey);
					if (center) {
						if (!startPoint) startPoint = center;
						endPoint = center;

						// Add dot for this step
						stepDots.push({ x: center.x, y: center.y });

						// Add arrow if we have a previous point
						if (lastPoint) {
							const midX = (lastPoint.x + center.x) / 2;
							const midY = (lastPoint.y + center.y) / 2;
							arrows.push({
								points: getArrowPoints(lastPoint.x, lastPoint.y, midX, midY, hexRadius * 0.4)
							});
						}

						currentSegment.push(center.x, center.y);
						lastPoint = center;
					}
					break;
				}
				case 'dm_teleport': {
					// End current segment if exists
					if (currentSegment.length >= 4) {
						segments.push({ points: currentSegment, isTeleport: false });
						currentSegment = [];
					}

					// Create teleport segment
					const fromCenter = lastPoint || getTileCenter(step.fromTile);
					const toCenter = getTileCenter(step.toTile);

					if (fromCenter && toCenter) {
						if (!startPoint) startPoint = fromCenter;
						endPoint = toCenter;

						// Add dot for teleport destination
						stepDots.push({ x: toCenter.x, y: toCenter.y });

						// Add arrow for teleport
						const midX = (fromCenter.x + toCenter.x) / 2;
						const midY = (fromCenter.y + toCenter.y) / 2;
						arrows.push({
							points: getArrowPoints(fromCenter.x, fromCenter.y, midX, midY, hexRadius * 0.5)
						});

						segments.push({
							points: [fromCenter.x, fromCenter.y, toCenter.x, toCenter.y],
							isTeleport: true
						});
						lastPoint = toCenter;
						// Start new segment from teleport destination
						currentSegment = [toCenter.x, toCenter.y];
					}
					break;
				}
				case 'dm_path': {
					// Add all tiles in the path to current segment
					for (const tile of step.tiles) {
						const center = getTileCenter(tile);
						if (center) {
							if (!startPoint) startPoint = center;
							endPoint = center;

							// Add dot for this step
							stepDots.push({ x: center.x, y: center.y });

							// Add arrow if we have a previous point
							if (lastPoint) {
								const midX = (lastPoint.x + center.x) / 2;
								const midY = (lastPoint.y + center.y) / 2;
								arrows.push({
									points: getArrowPoints(lastPoint.x, lastPoint.y, midX, midY, hexRadius * 0.4)
								});
							}

							currentSegment.push(center.x, center.y);
							lastPoint = center;
						}
					}
					break;
				}
			}
		}

		// Add final segment if exists
		if (currentSegment.length >= 4) {
			segments.push({ points: currentSegment, isTeleport: false });
		}

		return { segments, stepDots, arrows, startPoint, endPoint, color, opacity };
	}

	// Filter visible sessions
	let visibleSessions = $derived(
		sessions
			.filter((s) => visibleSessionIds.has(s.id))
			.sort((a, b) => b.sessionNumber - a.sessionNumber)
	);
</script>

{#if showPaths && visibleSessions.length > 0}
	<Layer x={xOffset} y={yOffset} listening={false}>
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
									perfectDrawEnabled={false}
								/>
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
									perfectDrawEnabled={false}
								/>
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
							opacity={pathData.opacity}
						/>
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
							opacity={pathData.opacity}
						/>
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
							opacity={pathData.opacity}
						/>
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
							opacity={pathData.opacity}
						/>
					{/if}
				</Group>
			{/if}
		{/each}
	</Layer>
{/if}
