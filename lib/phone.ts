const E164 = /^\+[1-9]\d{7,14}$/;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Normalise a UK or international number to E.164. Returns null if it cannot. */
export function toE164(input: string | null | undefined): string | null {
  if (!input) return null;
  let raw = input.trim().replace(/[^\d+]/g, "");
  if (!raw) return null;
  if (raw.startsWith("00")) raw = `+${raw.slice(2)}`;
  if (raw.startsWith("+")) {
    return E164.test(raw) ? raw : null;
  }
  if (raw.startsWith("0")) {
    const next = `+44${raw.slice(1)}`;
    return E164.test(next) ? next : null;
  }
  if (raw.startsWith("44")) {
    const next = `+${raw}`;
    return E164.test(next) ? next : null;
  }
  return null;
}

export function phoneLookupVariants(input: string | null | undefined): string[] {
  if (!input) return [];
  const compact = input.replace(/\s/g, "");
  const e164 = toE164(input);
  const variants = new Set<string>([compact]);
  if (e164) {
    variants.add(e164);
    variants.add(e164.slice(1));
    if (e164.startsWith("+44")) variants.add(`0${e164.slice(3)}`);
  }
  return [...variants].filter(Boolean);
}

export function formatUkPhone(input: string | null | undefined): string {
  const e164 = toE164(input ?? "");
  if (!e164) return input?.trim() || "";
  if (!e164.startsWith("+44")) return e164;
  const national = e164.slice(3);
  if (national.length === 10) {
    return `+44 ${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`;
  }
  return `+44 ${national}`;
}

export function telHref(input: string): string {
  const e164 = toE164(input);
  return `tel:${e164 ?? input.replace(/\s/g, "")}`;
}
