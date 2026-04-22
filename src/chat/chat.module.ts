import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway.js';
import { UsersModule } from '../users/users.module.js';
import { MessagesModule } from '../messages/messages.module.js';
import { CallsModule } from '../calls/calls.module.js';

@Module({
  imports: [JwtModule.register({}), UsersModule, MessagesModule, CallsModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}
