import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength } from 'class-validator';

export enum UploadFolder {
  AVATARS = 'avatars',
  IMAGES = 'images',
  VIDEOS = 'videos',
  AUDIOS = 'audios',
  VOICES = 'voices',
  FILES = 'files',
}

export class PresignedUrlDto {
  @ApiProperty({ example: 'photo.jpg', description: 'Original filename' })
  @IsString()
  @MaxLength(255)
  filename!: string;

  @ApiProperty({ example: 'image/jpeg', description: 'MIME type of the file' })
  @IsString()
  @MaxLength(100)
  contentType!: string;

  @ApiProperty({ enum: UploadFolder, example: 'images' })
  @IsEnum(UploadFolder)
  folder!: UploadFolder;
}
