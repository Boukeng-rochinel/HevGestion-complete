
// src/services/balance-processor.service.ts
import { prisma } from '../lib/prisma';
import { Balance, BalanceStatus, IssueType, Severity, AssetMovementType, ActivityType } from '@prisma/client';
import { BadRequestError } from '../lib/errors';

interface BalanceRow {
  accountNumber: string;
  accountName: string;
  openingDebit: number;
  openingCredit: number;
  movementDebit: number;
  movementCredit: number;
  closingDebit: number;
  closingCredit: number;
}

interface EquilibriumResult {
  openingDebit: number;
  openingCredit: number;
  movementDebit: number;
  movementCredit: number;
  closingDebit: number;
  closingCredit: number;
  isBalanced: boolean;
  anomalies?: string;
}

export class BalanceProcessor {
  // Account classification rules
  private readonly ASSET_ACCOUNTS = ['1', '2', '3', '4', '5'];
  private readonly LIABILITY_ACCOUNTS = ['1', '4'];
  private readonly EQUITY_ACCOUNTS = ['1'];
  private readonly FIXED_ASSET_ACCOUNTS = ['2'];
  
  async processBalance(balanceId: string): Promise<void> {
    const balance = await prisma.balance.findUnique({
      where: { id: balanceId },
    });

    if (!balance) {
      throw new BadRequestError('Balance not found');
    }

    // Update status to validating
    await prisma.balance.update({
      where: { id: balanceId },
      data: { status: BalanceStatus.VALIDATING },
    });

    try {
      // 1. Validate syntax and structure
      const validationErrors = await this.validateBalance(balance);
      
      if (validationErrors.length > 0) {
        await prisma.balance.update({
          where: { id: balanceId },
          data: {
            status: BalanceStatus.INVALID,
            validationErrors: JSON.stringify(validationErrors),
          },
        });
        return;
      }

      // 2. Check equilibrium
      const equilibrium = await this.checkEquilibrium(balance);

      // 3. Detect account issues
      const issues = await this.detectAccountIssues(balance);

      // 4. Extract fixed assets
      const fixedAssets = await this.extractFixedAssets(balance);

      // 5. Update balance with results
      await prisma.balance.update({
        where: { id: balanceId },
        data: {
          status: BalanceStatus.PROCESSED,
          processedAt: new Date(),
          equilibrium: {
            create: equilibrium,
          },
          accountIssues: {
            createMany: {
              data: issues,
            },
          },
          fixedAssets: {
            createMany: {
              data: fixedAssets,
            },
          },
        },
      });

      console.log(`Balance ${balanceId} processed successfully`);
    } catch (error) {
      console.error('Balance processing error:', error);
      await prisma.balance.update({
        where: { id: balanceId },
        data: {
          status: BalanceStatus.INVALID,
          validationErrors: error instanceof Error ? error.message : 'Processing failed',
        },
      });
      throw error;
    }
  }

  async validateBalance(balance: Balance): Promise<string[]> {
    const errors: string[] = [];
    const data = balance.originalData as any;

    if (!data || !Array.isArray(data.rows)) {
      errors.push('Invalid balance data structure');
      return errors;
    }

    const rows = data.rows as BalanceRow[];

    // Check required columns
    const requiredFields = [
      'accountNumber',
      'accountName',
      'openingDebit',
      'openingCredit',
      'movementDebit',
      'movementCredit',
      'closingDebit',
      'closingCredit',
    ];

    rows.forEach((row, index) => {
      requiredFields.forEach((field) => {
        if (row[field as keyof BalanceRow] === undefined || row[field as keyof BalanceRow] === null) {
          errors.push(`Row ${index + 1}: Missing required field '${field}'`);
        }
      });

      // Validate account number format (should be numeric)
      if (row.accountNumber && !/^\d+$/.test(row.accountNumber)) {
        errors.push(`Row ${index + 1}: Invalid account number format '${row.accountNumber}'`);
      }

      // Validate numeric values
      const numericFields = [
        'openingDebit',
        'openingCredit',
        'movementDebit',
        'movementCredit',
        'closingDebit',
        'closingCredit',
      ];

      numericFields.forEach((field) => {
        const value = row[field as keyof BalanceRow];
        if (typeof value !== 'number' || isNaN(value) || value < 0) {
          errors.push(`Row ${index + 1}: Invalid value for '${field}'`);
        }
      });
    });

    return errors;
  }

