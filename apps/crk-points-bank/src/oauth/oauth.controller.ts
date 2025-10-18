import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Request,
  Response,
  BadRequestException,
  Render,
  Logger,
} from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { AuthService } from '../auth/auth.service';

@Controller('oauth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private oauthService: OAuthService,
    private authService: AuthService
  ) {}

  /**
   * Authorization endpoint - entry point for OAuth flow
   * Member does NOT need to be authenticated yet
   */
  @Get('authorize')
  async authorize(
    @Query('client_id') clientId: string,
    @Query('redirect_uri') redirectUri: string,
    @Query('response_type') responseType: string,
    @Query('scope') scope: string,
    @Query('state') state: string,
    @Request() req,
    @Response() res
  ) {
    this.logger.log('=== OAUTH AUTHORIZE REQUEST ===');
    this.logger.log(`Client ID: ${clientId}`);
    this.logger.log(`Redirect URI: ${redirectUri}`);
    this.logger.log(`Response Type: ${responseType}`);
    this.logger.log(`Scope: ${scope || 'profile points'}`);
    this.logger.log(`State: ${state || 'none'}`);
    this.logger.log(`Session Member ID: ${req.session.memberId || 'not logged in'}`);

    if (responseType !== 'code') {
      throw new BadRequestException('Unsupported response type');
    }

    if (!clientId || !redirectUri) {
      throw new BadRequestException('Missing required parameters');
    }

    // Validate client
    const client = await this.oauthService.validateClient(clientId);
    this.logger.log(`Client validated: ${client.clientName}`);

    // Check if member is logged in via session
    if (!req.session.memberId) {
      // Save OAuth request parameters in session
      req.session.oauthRequest = {
        clientId,
        redirectUri,
        responseType,
        scope: scope || 'profile points',
        state,
      };

      this.logger.log('Member not logged in, redirecting to login page');
      this.logger.log('=== END OAUTH AUTHORIZE ===\n');
      // Redirect to login page with client info
      return res.redirect(`/api/oauth/login-form?client_name=${encodeURIComponent(client.clientName)}`);
    }

    // Member is logged in, redirect to consent page
    this.logger.log('Member already logged in, redirecting to consent page');
    this.logger.log('=== END OAUTH AUTHORIZE ===\n');
    return res.redirect('/api/oauth/consent-form');
  }

  /**
   * Show login form
   */
  @Get('login-form')
  async showLoginForm(@Query('client_name') clientName: string, @Query('error') error: string, @Response() res) {
    return res.render('login', {
      clientName: clientName || null,
      error: error || null,
    });
  }

  /**
   * Process login form submission
   */
  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
    @Request() req,
    @Response() res
  ) {
    this.logger.log('=== MEMBER LOGIN ATTEMPT ===');
    this.logger.log(`Email: ${email}`);
    this.logger.log(`OAuth Request in session: ${!!req.session.oauthRequest}`);

    try {
      const member = await this.authService.validateMember(email, password);

      // Create session
      req.session.memberId = member.id;
      req.session.memberEmail = member.email;

      this.logger.log(`Login successful for member: ${member.id} (${member.email})`);
      this.logger.log('Creating session and redirecting to consent page');
      this.logger.log('=== END LOGIN ===\n');

      // Redirect to consent page
      return res.redirect('/api/oauth/consent-form');
    } catch (error) {
      this.logger.warn(`Login failed for email: ${email}`);
      this.logger.log('=== END LOGIN ===\n');

      // Redirect back to login with error
      const clientName = req.session.oauthRequest?.clientId
        ? (await this.oauthService.validateClient(req.session.oauthRequest.clientId)).clientName
        : '';
      return res.redirect(`/api/oauth/login-form?error=${encodeURIComponent('Invalid email or password')}&client_name=${encodeURIComponent(clientName)}`);
    }
  }

  /**
   * Show registration form
   */
  @Get('register-form')
  async showRegisterForm(@Query('error') error: string, @Response() res) {
    return res.render('register', {
      error: error || null,
    });
  }

  /**
   * Process registration form submission
   */
  @Post('register')
  async register(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('firstName') firstName: string,
    @Body('lastName') lastName: string,
    @Request() req,
    @Response() res
  ) {
    try {
      const member = await this.authService.register({
        email,
        password,
        firstName,
        lastName,
      });

      // Create session
      req.session.memberId = member.id;
      req.session.memberEmail = member.email;

      // Redirect to consent page
      return res.redirect('/api/oauth/consent-form');
    } catch (error) {
      return res.redirect(`/api/oauth/register-form?error=${encodeURIComponent(error.message || 'Registration failed')}`);
    }
  }

  /**
   * Show consent page
   */
  @Get('consent-form')
  async showConsentForm(@Request() req, @Response() res) {
    if (!req.session.memberId || !req.session.oauthRequest) {
      return res.redirect('/api/oauth/login-form');
    }

    const client = await this.oauthService.validateClient(req.session.oauthRequest.clientId);
    const scopes = req.session.oauthRequest.scope.split(' ');

    return res.render('consent', {
      clientName: client.clientName,
      memberEmail: req.session.memberEmail,
      hasProfileScope: scopes.includes('profile'),
      hasPointsScope: scopes.includes('points'),
    });
  }

  /**
   * Process consent (approve)
   */
  @Post('consent')
  async consent(@Request() req, @Response() res) {
    this.logger.log('=== OAUTH CONSENT APPROVAL ===');
    this.logger.log(`Session Member ID: ${req.session.memberId}`);
    this.logger.log(`OAuth Request exists: ${!!req.session.oauthRequest}`);

    if (!req.session.memberId || !req.session.oauthRequest) {
      this.logger.warn('Missing session data, redirecting to login');
      this.logger.log('=== END CONSENT ===\n');
      return res.redirect('/api/oauth/login-form');
    }

    const { clientId, redirectUri, scope, state } = req.session.oauthRequest;
    this.logger.log(`Client ID: ${clientId}`);
    this.logger.log(`Redirect URI: ${redirectUri}`);
    this.logger.log(`Scope: ${scope}`);
    this.logger.log(`State: ${state || 'none'}`);

    // Get client and member
    const client = await this.oauthService.validateClient(clientId);
    const member = await this.authService.findById(req.session.memberId);

    this.logger.log(`Member: ${member.email} (${member.id})`);

    // Create authorization code
    const scopes = scope.split(' ');
    const authCode = await this.oauthService.createAuthorizationCode(
      client,
      member,
      redirectUri,
      scopes
    );

    this.logger.log(`Authorization code created: ${authCode.authorizationCode.substring(0, 20)}...`);
    this.logger.log(`Expires at: ${authCode.expiresAt.toISOString()}`);

    // Clean up session OAuth request
    delete req.session.oauthRequest;

    // Redirect back to client with authorization code
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.append('code', authCode.authorizationCode);
    if (state) {
      redirectUrl.searchParams.append('state', state);
    }

    this.logger.log(`Redirecting to: ${redirectUrl.toString()}`);
    this.logger.log('=== END CONSENT ===\n');

    return res.redirect(redirectUrl.toString());
  }

  /**
   * Deny authorization
   */
  @Get('deny')
  async deny(@Request() req, @Response() res) {
    const oauthRequest = req.session.oauthRequest;

    // Clean up session
    delete req.session.oauthRequest;

    if (oauthRequest && oauthRequest.redirectUri) {
      const redirectUrl = new URL(oauthRequest.redirectUri);
      redirectUrl.searchParams.append('error', 'access_denied');
      redirectUrl.searchParams.append('error_description', 'The user denied the request');
      if (oauthRequest.state) {
        redirectUrl.searchParams.append('state', oauthRequest.state);
      }
      return res.redirect(redirectUrl.toString());
    }

    return res.send('Authorization denied');
  }

  /**
   * Token endpoint - exchanges authorization code for access token
   */
  @Post('token')
  async token(
    @Body('grant_type') grantType: string,
    @Body('code') code: string,
    @Body('redirect_uri') redirectUri: string,
    @Body('client_id') clientId: string,
    @Body('client_secret') clientSecret: string,
    @Body('refresh_token') refreshToken: string
  ) {
    this.logger.log('=== TOKEN ENDPOINT REQUEST ===');
    this.logger.log(`Grant Type: ${grantType}`);

    if (grantType === 'authorization_code') {
      this.logger.log(`Authorization Code: ${code?.substring(0, 20)}...`);
      this.logger.log(`Redirect URI: ${redirectUri}`);
      this.logger.log(`Client ID: ${clientId}`);
      this.logger.log(`Client Secret: ${clientSecret ? '[REDACTED]' : 'missing'}`);

      if (!code || !redirectUri || !clientId || !clientSecret) {
        throw new BadRequestException('Missing required parameters');
      }

      const tokens = await this.oauthService.exchangeAuthorizationCode(
        code,
        clientId,
        clientSecret,
        redirectUri
      );

      const response = {
        access_token: tokens.accessToken.accessToken,
        token_type: 'Bearer',
        expires_in: Math.floor(
          (tokens.accessToken.accessTokenExpiresAt.getTime() - Date.now()) / 1000
        ),
        refresh_token: tokens.refreshToken.refreshToken,
        scope: tokens.accessToken.scope.join(' '),
      };

      this.logger.log('Response:');
      this.logger.log(`  Access Token: ${response.access_token.substring(0, 20)}...`);
      this.logger.log(`  Token Type: ${response.token_type}`);
      this.logger.log(`  Expires In: ${response.expires_in} seconds`);
      this.logger.log(`  Refresh Token: ${response.refresh_token.substring(0, 20)}...`);
      this.logger.log(`  Scope: ${response.scope}`);
      this.logger.log('=== END TOKEN EXCHANGE ===\n');

      return response;
    } else if (grantType === 'refresh_token') {
      this.logger.log(`Refresh Token: ${refreshToken?.substring(0, 20)}...`);
      this.logger.log(`Client ID: ${clientId}`);
      this.logger.log(`Client Secret: ${clientSecret ? '[REDACTED]' : 'missing'}`);

      if (!refreshToken || !clientId || !clientSecret) {
        throw new BadRequestException('Missing required parameters');
      }

      const tokens = await this.oauthService.refreshAccessToken(
        refreshToken,
        clientId,
        clientSecret
      );

      const response = {
        access_token: tokens.accessToken.accessToken,
        token_type: 'Bearer',
        expires_in: Math.floor(
          (tokens.accessToken.accessTokenExpiresAt.getTime() - Date.now()) / 1000
        ),
        refresh_token: tokens.refreshToken.refreshToken,
        scope: tokens.accessToken.scope.join(' '),
      };

      this.logger.log('Response:');
      this.logger.log(`  Access Token: ${response.access_token.substring(0, 20)}...`);
      this.logger.log(`  Token Type: ${response.token_type}`);
      this.logger.log(`  Expires In: ${response.expires_in} seconds`);
      this.logger.log(`  Refresh Token: ${response.refresh_token.substring(0, 20)}...`);
      this.logger.log(`  Scope: ${response.scope}`);
      this.logger.log('=== END TOKEN REFRESH ===\n');

      return response;
    } else {
      throw new BadRequestException('Unsupported grant type');
    }
  }

  /**
   * User info endpoint - returns member information for a valid access token
   */
  @Get('userinfo')
  async userInfo(@Request() req) {
    this.logger.log('=== USERINFO REQUEST ===');

    const authHeader = req.headers.authorization;
    this.logger.log(`Authorization Header: ${authHeader ? authHeader.substring(0, 27) + '...' : 'missing'}`);

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new BadRequestException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    this.logger.log(`Access Token: ${token.substring(0, 20)}...`);

    const accessToken = await this.oauthService.validateAccessToken(token);
    this.logger.log(`Token validated for member: ${accessToken.member.email} (${accessToken.member.id})`);
    this.logger.log(`Scopes: ${accessToken.scope.join(', ')}`);

    // Return member information based on requested scopes
    const userInfo: any = {};

    if (accessToken.scope.includes('profile')) {
      userInfo.id = accessToken.member.id;
      userInfo.email = accessToken.member.email;
      userInfo.firstName = accessToken.member.firstName;
      userInfo.lastName = accessToken.member.lastName;
    }

    if (accessToken.scope.includes('points')) {
      userInfo.points = accessToken.member.points;
    }

    this.logger.log(`Response: ${JSON.stringify(userInfo, null, 2)}`);
    this.logger.log('=== END USERINFO ===\n');

    return userInfo;
  }
}
