import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CallsService } from './calls.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Calls')
@Controller('calls')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Get('conversation/:conversationId')
  @ApiOperation({ summary: 'Get call history for a conversation' })
  async getCallHistory(
    @CurrentUser('userId') userId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.callsService.getCallHistory(conversationId, userId);
  }
}
