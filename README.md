# WhatsApp Marketing Platform

Plataforma robusta para disparo em massa com WhatsApp Cloud API, SQL e roteamento de leads via n8n.

## Implementado

- Painel web com layout tecnologico e blocos de operacao.
- Importacao de contatos com deduplicacao.
- Campanhas com template Meta + imagem de header opcional.
- Dashboard com insights: sucesso, entrega, leitura, retorno e conversao em lead.
- Timeline operacional dos ultimos dias (enviadas, retorno, falhas).
- Controle de status por destinatario (`PENDING`, `SENT`, `DELIVERED`, `READ`, `FAILED`).
- Webhook da Meta com validacao de assinatura (`X-Hub-Signature-256`).
- Roteamento de respostas para n8n com log de sucesso/erro (`N8nRouteEvent`).
- Rastreio de ultimas campanhas com metricas por campanha.

## Stack

- Node.js + TypeScript + Express
- Prisma ORM
- MySQL
- WhatsApp Cloud API
- n8n (integração webhook)

## Ambiente

Use `.env.example` como base:

- `DATABASE_URL`
- `META_APP_ID`
- `META_APP_SECRET`
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_BUSINESS_ACCOUNT_ID`
- `WEBHOOK_VERIFY_TOKEN`
- `N8N_WEBHOOK_URL`
- `N8N_WEBHOOK_AUTH_TOKEN` (opcional)

## Comandos

```bash
npm install
npm run prisma:generate
npx prisma db push
npm run dev
```

## Webhooks

- Meta verify: `GET /api/webhooks/whatsapp`
- Meta events: `POST /api/webhooks/whatsapp`
- n8n destino: definido em `N8N_WEBHOOK_URL`

## Endpoints

- `GET /api/dashboard/overview`
- `GET /api/dashboard/insights`
- `GET /api/dashboard/timeline?days=7`
- `POST /api/contacts/import`
- `POST /api/campaigns`
- `POST /api/campaigns/:id/prepare`
- `POST /api/campaigns/:id/send`
- `POST /api/webhooks/whatsapp`

## Roteamento n8n

Quando o contato responde mensagem da campanha:

1. O sistema marca `repliedAt` no destinatario.
2. Atualiza o contato para `leadStage=RESPONDED_CAMPAIGN`.
3. Envia payload para `N8N_WEBHOOK_URL` com contato, campanha, consultor e mensagem.
4. Registra resultado no banco (`N8nRouteEvent`).
