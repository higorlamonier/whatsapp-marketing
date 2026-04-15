import { Router } from "express";
import { ContactStatus, RecipientStatus } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { forwardLeadToN8n } from "../services/n8n.service.js";
import { isValidMetaSignature } from "../utils/meta-signature.js";
import { isUnsubscribeMessage, normalizePhone } from "../utils/phone.js";

export const webhooksRouter = Router();

webhooksRouter.get("/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.status(403).send("Forbidden");
});

webhooksRouter.post("/whatsapp", async (req, res) => {
  const signature = req.header("x-hub-signature-256");
  const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body));

  if (env.META_APP_SECRET && !isValidMetaSignature(rawBody, env.META_APP_SECRET, signature)) {
    return res.status(401).json({ error: "Assinatura do webhook invalida" });
  }

  const body = req.body as any;

  const changes = body?.entry?.[0]?.changes?.[0]?.value;
  const statuses = changes?.statuses ?? [];
  const messages = changes?.messages ?? [];

  for (const status of statuses) {
    const recipient = await prisma.campaignRecipient.findFirst({
      where: { whatsappMessageId: status.id }
    });

    if (!recipient) {
      continue;
    }

    let mappedStatus: RecipientStatus | null = null;
    if (status.status === "delivered") {
      mappedStatus = RecipientStatus.DELIVERED;
    }
    if (status.status === "read") {
      mappedStatus = RecipientStatus.READ;
    }
    if (status.status === "failed") {
      mappedStatus = RecipientStatus.FAILED;
    }

    if (!mappedStatus) {
      continue;
    }

    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: {
        status: mappedStatus,
        deliveredAt: mappedStatus === RecipientStatus.DELIVERED ? new Date() : undefined,
        readAt: mappedStatus === RecipientStatus.READ ? new Date() : undefined,
        errorReason: status.errors?.[0]?.title
      }
    });
  }

  for (const incomingMessage of messages) {
    const phone = normalizePhone(incomingMessage.from ?? "");
    if (!phone) {
      continue;
    }

    const contact = await prisma.contact.findUnique({
      where: { phoneNumber: phone },
      include: {
        assignedTo: true
      }
    });

    if (!contact) {
      continue;
    }

    const textBody = incomingMessage.text?.body ?? "";

    const latestRecipient = await prisma.campaignRecipient.findFirst({
      where: {
        contactId: contact.id,
        sentAt: { not: null }
      },
      include: {
        campaign: true
      },
      orderBy: {
        sentAt: "desc"
      }
    });

    await prisma.messageLog.create({
      data: {
        contactId: contact.id,
        campaignRecipientId: latestRecipient?.id,
        direction: "INBOUND",
        eventType: "MESSAGE_RECEIVED",
        payload: incomingMessage
      }
    });

    if (latestRecipient) {
      await prisma.campaignRecipient.update({
        where: { id: latestRecipient.id },
        data: {
          repliedAt: new Date(),
          responseCount: {
            increment: 1
          },
          lastInboundAt: new Date()
        }
      });
    }

    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        lastMessageAt: new Date(),
        isLead: true,
        leadStage: "RESPONDED_CAMPAIGN",
        sentToConsultant: Boolean(contact.assignedToId)
      }
    });

    if (isUnsubscribeMessage(textBody)) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          status: ContactStatus.DO_NOT_CONTACT,
          optedOutAt: new Date()
        }
      });

      await prisma.unsubscribeEvent.create({
        data: {
          contactId: contact.id,
          phone,
          reason: "Solicitado pelo usuario",
          rawMessage: textBody
        }
      });

      continue;
    }

    const n8nPayload = {
      contact: {
        id: contact.id,
        fullName: contact.fullName,
        phoneNumber: contact.phoneNumber,
        category: contact.category,
        leadStage: "RESPONDED_CAMPAIGN"
      },
      consultant: contact.assignedTo
        ? {
            id: contact.assignedTo.id,
            name: contact.assignedTo.name,
            email: contact.assignedTo.email,
            phone: contact.assignedTo.phone
          }
        : null,
      campaign: latestRecipient
        ? {
            id: latestRecipient.campaign.id,
            name: latestRecipient.campaign.name,
            category: latestRecipient.campaign.category,
            templateName: latestRecipient.campaign.templateName
          }
        : null,
      incomingMessage: {
        id: incomingMessage.id ?? "",
        text: textBody,
        timestamp: incomingMessage.timestamp ?? new Date().toISOString()
      }
    };

    const routeResult = await forwardLeadToN8n(n8nPayload);

    await prisma.n8nRouteEvent.create({
      data: {
        contactId: contact.id,
        campaignId: latestRecipient?.campaign.id,
        campaignRecipientId: latestRecipient?.id,
        success: routeResult.success,
        endpoint: env.N8N_WEBHOOK_URL || "",
        responseCode: routeResult.statusCode,
        errorMessage: routeResult.error,
        payload: n8nPayload
      }
    });

    await prisma.messageLog.create({
      data: {
        contactId: contact.id,
        campaignRecipientId: latestRecipient?.id,
        direction: "SYSTEM",
        eventType: routeResult.success ? "LEAD_ROUTED_N8N" : "LEAD_ROUTE_FAILED",
        payload: {
          responseCode: routeResult.statusCode,
          error: routeResult.error
        }
      }
    });
  }

  res.status(200).json({ received: true });
});
