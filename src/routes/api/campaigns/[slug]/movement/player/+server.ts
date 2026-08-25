import { db } from '$lib/server/db';
import { campaigns, gameSessions, paths, revealedTiles, timeAuditLog } from '$lib/server/db/schema';
import { emitEvent } from '$lib/server/events';
import type { PathStep } from '$lib/types';
import { error, isHttpError, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

function parseTileKey(tileKey: unknown): { tileKey: string; col: number; row: number } {
  if (!tileKey || typeof tileKey !== 'string') throw error(400, 'Invalid tileKey');
  const [col, row] = tileKey.split('-').map(Number);
  if (isNaN(col) || isNaN(row)) throw error(400, 'Invalid tile coordinates');
  return { tileKey, col, row };
}

// Adjacent hexes in odd-q offset coordinates.
function isAdjacentHex(fromX: number, fromY: number, toX: number, toY: number): boolean {
  const offsets =
    fromX % 2 === 1
      ? [
          [0, -1],
          [1, 0],
          [1, 1],
          [0, 1],
          [-1, 1],
          [-1, 0],
        ]
      : [
          [0, -1],
          [1, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
          [-1, -1],
        ];
  return offsets.some(([dx, dy]) => fromX + dx === toX && fromY + dy === toY);
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
  // Both DM and players can make player moves
  if (!locals.session) {
    throw error(403, 'Not authenticated');
  }

  if (locals.session.campaignSlug !== params.slug) {
    throw error(403, 'Access denied');
  }

  try {
    const { tileKey, col, row } = parseTileKey((await request.json()).tileKey);

    // Everything that reads-then-writes runs in one transaction.
    // The campaign row is claimed first with an optimistic lock, so a second
    // mover blocks on that row and fails before it can append to paths.steps.
    const result = await db.transaction(async (tx) => {
      const [campaign] = await tx.select().from(campaigns).where(eq(campaigns.slug, params.slug)).limit(1);

      if (!campaign) {
        throw error(404, 'Campaign not found');
      }

      const [activeSession] = await tx
        .select()
        .from(gameSessions)
        .where(and(eq(gameSessions.campaignId, campaign.id), eq(gameSessions.isActive, true)))
        .limit(1);

      if (!activeSession) {
        throw error(400, 'No active session');
      }

      const currentX = campaign.partyTokenX;
      const currentY = campaign.partyTokenY;

      if (currentX === null || currentY === null) {
        throw error(400, 'Party token position not set');
      }

      if (!isAdjacentHex(currentX, currentY, col, row)) {
        throw error(400, 'Tile is not adjacent to party position');
      }

      // Calculate time increment (0.5 days per tile)
      const timeCost = 0.5;
      const newGameTime = campaign.globalGameTime + timeCost;

      // Claim the move before writing anything else.
      const updateResult = await tx
        .update(campaigns)
        .set({
          globalGameTime: newGameTime,
          partyTokenX: col,
          partyTokenY: row,
        })
        .where(and(eq(campaigns.id, campaign.id), eq(campaigns.partyTokenX, currentX), eq(campaigns.partyTokenY, currentY)))
        .returning({ id: campaigns.id });

      if (updateResult.length === 0) {
        throw error(409, 'Party position changed. Another player already moved the token.');
      }

      const [currentPath] = await tx.select().from(paths).where(eq(paths.gameSessionId, activeSession.id)).limit(1);

      if (!currentPath) {
        throw error(500, 'Path not found for session');
      }

      const step: PathStep = {
        type: 'player_move',
        tileKey,
        timestamp: new Date(),
        gameTime: newGameTime,
      };

      // Check if tile needs to be revealed
      const [existingTile] = await tx
        .select()
        .from(revealedTiles)
        .where(and(eq(revealedTiles.campaignId, campaign.id), eq(revealedTiles.x, col), eq(revealedTiles.y, row)))
        .limit(1);

      const tilesToReveal: string[] = [];
      if (!existingTile) {
        await tx.insert(revealedTiles).values({
          campaignId: campaign.id,
          x: col,
          y: row,
          alwaysRevealed: false,
        });
        tilesToReveal.push(tileKey);
      }

      // Update path with new step and revealed tiles
      const updatedRevealedTiles = currentPath.revealedTiles.includes(tileKey)
        ? currentPath.revealedTiles
        : [...currentPath.revealedTiles, tileKey];

      await tx
        .update(paths)
        .set({
          steps: [...(currentPath.steps as PathStep[]), step],
          revealedTiles: updatedRevealedTiles,
        })
        .where(eq(paths.id, currentPath.id));

      // Create audit log entry
      await tx.insert(timeAuditLog).values({
        campaignId: campaign.id,
        type: 'movement',
        amount: timeCost,
        actorRole: locals.session!.role,
        notes: `Player move to ${tileKey}`,
      });

      // Update session last activity
      await tx.update(gameSessions).set({ lastActivityAt: new Date() }).where(eq(gameSessions.id, activeSession.id));

      return { sessionId: activeSession.id, step, tilesToReveal, newGameTime };
    });

    // Only broadcast once the transaction has committed.
    // This way a rolled back move is never announced to other clients.
    if (result.tilesToReveal.length > 0) {
      emitEvent(params.slug, 'tile:revealed', [{ x: col, y: row, alwaysRevealed: false }]);
    }

    emitEvent(params.slug, 'movement:step-added', {
      sessionId: result.sessionId,
      step: result.step,
      tiles: result.tilesToReveal,
    });

    emitEvent(params.slug, 'time:updated', {
      globalGameTime: result.newGameTime,
    });

    return json({ success: true, step: result.step, gameTime: result.newGameTime });
  } catch (err) {
    // HttpError is not an Error subclass, so it must be re-thrown explicitly to keep its status
    if (isHttpError(err)) throw err;
    console.error('Failed to add player move:', err);
    throw error(500, 'Failed to add player move');
  }
};
