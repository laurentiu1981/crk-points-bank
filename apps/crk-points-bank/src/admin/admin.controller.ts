import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  ValidationPipe,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateOAuthClientDto } from './dto/create-oauth-client.dto';

@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ========== OAuth Clients Endpoints ==========

  @Post('oauth-clients')
  async createClient(
    @Body(ValidationPipe) createDto: CreateOAuthClientDto
  ) {
    return this.adminService.createOAuthClient(createDto);
  }

  @Get('oauth-clients')
  async getAllClients() {
    return this.adminService.getAllClients();
  }

  /**
   * Get all members (for demo/testing purposes)
   * NOTE: Must be defined BEFORE @Get(':id') to avoid route conflicts
   */
  @Get('oauth-clients/members')
  async getAllMembers() {
    return this.adminService.getAllMembers();
  }

  @Get('oauth-clients/:id')
  async getClient(@Param('id') id: string) {
    return this.adminService.getClientById(id);
  }

  @Patch('oauth-clients/:id/deactivate')
  async deactivateClient(@Param('id') id: string) {
    return this.adminService.deactivateClient(id);
  }

  @Patch('oauth-clients/:id/activate')
  async activateClient(@Param('id') id: string) {
    return this.adminService.activateClient(id);
  }

  // ========== Redemption Requests Endpoints (for simulation) ==========

  /**
   * Get all pending redemption requests (for simulation dashboard)
   */
  @Get('redemption-requests/pending')
  async getPendingRedemptionRequests() {
    return this.adminService.getPendingRedemptionRequests();
  }

  /**
   * Approve redemption request (simulating member approval)
   */
  @Post('redemption-requests/approve')
  async approveRedemptionRequest(
    @Body('request_id') requestId: string,
    @Body('member_id') memberId: string,
    @Body('otp') otp: string
  ) {
    return this.adminService.approveRedemptionRequest(requestId, memberId, otp);
  }

  /**
   * Reject redemption request (simulating member rejection)
   */
  @Post('redemption-requests/reject')
  async rejectRedemptionRequest(
    @Body('request_id') requestId: string,
    @Body('member_id') memberId: string
  ) {
    return this.adminService.rejectRedemptionRequest(requestId, memberId);
  }
}
