-- ════════════════════════════════════════════════════
-- BONSYNC — Agenda comercial (reuniões) + Propostas
-- Rodar no Supabase: SQL Editor → New Query → Run
-- Seguro de rodar mais de uma vez (IF NOT EXISTS / OR REPLACE).
-- ════════════════════════════════════════════════════

-- 0. Colunas que o painel admin já espera em profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS responsavel    TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- ════════════════════════════════════════════════════
-- 1. MEETINGS (Agenda comercial)
-- ════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS meetings (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id           UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  deal_id            UUID REFERENCES deals(id) ON DELETE SET NULL,
  conversation_id    UUID REFERENCES conversations(id) ON DELETE SET NULL,
  contact_identifier TEXT,
  empresa            TEXT,
  contato_nome       TEXT,
  assunto            TEXT,
  observacoes        TEXT,
  proximo_passo      TEXT,
  responsavel        TEXT,
  canal              TEXT,                       -- Google Meet, Zoom, Teams, WhatsApp, Presencial...
  origem             TEXT DEFAULT 'WhatsApp',    -- de onde veio a oportunidade
  start_at           TIMESTAMPTZ,
  end_at             TIMESTAMPTZ,
  duracao_min        INTEGER DEFAULT 30,
  timezone           TEXT DEFAULT 'America/Sao_Paulo',
  status             TEXT DEFAULT 'aguardando'
                       CHECK (status IN ('confirmada','aguardando','realizada','reagendada','cancelada','ausente','sugerida')),
  source             TEXT DEFAULT 'manual'       -- manual | ai_sugerida
                       CHECK (source IN ('manual','ai_sugerida')),
  -- prontos para integração futura com calendário
  provider           TEXT,                       -- google | outlook | zoom | teams | meet
  calendar_event_id  TEXT,
  meeting_url        TEXT,
  participants       JSONB DEFAULT '[]',
  reminder_status    TEXT DEFAULT 'none'         -- none | scheduled | sent_24h | sent_1h
                       CHECK (reminder_status IN ('none','scheduled','sent_24h','sent_1h')),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS meetings_agent_start_idx ON meetings (agent_id, start_at);

-- ════════════════════════════════════════════════════
-- 2. PROPOSALS (Propostas comerciais)
-- ════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS proposals (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id           UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  deal_id            UUID REFERENCES deals(id) ON DELETE SET NULL,
  contact_identifier TEXT,
  empresa            TEXT,
  contato_nome       TEXT,
  produto            TEXT,
  valor              TEXT,
  conteudo           TEXT,
  validade           DATE,
  responsavel        TEXT,
  status             TEXT DEFAULT 'rascunho'
                       CHECK (status IN ('rascunho','aguardando_envio','enviada','visualizada','em_negociacao','aceita','recusada','expirada')),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  sent_at            TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS proposals_agent_idx ON proposals (agent_id, created_at);

-- ════════════════════════════════════════════════════
-- 3. RLS — cliente gerencia o que pertence aos seus agentes
-- ════════════════════════════════════════════════════
ALTER TABLE meetings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia reunioes" ON meetings;
CREATE POLICY "Admin gerencia reunioes" ON meetings FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Cliente gerencia reunioes dos proprios agentes" ON meetings;
CREATE POLICY "Cliente gerencia reunioes dos proprios agentes" ON meetings FOR ALL
  USING (agent_id IN (SELECT id FROM agents WHERE client_id = auth.uid()))
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE client_id = auth.uid()));

DROP POLICY IF EXISTS "Admin gerencia propostas" ON proposals;
CREATE POLICY "Admin gerencia propostas" ON proposals FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Cliente gerencia propostas dos proprios agentes" ON proposals;
CREATE POLICY "Cliente gerencia propostas dos proprios agentes" ON proposals FOR ALL
  USING (agent_id IN (SELECT id FROM agents WHERE client_id = auth.uid()))
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE client_id = auth.uid()));
