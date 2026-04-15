# WhatsApp Marketing Platform

Projeto robusto para disparo em massa com WhatsApp Cloud API e controle completo em SQL.

## O que ja esta implementado

- Interface web administrativa para importacao, criacao de campanha e disparo por lote.
- Integracao com SQL (MySQL via Prisma).
- Controle de duplicidade por telefone.
- Controle de descadastro (opt-out) via webhook com palavras-chave.
- Controle de status de envio (PENDING, SENT, DELIVERED, READ, FAILED).
- Controle de categoria de campanha e categoria de contatos.
- Controle de lead e responsavel comercial (consultor) + historico de ownership.
- Log de eventos de mensagens e insights basicos no dashboard.
- Validacao de assinatura de webhook (`X-Hub-Signature-256`) usando `META_APP_SECRET`.

## Stack

- Node.js + TypeScript + Express
- Prisma ORM
- MySQL
- WhatsApp Cloud API (Meta)

## Como rodar

1. Instale dependencias:

```bash
npm install
```

2. Copie variaveis de ambiente:

```bash
cp .env.example .env
```

3. Gere o Prisma Client e rode migracao:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
```

4. Suba o servidor:

```bash
npm run dev
```

5. Abra o painel:

- `http://localhost:3000`

## Configuracao da Meta

- URL de webhook: `https://marketing.araunahtech.com.br/api/webhooks/whatsapp`
- Token de verificacao: valor de `WEBHOOK_VERIFY_TOKEN`
- Endpoint de verificacao: `GET /api/webhooks/whatsapp`
- Endpoint de eventos: `POST /api/webhooks/whatsapp`

## Endpoints principais

- `GET /health`
- `GET /api/dashboard/overview`
- `GET /api/contacts`
- `POST /api/contacts/import`
- `PATCH /api/contacts/:id/optout`
- `PATCH /api/contacts/:id/lead`
- `GET /api/consultants`
- `POST /api/consultants`
- `GET /api/campaigns`
- `POST /api/campaigns`
- `POST /api/campaigns/:id/prepare`
- `POST /api/campaigns/:id/send`
- `GET /api/webhooks/whatsapp` (verificacao Meta)
- `POST /api/webhooks/whatsapp` (status + inbox + opt-out)

## Fluxo recomendado de operacao

1. Cadastrar consultores.
2. Importar base de contatos por JSON.
3. Criar campanha com categoria e template da Meta.
4. Preparar campanha (gera destinatarios para contatos ativos da categoria).
5. Rodar envio em lotes (`/send`) para controle de throughput.
6. Meta chama webhook para atualizar status entregue/lido/falha.
7. Mensagens de opt-out movem contato para `DO_NOT_CONTACT` automaticamente.

## Melhorias prontas para proxima etapa

- Autenticacao de usuarios no painel (RBAC por equipe).
- Job queue com retries e rate-limit dinamico (BullMQ + Redis).
- Agendamento por horario/campanha.
- Segmentacao avancada por score/engajamento.
- Importacao CSV com mapeamento visual.
- BI com funil de conversao por consultor e categoria.

## Seguranca

- As credenciais compartilhadas nesta fase devem ser rotacionadas apos subir em producao.
- Nunca publicar `.env` em reposito rios Git.
- Recomenda-se liberar o webhook apenas para IPs da Meta no firewall do servidor.
