-- Push notifications: armazenar tokens de dispositivo por usuário
CREATE TABLE IF NOT EXISTS push_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL,
  platform    TEXT        NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tokens"
  ON push_tokens FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON push_tokens(user_id);
