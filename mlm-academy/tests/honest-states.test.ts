import { readdirSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { futureTrackContentSchema } from '@/domain/schemas';
import { getTrackAvailability, getTrackStatusView } from '@/domain/status';
import { listPublicTracks } from '@/server/catalog';

describe('честные состояния трека', () => {
  it('metadata_only не даёт кнопку «Начать» и скрывает прогресс', () => {
    const view = getTrackStatusView({
      publicationStatus: 'planned',
      contentStatus: 'metadata_only',
    });
    expect(view.availability).toBe('preparing');
    expect(view.canStart).toBe(false);
    expect(view.showProgress).toBe(false);
    expect(view.label).toBe('Готовится');
  });

  it('опубликованный трек без содержания тоже не предлагает «Начать»', () => {
    const view = getTrackStatusView({
      publicationStatus: 'published',
      contentStatus: 'metadata_only',
    });
    expect(view.availability).toBe('published_empty');
    expect(view.canStart).toBe(false);
    expect(view.showProgress).toBe(false);
  });

  it('трек с содержанием открывается и считает прогресс', () => {
    const view = getTrackStatusView({
      publicationStatus: 'published',
      contentStatus: 'published',
    });
    expect(view.canStart).toBe(true);
    expect(view.showProgress).toBe(true);
  });

  it('без entitlement трек показывается как «Нет доступа», а не как готовый', () => {
    expect(
      getTrackAvailability(
        { publicationStatus: 'published', contentStatus: 'published' },
        { entitled: false },
      ),
    ).toBe('locked');
  });

  it('ни один трек текущего каталога не заявляет готовое содержание', () => {
    for (const track of listPublicTracks({ preview: true })) {
      expect(getTrackStatusView(track).canStart).toBe(false);
    }
  });
});

describe('запрет на преждевременное наполнение', () => {
  it('в проекте нет ни одного файла содержания трека', () => {
    const contentDir = new URL('../src/data/content/', import.meta.url);
    const exists = existsSync(contentDir);
    if (!exists) {
      expect(exists).toBe(false);
      return;
    }
    expect(readdirSync(contentDir)).toEqual([]);
  });

  it('схема будущего содержания существует и валидирует контракт', () => {
    const parsed = futureTrackContentSchema.safeParse({
      trackId: 'A1-001',
      version: '1.0.0',
      status: 'draft',
      steps: [],
      completionRule: { requiresAction: true, requiresEvidence: true, requiresNextStep: true },
    });
    expect(parsed.success).toBe(true);

    const invalid = futureTrackContentSchema.safeParse({
      trackId: 'A9-999',
      version: '1',
      status: 'live',
      steps: [{ stepId: '1', type: 'sing', title: 'x' }],
      completionRule: {},
    });
    expect(invalid.success).toBe(false);
  });
});
