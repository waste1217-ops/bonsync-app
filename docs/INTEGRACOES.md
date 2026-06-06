# Plano — Integrações de canais (#12)

> Status: **planejado** (aguardando decisão de motor + prioridade de canal).
> Registrado em 2026-06.

## Situação atual (arquitetura)

Existem **dois motores** de processamento de mensagens no projeto:

| Motor | Onde | Recursos |
|---|---|---|
| Agente da VPS (`bonsync-agente`) | VPS, Node/Docker | Completo: memória por contato, base de conhecimento, guardrails de segurança, áudio (Groq Whisper), visão (Claude), detecção de negócios |
| `lib/agent.ts` | dentro do app Next | Simples: Claude + histórico + escalonamento (sem memória/conhecimento/guardrail) |

O WhatsApp em produção roda no **agente da VPS**. Recebe via Evolution API → webhook → `processMessage`.

**Decisão central:** todo canal novo deve idealmente entrar no **motor da VPS** para herdar memória, conhecimento e segurança. Caso contrário, o novo canal responde de forma mais "simples" que o WhatsApp.

## Pré-requisito recomendado: consolidar o motor

Tornar o agente da VPS **canal-agnóstico**:
- Abstrair `enviarMensagem(canal, destino, texto)` (hoje só Evolution/WhatsApp).
- `conversations.channel` já existe — usar para diferenciar origem.
- Identificar o agente por canal: hoje é `config.whatsapp_instance`; criar `config.channels.{telegram,meta,discord}` com credenciais.

## Canais

### 1. Telegram — ⭐ mais fácil
- Cliente cria bot no **@BotFather** → `bot_token`. Sem revisão de app; ativa na hora.
- Setar webhook: `https://api.telegram.org/bot<token>/setWebhook?url=<endpoint>`.
- Endpoint recebe updates → identifica agente pelo token/bot → motor → resposta via `sendMessage`.
- Esforço: **baixo**.

### 2. Instagram DM + Facebook Messenger (Meta) — médio/alto
- Exige **App Meta + verificação de negócio + revisão do app** (`instagram_manage_messages`, `pages_messaging`, `pages_manage_metadata`). Aprovação pode levar dias/semanas.
- Cliente conecta Página/IG via OAuth → `page_access_token`.
- Webhook único Meta (com verify token) → roteia por `page_id`/`recipient.id` → motor.
- Janela de 24h de mensageria (regra da Meta).
- Esforço: **alto** (sobretudo a burocracia).

### 3. Discord — médio
- Bot por cliente (token) ou bot único da Bonsync adicionado aos servidores.
- Gateway (conexão persistente, melhor na VPS) ou Interactions endpoint.
- Mais voltado a comunidades. Prioridade menor para PMEs BR.

### 4. Webhooks (entrada/saída) — baixo/médio
- Saída: disparar eventos (nova conversa, negócio fechado, escalonamento) para URL do cliente (com segredo/HMAC).
- Entrada: endpoint genérico autenticado para sistemas do cliente injetarem mensagens.

### 5. API própria — médio
- Endpoints autenticados (API key por cliente) para enviar/consultar mensagens, conversas e métricas.
- Rate limiting + escopo por cliente (RLS/service role).

## Sequência recomendada
1. Consolidar o motor (canal-agnóstico na VPS).
2. **Telegram** (entrega rápida).
3. Webhooks + API própria (sem dependência de terceiros).
4. Meta (IG/Messenger) — iniciar papelada cedo, em paralelo.
5. Discord (se houver demanda).

## Decisões pendentes
1. Motor dos canais novos: **VPS** (recomendado) ou app Next?
2. Ordem de canais.
3. Meta: já existe App Meta / conta de negócios verificada?
