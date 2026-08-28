import { z } from 'zod';

import { TRACK_ID_PATTERN } from './track-id';
import { SECTION_IDS } from './types';

/**
 * Zod-зеркала контрактов из MLM_Academy_Cursor_Package/schemas.
 * Каталог валидируется при загрузке; ошибки не проглатываются.
 */

export const sectionIdSchema = z.enum(SECTION_IDS);

export const trackIdSchema = z.string().regex(TRACK_ID_PATTERN, 'Track ID должен иметь вид A1-001');

export const sectionSchema = z.object({
  order: z.number().int().min(1),
  sectionId: sectionIdSchema,
  shortTitle: z.string().min(1),
  title: z.string().min(1),
  entryQuestion: z.string().min(1),
  promise: z.string().min(1),
  routeLogic: z.array(z.string().min(1)),
  accentToken: z.string().min(1),
  iconName: z.string().min(1),
});

export const sectionsFileSchema = z.object({
  version: z.string(),
  sections: z.array(sectionSchema).length(6),
});

export const trackSourceSchema = z
  .object({
    sourceCode: z.string().nullable(),
    originalTitle: z.string().nullable(),
    pages: z.union([z.string(), z.number(), z.null()]),
    adaptationDecision: z.string().nullable(),
  })
  .strict();

export const internalTrackMetadataSchema = z
  .object({
    order: z.number().int().min(1),
    sectionId: sectionIdSchema,
    module: z.string().min(1),
    trackId: trackIdSchema,
    title: z.string().min(4),
    situation: z.string().min(4),
    outcome: z.string().min(4),
    priority: z.enum(['P0', 'P1', 'P2', 'Review']),
    format: z.string().min(1),
    nextTrackIds: z.array(trackIdSchema),
    legacyPublicUrl: z.string().url().nullable().default(null),
    pageStatusRaw: z.string().nullable().default(null),
    publicationStatus: z.enum(['planned', 'draft', 'review', 'published', 'archived', 'unknown']),
    visibility: z.enum(['hidden', 'catalog', 'direct_only']).default('catalog'),
    access: z.enum(['undecided', 'free', 'paid', 'organization', 'invite']).default('undecided'),
    contentStatus: z.enum(['metadata_only', 'draft', 'review', 'published', 'archived']),
    adaptationLevel: z.string().nullable().default(null),
    transformationType: z.string().nullable().default(null),
    internalNote: z.string().nullable().default(null),
    source: trackSourceSchema,
  })
  .strict();

export const catalogFileSchema = z.object({
  version: z.string(),
  generatedFrom: z.string().optional(),
  tracks: z.array(internalTrackMetadataSchema).min(1),
});

export const pilotGraphSchema = z.object({
  version: z.string(),
  nodes: z
    .array(
      z.object({
        step: z.number().int().min(1),
        trackId: trackIdSchema,
        sectionId: sectionIdSchema,
        title: z.string().min(1),
        outcome: z.string().min(1),
        nextTrackIds: z.array(trackIdSchema),
      }),
    )
    .min(1),
});

export const recommendationRulesSchema = z.object({
  version: z.string(),
  engine: z.string(),
  principles: z.array(z.string()),
  entryRules: z.array(z.object({ answer: z.string(), sectionId: sectionIdSchema })),
  completionOutcomes: z.array(
    z.object({
      code: z.enum(['done', 'question', 'pause', 'refusal', 'not_done']),
      label: z.string(),
      behavior: z.string(),
    }),
  ),
  ranking: z.array(z.string()),
  limits: z.object({
    primaryNextActions: z.number().int().min(1),
    alternativeNextActions: z.number().int().min(0),
    recentlyCompletedCooldownDays: z.number().int().min(0),
  }),
});

export const registrySummarySchema = z.object({
  totalTracks: z.number().int().min(1),
  bySection: z.record(z.string(), z.number().int()),
  byPriority: z.record(z.string(), z.number().int()),
  byModule: z.record(z.string(), z.number().int()),
  byTransformationType: z.record(z.string(), z.number().int()),
  pilotRows: z.number().int(),
  uniquePilotTracks: z.number().int(),
});

/**
 * Контракт будущего содержания трека. Существует как тип и валидатор,
 * но ни одного наполненного объекта в этой итерации не создаётся.
 */
export const futureTrackContentSchema = z
  .object({
    trackId: trackIdSchema,
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    status: z.enum(['draft', 'review', 'published', 'archived']),
    estimatedMinutes: z.number().int().min(1).nullable().optional(),
    steps: z.array(
      z
        .object({
          stepId: z.string().min(1),
          type: z.enum([
            'read',
            'watch',
            'listen',
            'answer',
            'write',
            'upload',
            'do',
            'wait',
            'check',
          ]),
          title: z.string().min(1),
          body: z.string().nullable().optional(),
        })
        .loose(),
    ),
    completionRule: z
      .object({
        requiresAction: z.boolean(),
        requiresEvidence: z.boolean(),
        requiresNextStep: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type FutureTrackContent = z.infer<typeof futureTrackContentSchema>;
