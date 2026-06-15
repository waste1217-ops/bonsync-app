-- ════════════════════════════════════════════════════
-- BONSYNC — Agendamentos: detecção, aprovação e confirmação de reuniões
-- Rodar no Supabase: SQL Editor → New Query → Run (depois do 02_negocios.sql)
-- Seguro de rodar mais de uma vez.
-- ════════════════════════════════════════════════════

-- 1. Novos campos na tabela meetings (fluxo de solicitação/confirmação)
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS tipo              TEXT,            -- reuniao | visita | call | demo
  ADD COLUMN IF NOT EXISTS modalidade        TEXT,            -- presencial | online | telefone
  ADD COLUMN IF NOT EXISTS endereco          TEXT,
  ADD COLUMN IF NOT EXISTS periodo           TEXT,            -- manha | tarde | noite
  ADD COLUMN IF NOT EXISTS requested_date    DATE,
  ADD COLUMN IF NOT EXISTS requested_time    TEXT,
  ADD COLUMN IF NOT EXISTS alternative_slots JSONB DEFAULT '[]';

-- 2. Amplia os status possíveis do agendamento
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_status_check;
ALTER TABLE meetings ADD CONSTRAINT meetings_status_check CHECK (status IN (
  'detectada',            -- IA detectou intenção
  'aguardando_info',      -- falta data/horário
  'aguardando',           -- aguardando confirmação da empresa
  'sugerida',             -- sugerida pela IA (compat. 02)
  'aguardando_escolha',   -- empresa ofereceu datas; aguardando o cliente
  'confirmada',
  'reagendada',
  'realizada',
  'cancelada',
  'ausente',
  'recusada'
));

-- 3. Permite eventos internos na linha do tempo da conversa (role 'system')
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_role_check;
ALTER TABLE messages ADD CONSTRAINT messages_role_check CHECK (role IN ('user', 'assistant', 'system'));

-- 4. A configuração de disponibilidade e o modo de confirmação ficam em
--    agents.config->'scheduling' (JSONB) — não precisa de DDL. Estrutura:
--    {
--      "mode": "manual" | "auto" | "auto_allowed",
--      "weekdays": [1,2,3,4,5], "start": "09:00", "end": "18:00",
--      "duration_min": 30, "buffer_min": 15, "min_notice_hours": 2,
--      "max_per_day": 8, "modalities": ["presencial","online"],
--      "address": "Rua ...", "responsibles": ["João"],
--      "blocked_times": [], "holidays": [], "timezone": "America/Sao_Paulo"
--    }
