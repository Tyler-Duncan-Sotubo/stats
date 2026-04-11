import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * AwsService handles all communication with Amazon S3.
 *
 * It is intentionally kept generic — it knows nothing about NeedIt's
 * domain (needs, offers, users). It only knows how to talk to S3.
 *
 * All domain-specific logic (which folder, which entity, which DB table)
 * lives in MediaService. AwsService just executes the S3 operations.
 *
 * Methods:
 *   createPresignedUrl → generate a signed URL for client-side uploads
 *   headObject         → verify a file exists in S3 and get its metadata
 *   deleteObject       → permanently remove a file from S3
 *   publicUrlForKey    → build the public URL for any S3 key
 */
@Injectable()
export class AwsService {
  private s3Client: S3Client;

  constructor(private configService: ConfigService) {
    // S3Client is initialised once when the module boots.
    // Credentials and region are pulled from environment variables —
    // never hardcode these values in the source code.
    this.s3Client = new S3Client({
      region: this.configService.getOrThrow<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  // ─── Private helpers ──────────────────────────────────────────

  // Returns the S3 bucket name from env.
  // getOrThrow means the app will refuse to start if this is missing.
  private bucket() {
    return this.configService.getOrThrow<string>('AWS_BUCKET_NAME');
  }

  // Returns the AWS region from env.
  private region() {
    return this.configService.getOrThrow<string>('AWS_REGION');
  }

  // Controls whether uploaded objects are publicly readable.
  // Set to true for NeedIt since need images are public.
  // If you ever add private files (e.g. ID verification docs),
  // make this configurable per upload instead of a global flag.
  private publicReadEnabled() {
    return true;
  }

  // ─── Public URL ───────────────────────────────────────────────

  /**
   * Builds the permanent public URL for any S3 object key.
   *
   * Format: https://<bucket>.s3.<region>.amazonaws.com/<key>
   *
   * This is the URL that gets saved to the database and served
   * to the frontend. It only works if the object is publicly readable
   * (i.e. publicReadEnabled() returns true).
   */
  publicUrlForKey(key: string): string {
    return `https://${this.bucket()}.s3.${this.region()}.amazonaws.com/${key}`;
  }

  // ─── Presign ──────────────────────────────────────────────────

  /**
   * Generates a short-lived signed URL that allows the client to
   * PUT a file directly to S3 without going through our server.
   *
   * Why presigned URLs?
   * - The server never handles raw file bytes → no memory pressure
   * - Uploads go directly from the browser to S3 → faster for the user
   * - The signed URL expires, so it can't be reused after the window closes
   *
   * Flow:
   *   1. Client calls POST /api/media/presign → gets { uploadUrl, key, publicUrl }
   *   2. Client PUTs the file to uploadUrl    → goes directly to S3
   *   3. Client calls POST /api/media/finalize → server verifies + saves to DB
   *
   * The key is the S3 object path (e.g. needs/01J4XXX/01J4YYY-photo.jpg).
   * The publicUrl is what gets stored in the DB and shown in the UI.
   */
  async createPresignedUrl(params: {
    key: string;
    contentType: string;
    expiresInSeconds?: number;
  }) {
    const { key, contentType, expiresInSeconds } = params;

    const command = new PutObjectCommand({
      Bucket: this.bucket(),
      Key: key,
      ContentType: contentType,
      // ACL: 'public-read' makes the uploaded object publicly accessible.
      // Only included when publicReadEnabled() is true.
      // If your bucket has "Block all public access" enabled, remove this
      // and use a bucket policy instead.
      ...(this.publicReadEnabled() ? { ACL: 'public-read' } : {}),
    });

    // getSignedUrl cryptographically signs the command so S3 will
    // accept a PUT from anyone who has this URL — but only within
    // the expiry window and only for this exact key + contentType.
    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds ?? 3600, // default 1 hour
    });

    return {
      key,
      uploadUrl, // client PUTs to this
      publicUrl: this.publicUrlForKey(key), // permanent URL saved to DB
    };
  }

  // ─── Head object ──────────────────────────────────────────────

  /**
   * Fetches metadata for an S3 object WITHOUT downloading it.
   *
   * Used in MediaService.finalize() to confirm the file actually
   * landed in S3 before we save anything to the database.
   * This prevents ghost records in the DB for failed uploads.
   *
   * Returns contentType and contentLength (file size in bytes).
   * Throws if the object does not exist — caught in MediaService.
   */
  async headObject(key: string) {
    const response = await this.s3Client.send(
      new HeadObjectCommand({
        Bucket: this.bucket(),
        Key: key,
      }),
    );

    return {
      contentType: response.ContentType ?? null,
      contentLength: response.ContentLength ?? null,
    };
  }

  // ─── Delete ───────────────────────────────────────────────────

  /**
   * Permanently deletes a file from S3.
   *
   * Always called BEFORE the DB delete in MediaService.
   * Reason: if S3 delete fails we don't remove the DB record,
   * so the file reference stays intact and we can retry.
   * If we deleted from DB first and S3 failed, we'd have an
   * orphaned file in S3 with no way to track or clean it up.
   *
   * This operation is irreversible — there is no S3 recycle bin
   * unless versioning is enabled on the bucket.
   */
  async deleteObject(key: string) {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket(),
        Key: key,
      }),
    );

    return { ok: true };
  }
}
