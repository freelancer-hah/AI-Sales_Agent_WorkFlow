export function normalizeDomain(input: string): string {
  if (!input) return '';
  let cleaned = input.trim().toLowerCase();
  // Remove protocol
  cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?/, '');
  // Extract hostname part before path or query
  cleaned = cleaned.split('/')[0].split('?')[0].split(':')[0];
  return cleaned;
}

export function normalizeUrl(input: string): string {
  if (!input) return '';
  let cleaned = input.trim();
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }
  try {
    const parsed = new URL(cleaned);
    return parsed.href;
  } catch {
    return cleaned;
  }
}

export function normalizeCompanyName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
    .replace(/\b(llc|inc|corp|corporation|ltd|limited|gmbh|co|company|pty|pvt)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanEmail(email: string): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  return phone.replace(/[^\d+()-\s]/g, '').trim();
}
