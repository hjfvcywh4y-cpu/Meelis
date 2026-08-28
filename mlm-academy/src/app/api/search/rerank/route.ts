import { handleRerankRequest } from '../../../../../search-proxy/rerank-core.js';

export const runtime = 'nodejs';

export function OPTIONS(request: Request) {
  return handleRerankRequest(request, process.env);
}

export async function POST(request: Request) {
  return handleRerankRequest(request, process.env);
}
