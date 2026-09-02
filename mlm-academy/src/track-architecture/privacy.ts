/** Поля, которые нельзя принимать на сервер, писать в runtime facts или отправлять в аналитику. */

export const CLIENT_ONLY_CONTACT_FIELDS = [
  'contact_name',
  'full_name',
  'fio',
  'phone',
  'email',
  'address',
  'messenger_handle',
  'profile_url',
  'real_reason_text',
  'message_draft',
  'message_text',
  'message',
  'response_text',
  'free_text_note',
  'note',
  'notes',
  'correspondence',
  'contact_card',
  'contact_details',
] as const;

const FORBIDDEN = new Set(CLIENT_ONLY_CONTACT_FIELDS.map((name) => name.toLowerCase()));

const FORBIDDEN_PATH_PARTS = new Set([
  'phone',
  'email',
  'address',
  'message_text',
  'message_draft',
  'real_reason_text',
  'response_text',
  'full_name',
  'fio',
  'contact_name',
  'messenger_handle',
  'profile_url',
  'contact_card',
]);

export function isForbiddenFactKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (FORBIDDEN.has(lower)) return true;
  const parts = lower.split('.');
  return parts.some((part) => FORBIDDEN_PATH_PARTS.has(part));
}

export function stripUnsafeFacts(facts: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!facts || typeof facts !== 'object') return out;
  for (const [key, value] of Object.entries(facts)) {
    if (isForbiddenFactKey(key)) continue;
    if (typeof value === 'string' && value.length > 200) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = stripUnsafeFacts(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function assertNoContactPii(payload: unknown): string[] {
  const hits: string[] = [];
  walk(payload, '', hits);
  return hits;
}

function walk(value: unknown, path: string, hits: string[]): void {
  if (value == null) return;
  if (typeof value === 'string') {
    const leaf = path.split('.').pop() || path;
    if (isForbiddenFactKey(leaf) || isForbiddenFactKey(path)) hits.push(path || leaf);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, path ? `${path}.${index}` : String(index), hits));
    return;
  }
  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const next = path ? `${path}.${key}` : key;
      if (isForbiddenFactKey(key) || isForbiddenFactKey(next)) {
        hits.push(next);
        continue;
      }
      walk(nested, next, hits);
    }
  }
}
