# Detecção de agendamento na VPS (bonsync-agente)

Use isto **somente se o processador do WhatsApp for a VPS** (Docker), e não o site.
Como descobrir: no **Evolution Manager → sua instância → Webhook**, veja a URL.
- `https://app.bonsync.com.br/api/webhook/whatsapp` → é o **site**: nada a fazer aqui, já está no deploy.
- IP da VPS / outra URL → é a **VPS**: siga os passos abaixo.

## Passo 1 — copiar o módulo
Copie `appointments.js` (desta pasta) para `bonsync-agente/src/appointments.js`.

Ele é autocontido: usa as envs que o agente já tem
(`SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) e cria
o próprio cliente Anthropic a partir da chave do agente.

## Passo 2 — chamar no fim do processamento (src/agent.js)
No `src/agent.js`, **depois** de gerar e enviar a resposta ao cliente
(perto de onde a resposta do assistente é salva), adicione:

```js
const { detectAppointment } = require('./appointments')

// ... dentro do fluxo, após enviar a resposta:
try {
  const historico = [...messages, { role: 'assistant', content: reply }] // ajuste aos nomes locais
  await detectAppointment(cfg.anthropic_key, {
    agentId: agent.id,
    contactId: contactId,                 // o MESMO valor salvo em conversations.contact_identifier
    contactName: pushName || '',          // nome do contato (ajuste ao nome da variável local)
    address: (cfg.scheduling && cfg.scheduling.address) || '',
    durationMin: (cfg.scheduling && cfg.scheduling.duration_min) || 30,
  }, historico)
} catch (e) {
  console.error('[Appointment] Erro ao detectar/criar solicitação:', e.message)
}
```

> Pontos de atenção (já tivemos bugs de vínculo antes):
> - `contactId` precisa ser **idêntico** ao que o agente grava em
>   `conversations.contact_identifier` (inclusive o caso `@lid`). O módulo
>   resolve a conversa por `(agent_id, contact_identifier)`.
> - `agent.id` é o agente que recebeu a mensagem → garante o `clientId` correto
>   (a RLS/listagem do painel é por `agent_id`).

## Passo 3 — rebuild do Docker
```bash
cd bonsync-agente
git add -A && git commit -m "feat: deteccao de agendamento (appointments.js)"
git pull            # se aplicável
docker compose build --no-cache
docker compose up -d --force-recreate
```

## Passo 4 — pré-requisito de banco
Rode antes os SQLs `supabase/02_negocios.sql` e `supabase/03_agendamentos.sql`
(tabela `meetings` + campos/status de agendamento). Sem eles o insert falha com
`relation "meetings" does not exist`.

## Teste de ponta a ponta
Pelo WhatsApp: "Quero marcar uma reunião presencial dia 20 às 15h."
Logs esperados:
```
[Appointment] Intenção de agendamento detectada
[Appointment] Dados completos
[Appointment] Solicitação criada: <id> — conversa <id> — status aguardando
```
No painel: **Negócios → Agenda comercial → Solicitações pendentes** aparece o
registro com status "Aguardando confirmação".
