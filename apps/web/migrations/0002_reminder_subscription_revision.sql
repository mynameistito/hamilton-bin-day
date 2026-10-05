ALTER TABLE reminder_subscriptions
  ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
