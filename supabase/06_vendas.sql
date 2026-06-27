-- ════════════════════════════════════════════════════
-- BONSYNC — Vendas geradas: vincular conversa + forma de pagamento
-- Rodar no Supabase SQL Editor. Seguro repetir.
-- ════════════════════════════════════════════════════
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
