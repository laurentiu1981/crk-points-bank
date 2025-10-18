import { IsNotEmpty, IsString, IsArray, IsOptional } from 'class-validator';

export class CreateOAuthClientDto {
  @IsString()
  @IsNotEmpty()
  clientName: string;

  @IsArray()
  @IsNotEmpty()
  redirectUris: string[];

  @IsArray()
  @IsOptional()
  allowedGrants?: string[];

  @IsArray()
  @IsOptional()
  allowedScopes?: string[];

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;
}
