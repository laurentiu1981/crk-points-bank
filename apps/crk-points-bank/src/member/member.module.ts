import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberController } from './member.controller';
import { MemberService } from './member.service';
import { AuthModule } from '../auth/auth.module';
import { Member } from '../entities/member.entity';
import { OAuthAccessToken } from '../entities/oauth-access-token.entity';
import { OAuthRefreshToken } from '../entities/oauth-refresh-token.entity';
import { Transaction } from '../entities/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Member,
      OAuthAccessToken,
      OAuthRefreshToken,
      Transaction,
    ]),
    AuthModule,
  ],
  controllers: [MemberController],
  providers: [MemberService],
  exports: [MemberService],
})
export class MemberModule {}
