import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BlockedUsersService } from './blocked-users.service.js';
import { BlockUserDto } from './dto/block-user.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Blocked Users')
@Controller('blocked-users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BlockedUsersController {
  constructor(private readonly blockedUsersService: BlockedUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get list of blocked users' })
  async getBlockedUsers(@CurrentUser('userId') userId: string) {
    return this.blockedUsersService.getBlockedUsers(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Block a user' })
  async blockUser(
    @CurrentUser('userId') userId: string,
    @Body() dto: BlockUserDto,
  ) {
    return this.blockedUsersService.blockUser(userId, dto.blockedUserId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Unblock a user' })
  async unblockUser(
    @CurrentUser('userId') userId: string,
    @Param('id') blockedUserId: string,
  ) {
    return this.blockedUsersService.unblockUser(userId, blockedUserId);
  }
}
