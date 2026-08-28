/**
 * Заглушка Account API. Без service role в клиенте.
 * Подключить после schema.sql. Пока возвращает 501, клиент использует local_fallback.
 */
export default {
  async fetch() {
    return Response.json(
      { ok: false, reason: 'not_connected', hint: 'Подключите Supabase по server/README.md' },
      { status: 501 },
    );
  },
};
