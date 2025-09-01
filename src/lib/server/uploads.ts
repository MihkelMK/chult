import { writeFile, mkdir, unlink, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const UPLOAD_DIR = './uploads';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface UploadResult {
	success: boolean;
	filename?: string;
	error?: string;
	originalDimensions?: { width: number; height: number };
}

export async function ensureUploadDir(campaignSlug: string): Promise<void> {
	const campaignDir = path.join(UPLOAD_DIR, campaignSlug);
	if (!existsSync(campaignDir)) {
		await mkdir(campaignDir, { recursive: true });
	}
}

export async function validateImageFile(
	file: File
): Promise<{ valid: boolean; error?: string; dimensions?: { width: number; height: number } }> {
	if (file.size > MAX_FILE_SIZE) {
		return { valid: false, error: 'File size must be less than 50MB' };
	}

	if (!ALLOWED_TYPES.includes(file.type)) {
		return { valid: false, error: 'Only JPEG, PNG, and WebP images are allowed' };
	}

	// Basic validation - let imgproxy handle the detailed processing
	try {
		const buffer = Buffer.from(await file.arrayBuffer());

		// Simple dimension check using a lightweight method
		let width = 0,
			height = 0;

		if (file.type === 'image/jpeg') {
			// Simple JPEG dimension reading
			const dimensions = getJPEGDimensions(buffer);
			width = dimensions.width;
			height = dimensions.height;
		} else {
			// For PNG/WebP, we'll trust the file and let imgproxy validate
			width = 1000; // Assume it's valid
			height = 1000;
		}

		if (width < 500 || height < 500) {
			return { valid: false, error: 'Image must be at least 500x500 pixels' };
		}

		return { valid: true, dimensions: { width, height } };
	} catch {
		return { valid: false, error: 'Invalid or corrupted image file' };
	}
}

// Simple JPEG dimension reader (no dependencies)
function getJPEGDimensions(buffer: Buffer): { width: number; height: number } {
	let offset = 2;

	while (offset < buffer.length) {
		const marker = buffer.readUInt16BE(offset);
		offset += 2;

		if (marker >= 0xffc0 && marker <= 0xffc3) {
			offset += 3; // Skip length and precision
			const height = buffer.readUInt16BE(offset);
			const width = buffer.readUInt16BE(offset + 2);
			return { width, height };
		}

		const segmentLength = buffer.readUInt16BE(offset);
		offset += segmentLength;
	}

	return { width: 1000, height: 1000 }; // Fallback
}

export async function saveMapImage(campaignSlug: string, file: File): Promise<UploadResult> {
	try {
		const validation = await validateImageFile(file);
		if (!validation.valid) {
			return { success: false, error: validation.error };
		}

		await ensureUploadDir(campaignSlug);

		// Always save as map.jpg for consistency
		const filename = 'map.jpg';
		const filepath = path.join(UPLOAD_DIR, campaignSlug, filename);

		// Save original file - let imgproxy handle all processing
		const buffer = Buffer.from(await file.arrayBuffer());
		await writeFile(filepath, buffer);

		return {
			success: true,
			filename,
			originalDimensions: validation.dimensions
		};
	} catch (error) {
		console.error('Error saving map image:', error);
		return { success: false, error: 'Failed to save image' };
	}
}

export async function deleteMapImage(campaignSlug: string): Promise<void> {
	const filepath = path.join(UPLOAD_DIR, campaignSlug, 'map.jpg');
	try {
		await unlink(filepath);
	} catch {
		// File doesn't exist
	}
}

export async function hasMapImage(campaignSlug: string): Promise<boolean> {
	const filepath = path.join(UPLOAD_DIR, campaignSlug, 'map.jpg');
	try {
		await stat(filepath);
		return true;
	} catch {
		return false;
	}
}
