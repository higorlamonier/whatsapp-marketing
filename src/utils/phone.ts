export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  if (digits.startsWith("55")) {
    return digits;
  }
  return `55${digits}`;
}

export function isUnsubscribeMessage(text: string): boolean {
  const value = text.trim().toLowerCase();
  const keywords = [
    "sair",
    "parar",
    "stop",
    "cancelar",
    "descadastrar",
    "unsubscribe"
  ];
  return keywords.includes(value);
}
