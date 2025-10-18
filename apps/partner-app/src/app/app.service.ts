import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private readonly pointsBankUrl = process.env.POINTS_BANK_URL || 'http://localhost:3000';
  private readonly clientId = process.env.OAUTH_CLIENT_ID;
  private readonly clientSecret = process.env.OAUTH_CLIENT_SECRET;
  private readonly redirectUri = process.env.OAUTH_REDIRECT_URI;

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<any> {
    const url = `${this.pointsBankUrl}/api/oauth/token`;
    const payload = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      client_secret: '[REDACTED]',
    };

    this.logger.log('=== EXCHANGE CODE FOR TOKEN ===');
    this.logger.log(`POST ${url}`);
    this.logger.log(`Payload: ${JSON.stringify(payload, null, 2)}`);

    const response = await axios.post(
      url,
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    this.logger.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
    this.logger.log('=== END EXCHANGE CODE ===\n');

    return response.data;
  }

  /**
   * Get member information from Points Bank
   */
  async getMemberInfo(accessToken: string): Promise<any> {
    const url = `${this.pointsBankUrl}/api/oauth/userinfo`;

    this.logger.log('=== GET MEMBER INFO ===');
    this.logger.log(`GET ${url}`);
    this.logger.log(`Authorization: Bearer ${accessToken.substring(0, 20)}...`);

    const response = await axios.get(
      url,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    this.logger.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
    this.logger.log('=== END GET MEMBER INFO ===\n');

    return response.data;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<any> {
    const url = `${this.pointsBankUrl}/api/oauth/token`;
    const payload = {
      grant_type: 'refresh_token',
      refresh_token: '[REDACTED]',
      client_id: this.clientId,
      client_secret: '[REDACTED]',
    };

    this.logger.log('=== REFRESH ACCESS TOKEN ===');
    this.logger.log(`POST ${url}`);
    this.logger.log(`Payload: ${JSON.stringify(payload, null, 2)}`);

    const response = await axios.post(
      url,
      {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    this.logger.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
    this.logger.log('=== END REFRESH TOKEN ===\n');

    return response.data;
  }

  /**
   * Redeem points using member's access token (Approach 1)
   */
  async redeemPoints(accessToken: string, amount: number, description?: string): Promise<any> {
    const url = `${this.pointsBankUrl}/api/points/redeem`;
    const payload = {
      amount,
      description: description || undefined,
    };

    this.logger.log('=== REDEEM POINTS ===');
    this.logger.log(`POST ${url}`);
    this.logger.log(`Authorization: Bearer ${accessToken.substring(0, 20)}...`);
    this.logger.log(`Payload: ${JSON.stringify(payload, null, 2)}`);

    const response = await axios.post(
      url,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    this.logger.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
    this.logger.log('=== END REDEEM POINTS ===\n');

    return response.data;
  }

  /**
   * Credit/Reward points to a member (B2B action)
   * Partner awards points using client credentials
   */
  async creditPoints(memberId: string, amount: number, description?: string, reason?: string): Promise<any> {
    const url = `${this.pointsBankUrl}/api/points/credit`;
    const payload = {
      client_id: this.clientId,
      client_secret: '[REDACTED]',
      member_id: memberId,
      amount,
      description: description || undefined,
      reason: reason || undefined,
    };

    this.logger.log('=== CREDIT POINTS (B2B) ===');
    this.logger.log(`POST ${url}`);
    this.logger.log(`Payload: ${JSON.stringify(payload, null, 2)}`);

    const response = await axios.post(
      url,
      {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        member_id: memberId,
        amount,
        description,
        reason,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    this.logger.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
    this.logger.log('=== END CREDIT POINTS ===\n');

    return response.data;
  }

  /**
   * Get all members from Points Bank (for simulation dashboard)
   */
  async getAllMembers(): Promise<any> {
    const url = `${this.pointsBankUrl}/api/admin/oauth-clients/members`;

    this.logger.log('=== GET ALL MEMBERS ===');
    this.logger.log(`GET ${url}`);

    const response = await axios.get(url);

    this.logger.log(`Response: Found ${response.data.length} members`);
    this.logger.log('=== END GET ALL MEMBERS ===\n');

    return response.data;
  }

  /**
   * Create redemption request (OTP-based) - B2B operation
   */
  async createRedemptionRequest(
    memberId: string,
    amount: number,
    description?: string
  ): Promise<any> {
    const url = `${this.pointsBankUrl}/api/points/redemption-request`;
    const payload = {
      client_id: this.clientId,
      client_secret: '[REDACTED]',
      member_id: memberId,
      amount,
      description,
    };

    this.logger.log('=== CREATE REDEMPTION REQUEST ===');
    this.logger.log(`POST ${url}`);
    this.logger.log(`Payload: ${JSON.stringify(payload, null, 2)}`);

    const response = await axios.post(
      url,
      {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        member_id: memberId,
        amount,
        description,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    this.logger.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
    this.logger.log('=== END CREATE REDEMPTION REQUEST ===\n');

    return response.data;
  }

  /**
   * Get pending redemption requests (for simulation dashboard)
   * This would normally require authentication, but for demo purposes
   * we'll call the Points Bank API to get all pending requests
   */
  async getPendingRedemptionRequests(): Promise<any> {
    const url = `${this.pointsBankUrl}/api/admin/redemption-requests/pending`;

    this.logger.log('=== GET PENDING REDEMPTION REQUESTS ===');
    this.logger.log(`GET ${url}`);

    try {
      const response = await axios.get(url);

      this.logger.log(`Response: Found ${response.data.length || 0} pending requests`);
      this.logger.log('=== END GET PENDING REQUESTS ===\n');

      return response.data;
    } catch (error) {
      this.logger.warn('Failed to fetch pending requests');
      return [];
    }
  }

  /**
   * Approve redemption request with OTP
   * This simulates the member approving the request
   */
  async approveRedemptionRequest(
    requestId: string,
    memberId: string,
    otp: string
  ): Promise<any> {
    const url = `${this.pointsBankUrl}/api/admin/redemption-requests/approve`;
    const payload = {
      request_id: requestId,
      member_id: memberId,
      otp,
    };

    this.logger.log('=== APPROVE REDEMPTION REQUEST (SIMULATION) ===');
    this.logger.log(`POST ${url}`);
    this.logger.log(`Payload: ${JSON.stringify(payload, null, 2)}`);

    const response = await axios.post(
      url,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    this.logger.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
    this.logger.log('=== END APPROVE REDEMPTION REQUEST ===\n');

    return response.data;
  }

  /**
   * Reject redemption request
   * This simulates the member rejecting the request
   */
  async rejectRedemptionRequest(
    requestId: string,
    memberId: string
  ): Promise<any> {
    const url = `${this.pointsBankUrl}/api/admin/redemption-requests/reject`;
    const payload = {
      request_id: requestId,
      member_id: memberId,
    };

    this.logger.log('=== REJECT REDEMPTION REQUEST (SIMULATION) ===');
    this.logger.log(`POST ${url}`);
    this.logger.log(`Payload: ${JSON.stringify(payload, null, 2)}`);

    const response = await axios.post(
      url,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    this.logger.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
    this.logger.log('=== END REJECT REDEMPTION REQUEST ===\n');

    return response.data;
  }
}
