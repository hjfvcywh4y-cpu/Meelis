/**
 * Vercel Edge Function: POST /api/rerank
 * Ключ только в переменных площадки. Клиентский JS его не видит.
 */
import { handleRerankRequest } from '../rerank-core.js';

export const config = { runtime: 'edge' };

export default async function handler(request) {
  return handleRerankRequest(request, typeof process !== 'undefined' ? process.env : {});
}
