/**
 * Data Migration Script: Migrate from separate transaction tables to unified Transaction table
 *
 * This script migrates:
 * 1. CreditTransaction records → Transaction (type: 'credit')
 * 2. RedemptionRequest records (approved) → Transaction (type: 'debit', method: 'otp_approval')
 *
 * Run with: npx ts-node apps/crk-points-bank/src/scripts/migrate-transactions.ts
 */

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Member } from '../entities/member.entity';
import { OAuthClient } from '../entities/oauth-client.entity';
import { OAuthAuthorizationCode } from '../entities/oauth-authorization-code.entity';
import { OAuthAccessToken } from '../entities/oauth-access-token.entity';
import { OAuthRefreshToken } from '../entities/oauth-refresh-token.entity';
import { RedemptionRequest } from '../entities/redemption-request.entity';
import { CreditTransaction } from '../entities/credit-transaction.entity';
import { Transaction } from '../entities/transaction.entity';

// Load environment variables
config();

async function runMigration() {
  console.log('🚀 Starting transaction data migration...\n');

  // Create database connection
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'points_admin',
    password: process.env.DB_PASSWORD || 'dev_password_change_in_production',
    database: process.env.DB_DATABASE || 'points_bank',
    entities: [
      Member,
      OAuthClient,
      OAuthAuthorizationCode,
      OAuthAccessToken,
      OAuthRefreshToken,
      RedemptionRequest,
      CreditTransaction,
      Transaction,
    ],
    synchronize: false, // Don't auto-sync during migration
    logging: true,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connection established\n');

    const creditRepo = dataSource.getRepository(CreditTransaction);
    const redemptionRepo = dataSource.getRepository(RedemptionRequest);
    const transactionRepo = dataSource.getRepository(Transaction);

    // Check if migration already ran
    const existingCount = await transactionRepo.count();
    if (existingCount > 0) {
      console.log(`⚠️  Warning: Transaction table already has ${existingCount} records.`);
      console.log('This migration will add more records. Continue? (Ctrl+C to cancel)\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // 1. Migrate CreditTransaction records
    console.log('📊 Migrating credit transactions...');
    const credits = await creditRepo.find({
      relations: ['member', 'client'],
    });

    console.log(`Found ${credits.length} credit transactions to migrate`);

    for (const credit of credits) {
      const transaction = transactionRepo.create({
        memberId: credit.memberId,
        member: credit.member,
        clientId: credit.clientId,
        client: credit.client,
        type: 'credit',
        method: credit.reason || 'legacy_credit',
        amount: credit.amount,
        description: credit.description,
        status: null, // Credits are instant
        createdAt: credit.createdAt,
      });

      await transactionRepo.save(transaction);
    }

    console.log(`✅ Migrated ${credits.length} credit transactions\n`);

    // 2. Migrate approved RedemptionRequest records
    console.log('📊 Migrating approved redemption requests...');
    const redemptions = await redemptionRepo.find({
      where: { status: 'approved' },
      relations: ['member', 'client'],
    });

    console.log(`Found ${redemptions.length} approved redemptions to migrate`);

    for (const redemption of redemptions) {
      const transaction = transactionRepo.create({
        memberId: redemption.memberId,
        member: redemption.member,
        clientId: redemption.clientId,
        client: redemption.client,
        type: 'debit',
        method: 'otp_approval',
        amount: redemption.amount,
        description: redemption.description,
        status: 'approved',
        otp: null, // Don't migrate OTP for security
        otpExpiresAt: null,
        completedAt: redemption.completedAt,
        createdAt: redemption.createdAt,
      });

      await transactionRepo.save(transaction);
    }

    console.log(`✅ Migrated ${redemptions.length} approved redemptions\n`);

    // Summary
    const totalMigrated = credits.length + redemptions.length;
    const finalCount = await transactionRepo.count();

    console.log('✨ Migration complete!');
    console.log(`📈 Total records migrated: ${totalMigrated}`);
    console.log(`📊 Transaction table now has: ${finalCount} records\n`);

    console.log('💡 Next steps:');
    console.log('   1. Test the transaction history in the member dashboard');
    console.log('   2. If everything looks good, you can drop the old tables:');
    console.log('      - credit_transactions');
    console.log('      - (Keep redemption_requests if you still need pending OTP requests)');
    console.log('   3. Remove CreditTransaction entity imports from the codebase\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
