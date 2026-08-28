/**
 * Cloudflare Worker для rerank поиска MLM Academy.
 * Секрет OPENAI_API_KEY (или GROQ_API_KEY) задаётся в окружении Worker, не в Tilda.
 */
import { handleRerankRequest } from './rerank-core.js';

const worker = {
  async fetch(request, env) {
    return handleRerankRequest(request, env);
  },
};

export default worker;
