import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway.js';
import { UsersModule } from '../users/users.module.js';
import { MessagesModule } from '../messages/messages.module.js';
import { CallsModule } from '../calls/calls.module.js';
import { ContactsModule } from '../contacts/contacts.module.js';
import { WsCryptoInterceptor } from '../common/interceptors/ws-crypto.interceptor.js';

@Module({
  imports: [JwtModule.register({}), UsersModule, MessagesModule, CallsModule, ContactsModule],
  providers: [ChatGateway, WsCryptoInterceptor],
  exports: [ChatGateway],
})
export class ChatModule {}
