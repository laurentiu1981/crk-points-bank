import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '../auth/auth.module';
import { OAuthModule } from '../oauth/oauth.module';
import { AdminModule } from '../admin/admin.module';
import { PointsModule } from '../points/points.module';
import { MemberModule } from '../member/member.module';
import { Member } from '../entities/member.entity';
import { OAuthClient } from '../entities/oauth-client.entity';
import { OAuthAuthorizationCode } from '../entities/oauth-authorization-code.entity';
import { OAuthAccessToken } from '../entities/oauth-access-token.entity';
import { OAuthRefreshToken } from '../entities/oauth-refresh-token.entity';
import { RedemptionRequest } from '../entities/redemption-request.entity';
import { Transaction } from '../entities/transaction.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [
          Member,
          OAuthClient,
          OAuthAuthorizationCode,
          OAuthAccessToken,
          OAuthRefreshToken,
          RedemptionRequest,
          Transaction,
        ],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    OAuthModule,
    AdminModule,
    PointsModule,
    MemberModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
