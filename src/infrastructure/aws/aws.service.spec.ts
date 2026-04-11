/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AwsService } from './aws.service';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ─── Mock AWS SDK ─────────────────────────────────────────────────────────────

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn().mockImplementation((input) => input),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => input),
  HeadObjectCommand: jest.fn().mockImplementation((input) => input),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ENV = {
  AWS_REGION: 'eu-west-1',
  AWS_ACCESS_KEY_ID: 'test-key-id',
  AWS_SECRET_ACCESS_KEY: 'test-secret',
  AWS_BUCKET_NAME: 'test-bucket',
};

const mockConfigService = {
  getOrThrow: jest.fn((key: string) => ENV[key]),
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('AwsService', () => {
  let service: AwsService;
  let s3Send: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AwsService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AwsService>(AwsService);

    // Grab the send mock from whichever S3Client instance was created
    s3Send = (S3Client as jest.Mock).mock.results[0].value.send;

    jest.clearAllMocks();
    mockConfigService.getOrThrow.mockImplementation((key: string) => ENV[key]);
  });

  // ─── publicUrlForKey ──────────────────────────────────────────────────────

  describe('publicUrlForKey', () => {
    it('builds the correct public S3 URL', () => {
      const result = service.publicUrlForKey(
        'needs/entity-1/image-1-photo.jpg',
      );

      expect(result).toBe(
        'https://test-bucket.s3.eu-west-1.amazonaws.com/needs/entity-1/image-1-photo.jpg',
      );
    });

    it('uses the bucket and region from config', () => {
      const result = service.publicUrlForKey('users/user-1/avatar.png');

      expect(result).toContain(ENV.AWS_BUCKET_NAME);
      expect(result).toContain(ENV.AWS_REGION);
    });
  });

  // ─── createPresignedUrl ───────────────────────────────────────────────────

  describe('createPresignedUrl', () => {
    it('returns key, uploadUrl and publicUrl', async () => {
      (getSignedUrl as jest.Mock).mockResolvedValue('https://s3.presigned.url');

      const result = await service.createPresignedUrl({
        key: 'needs/entity-1/image-1-photo.jpg',
        contentType: 'image/jpeg',
      });

      expect(result).toEqual({
        key: 'needs/entity-1/image-1-photo.jpg',
        uploadUrl: 'https://s3.presigned.url',
        publicUrl:
          'https://test-bucket.s3.eu-west-1.amazonaws.com/needs/entity-1/image-1-photo.jpg',
      });
    });

    it('uses the default expiry of 3600 seconds when not specified', async () => {
      (getSignedUrl as jest.Mock).mockResolvedValue('https://s3.presigned.url');

      await service.createPresignedUrl({
        key: 'needs/entity-1/photo.jpg',
        contentType: 'image/jpeg',
      });

      const [, , options] = (getSignedUrl as jest.Mock).mock.calls[0];
      expect(options.expiresIn).toBe(3600);
    });

    it('uses a custom expiry when provided', async () => {
      (getSignedUrl as jest.Mock).mockResolvedValue('https://s3.presigned.url');

      await service.createPresignedUrl({
        key: 'needs/entity-1/photo.jpg',
        contentType: 'image/jpeg',
        expiresInSeconds: 600,
      });

      const [, , options] = (getSignedUrl as jest.Mock).mock.calls[0];
      expect(options.expiresIn).toBe(600);
    });

    it('includes ACL public-read in the command', async () => {
      (getSignedUrl as jest.Mock).mockResolvedValue('https://s3.presigned.url');

      await service.createPresignedUrl({
        key: 'needs/entity-1/photo.jpg',
        contentType: 'image/jpeg',
      });

      const commandInput = (getSignedUrl as jest.Mock).mock.calls[0][1];
      expect(commandInput).toMatchObject({ ACL: 'public-read' });
    });
  });

  // ─── headObject ───────────────────────────────────────────────────────────

  describe('headObject', () => {
    it('returns contentType and contentLength from the S3 response', async () => {
      s3Send.mockResolvedValue({
        ContentType: 'image/jpeg',
        ContentLength: 204800,
      });

      const result = await service.headObject('needs/entity-1/photo.jpg');

      expect(result).toEqual({
        contentType: 'image/jpeg',
        contentLength: 204800,
      });
    });

    it('returns null for contentType when S3 omits it', async () => {
      s3Send.mockResolvedValue({ ContentLength: 1024 });

      const result = await service.headObject('needs/entity-1/photo.jpg');

      expect(result.contentType).toBeNull();
    });

    it('returns null for contentLength when S3 omits it', async () => {
      s3Send.mockResolvedValue({ ContentType: 'image/jpeg' });

      const result = await service.headObject('needs/entity-1/photo.jpg');

      expect(result.contentLength).toBeNull();
    });

    it('throws when the object does not exist in S3', async () => {
      s3Send.mockRejectedValue(new Error('NoSuchKey'));

      await expect(
        service.headObject('needs/entity-1/missing.jpg'),
      ).rejects.toThrow('NoSuchKey');
    });
  });

  // ─── deleteObject ─────────────────────────────────────────────────────────

  describe('deleteObject', () => {
    it('sends a DeleteObjectCommand and returns { ok: true }', async () => {
      s3Send.mockResolvedValue({});

      const result = await service.deleteObject('needs/entity-1/photo.jpg');

      expect(s3Send).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ ok: true });
    });

    it('sends the correct bucket and key', async () => {
      s3Send.mockResolvedValue({});

      await service.deleteObject('needs/entity-1/photo.jpg');

      const command = s3Send.mock.calls[0][0];
      expect(command).toMatchObject({
        Bucket: ENV.AWS_BUCKET_NAME,
        Key: 'needs/entity-1/photo.jpg',
      });
    });

    it('propagates S3 errors', async () => {
      s3Send.mockRejectedValue(new Error('AccessDenied'));

      await expect(
        service.deleteObject('needs/entity-1/photo.jpg'),
      ).rejects.toThrow('AccessDenied');
    });
  });
});