  async checkEquilibrium(balance: Balance): Promise<EquilibriumResult> {
    console.log("checkEquilibrium called with balance:", balance.id);
    console.log("originalData:", balance.originalData);

    if (!balance.originalData) {
      throw new Error("Balance has no original data");
    }

    const data = balance.originalData as any;
    console.log("data object:", data);

    if (!data.rows || !Array.isArray(data.rows)) {
      throw new Error("Balance data has no valid rows array");
    }

    const rows = data.rows as BalanceRow[];
    console.log("Number of rows:", rows.length);

    let totalOpeningDebit = 0;
    let totalOpeningCredit = 0;
    let totalMovementDebit = 0;
    let totalMovementCredit = 0;
    let totalClosingDebit = 0;
    let totalClosingCredit = 0;

    rows.forEach((row, index) => {
      console.log(`Processing row ${index}:`, row);

      // Ensure numeric values
      const openingDebit = Number(row.openingDebit) || 0;
      const openingCredit = Number(row.openingCredit) || 0;
      const movementDebit = Number(row.movementDebit) || 0;
      const movementCredit = Number(row.movementCredit) || 0;
      const closingDebit = Number(row.closingDebit) || 0;
      const closingCredit = Number(row.closingCredit) || 0;

      totalOpeningDebit += openingDebit;
      totalOpeningCredit += openingCredit;
      totalMovementDebit += movementDebit;
      totalMovementCredit += movementCredit;
      totalClosingDebit += closingDebit;
      totalClosingCredit += closingCredit;
    });

    console.log("Totals calculated:", {
      totalOpeningDebit,
      totalOpeningCredit,
      totalMovementDebit,
      totalMovementCredit,
      totalClosingDebit,
      totalClosingCredit,
    });

    // Check if balanced (with tolerance for floating point)
    const tolerance = 0.01;
    const openingBalanced = Math.abs(totalOpeningDebit - totalOpeningCredit) < tolerance;
    const movementBalanced = Math.abs(totalMovementDebit - totalMovementCredit) < tolerance;
    const closingBalanced = Math.abs(totalClosingDebit - totalClosingCredit) < tolerance;

    const isBalanced = openingBalanced && movementBalanced && closingBalanced;

    const anomalies: string[] = [];
    if (!openingBalanced) {
      anomalies.push(`Opening balance discrepancy: ${(totalOpeningDebit - totalOpeningCredit).toFixed(2)}`);
    }
    if (!movementBalanced) {
      anomalies.push(`Movement discrepancy: ${(totalMovementDebit - totalMovementCredit).toFixed(2)}`);
    }
    if (!closingBalanced) {
      anomalies.push(`Closing balance discrepancy: ${(totalClosingDebit - totalClosingCredit).toFixed(2)}`);
    }

    const result = {
      openingDebit: totalOpeningDebit,
      openingCredit: totalOpeningCredit,
      movementDebit: totalMovementDebit,
      movementCredit: totalMovementCredit,
      closingDebit: totalClosingDebit,
      closingCredit: totalClosingCredit,
      isBalanced,
      anomalies: anomalies.length > 0 ? anomalies.join('; ') : undefined,
    };

    console.log("Equilibrium result:", result);
    return result;
  }

  async detectAccountIssues(balance: Balance): Promise<any[]> {
    const data = balance.originalData as any;
    const rows = data.rows as BalanceRow[];
    const issues: any[] = [];

    rows.forEach((row) => {
      // Check for non-compliant accounts
      if (!this.isValidAccountNumber(row.accountNumber)) {
        issues.push({
          accountNumber: row.accountNumber,
          accountName: row.accountName,
          issueType: IssueType.NON_COMPLIANT_ACCOUNT,
          description: 'Account number does not comply with OHADA chart of accounts',
          severity: Severity.ERROR,
        });
      }

      // Check balance position
      const accountClass = row.accountNumber.charAt(0);
      const hasDebitBalance = row.closingDebit > row.closingCredit;
      const hasCreditBalance = row.closingCredit > row.closingDebit;

      if (this.ASSET_ACCOUNTS.includes(accountClass) && hasCreditBalance) {
        issues.push({
          accountNumber: row.accountNumber,
          accountName: row.accountName,
          issueType: IssueType.WRONG_BALANCE_POSITION,
          description: 'Asset account has credit balance',
          severity: Severity.WARNING,
        });
      }

      // Check for specific account specifications needed
      if (this.requiresSpecification(row.accountNumber)) {
        issues.push({
          accountNumber: row.accountNumber,
          accountName: row.accountName,
          issueType: IssueType.MISSING_SPECIFICATION,
          description: 'Account requires additional specifications for DSF',
          severity: Severity.INFO,
        });
      }
    });

    return issues;
  }

