-- ════════════════════════════════════════════════════
-- BONSYNC — Conexão WhatsApp por cliente (Painel Admin)
-- Guarda a instância do cliente e a data da última conexão.
-- Rodar no Supabase: SQL Editor → New Query → Run. Seguro repetir.
-- ════════════════════════════════════════════════════
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS whatsapp_instance     TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_connected_at TIMESTAMPTZ;
