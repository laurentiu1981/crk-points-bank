import {
  Controller,
  Get,
  Post,
  Body,
  Request,
  Response,
  Query,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { MemberService } from './member.service';
import { AuthService } from '../auth/auth.service';

@Controller()
export class MemberController {
  constructor(
    private memberService: MemberService,
    private authService: AuthService,
  ) {}

  /**
   * Show member login page
   */
  @Get('member/login')
  async showMemberLogin(
    @Query('redirect') redirect: string,
    @Request() req,
    @Response() res,
  ) {
    // If already logged in, redirect to dashboard
    if (req.session.memberId) {
      return res.redirect(redirect || '/member/dashboard');
    }

    return res.render('member-login', {
      error: null,
      redirect: redirect || '/member/dashboard',
    });
  }

  /**
   * Process member login
   */
  @Post('member/login')
  async processMemberLogin(
    @Body('email') email: string,
    @Body('password') password: string,
    @Body('redirect') redirect: string,
    @Request() req,
    @Response() res,
  ) {
    if (!email || !password) {
      return res.render('member-login', {
        error: 'Email and password are required',
        redirect: redirect || '/member/dashboard',
      });
    }

    try {
      // Validate credentials
      const member = await this.authService.validateMember(email, password);

      if (!member) {
        return res.render('member-login', {
          error: 'Invalid email or password',
          redirect: redirect || '/member/dashboard',
        });
      }

      // Store member ID in session
      req.session.memberId = member.id;
      req.session.memberEmail = member.email;

      // Redirect to intended destination
      return res.redirect(redirect || '/member/dashboard');
    } catch (error) {
      return res.render('member-login', {
        error: 'Login failed. Please try again.',
        redirect: redirect || '/member/dashboard',
      });
    }
  }

  /**
   * Member dashboard - shows active sessions
   */
  @Get('member/dashboard')
  async dashboard(@Request() req, @Response() res) {
    if (!req.session.memberId) {
      return res.redirect('/member/login?redirect=/member/dashboard');
    }

    try {
      // Get member data
      const member = await this.authService.findMemberById(req.session.memberId);

      if (!member) {
        req.session.destroy(() => {
          return res.redirect('/member/login');
        });
        return;
      }

      // Get active sessions
      const sessions = await this.memberService.getActiveSessions(member.id);

      return res.render('member-dashboard', {
        member,
        sessions,
        activePage: 'dashboard',
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      return res.redirect('/member/login?error=Failed to load dashboard');
    }
  }

  /**
   * Member transactions history
   */
  @Get('member/transactions')
  async transactions(@Request() req, @Response() res) {
    if (!req.session.memberId) {
      return res.redirect('/member/login?redirect=/member/transactions');
    }

    try {
      // Get member data
      const member = await this.authService.findMemberById(req.session.memberId);

      if (!member) {
        req.session.destroy(() => {
          return res.redirect('/member/login');
        });
        return;
      }

      // Get transaction history
      const transactions = await this.memberService.getTransactionHistory(member.id);

      return res.render('member-transactions', {
        member,
        transactions,
        activePage: 'transactions',
      });
    } catch (error) {
      console.error('Transactions error:', error);
      return res.redirect('/member/dashboard?error=Failed to load transactions');
    }
  }

  /**
   * Revoke OAuth session
   */
  @Post('member/sessions/:sessionId/revoke')
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @Request() req,
    @Response() res,
  ) {
    if (!req.session.memberId) {
      throw new BadRequestException('Not authenticated');
    }

    const revoked = await this.memberService.revokeSession(
      req.session.memberId,
      sessionId,
    );

    if (!revoked) {
      return res.redirect('/member/dashboard?error=Session not found');
    }

    return res.redirect('/member/dashboard?success=Session revoked');
  }

  /**
   * Member logout
   */
  @Get('member/logout')
  async logout(@Request() req, @Response() res) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
      res.redirect('/member/login');
    });
  }
}
