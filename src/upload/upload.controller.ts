import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UploadService } from './upload.service.js';
import { PresignedUrlDto } from './dto/presigned-url.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presigned-url')
  @ApiOperation({ summary: 'Get a presigned URL for direct S3 upload' })
  async getPresignedUrl(
    @CurrentUser('userId') userId: string,
    @Body() dto: PresignedUrlDto,
  ) {
    return this.uploadService.getPresignedUrl(userId, dto);
  }
}
