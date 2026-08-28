'use client';

import { useEffect, useId, useMemo, useState } from 'react';

import { TrackCard } from '@/components/catalog/track-card';
import { pluralTracks } from '@/components/catalog/section-card';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useAppMode } from '@/components/providers/app-mode-provider';
import { routes } from '@/domain/routes';
import { filterTracks, type CatalogQuery } from '@/domain/search';
import { SECTION_IDS, type PublicTrackMetadata, type Section, type SectionId } from '@/domain/types';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';

interface CatalogBrowserProps {
  tracks: PublicTrackMetadata[];
  sections: Section[];
  initialQuery: string;
  initialSection: SectionId | null;
  initialFormat: string | null;
  formats: string[];
}

type ViewMode = 'list' | 'grouped';

export function CatalogBrowser({
  tracks,
  sections,
  initialQuery,
  initialSection,
  initialFormat,
  formats,
}: CatalogBrowserProps) {
  const mode = useAppMode();
  const searchId = useId();
  const formatId = useId();

  const [query, setQuery] = useState(initialQuery);
  const [sectionId, setSectionId] = useState<SectionId | null>(initialSection);
  const [format, setFormat] = useState<string | null>(initialFormat);
  const [availability, setAvailability] = useState<NonNullable<CatalogQuery['availability']>>('all');
  const [view, setView] = useState<ViewMode>('list');

  const sectionById = useMemo(
    () => new Map(sections.map((section) => [section.sectionId, section])),
    [sections],
  );

  const results = useMemo(
    () => filterTracks(tracks, { query, sectionId, format, availability }),
    [tracks, query, sectionId, format, availability],
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (sectionId) params.set('section', sectionId);
    if (format) params.set('format', format);
    const search = params.toString();
    window.history.replaceState(null, '', search ? `${routes.library()}?${search}` : routes.library());
  }, [query, sectionId, format]);

  useEffect(() => {
    if (!query.trim()) return;
    trackEvent({ name: 'search_catalog', query: query.trim(), results: results.length });
  }, [query, results.length]);

  const hasFilters = Boolean(query.trim() || sectionId || format || availability !== 'all');

  function resetFilters() {
    setQuery('');
    setSectionId(null);
    setFormat(null);
    setAvailability('all');
  }

  return (
    <div className="container-grid">
      <div className="grid gap-4 border-b-2 border-ink py-6 lg:grid-cols-[minmax(280px,1fr)_auto] lg:items-end">
        <div>
          <label htmlFor={searchId} className="meta-text mb-2 block">
            Поиск по ситуации и результату
          </label>
          <input
            id={searchId}
            type="search"
            className="field"
            placeholder="Например: написать первое сообщение"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button
            type="button"
            className={cn('chip', sectionId === null && 'chip-active')}
            aria-pressed={sectionId === null}
            onClick={() => setSectionId(null)}
          >
            Все разделы
          </button>
          {SECTION_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className={cn('chip', sectionId === id && 'chip-active')}
              aria-pressed={sectionId === id}
              onClick={() => setSectionId(sectionId === id ? null : id)}
            >
              {id}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 border-b border-line-soft py-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor={formatId} className="meta-text mb-2 block">
              Формат
            </label>
            <select
              id={formatId}
              className="field min-h-[44px] max-w-[280px] text-[15px]"
              value={format ?? ''}
              onChange={(event) => setFormat(event.target.value || null)}
            >
              <option value="">Любой формат</option>
              {formats.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          {mode.preview ? (
            <fieldset className="min-w-0">
              <legend className="meta-text mb-2">Доступность</legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['all', 'Все'],
                    ['available', 'Доступные'],
                    ['preparing', 'Готовятся'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={cn('chip', availability === value && 'chip-active')}
                    aria-pressed={availability === value}
                    onClick={() => setAvailability(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="meta-text">Вид</span>
          <button
            type="button"
            className={cn('chip', view === 'list' && 'chip-active')}
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            Списком
          </button>
          <button
            type="button"
            className={cn('chip', view === 'grouped' && 'chip-active')}
            aria-pressed={view === 'grouped'}
            onClick={() => setView('grouped')}
          >
            По разделам
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 py-5">
        <p aria-live="polite" className="text-[16px] font-bold">
          {results.length === 0
            ? 'Ничего не найдено'
            : `${results.length} ${pluralTracks(results.length)}`}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {hasFilters ? (
            <button type="button" className="chip" onClick={resetFilters}>
              Сбросить фильтры
            </button>
          ) : null}
          <span className="text-[14px] text-muted">
            {mode.preview
              ? 'В production неопубликованные треки скрыты'
              : 'Показаны только опубликованные треки'}
          </span>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="pb-16">
          <EmptyState
            eyebrow="Пустой результат"
            title="По этому запросу треков нет"
            description="Попробуйте описать ситуацию своими словами — например «человек взял паузу» или «не знаю, кому написать». Или откройте раздел целиком."
            actions={
              <>
                <button type="button" className="btn" onClick={resetFilters}>
                  Сбросить фильтры
                </button>
                <ButtonLink href={routes.start()} variant="primary">
                  Выбрать ситуацию
                </ButtonLink>
              </>
            }
          />
        </div>
      ) : view === 'list' ? (
        <ul className="grid gap-4 pb-16 md:grid-cols-2 xl:grid-cols-3">
          {results.map((track) => (
            <li key={track.trackId} className="flex">
              <div className="flex w-full">
                <TrackCard
                  track={track}
                  section={
                    sectionById.get(track.sectionId) ?? {
                      sectionId: track.sectionId,
                      shortTitle: track.sectionId,
                    }
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-10 pb-16">
          {sections.map((section) => {
            const sectionTracks = results.filter((track) => track.sectionId === section.sectionId);
            if (sectionTracks.length === 0) return null;
            return (
              <section key={section.sectionId} aria-labelledby={`group-${section.sectionId}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-ink pb-3">
                  <h2 id={`group-${section.sectionId}`} className="heading-3">
                    {section.sectionId} · {section.shortTitle}
                  </h2>
                  <span className="meta-text">
                    {sectionTracks.length} {pluralTracks(sectionTracks.length)}
                  </span>
                </div>
                <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {sectionTracks.map((track) => (
                    <li key={track.trackId} className="flex">
                      <div className="flex w-full">
                        <TrackCard track={track} section={section} />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
