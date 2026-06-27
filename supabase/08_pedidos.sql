-- ════════════════════════════════════════════════════
-- BONSYNC — Agenda alimentícia: status de pedido/produção/entrega
-- Rodar no Supabase SQL Editor (depois do 07_agenda.sql). Seguro repetir.
-- ════════════════════════════════════════════════════
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_status_check;
ALTER TABLE meetings ADD CONSTRAINT meetings_status_check CHECK (status IN (
  'detectada','aguardando_info','aguardando','sugerida','aguardando_escolha',
  'confirmada','reagendada','em_atendimento',
  'em_preparacao','pronto','saiu_entrega','aguardando_retirada','entregue',
  'realizada','cancelada','ausente','recusada'
));
