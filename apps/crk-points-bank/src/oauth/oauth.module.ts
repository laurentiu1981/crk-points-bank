import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OAuthService } from './oauth.service';
import { OAuthController } from './oauth.controller';
import { OAuthClient } from '../entities/oauth-client.entity';
import { OAuthAuthorizationCode } from '../entities/oauth-authorization-code.entity';
import { OAuthAccessToken } from '../entities/oauth-access-token.entity';
import { OAuthRefreshToken } from '../entities/oauth-refresh-token.entity';
import { Member } from '../entities/member.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OAuthClient,
      OAuthAuthorizationCode,
      OAuthAccessToken,
      OAuthRefreshToken,
      Member,
    ]),
    AuthModule,
  ],
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}
