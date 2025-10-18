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
}
