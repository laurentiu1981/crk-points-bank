import {
  Controller,
  Post,
  Get,
  Body,
  Request,
  BadRequestException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { PointsService } from './points.service';
import { OAuthService } from '../oauth/oauth.service';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('points')
export class PointsController {
  private readonly logger = new Logger(PointsController.name);

  constructor(
    private pointsService: PointsService,
    private oauthService: OAuthService,
    private authService: AuthService,
  ) {}

  /**
   * APPROACH 1: Direct redemption using member's OAuth access token
   * Partner app uses the member's access token to redeem points
   * Requires: Bearer token (OAuth access token with 'points' scope)
   */
  @Post('redeem')
  async redeemWithAccessToken(
    @Request() req,
    @Body('amount') amount: number,
    @Body('description') description?: string,
  ) {
    this.logger.log('=== REDEEM POINTS WITH ACCESS TOKEN ===');
    this.logger.log(`Amount: ${amount}`);
    this.logger.log(`Description: ${description || 'none'}`);

    // Extract access token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new BadRequestException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    this.logger.log(`Access Token: ${token.substring(0, 20)}...`);

    // Validate access token
    const accessToken = await this.oauthService.validateAccessToken(token);

    // Check if token has 'points' scope
    if (!accessToken.scope.includes('points')) {
      this.logger.warn('Access token does not have points scope');
      throw new BadRequestException('Access token does not have permission to redeem points. Required scope: points');
    }

    this.logger.log(`Token validated. Member: ${accessToken.member.email}`);
    this.logger.log(`Client: ${accessToken.client.clientName}`);
    this.logger.log(`Scopes: ${accessToken.scope.join(', ')}`);

    // Perform redemption
    const result = await this.pointsService.redeemWithAccessToken(
      accessToken.member,
      accessToken.client,
      amount,
      description,
    );

    this.logger.log('=== END REDEEM POINTS ===\n');

    return {
      success: result.success,
      newBalance: result.newBalance,
      transactionId: result.transactionId,
      redeemedAmount: amount,
      client: {
        id: accessToken.client.clientId,
        name: accessToken.client.clientName,
      },
    };
  }

  /**
   * APPROACH 2: Create redemption request (requires OTP approval)
   * Partner initiates redemption, member must approve with OTP
   * Requires: Client credentials in body
   */
  @Post('redemption-request')
  async createRedemptionRequest(
    @Body('client_id') clientId: string,
    @Body('client_secret') clientSecret: string,
    @Body('member_id') memberId: string,
    @Body('amount') amount: number,
    @Body('description') description?: string,
  ) {
    this.logger.log('=== CREATE REDEMPTION REQUEST ENDPOINT ===');

    if (!clientId || !clientSecret || !memberId || !amount) {
      throw new BadRequestException('Missing required parameters: client_id, client_secret, member_id, amount');
    }

    const result = await this.pointsService.createRedemptionRequest(
      clientId,
      clientSecret,
      memberId,
      amount,
      description,
    );

    this.logger.log('=== END CREATE REDEMPTION REQUEST ENDPOINT ===\n');

    return {
      success: true,
      requestId: result.requestId,
      otp: result.otp, // For demo only - in production, send via SMS/Email
      expiresAt: result.expiresAt,
      message: 'Redemption request created. Member must approve with OTP within 10 minutes.',
    };
  }

  /**
   * Member approves redemption request with OTP
   * Requires: Member JWT authentication
   */
  @Post('redemption/approve')
  @UseGuards(JwtAuthGuard)
  async approveRedemption(
    @Request() req,
    @Body('request_id') requestId: string,
    @Body('otp') otp: string,
  ) {
    this.logger.log('=== APPROVE REDEMPTION ENDPOINT ===');
    this.logger.log(`Member: ${req.user.email} (${req.user.userId})`);
    this.logger.log(`Request ID: ${requestId}`);

    if (!requestId || !otp) {
      throw new BadRequestException('Missing required parameters: request_id, otp');
    }

    const result = await this.pointsService.approveRedemptionRequest(
      req.user.userId,
      requestId,
      otp,
    );

    this.logger.log('=== END APPROVE REDEMPTION ENDPOINT ===\n');

    return {
      success: result.success,
      newBalance: result.newBalance,
      transactionId: result.transactionId,
      message: 'Points redeemed successfully',
    };
  }

  /**
   * Member rejects redemption request
   * Requires: Member JWT authentication
   */
  @Post('redemption/reject')
  @UseGuards(JwtAuthGuard)
  async rejectRedemption(
    @Request() req,
    @Body('request_id') requestId: string,
  ) {
    this.logger.log('=== REJECT REDEMPTION ENDPOINT ===');
    this.logger.log(`Member: ${req.user.email} (${req.user.userId})`);
    this.logger.log(`Request ID: ${requestId}`);

    if (!requestId) {
      throw new BadRequestException('Missing required parameter: request_id');
    }

    const result = await this.pointsService.rejectRedemptionRequest(
      req.user.userId,
      requestId,
    );

    this.logger.log('=== END REJECT REDEMPTION ENDPOINT ===\n');

    return {
      success: result.success,
      message: 'Redemption request rejected',
    };
  }

  /**
   * Get pending redemption requests for authenticated member
   * Requires: Member JWT authentication
   */
  @Get('redemption/pending')
  @UseGuards(JwtAuthGuard)
  async getPendingRedemptions(@Request() req) {
    this.logger.log('=== GET PENDING REDEMPTIONS ===');
    this.logger.log(`Member: ${req.user.email} (${req.user.userId})`);

    const requests = await this.pointsService.getPendingRequests(req.user.userId);

    this.logger.log(`Found ${requests.length} pending redemption requests`);
    this.logger.log('=== END GET PENDING REDEMPTIONS ===\n');

    return {
      pendingRequests: requests.map((r) => ({
        requestId: r.id,
        amount: r.amount,
        description: r.description,
        partnerName: r.client.clientName,
        createdAt: r.createdAt,
        expiresAt: r.otpExpiresAt,
      })),
    };
  }
}
