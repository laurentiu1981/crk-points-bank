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
    if (!req.session.accessToken) {
      return res.redirect('/');
    }

    try {
      // Fetch fresh member info from Points Bank on every dashboard load
      const memberInfo = await this.appService.getMemberInfo(req.session.accessToken);

      // Update session with fresh data (keeps basic info in sync)
      req.session.member = memberInfo;

      let successMessage = null;
      if (success === 'true') {
        successMessage = `Successfully redeemed ${amount} points!`;
      } else if (credit === 'true') {
        successMessage = `Successfully rewarded ${amount} points!`;
      }

      return res.render('dashboard', {
        member: memberInfo,
        successMessage,
        errorMessage: error ? decodeURIComponent(error) : null,
      });
    } catch (error) {
      console.error('Failed to fetch member info:', error.response?.data || error.message);

      // If access token expired, redirect to login
      if (error.response?.status === 400 || error.response?.status === 401) {
        req.session.destroy(() => {
          return res.redirect('/?error=Session expired, please login again');
        });
      } else {
        return res.redirect('/?error=Failed to load dashboard');
      }
    }
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

      // Dashboard will fetch fresh balance, no need to update session
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

      // Dashboard will fetch fresh balance, no need to update session
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
   * Simulation Dashboard - Public page for backend simulation
   */
  @Get('simulation-dashboard')
  async simulationDashboard(
    @Query('success') success: string,
    @Query('amount') amount: string,
    @Query('memberEmail') memberEmail: string,
    @Query('message') message: string,
    @Query('error') error: string,
    @Response() res
  ) {
    try {
      const members = await this.appService.getAllMembers();
      const pendingRequests = await this.appService.getPendingRedemptionRequests();

      let successMessage = null;
      if (success === 'true' && amount && memberEmail) {
        successMessage = `Successfully rewarded ${amount} points to ${memberEmail}!`;
      } else if (message) {
        successMessage = decodeURIComponent(message);
      }

      return res.render('simulation-dashboard', {
        members,
        pendingRequests,
        successMessage,
        errorMessage: error ? decodeURIComponent(error) : null,
      });
    } catch (error) {
      console.error('Failed to fetch data:', error.response?.data || error.message);
      return res.render('simulation-dashboard', {
        members: [],
        pendingRequests: [],
        successMessage: null,
        errorMessage: 'Failed to load data from Points Bank',
      });
    }
  }

  /**
   * Credit points from simulation dashboard (B2B backend simulation)
   */
  @Post('simulation/credit')
  async simulationCredit(
    @Body('member_id') memberId: string,
    @Body('amount') amount: number,
    @Body('description') description: string,
    @Body('reason') reason: string,
    @Response() res
  ) {
    try {
      const result = await this.appService.creditPoints(
        memberId,
        amount,
        description,
        reason
      );

      // Get member email for success message
      const members = await this.appService.getAllMembers();
      const member = members.find(m => m.id === memberId);
      const memberEmail = member ? member.email : 'member';

      return res.redirect(`/simulation-dashboard?success=true&amount=${amount}&memberEmail=${encodeURIComponent(memberEmail)}`);
    } catch (error) {
      console.error('Credit error:', error.response?.data || error.message);

      const errorMsg = error.response?.data?.message || 'Credit failed';
      return res.redirect('/simulation-dashboard?error=' + encodeURIComponent(errorMsg));
    }
  }

  /**
   * Create redemption request from simulation dashboard (B2B backend simulation)
   */
  @Post('simulation/redemption-request')
  async simulationRedemptionRequest(
    @Body('member_id') memberId: string,
    @Body('amount') amount: number,
    @Body('description') description: string,
    @Response() res
  ) {
    try {
      const result = await this.appService.createRedemptionRequest(
        memberId,
        amount,
        description
      );

      // Get member email for success message
      const members = await this.appService.getAllMembers();
      const member = members.find(m => m.id === memberId);
      const memberEmail = member ? member.email : 'member';

      const successMsg = `Redemption request created for ${memberEmail}. OTP: ${result.otp}`;
      return res.redirect(`/simulation-dashboard?message=${encodeURIComponent(successMsg)}`);
    } catch (error) {
      console.error('Redemption request error:', error.response?.data || error.message);

      const errorMsg = error.response?.data?.message || 'Failed to create redemption request';
      return res.redirect('/simulation-dashboard?error=' + encodeURIComponent(errorMsg));
    }
  }

  /**
   * Approve redemption request from simulation dashboard
   */
  @Post('simulation/redemption/approve')
  async simulationApproveRedemption(
    @Body('request_id') requestId: string,
    @Body('member_id') memberId: string,
    @Body('otp') otp: string,
    @Response() res
  ) {
    try {
      const result = await this.appService.approveRedemptionRequest(
        requestId,
        memberId,
        otp
      );

      const successMsg = `Redemption request approved! ${result.redeemedAmount} points redeemed.`;
      return res.redirect(`/simulation-dashboard?message=${encodeURIComponent(successMsg)}`);
    } catch (error) {
      console.error('Approve redemption error:', error.response?.data || error.message);

      const errorMsg = error.response?.data?.message || 'Failed to approve redemption request';
      return res.redirect('/simulation-dashboard?error=' + encodeURIComponent(errorMsg));
    }
  }

  /**
   * Reject redemption request from simulation dashboard
   */
  @Post('simulation/redemption/reject')
  async simulationRejectRedemption(
    @Body('request_id') requestId: string,
    @Body('member_id') memberId: string,
    @Response() res
  ) {
    try {
      const result = await this.appService.rejectRedemptionRequest(
        requestId,
        memberId
      );

      const successMsg = `Redemption request rejected.`;
      return res.redirect(`/simulation-dashboard?message=${encodeURIComponent(successMsg)}`);
    } catch (error) {
      console.error('Reject redemption error:', error.response?.data || error.message);

      const errorMsg = error.response?.data?.message || 'Failed to reject redemption request';
      return res.redirect('/simulation-dashboard?error=' + encodeURIComponent(errorMsg));
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
