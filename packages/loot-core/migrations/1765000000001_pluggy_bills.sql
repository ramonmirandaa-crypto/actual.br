BEGIN TRANSACTION;

CREATE TABLE pluggy_credit_bills (
  id TEXT PRIMARY KEY,
  account TEXT NOT NULL,
  bill_id TEXT NOT NULL,
  due_date TEXT,
  total_amount INTEGER,
  minimum_amount INTEGER,
  currency_code TEXT,
  allows_installments INTEGER,
  created_at TEXT,
  updated_at TEXT
);

CREATE UNIQUE INDEX pluggy_credit_bills_bill_id ON pluggy_credit_bills(bill_id);
CREATE INDEX pluggy_credit_bills_account ON pluggy_credit_bills(account);

COMMIT;
