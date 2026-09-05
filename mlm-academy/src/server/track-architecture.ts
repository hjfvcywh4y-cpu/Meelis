import 'server-only';

export { handleArchitectureRequest } from '@/track-architecture/http';
export { getArchitectureStore, createSeededStore } from '@/track-architecture/seed';
export { resolveArchitectureFlags, DEFAULT_ARCHITECTURE_FLAGS } from '@/track-architecture/flags';
