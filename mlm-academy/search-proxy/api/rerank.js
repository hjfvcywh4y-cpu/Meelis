/**
 * Vercel Node Function: POST /api/rerank
 * Node.js, не Edge: анонимный vercel --temporary Edge больше не принимает.
 * Ключ только в переменных площадки. Клиентский JS его не видит.
 */
import { handleRerankRequest } from '../rerank-core.js';

export default {
  fetch(request) {
    return handleRerankRequest(request, typeof process !== 'undefined' ? process.env : {});
  },
};
