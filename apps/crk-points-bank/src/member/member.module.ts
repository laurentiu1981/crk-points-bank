import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberController } from './member.controller';
import { MemberService } from './member.service';
import { AuthModule } from '../auth/auth.module';
import { Member } from '../entities/member.entity';
import { OAuthAccessToken } from '../entities/oauth-access-token.entity';
import { OAuthRefreshToken } from '../entities/oauth-refresh-token.entity';
import { RedemptionRequest } from '../entities/redemption-request.entity';
import { CreditTransaction } from '../entities/credit-transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Member,
      OAuthAccessToken,
      OAuthRefreshToken,
      RedemptionRequest,
      CreditTransaction,
    ]),
    AuthModule,
  ],
  controllers: [MemberController],
  providers: [MemberService],
  exports: [MemberService],
})
export class MemberModule {}
