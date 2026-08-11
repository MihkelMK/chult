import { db } from '$lib/server/db/index';
import { campaigns } from '$lib/server/db/schema';
import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

type UpdateData = Record<string, number | Date | null | boolean>;

function assignRange(target: UpdateData, key: string, value: unknown, min: number, max: number) {
  if (value === undefined) return;
  if (typeof value !== 'number' || value < min || value > max) {
    throw error(400, `Invalid ${key} value`);
  }
  target[key] = value;
}

function assignNullableNumber(target: UpdateData, key: string, value: unknown) {
  if (value === undefined) return;
  if (value !== null && typeof value !== 'number') {
    throw error(400, `Invalid ${key} value`);
  }
  target[key] = value as number | null;
}

function assignBoolean(target: UpdateData, key: string, value: unknown) {
  if (value === undefined) return;
  if (typeof value !== 'boolean') {
    throw error(400, `Invalid ${key} value`);
  }
  target[key] = value;
}

function buildSettingsUpdate(body: Record<string, unknown>): UpdateData {
  const updateData: UpdateData = { updatedAt: new Date() };

  assignRange(updateData, 'hexesPerRow', body.hexesPerRow, 5, 100);
  assignRange(updateData, 'hexesPerCol', body.hexesPerCol, 5, 100);
  assignRange(updateData, 'hexOffsetX', body.hexOffsetX, -200, 200);
  assignRange(updateData, 'hexOffsetY', body.hexOffsetY, -200, 200);
  assignNullableNumber(updateData, 'partyTokenX', body.partyTokenX);
  assignNullableNumber(updateData, 'partyTokenY', body.partyTokenY);
  assignBoolean(updateData, 'hasPlayerMap', body.hasPlayerMap);

  return updateData;
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  // Verify authentication
  if (!locals.session) {
    throw error(401, 'Unauthorized');
  }

  // Verify DM permission
  if (locals.session.role !== 'dm') {
    throw error(403, 'Only DMs can update hex grid settings');
  }

  // Verify campaign ownership
  if (locals.session.campaignSlug !== params.slug) {
    throw error(403, 'Access denied');
  }

  try {
    const updateData = buildSettingsUpdate(await request.json());

    // Update the campaign in database
    const result = await db.update(campaigns).set(updateData).where(eq(campaigns.slug, params.slug)).returning({
      hexesPerRow: campaigns.hexesPerRow,
      hexesPerCol: campaigns.hexesPerCol,
      hexOffsetX: campaigns.hexOffsetX,
      hexOffsetY: campaigns.hexOffsetY,
      partyTokenX: campaigns.partyTokenX,
      partyTokenY: campaigns.partyTokenY,
      hasPlayerMap: campaigns.hasPlayerMap,
    });

    if (result.length === 0) {
      throw error(404, 'Campaign not found');
    }

    return json({
      success: true,
      message: 'Campaign settings updated successfully',
      config: result[0],
    });
  } catch (err) {
    console.error('Error updating campaign settings:', err);
    if (err instanceof Error && err.message.includes('Invalid')) {
      throw error(400, err.message);
    }
    throw error(500, 'Failed to update campaign settings');
  }
};
