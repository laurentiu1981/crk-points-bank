import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { OAuthClient } from '../entities/oauth-client.entity';
import { OAuthAuthorizationCode } from '../entities/oauth-authorization-code.entity';
import { OAuthAccessToken } from '../entities/oauth-access-token.entity';
import { OAuthRefreshToken } from '../entities/oauth-refresh-token.entity';
import { Member } from '../entities/member.entity';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    @InjectRepository(OAuthClient)
    private clientRepository: Repository<OAuthClient>,
    @InjectRepository(OAuthAuthorizationCode)
    private authCodeRepository: Repository<OAuthAuthorizationCode>,
    @InjectRepository(OAuthAccessToken)
    private accessTokenRepository: Repository<OAuthAccessToken>,
    @InjectRepository(OAuthRefreshToken)
    private refreshTokenRepository: Repository<OAuthRefreshToken>,
    @InjectRepository(Member)
    private memberRepository: Repository<Member>,
    private configService: ConfigService
  ) {}

  async validateClient(clientId: string, clientSecret?: string): Promise<OAuthClient> {
    this.logger.debug(`Validating client: ${clientId}`);

    const client = await this.clientRepository.findOne({
      where: { clientId, active: true },
    });

    if (!client) {
      this.logger.warn(`Client not found: ${clientId}`);
      throw new NotFoundException('Client not found');
    }

    if (clientSecret && client.clientSecret !== clientSecret) {
      this.logger.warn(`Invalid client secret for client: ${clientId}`);
      throw new BadRequestException('Invalid client credentials');
    }

    this.logger.debug(`Client validated: ${client.clientName} (${clientId})`);
    return client;
  }

  async createAuthorizationCode(
    client: OAuthClient,
    member: Member,
    redirectUri: string,
    scope: string[]
  ): Promise<OAuthAuthorizationCode> {
    this.logger.debug(`Creating authorization code for member ${member.email} and client ${client.clientName}`);
    this.logger.debug(`Redirect URI: ${redirectUri}`);
    this.logger.debug(`Scope: ${scope.join(', ')}`);

    // Validate redirect URI
    if (!client.redirectUris.includes(redirectUri)) {
      this.logger.warn(`Invalid redirect URI: ${redirectUri}`);
      this.logger.debug(`Allowed URIs: ${client.redirectUris.join(', ')}`);
      throw new BadRequestException('Invalid redirect URI');
    }

    const code = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    const lifetime = this.configService.get<number>('OAUTH_AUTHORIZATION_CODE_LIFETIME');
    expiresAt.setSeconds(expiresAt.getSeconds() + lifetime);

    this.logger.debug(`Code lifetime: ${lifetime} seconds`);
    this.logger.debug(`Code expires at: ${expiresAt.toISOString()}`);

    const authCode = this.authCodeRepository.create({
      authorizationCode: code,
      expiresAt,
      redirectUri,
      scope,
      client,
      clientId: client.id,
      member,
      memberId: member.id,
    });

    const savedCode = await this.authCodeRepository.save(authCode);
    this.logger.debug(`Authorization code created: ${code.substring(0, 20)}...`);

    return savedCode;
  }

  async exchangeAuthorizationCode(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ): Promise<{ accessToken: OAuthAccessToken; refreshToken: OAuthRefreshToken }> {
    this.logger.debug(`Exchanging authorization code: ${code.substring(0, 20)}...`);
    this.logger.debug(`Client ID: ${clientId}`);
    this.logger.debug(`Redirect URI: ${redirectUri}`);

    const client = await this.validateClient(clientId, clientSecret);

    const authCode = await this.authCodeRepository.findOne({
      where: { authorizationCode: code },
      relations: ['member', 'client'],
    });

    if (!authCode) {
      this.logger.warn(`Invalid authorization code: ${code.substring(0, 20)}...`);
      throw new BadRequestException('Invalid authorization code');
    }

    this.logger.debug(`Authorization code found for member: ${authCode.member.email}`);

    if (authCode.expiresAt < new Date()) {
      this.logger.warn(`Authorization code expired. Expired at: ${authCode.expiresAt.toISOString()}`);
      throw new BadRequestException('Authorization code expired');
    }

    if (authCode.redirectUri !== redirectUri) {
      this.logger.warn(`Redirect URI mismatch. Expected: ${authCode.redirectUri}, Got: ${redirectUri}`);
      throw new BadRequestException('Redirect URI mismatch');
    }

    if (authCode.clientId !== client.id) {
      this.logger.warn(`Client mismatch. Expected: ${authCode.clientId}, Got: ${client.id}`);
      throw new BadRequestException('Client mismatch');
    }

    this.logger.debug(`All validations passed. Creating tokens for member: ${authCode.member.email}`);

    // Create access token
    const accessToken = await this.createAccessToken(
      client,
      authCode.member,
      authCode.scope
    );

    // Create refresh token
    const refreshToken = await this.createRefreshToken(
      client,
      authCode.member,
      authCode.scope
    );

    // Delete the used authorization code
    await this.authCodeRepository.remove(authCode);
    this.logger.debug('Authorization code deleted (one-time use)');

    this.logger.debug('Tokens created successfully');

    return { accessToken, refreshToken };
  }

  async createAccessToken(
    client: OAuthClient,
    member: Member,
    scope: string[]
  ): Promise<OAuthAccessToken> {
    this.logger.debug(`Creating access token for member ${member.email} and client ${client.clientName}`);
    this.logger.debug(`Scope: ${scope.join(', ')}`);

    const token = randomBytes(32).toString('hex');

    // Card linking tokens (pay-with-points scope) do not expire
    // They can only be revoked manually
    let expiresAt: Date = null;

    if (scope.includes('pay-with-points')) {
      this.logger.debug('🔗 Card linking scope detected - creating NON-EXPIRING token');
      this.logger.debug('⚠️  Token can only be revoked manually');
      expiresAt = null;
    } else {
      expiresAt = new Date();
      const lifetime = this.configService.get<number>('OAUTH_ACCESS_TOKEN_LIFETIME');
      expiresAt.setSeconds(expiresAt.getSeconds() + lifetime);
      this.logger.debug(`Access token lifetime: ${lifetime} seconds`);
      this.logger.debug(`Access token expires at: ${expiresAt.toISOString()}`);
    }

    const accessToken = this.accessTokenRepository.create({
      accessToken: token,
      accessTokenExpiresAt: expiresAt,
      scope,
      client,
      clientId: client.id,
      member,
      memberId: member.id,
      revoked: false,
    });

    const savedToken = await this.accessTokenRepository.save(accessToken);
    this.logger.debug(`Access token created: ${token.substring(0, 20)}...`);

    return savedToken;
  }

  async createRefreshToken(
    client: OAuthClient,
    member: Member,
    scope: string[]
  ): Promise<OAuthRefreshToken> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    const lifetime = this.configService.get<number>('OAUTH_REFRESH_TOKEN_LIFETIME');
    expiresAt.setSeconds(expiresAt.getSeconds() + lifetime);

    const refreshToken = this.refreshTokenRepository.create({
      refreshToken: token,
      refreshTokenExpiresAt: expiresAt,
      scope,
      client,
      clientId: client.id,
      member,
      memberId: member.id,
      revoked: false,
    });

    return this.refreshTokenRepository.save(refreshToken);
  }

  async refreshAccessToken(
    refreshTokenValue: string,
    clientId: string,
    clientSecret: string
  ): Promise<{ accessToken: OAuthAccessToken; refreshToken: OAuthRefreshToken }> {
    const client = await this.validateClient(clientId, clientSecret);

    const refreshToken = await this.refreshTokenRepository.findOne({
      where: { refreshToken: refreshTokenValue, revoked: false },
      relations: ['member', 'client'],
    });

    if (!refreshToken) {
      throw new BadRequestException('Invalid refresh token');
    }

    if (refreshToken.refreshTokenExpiresAt < new Date()) {
      throw new BadRequestException('Refresh token expired');
    }

    if (refreshToken.clientId !== client.id) {
      throw new BadRequestException('Client mismatch');
    }

    // Revoke old refresh token
    refreshToken.revoked = true;
    await this.refreshTokenRepository.save(refreshToken);

    // Create new tokens
    const accessToken = await this.createAccessToken(
      client,
      refreshToken.member,
      refreshToken.scope
    );

    const newRefreshToken = await this.createRefreshToken(
      client,
      refreshToken.member,
      refreshToken.scope
    );

    return { accessToken, refreshToken: newRefreshToken };
  }

  async validateAccessToken(token: string): Promise<OAuthAccessToken> {
    this.logger.debug(`Validating access token: ${token.substring(0, 20)}...`);

    const accessToken = await this.accessTokenRepository.findOne({
      where: { accessToken: token, revoked: false },
      relations: ['member', 'client'],
    });

    if (!accessToken) {
      this.logger.warn(`Invalid access token: ${token.substring(0, 20)}...`);
      throw new BadRequestException('Invalid access token');
    }

    this.logger.debug(`Access token found for member: ${accessToken.member.email}`);
    this.logger.debug(`Scope: ${accessToken.scope.join(', ')}`);

    // Check expiration only if the token has an expiration date
    // Tokens with pay-with-points scope never expire (accessTokenExpiresAt is null)
    if (accessToken.accessTokenExpiresAt) {
      this.logger.debug(`Expires at: ${accessToken.accessTokenExpiresAt.toISOString()}`);

      if (accessToken.accessTokenExpiresAt < new Date()) {
        this.logger.warn(`Access token expired at: ${accessToken.accessTokenExpiresAt.toISOString()}`);
        throw new BadRequestException('Access token expired');
      }
    } else {
      this.logger.debug('Non-expiring token (card linking)');
    }

    this.logger.debug('Access token validated successfully');

    return accessToken;
  }

  async cleanupExpiredTokens(): Promise<void> {
    const now = new Date();

    // Clean up expired authorization codes
    await this.authCodeRepository.delete({ expiresAt: LessThan(now) });

    // Clean up expired access tokens
    await this.accessTokenRepository.delete({
      accessTokenExpiresAt: LessThan(now),
    });

    // Clean up expired refresh tokens
    await this.refreshTokenRepository.delete({
      refreshTokenExpiresAt: LessThan(now),
    });
  }
}
