import * as asyncStorage from '../../platform/server/asyncStorage';
import { logger } from '../../platform/server/log';
import { amountToInteger } from '../../shared/util';
import * as db from '../db';
import { handlers } from '../main';
import { post } from '../post';
import { getServer } from '../server-config';

import type { DbAccount } from '../db/types';

type PluggyAccount = {
  account_id: string;
  name: string;
  type?: string;
  institution?: string;
  orgDomain?: string | null;
  orgId?: string | null;
};

type PluggyStatementsResponse = {
  statements?: Array<{
    id: string;
    monthYear?: string;
    url?: string;
    issuedAt?: string;
    dueDate?: string;
    currencyCode?: string;
    totalAmount?: number;
    minimumAmount?: number;
  }>;
};

type PluggyBillsResponse = {
  bills?: Array<{
    id: string;
    dueDate?: string;
    totalAmount?: number;
    minimumPaymentAmount?: number | null;
    totalAmountCurrencyCode?: string;
    allowsInstallments?: boolean | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
};

function asDateString(value?: string | Date | null): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

async function fetchStatements(accountId: string) {
  const userToken = await asyncStorage.getItem('user-token');
  const server = getServer();

  if (!userToken || !server?.PLUGGYAI_SERVER) {
    return [];
  }

  try {
    const res = (await post(
      server.PLUGGYAI_SERVER + '/statements',
      { accountId },
      { 'X-ACTUAL-TOKEN': userToken },
      60000,
    )) as PluggyStatementsResponse;
    return res.statements ?? [];
  } catch (error) {
    logger.error('Failed to fetch Pluggy statements', error);
    return [];
  }
}

async function fetchBills(accountId: string) {
  const userToken = await asyncStorage.getItem('user-token');
  const server = getServer();

  if (!userToken || !server?.PLUGGYAI_SERVER) {
    return [];
  }

  try {
    const res = (await post(
      server.PLUGGYAI_SERVER + '/bills',
      { accountId },
      { 'X-ACTUAL-TOKEN': userToken },
      60000,
    )) as PluggyBillsResponse;
    return res.bills ?? [];
  } catch (error) {
    logger.error('Failed to fetch Pluggy credit bills', error);
    return [];
  }
}

async function ensureAccountLink(account: PluggyAccount): Promise<DbAccount['id']> {
  const existing = await db.first<DbAccount>(
    'SELECT * FROM accounts WHERE account_id = ?',
    [account.account_id],
  );

  await handlers['pluggyai-accounts-link']({
    externalAccount: account,
    upgradingId: existing?.id ?? undefined,
    offBudget: account.type === 'CREDIT' || account.type === 'LOAN',
  });

  if (existing?.id) {
    return existing.id;
  }

  const created = await db.first<DbAccount>(
    'SELECT * FROM accounts WHERE account_id = ?',
    [account.account_id],
  );

  if (!created) {
    throw new Error('Failed to create account for Pluggy import');
  }

  return created.id;
}

async function importStatements(accountId: string, localAccountId: string) {
  const statements = await fetchStatements(accountId);

  for (const stmt of statements) {
    await db.upsertPluggyStatement({
      id: `${accountId}-${stmt.id}`,
      account: localAccountId,
      statement_id: stmt.id,
      period: stmt.monthYear ?? null,
      issued_at: asDateString(stmt.issuedAt),
      due_at: asDateString(stmt.dueDate),
      currency_code: stmt.currencyCode ?? null,
      total_amount:
        stmt.totalAmount != null ? amountToInteger(stmt.totalAmount) : null,
      minimum_amount:
        stmt.minimumAmount != null ? amountToInteger(stmt.minimumAmount) : null,
      resource_url: stmt.url ?? null,
    });
  }
}

async function importBills(accountId: string, localAccountId: string) {
  const bills = await fetchBills(accountId);

  for (const bill of bills) {
    await db.upsertPluggyCreditBill({
      id: `${accountId}-${bill.id}`,
      account: localAccountId,
      bill_id: bill.id,
      due_date: asDateString(bill.dueDate),
      total_amount:
        bill.totalAmount != null ? amountToInteger(bill.totalAmount) : null,
      minimum_amount:
        bill.minimumPaymentAmount != null
          ? amountToInteger(bill.minimumPaymentAmount)
          : null,
      currency_code: bill.totalAmountCurrencyCode ?? null,
      allows_installments:
        bill.allowsInstallments == null
          ? null
          : bill.allowsInstallments
            ? 1
            : 0,
      created_at: asDateString(bill.createdAt),
      updated_at: asDateString(bill.updatedAt),
    });
  }
}

export async function importPluggyData() {
  const status = await handlers['pluggyai-status']();
  if (!status || status.error || !status.configured) {
    throw new Error('Pluggy.ai is not configured');
  }

  const accountsResult = await handlers['pluggyai-accounts']();
  const accounts: PluggyAccount[] = accountsResult?.accounts ?? [];

  for (const account of accounts) {
    try {
      const localAccountId = await ensureAccountLink(account);
      await importStatements(account.account_id, localAccountId);
      await importBills(account.account_id, localAccountId);
    } catch (error) {
      logger.error('Failed to import data for Pluggy account', account, error);
    }
  }
}
