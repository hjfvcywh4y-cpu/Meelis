/**
 * Заглушка больше не является живым API. Рабочий контур — Cloudflare Worker
 * `account-proxy/worker.js` + KV. Этот файл оставлен, чтобы не ломать импорты.
 * Секреты сюда не класть.
 */
export { default } from '../account-proxy/worker.js';
