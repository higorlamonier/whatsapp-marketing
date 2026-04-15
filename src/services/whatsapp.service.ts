import { env } from "../config/env.js";

type SendTemplatePayload = {
  to: string;
  templateName: string;
  languageCode: string;
  headerImageUrl?: string | null;
};

export async function sendTemplateMessage(payload: SendTemplatePayload): Promise<{ messageId: string }> {
  const url = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const components = [];
  if (payload.headerImageUrl) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "image",
          image: {
            link: payload.headerImageUrl
          }
        }
      ]
    });
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: payload.to,
      type: "template",
      template: {
        name: payload.templateName,
        language: {
          code: payload.languageCode
        },
        ...(components.length > 0 ? { components } : {})
      }
    })
  });

  const json = (await response.json()) as Record<string, any>;
  if (!response.ok) {
    throw new Error(json.error?.message ?? "Falha ao enviar mensagem WhatsApp");
  }

  const messageId = json.messages?.[0]?.id;
  if (!messageId) {
    throw new Error("WhatsApp Cloud API nao retornou message id");
  }

  return { messageId };
}
