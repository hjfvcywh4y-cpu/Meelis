import { handleArchitectureRequest } from '@/server/track-architecture';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return handleArchitectureRequest(request);
}

export function POST(request: Request) {
  return handleArchitectureRequest(request);
}
