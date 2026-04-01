import { IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MaxLength(255)
  identifier!: string;

  @IsString()
  @MaxLength(72)
  password!: string;
}
