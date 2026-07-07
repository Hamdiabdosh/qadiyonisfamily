export type ContactAdmin = {
  phone: string;
  telegram: string;
  label?: string;
};

export const DEFAULT_CONTACT_ADMINS: ContactAdmin[] = [
  { phone: "0931947040", telegram: "hamdiabdosh43" },
];

export function parseContactAdmins(raw: string | undefined): ContactAdmin[] {
  if (!raw?.trim()) return DEFAULT_CONTACT_ADMINS;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CONTACT_ADMINS;
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const phone = String(row.phone ?? "").trim();
        const telegram = String(row.telegram ?? "").trim().replace(/^@/, "");
        if (!phone && !telegram) return null;
        const label = row.label != null ? String(row.label).trim() : undefined;
        return { phone, telegram, ...(label ? { label } : {}) };
      })
      .filter((item): item is ContactAdmin => item !== null);
  } catch {
    return DEFAULT_CONTACT_ADMINS;
  }
}

export function serializeContactAdmins(admins: ContactAdmin[]): string {
  return JSON.stringify(
    admins.map((a) => ({
      phone: a.phone.trim(),
      telegram: a.telegram.trim().replace(/^@/, ""),
      ...(a.label?.trim() ? { label: a.label.trim() } : {}),
    })),
  );
}

export function telegramUrl(handle: string): string {
  const user = handle.trim().replace(/^@/, "");
  return user ? `https://t.me/${user}` : "#";
}
