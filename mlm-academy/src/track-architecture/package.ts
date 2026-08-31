import { z } from 'zod';

import { TRACK_ID_PATTERN } from '../domain/track-id';
import { DESTINATION_TYPES, ENTITY_TYPES, OPERATORS, PUBLICATION_STATUSES } from './types';

const trackId = z.string().regex(TRACK_ID_PATTERN);

export const trackPackageSchema = z
  .object({
    packageVersion: z.literal('1.0'),
    track: z
      .object({
        id: trackId,
        canonicalId: trackId,
        entityType: z.enum(ENTITY_TYPES),
        section: z.string().regex(/^A[1-6]$/),
        domain: z.string().min(1),
        title: z.string().min(1),
        situation: z.string().optional(),
        result: z.string().optional(),
        audience: z.string().optional(),
      })
      .strict(),
    content: z
      .object({
        version: z.string().min(1),
        status: z.enum(PUBLICATION_STATUSES),
        format: z.enum(['html', 'markdown', 'json', 'module', 'system-ui', 'none']),
        serverOnly: z.boolean(),
        sourcePath: z.string(),
        checksum: z.string().optional(),
        releaseNotes: z.string().optional(),
      })
      .strict(),
    access: z
      .object({
        policy: z.enum(['PUBLIC_META', 'FREE_CONTENT', 'ENTITLED', 'ADMIN_PREVIEW', 'UNAVAILABLE']),
        productCodes: z.array(z.string().min(1)),
      })
      .strict(),
    outcomes: z.array(
      z
        .object({
          code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
          label: z.string().min(1),
          observableFact: z.string().min(1),
          requiredFacts: z.array(z.string()).optional(),
        })
        .strict(),
    ),
    routeRules: z.array(
      z
        .object({
          ruleId: z.string().regex(/^RR[0-9A-Z-]+$/),
          fromId: trackId,
          outcomeCode: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
          field: z.string().min(1),
          operator: z.enum(OPERATORS),
          value: z.unknown(),
          destinationType: z.enum(DESTINATION_TYPES),
          destinationId: z.union([trackId, z.literal(''), z.null()]).optional(),
          reason: z.string().optional(),
          stopRule: z.string().optional(),
          recoveryRule: z.union([z.string(), z.null()]).optional(),
          priority: z.number().int().min(0),
          owner: z.string().optional(),
          version: z.string().min(1),
          status: z.enum(['PILOT_DRAFT_TO_TEST', 'VALIDATED_RULE', 'DISABLED', 'ARCHIVED']),
        })
        .strict(),
    ),
    privacy: z
      .object({
        serverAllowedFields: z.array(z.string()),
        clientOnlyFields: z.array(z.string()),
        analyticsAllowedFields: z.array(z.string()),
      })
      .strict(),
    source: z
      .object({
        files: z.array(z.string()).optional(),
        owner: z.string().optional(),
        approvedAt: z.union([z.string(), z.null()]).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type TrackPackage = z.infer<typeof trackPackageSchema>;

export function parseTrackPackage(input: unknown): { ok: true; data: TrackPackage } | { ok: false; error: string } {
  const parsed = trackPackageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }
  return { ok: true, data: parsed.data };
}
