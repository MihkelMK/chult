import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/session';
import { db } from '$lib/server/db';
import { mapMarkers } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import eventEmitter from '$lib/server/events';

const UPLOADS_BASE = process.env.UPLOADS_DIR || '/tmp/uploads';

export const POST: RequestHandler = async (event) => {
	const session = requireAuth(event);
	
	if (!session) {
		return error(401, 'Unauthorized');
	}

	if (session.campaignSlug !== event.params.slug) {
		return error(403, 'Access denied');
	}

	const markerId = parseInt(event.params.markerId, 10);
	
	// Verify marker exists and user has permission
	const [marker] = await db
		.select()
		.from(mapMarkers)
		.where(and(eq(mapMarkers.id, markerId), eq(mapMarkers.campaignId, session.campaignId)));

	if (!marker) {
		return error(404, 'Marker not found');
	}

	// Players can only edit their own notes
	if (session.role === 'player' && marker.authorRole !== 'player') {
		return error(403, 'Players can only edit their own notes');
	}

	try {
		const formData = await event.request.formData();
		const file = formData.get('image') as File;

		if (!file) {
			return error(400, 'No file uploaded');
		}

		// Validate file type
		if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
			return error(400, 'Invalid file type. Only JPEG, PNG, and WebP are supported.');
		}

		// Validate file size (10MB max for marker images)
		if (file.size > 10 * 1024 * 1024) {
			return error(400, 'File too large. Maximum size is 10MB.');
		}

		// Create directory structure
		const campaignDir = path.join(UPLOADS_BASE, event.params.slug);
		const markersDir = path.join(campaignDir, 'markers');
		
		await mkdir(markersDir, { recursive: true });

		// Save file
		const fileName = `${markerId}.jpg`; // Convert all to jpg for consistency
		const filePath = path.join(markersDir, fileName);
		
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		await writeFile(filePath, buffer);

		// Update marker with image path
		const imagePath = `/${event.params.slug}/markers/${fileName}`;
		const [updatedMarker] = await db
			.update(mapMarkers)
			.set({
				imagePath: imagePath
			})
			.where(eq(mapMarkers.id, markerId))
			.returning();

		// Emit event
		eventEmitter.emit(`campaign-${event.params.slug}`, {
			event: 'marker-updated',
			data: updatedMarker,
			role: updatedMarker.visibleToPlayers ? 'all' : 'dm'
		});

		return json({ 
			success: true, 
			imagePath: imagePath,
			marker: updatedMarker
		});

	} catch (err) {
		console.error('Marker image upload failed:', err);
		return error(500, 'Upload failed');
	}
};

export const DELETE: RequestHandler = async (event) => {
	const session = requireAuth(event);
	
	if (!session) {
		return error(401, 'Unauthorized');
	}

	if (session.campaignSlug !== event.params.slug) {
		return error(403, 'Access denied');
	}

	const markerId = parseInt(event.params.markerId, 10);
	
	// Verify marker exists and user has permission
	const [marker] = await db
		.select()
		.from(mapMarkers)
		.where(and(eq(mapMarkers.id, markerId), eq(mapMarkers.campaignId, session.campaignId)));

	if (!marker) {
		return error(404, 'Marker not found');
	}

	// Players can only edit their own notes
	if (session.role === 'player' && marker.authorRole !== 'player') {
		return error(403, 'Players can only edit their own notes');
	}

	try {
		// Update marker to remove image path
		const [updatedMarker] = await db
			.update(mapMarkers)
			.set({
				imagePath: null
			})
			.where(eq(mapMarkers.id, markerId))
			.returning();

		// Emit event
		eventEmitter.emit(`campaign-${event.params.slug}`, {
			event: 'marker-updated',
			data: updatedMarker,
			role: updatedMarker.visibleToPlayers ? 'all' : 'dm'
		});

		return json({ 
			success: true,
			marker: updatedMarker
		});

	} catch (err) {
		console.error('Marker image delete failed:', err);
		return error(500, 'Delete failed');
	}
};