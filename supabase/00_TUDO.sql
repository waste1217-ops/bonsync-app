-- ════════════════════════════════════════════════════════════════════
-- BONSYNC — SCRIPT ÚNICO E COMPLETO (idempotente)
-- Cole tudo no Supabase → SQL Editor → New query → Run.
-- Seguro rodar quantas vezes quiser. Cobre tudo que conversamos.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. PROFILES: colunas extras (admin / WhatsApp) ──────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS responsavel           TEXT,
  ADD COLUMN IF NOT EXISTS internal_notes        TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_instance     TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_qr_sent_at   TIMESTAMPTZ;

-- ── 2. MESSAGES: status de envio real + ACK + eventos 'system' ──────
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS send_status   TEXT,
  ADD COLUMN IF NOT EXISTS send_error    TEXT,
  ADD COLUMN IF NOT EXISTS wa_message_id TEXT,
  ADD COLUMN IF NOT EXISTS send_attempts INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS messages_wa_message_id_idx ON messages (wa_message_id);
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_role_check;
ALTER TABLE messages ADD CONSTRAINT messages_role_check CHECK (role IN ('user','assistant','system'));

-- ── 3. DEALS: vínculo com conversa + forma de pagamento ─────────────
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;

-- ── 4. MEETINGS: agenda / reuniões / pedidos ────────────────────────
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
  canal              TEXT,
  origem             TEXT DEFAULT 'WhatsApp',
  start_at           TIMESTAMPTZ,
  end_at             TIMESTAMPTZ,
  duracao_min        INTEGER DEFAULT 30,
  timezone           TEXT DEFAULT 'America/Sao_Paulo',
  status             TEXT DEFAULT 'aguardando',
  source             TEXT DEFAULT 'manual',
  provider           TEXT,
  calendar_event_id  TEXT,
  meeting_url        TEXT,
  participants       JSONB DEFAULT '[]',
  reminder_status    TEXT DEFAULT 'none',
  tipo               TEXT,
  modalidade         TEXT,
  endereco           TEXT,
  periodo            TEXT,
  requested_date     DATE,
  requested_time     TEXT,
  alternative_slots  JSONB DEFAULT '[]',
  campos             JSONB DEFAULT '{}',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
-- garante colunas mesmo se a tabela já existia antes (instalações parciais)
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS deal_id           UUID REFERENCES deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conversation_id   UUID REFERENCES conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proximo_passo     TEXT,
  ADD COLUMN IF NOT EXISTS responsavel       TEXT,
  ADD COLUMN IF NOT EXISTS canal             TEXT,
  ADD COLUMN IF NOT EXISTS origem            TEXT,
  ADD COLUMN IF NOT EXISTS end_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duracao_min       INTEGER,
  ADD COLUMN IF NOT EXISTS timezone          TEXT,
  ADD COLUMN IF NOT EXISTS source            TEXT,
  ADD COLUMN IF NOT EXISTS provider          TEXT,
  ADD COLUMN IF NOT EXISTS calendar_event_id TEXT,
  ADD COLUMN IF NOT EXISTS meeting_url       TEXT,
  ADD COLUMN IF NOT EXISTS participants      JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS reminder_status   TEXT,
  ADD COLUMN IF NOT EXISTS tipo              TEXT,
  ADD COLUMN IF NOT EXISTS modalidade        TEXT,
  ADD COLUMN IF NOT EXISTS endereco          TEXT,
  ADD COLUMN IF NOT EXISTS periodo           TEXT,
  ADD COLUMN IF NOT EXISTS requested_date    DATE,
  ADD COLUMN IF NOT EXISTS requested_time    TEXT,
  ADD COLUMN IF NOT EXISTS alternative_slots JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS campos            JSONB DEFAULT '{}';
CREATE INDEX IF NOT EXISTS meetings_agent_start_idx ON meetings (agent_id, start_at);

-- status válidos (agenda + pedidos alimentícios)
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_status_check;
ALTER TABLE meetings ADD CONSTRAINT meetings_status_check CHECK (status IN (
  'detectada','aguardando_info','aguardando','sugerida','aguardando_escolha',
  'confirmada','reagendada','em_atendimento',
  'em_preparacao','pronto','saiu_entrega','aguardando_retirada','entregue',
  'realizada','cancelada','ausente','recusada'
));

-- ── 5. PROPOSALS: propostas comerciais ──────────────────────────────
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

-- ── 6. RLS (isolamento por cliente) ─────────────────────────────────
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

-- ── 7. (opcional) Admin lê todos os perfis no navegador ─────────────
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN
  LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;
DROP POLICY IF EXISTS "admin le todos os profiles" ON profiles;
CREATE POLICY "admin le todos os profiles" ON profiles
  FOR SELECT USING (id = auth.uid() OR public.is_admin());
