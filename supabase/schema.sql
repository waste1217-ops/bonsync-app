-- ════════════════════════════════════════════════════
-- BONSYNC — Schema do banco de dados
-- Rodar no Supabase: SQL Editor → New Query → Run
-- ════════════════════════════════════════════════════

-- 1. PROFILES (estende auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email        TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  company_name TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. AGENTS
CREATE TABLE IF NOT EXISTS agents (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id   UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
  config      JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CONVERSATIONS
CREATE TABLE IF NOT EXISTS conversations (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id           UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  contact_identifier TEXT,
  channel            TEXT DEFAULT 'whatsapp',
  status             TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'escalated')),
  started_at         TIMESTAMPTZ DEFAULT NOW(),
  ended_at           TIMESTAMPTZ,
  message_count      INTEGER DEFAULT 0
);

-- 4. MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DAILY METRICS
CREATE TABLE IF NOT EXISTS metrics (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id               UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  date                   DATE NOT NULL,
  total_conversations    INTEGER DEFAULT 0,
  resolved_conversations INTEGER DEFAULT 0,
  escalated_conversations INTEGER DEFAULT 0,
  avg_response_ms        INTEGER DEFAULT 0,
  total_messages         INTEGER DEFAULT 0,
  UNIQUE(agent_id, date)
);

-- ════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════

ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics      ENABLE ROW LEVEL SECURITY;

-- Helper: verifica se usuário é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- PROFILES policies
CREATE POLICY "Usuário vê próprio perfil"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admin vê todos os perfis"
  ON profiles FOR SELECT USING (is_admin());

CREATE POLICY "Admin gerencia perfis"
  ON profiles FOR ALL USING (is_admin());

-- AGENTS policies
CREATE POLICY "Admin gerencia todos agentes"
  ON agents FOR ALL USING (is_admin());

CREATE POLICY "Cliente vê próprios agentes"
  ON agents FOR SELECT USING (client_id = auth.uid());

CREATE POLICY "Cliente atualiza próprio agente"
  ON agents FOR UPDATE USING (client_id = auth.uid());

-- CONVERSATIONS policies
CREATE POLICY "Admin vê todas conversas"
  ON conversations FOR ALL USING (is_admin());

CREATE POLICY "Cliente vê conversas dos próprios agentes"
  ON conversations FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE client_id = auth.uid())
  );

CREATE POLICY "Inserir conversa (service role)"
  ON conversations FOR INSERT WITH CHECK (
    agent_id IN (SELECT id FROM agents WHERE client_id = auth.uid()) OR is_admin()
  );

-- MESSAGES policies
CREATE POLICY "Admin vê todas mensagens"
  ON messages FOR ALL USING (is_admin());

CREATE POLICY "Cliente vê mensagens das próprias conversas"
  ON messages FOR SELECT USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN agents a ON c.agent_id = a.id
      WHERE a.client_id = auth.uid()
    )
  );

-- METRICS policies
CREATE POLICY "Admin vê todas métricas"
  ON metrics FOR ALL USING (is_admin());

CREATE POLICY "Cliente vê próprias métricas"
  ON metrics FOR SELECT USING (
    agent_id IN (SELECT id FROM agents WHERE client_id = auth.uid())
  );

-- ════════════════════════════════════════════════════
-- TRIGGER: criar profile ao registrar usuário
-- ════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, role, company_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    NEW.raw_user_meta_data->>'company_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ════════════════════════════════════════════════════
-- USUÁRIO ADMIN INICIAL
-- Após rodar o schema, crie o admin pelo Supabase Auth
-- e depois rode:
--
-- UPDATE profiles SET role = 'admin' WHERE email = 'waste1217@gmail.com';
-- ════════════════════════════════════════════════════
