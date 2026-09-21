import sharp, { type Metadata, type Sharp } from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import { query } from '../config/database.js';
import { BadRequestError, ForbiddenError, PayloadTooLargeError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DIMENSION = 4096; // 4096px max width or height
const BUCKET_NAME = 'campus-radar-images';

// Local storage directory for fallback
const LOCAL_UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
  fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
}

// Initialize Supabase Storage client if credentials available
let supabaseStorage: SupabaseClient | null = null;
if (env.SUPABASE_URL && env.SUPABASE_SECRET_KEY) {
  try {
    supabaseStorage = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false }
    });
  } catch (err: any) {
    logger.warn('Failed to initialize Supabase storage client, using local storage fallback', { error: err.message });
  }
}

export type ValidatedImageInfo = {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  format: string;
};

export const uploadService = {
  /**
   * Validate file buffer magic bytes to ensure it is a real image.
   * NEVER trust the user-supplied filename extension or Content-Type header.
   */
  validateMagicBytes(buffer: Buffer): ValidatedImageInfo {
    if (!buffer || buffer.length < 12) {
      throw new BadRequestError('Invalid file: File buffer is too small or empty');
    }

    // JPEG magic bytes: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { mimeType: 'image/jpeg', format: 'jpeg' };
    }

    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { mimeType: 'image/png', format: 'png' };
    }

    // WebP magic bytes: RIFF .... WEBP
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { mimeType: 'image/webp', format: 'webp' };
    }

    // Strictly reject SVG, HTML, executable, and unknown formats
    throw new BadRequestError(
      'Invalid image format. Only authentic JPEG, PNG, and WebP images are allowed. SVG and executable files are strictly prohibited.'
    );
  },

  /**
   * Process and securely upload an image
   */
  async processAndUploadImage(
    userId: string,
    fileBuffer: Buffer,
    _originalName?: string
  ): Promise<{
    uploadId: string;
    url: string;
    storageKey: string;
    width: number;
    height: number;
    mimeType: string;
    size: number;
  }> {
    // 1. Strict size check
    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new PayloadTooLargeError('Image exceeds the maximum allowed size of 5 MB');
    }

    // 2. Magic byte / MIME inspection
    this.validateMagicBytes(fileBuffer);

    // 3. Inspect image metadata via Sharp (prevents decompression bombs & malformed files)
    let sharpInstance: Sharp;
    let metadata: Metadata;
    try {
      sharpInstance = sharp(fileBuffer, { failOn: 'error' });
      metadata = await sharpInstance.metadata();
    } catch (err: any) {
      throw new BadRequestError('Corrupted or unreadable image file');
    }

    if (!metadata.width || !metadata.height) {
      throw new BadRequestError('Could not determine image dimensions');
    }

    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
      throw new BadRequestError(
        `Image dimensions (${metadata.width}x${metadata.height}) exceed maximum allowed dimensions (${MAX_DIMENSION}x${MAX_DIMENSION}px)`
      );
    }

    // 4. Secure Processing:
    // - Auto-rotate based on EXIF orientation
    // - Strip ALL EXIF, GPS, camera, and device metadata (Privacy requirement)
    // - Resize down to max 1920px width/height for feed performance while preserving aspect ratio
    // - Convert to optimized WebP format
    const optimizedBuffer = await sharp(fileBuffer)
      .rotate() // Auto-orient then strip metadata
      .resize({
        width: 1920,
        height: 1920,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 85, effort: 4 })
      .toBuffer();

    const finalMetadata = await sharp(optimizedBuffer).metadata();
    const finalWidth = finalMetadata.width || metadata.width;
    const finalHeight = finalMetadata.height || metadata.height;
    const finalSize = optimizedBuffer.length;

    // 5. Generate Opaque Secure Storage Key
    // Privacy requirement: Never use user name, email, student ID, or original filename!
    const fileId = uuidv4();
    const storageKey = `uploads/${fileId}.webp`;

    // 6. Upload to Storage (Supabase Storage with Local Fallback)
    let publicUrl = '';
    let uploadedToSupabase = false;

    if (supabaseStorage) {
      try {
        let { error: uploadError } = await supabaseStorage.storage
          .from(BUCKET_NAME)
          .upload(storageKey, optimizedBuffer, {
            contentType: 'image/webp',
            upsert: false
          });

        if (uploadError && (uploadError.message?.toLowerCase().includes('bucket') || (uploadError as any).statusCode === 404)) {
          // Attempt to auto-create public bucket if it does not yet exist
          await supabaseStorage.storage.createBucket(BUCKET_NAME, { public: true }).catch(() => {});
          const retry = await supabaseStorage.storage
            .from(BUCKET_NAME)
            .upload(storageKey, optimizedBuffer, {
              contentType: 'image/webp',
              upsert: false
            });
          uploadError = retry.error;
        }

        if (!uploadError) {
          const { data: publicUrlData } = supabaseStorage.storage
            .from(BUCKET_NAME)
            .getPublicUrl(storageKey);
          
          if (publicUrlData?.publicUrl) {
            publicUrl = publicUrlData.publicUrl;
            uploadedToSupabase = true;
          }
        } else {
          logger.warn('Supabase storage upload error, falling back to local storage', { error: uploadError.message });
        }
      } catch (storageErr: any) {
        logger.warn('Supabase storage exception, using local fallback', { error: storageErr.message });
      }
    }

    if (!uploadedToSupabase) {
      // Local disk fallback
      const localFilePath = path.join(LOCAL_UPLOADS_DIR, `${fileId}.webp`);
      await fs.promises.writeFile(localFilePath, optimizedBuffer);
      publicUrl = `/uploads/${fileId}.webp`;
    }

    // 7. Track in Database `uploads` Table
    const insertRes = await query(
      `INSERT INTO uploads (id, owner_id, storage_key, url, mime_type, file_size, width, height, is_attached)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, url, storage_key, width, height, mime_type, file_size`,
      [
        fileId,
        userId,
        storageKey,
        publicUrl,
        'image/webp',
        finalSize,
        finalWidth,
        finalHeight,
        false
      ]
    );

    const record = insertRes.rows[0];

    return {
      uploadId: record.id,
      url: record.url,
      storageKey: record.storage_key,
      width: record.width,
      height: record.height,
      mimeType: record.mime_type,
      size: record.file_size
    };
  },

  /**
   * Verify an image URL belongs to approved storage and optionally marks it as attached to a post/event.
   */
  async validateAndAttachImage(userId: string, imageUrl: string, attachedToType: string, attachedToId?: string): Promise<boolean> {
    if (!imageUrl) return true;

    // Check if the URL matches an asset in the uploads table
    const res = await query(
      `SELECT id, owner_id, is_attached FROM uploads WHERE url = $1`,
      [imageUrl]
    );

    if (res.rowCount && res.rowCount > 0) {
      const uploadRecord = res.rows[0];
      if (uploadRecord.owner_id !== userId) {
        throw new ForbiddenError('You cannot attach an image uploaded by another user');
      }

      await query(
        `UPDATE uploads 
         SET is_attached = TRUE, attached_to_type = $1, attached_to_id = $2 
         WHERE url = $3 AND owner_id = $4`,
        [attachedToType, attachedToId || null, imageUrl, userId]
      );
      return true;
    }

    // Allow default system static paths (e.g., default badges or avatars)
    if (imageUrl.startsWith('/assets/') || imageUrl.startsWith('/images/')) {
      return true;
    }

    // Disallow arbitrary third-party executable or untrusted URLs
    throw new BadRequestError('Invalid or unauthorized image URL reference');
  }
};

