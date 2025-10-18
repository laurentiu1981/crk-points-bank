import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Request,
  Response,
  Render,
  BadRequestException,
} from '@nestjs/common';
import { AppService } from './app.service';
import { randomBytes } from 'crypto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Home page - shows login button if not logged in, dashboard if logged in
   */
  @Get()
  async home(@Request() req, @Response() res) {
    if (req.session.member) {
      // Member is logged in, redirect to dashboard
      return res.redirect('/dashboard');
    }

    return res.render('home', {
      pointsBankUrl: process.env.POINTS_BANK_URL || 'http://localhost:3000',
    });
  }

  /**
   * Initiate OAuth login
   */
  @Get('login')
  async login(@Request() req, @Response() res) {
    const state = randomBytes(16).toString('hex');
    req.session.oauthState = state;

    const authUrl = new URL(`${process.env.POINTS_BANK_URL || 'http://localhost:3000'}/api/oauth/authorize`);
    authUrl.searchParams.append('client_id', process.env.OAUTH_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', process.env.OAUTH_REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'profile points');
    authUrl.searchParams.append('state', state);

    return res.redirect(authUrl.toString());
  }

  /**
   * OAuth callback - exchange code for token
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Request() req,
    @Response() res
  ) {
    // Handle errors
    if (error) {
      return res.redirect(`/?error=${encodeURIComponent(error)}`);
    }

    // Validate state
    if (!state || state !== req.session.oauthState) {
      throw new BadRequestException('Invalid state parameter');
    }

    // Clear state
    delete req.session.oauthState;

    // Exchange code for tokens
    const tokens = await this.appService.exchangeCodeForToken(code);

    // Save tokens in session
    req.session.accessToken = tokens.access_token;
    req.session.refreshToken = tokens.refresh_token;

    // Get member info
    const memberInfo = await this.appService.getMemberInfo(tokens.access_token);
    req.session.member = memberInfo;

    // Redirect to dashboard
    return res.redirect('/dashboard');
  }

  /**
   * Dashboard - shows member info and points
   */
  @Get('dashboard')
  async dashboard(
    @Query('success') success: string,
    @Query('credit') credit: string,
    @Query('amount') amount: string,
    @Query('error') error: string,
    @Request() req,
    @Response() res
  ) {
    if (!req.session.member) {
      return res.redirect('/');
    }

    let successMessage = null;
    if (success === 'true') {
      successMessage = `Successfully redeemed ${amount} points!`;
    } else if (credit === 'true') {
      successMessage = `Successfully rewarded ${amount} points!`;
    }

    return res.render('dashboard', {
      member: req.session.member,
      successMessage,
      errorMessage: error ? decodeURIComponent(error) : null,
    });
  }

  /**
   * Redeem points using OAuth access token
   */
  @Post('redeem')
  async redeemPoints(
    @Body('amount') amount: number,
    @Body('description') description: string,
    @Request() req,
    @Response() res
  ) {
    if (!req.session.member || !req.session.accessToken) {
      return res.redirect('/');
    }

    try {
      const result = await this.appService.redeemPoints(
        req.session.accessToken,
        amount,
        description
      );

      // Update member info in session with new balance
      req.session.member.points = result.newBalance;

      // Redirect to dashboard with success message
      return res.redirect('/dashboard?success=true&amount=' + amount);
    } catch (error) {
      console.error('Redemption error:', error.response?.data || error.message);

      // Redirect to dashboard with error message
      const errorMsg = error.response?.data?.message || 'Redemption failed';
      return res.redirect('/dashboard?error=' + encodeURIComponent(errorMsg));
    }
  }

  /**
   * Credit/Reward points to member (B2B action)
   */
  @Post('credit')
  async creditPoints(
    @Body('amount') amount: number,
    @Body('description') description: string,
    @Body('reason') reason: string,
    @Request() req,
    @Response() res
  ) {
    if (!req.session.member) {
      return res.redirect('/');
    }

    try {
      const result = await this.appService.creditPoints(
        req.session.member.id,
        amount,
        description,
        reason
      );

      // Update member info in session with new balance
      req.session.member.points = result.newBalance;

      // Redirect to dashboard with success message
      return res.redirect('/dashboard?credit=true&amount=' + amount);
    } catch (error) {
      console.error('Credit error:', error.response?.data || error.message);

      // Redirect to dashboard with error message
      const errorMsg = error.response?.data?.message || 'Credit failed';
      return res.redirect('/dashboard?error=' + encodeURIComponent(errorMsg));
    }
  }

  /**
   * Logout
   */
  @Get('logout')
  async logout(@Request() req, @Response() res) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
      res.redirect('/');
    });
  }
}
