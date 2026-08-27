import type {
  CompletionOutcomeCode,
  PublicTrackMetadata,
  SectionId,
  UserProfile,
} from './types';
import { getTrackAvailability } from './status';

/**
 * Детерминированный движок рекомендаций v0.
 *
 * AI здесь не участвует: набор кандидатов ограничен `nextTrackIds` существующих треков,
 * порядок задан правилами из data/recommendation.rules.json, каждый результат объясним.
 */

export const RECOMMENDATION_LIMITS = {
  primary: 1,
  alternatives: 3,
} as const;

export type RecommendationReason =
  | 'explicit_next_edge'
  | 'matches_completion_outcome'
  | 'matches_profile_goal'
  | 'same_section'
  | 'smaller_step_of_current';

export interface Recommendation {
  track: PublicTrackMetadata;
  reason: RecommendationReason;
  available: boolean;
}

export interface RecommendationResult {
  primary: Recommendation | null;
  alternatives: Recommendation[];
  /** true, когда доступного продолжения нет и экран обязан предложить возврат. */
  needsFallback: boolean;
}

/** Приоритетные разделы для каждого исхода действия. */
const OUTCOME_SECTION_PREFERENCE: Record<CompletionOutcomeCode, SectionId[]> = {
  done: [],
  question: ['A4', 'A5'],
  pause: ['A5', 'A6'],
  refusal: ['A5', 'A2'],
  not_done: [],
};

interface RecommendInput {
  current: PublicTrackMetadata;
  /** Индекс всех треков, видимых в текущем режиме приложения. */
  visibleTracks: Map<string, PublicTrackMetadata>;
  outcome?: CompletionOutcomeCode;
  profile?: Pick<UserProfile, 'selectedSectionId'> | null;
  isEntitled?: (track: PublicTrackMetadata) => boolean;
}

export function recommendNextTracks(input: RecommendInput): RecommendationResult {
  const { current, visibleTracks, outcome = 'done', profile, isEntitled } = input;

  if (outcome === 'not_done') {
    return {
      primary: {
        track: current,
        reason: 'smaller_step_of_current',
        available: isAvailable(current, isEntitled),
      },
      alternatives: [],
      needsFallback: false,
    };
  }

  const preferredSections = OUTCOME_SECTION_PREFERENCE[outcome];

  const candidates: Recommendation[] = current.nextTrackIds
    .map((id, edgeIndex) => ({ id, edgeIndex }))
    .flatMap(({ id, edgeIndex }) => {
      const track = visibleTracks.get(id);
      if (!track) return [];
      const available = isAvailable(track, isEntitled);
      const outcomeRank = preferredSections.indexOf(track.sectionId);
      const matchesGoal =
        profile?.selectedSectionId != null && profile.selectedSectionId === track.sectionId;

      const reason: RecommendationReason =
        outcomeRank >= 0
          ? 'matches_completion_outcome'
          : matchesGoal
            ? 'matches_profile_goal'
            : track.sectionId === current.sectionId
              ? 'same_section'
              : 'explicit_next_edge';

      return [
        {
          recommendation: { track, reason, available } satisfies Recommendation,
          sort: [
            available ? 0 : 1,
            outcomeRank >= 0 ? outcomeRank : preferredSections.length,
            matchesGoal ? 0 : 1,
            track.sectionId === current.sectionId ? 0 : 1,
            edgeIndex,
          ],
        },
      ];
    })
    .sort((a, b) => compareSortKeys(a.sort, b.sort))
    .map((entry) => entry.recommendation);

  const [primary, ...rest] = candidates;

  return {
    primary: primary ?? null,
    alternatives: rest.slice(0, RECOMMENDATION_LIMITS.alternatives),
    needsFallback: !primary || !primary.available,
  };
}

function isAvailable(
  track: PublicTrackMetadata,
  isEntitled?: (track: PublicTrackMetadata) => boolean,
): boolean {
  const entitled = isEntitled ? isEntitled(track) : true;
  return getTrackAvailability(track, { entitled }) === 'available';
}

function compareSortKeys(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export const RECOMMENDATION_REASON_LABELS: Record<RecommendationReason, string> = {
  explicit_next_edge: 'Следующий шаг по маршруту трека',
  matches_completion_outcome: 'Подходит к тому, чем закончилось действие',
  matches_profile_goal: 'Совпадает с выбранным разделом',
  same_section: 'Продолжение внутри раздела',
  smaller_step_of_current: 'Тот же трек меньшим шагом',
};

/** Первый вход: рекомендация начинается с ответа на /start, а не с догадки. */
export function entrySectionForAnswer(
  answer: string,
  entryRules: { answer: string; sectionId: SectionId }[],
): SectionId | null {
  return entryRules.find((rule) => rule.answer === answer)?.sectionId ?? null;
}
