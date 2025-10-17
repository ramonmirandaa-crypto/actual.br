BEGIN TRANSACTION;

CREATE INDEX IF NOT EXISTS trans_account_date ON transactions(acct, date);

COMMIT;
