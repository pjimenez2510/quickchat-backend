import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { PresignedUrlDto } from './dto/presigned-url.dto.js';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface PresignedUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  key: string;
}

@Injectable()
export class UploadService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_S3_REGION', 'us-east-1');
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET', 'quickchat-uploads');

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  async getPresignedUrl(userId: string, dto: PresignedUrlDto) {
    const ext = dto.filename.split('.').pop() ?? '';
    const key = `${dto.folder}/${userId}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: dto.contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 300,
      unhoistableHeaders: new Set(['content-type']),
    });

    const fileUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    return {
      message: 'Presigned URL generated successfully',
      data: {
        uploadUrl,
        fileUrl,
        key,
      } as PresignedUrlResponse,
    };
  }
}
