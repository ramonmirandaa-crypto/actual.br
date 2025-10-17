BEGIN TRANSACTION;

CREATE TABLE pluggy_statements (
  id TEXT PRIMARY KEY,
  account TEXT NOT NULL,
  statement_id TEXT NOT NULL,
  period TEXT,
  issued_at TEXT,
  due_at TEXT,
  currency_code TEXT,
  total_amount INTEGER,
  minimum_amount INTEGER,
  resource_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX pluggy_statements_statement_id ON pluggy_statements(statement_id);
CREATE INDEX pluggy_statements_account ON pluggy_statements(account);

COMMIT;
