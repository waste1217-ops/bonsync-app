-- ════════════════════════════════════════════════════
-- BONSYNC — Agenda dinâmica por segmento
-- Campos extras por segmento + status "em_atendimento".
-- Rodar no Supabase SQL Editor (depois do 03_agendamentos.sql). Seguro repetir.
-- ════════════════════════════════════════════════════

-- Campos específicos do segmento (convênio, placa, mesa, imóvel, etc.)
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS campos JSONB DEFAULT '{}';

-- Inclui "em_atendimento" nos status válidos
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_status_check;
ALTER TABLE meetings ADD CONSTRAINT meetings_status_check CHECK (status IN (
  'detectada','aguardando_info','aguardando','sugerida','aguardando_escolha',
  'confirmada','reagendada','em_atendimento','realizada','cancelada','ausente','recusada'
));