  async extractFixedAssets(balance: Balance): Promise<any[]> {
    const data = balance.originalData as any;
    const rows = data.rows as BalanceRow[];
    const fixedAssets: any[] = [];

    rows.forEach((row) => {
      const accountClass = row.accountNumber.substring(0, 2);

      // Extract fixed assets (class 2x accounts)
      if (this.FIXED_ASSET_ACCOUNTS.includes(row.accountNumber.charAt(0))) {
        const grossValue = row.closingDebit || 0;
        const movement = row.movementDebit - row.movementCredit;

        let movementType: AssetMovementType | undefined;
        if (movement > 0) movementType = AssetMovementType.ACQUISITION;
        if (movement < 0) movementType = AssetMovementType.DISPOSAL;

        fixedAssets.push({
          accountNumber: row.accountNumber,
          accountName: row.accountName,
          grossValue,
          netValue: row.closingDebit - row.closingCredit,
          depreciation: this.calculateDepreciation(row),
          movementType,
          activityType: ActivityType.ORDINARY,
        });
      }
    });

    return fixedAssets;
  }

  async performVentilation(balance: Balance): Promise<any> {
    const data = balance.originalData as any;
    const rows = data.rows as BalanceRow[];

    const ventilation = {
      assets: {
        current: 0,
        fixed: 0,
        total: 0,
      },
      liabilities: {
        current: 0,
        longTerm: 0,
        equity: 0,
        total: 0,
      },
      income: 0,
      expenses: 0,
    };

    rows.forEach((row) => {
      const accountClass = row.accountNumber.charAt(0);
      const netBalance = row.closingDebit - row.closingCredit;

      switch (accountClass) {
        case '2': // Fixed assets
          ventilation.assets.fixed += Math.abs(netBalance);
          break;
        case '3': // Inventory
        case '4': // Receivables (if debit)
        case '5': // Cash
          if (netBalance > 0) {
            ventilation.assets.current += netBalance;
          }
          break;
        case '1': // Capital and reserves
          if (netBalance < 0) {
            ventilation.liabilities.equity += Math.abs(netBalance);
          }
          break;
        case '4': // Payables (if credit)
          if (netBalance < 0) {
            ventilation.liabilities.current += Math.abs(netBalance);
          }
          break;
        case '6': // Expenses
          ventilation.expenses += Math.abs(netBalance);
          break;
        case '7': // Income
          ventilation.income += Math.abs(netBalance);
          break;
      }
    });

    ventilation.assets.total = ventilation.assets.current + ventilation.assets.fixed;
    ventilation.liabilities.total = 
      ventilation.liabilities.current + 
      ventilation.liabilities.longTerm + 
      ventilation.liabilities.equity;

    return ventilation;
  }

  // Helper methods
  private isValidAccountNumber(accountNumber: string): boolean {
    // OHADA accounts are typically 6-8 digits
    return /^\d{6,8}$/.test(accountNumber);
  }

  private requiresSpecification(accountNumber: string): boolean {
    // Accounts that require specifications (e.g., bank accounts, specific liabilities)
    const needsSpec = ['10', '11', '16', '17', '40', '41', '42', '50', '51', '52'];
    const prefix = accountNumber.substring(0, 2);
    return needsSpec.includes(prefix);
  }

  private calculateDepreciation(row: BalanceRow): number {
    // Simple depreciation calculation (can be enhanced)
    const grossValue = row.closingDebit || 0;
    const netValue = row.closingDebit - row.closingCredit;
    return grossValue - netValue;
  }
}