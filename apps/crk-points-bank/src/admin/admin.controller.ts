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

@Controller('admin/oauth-clients')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Post()
  async createClient(
    @Body(ValidationPipe) createDto: CreateOAuthClientDto
  ) {
    return this.adminService.createOAuthClient(createDto);
  }

  @Get()
  async getAllClients() {
    return this.adminService.getAllClients();
  }

  @Get(':id')
  async getClient(@Param('id') id: string) {
    return this.adminService.getClientById(id);
  }

  @Patch(':id/deactivate')
  async deactivateClient(@Param('id') id: string) {
    return this.adminService.deactivateClient(id);
  }

  @Patch(':id/activate')
  async activateClient(@Param('id') id: string) {
    return this.adminService.activateClient(id);
  }
}
