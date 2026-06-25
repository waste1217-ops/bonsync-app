-- ════════════════════════════════════════════════════
-- BONSYNC — Confirmação real de entrega das mensagens (ACK)
-- Guarda o ID da mensagem no WhatsApp para correlacionar os eventos de ACK
-- (enviada/entregue/lida). Rodar no Supabase SQL Editor. Seguro repetir.
-- ════════════════════════════════════════════════════
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS wa_message_id TEXT;

CREATE INDEX IF NOT EXISTS messages_wa_message_id_idx ON messages (wa_message_id);

-- send_status passa a usar: pendente | enviando | aceita | enviada | entregue
--   | lida | falha | nao_confirmada   (texto livre — sem constraint)
