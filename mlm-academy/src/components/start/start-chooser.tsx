'use client';

import { useState } from 'react';

import { TrackCard } from '@/components/catalog/track-card';
import { pluralTracks } from '@/components/catalog/section-card';
import { useProfile } from '@/components/providers/profile-provider';
import { ButtonLink } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/eyebrow';
import { sectionAccentStyle } from '@/components/ui/section-accent';
import { routes } from '@/domain/routes';
import type { PublicTrackMetadata, Section, SectionId } from '@/domain/types';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';

export interface StartOption {
  section: Section;
  total: number;
  published: number;
  recommended: PublicTrackMetadata | null;
}

/**
 * Один вопрос и шесть ответов. Ни возраста, ни дохода, ни квалификации:
 * это вход в раздел, а не анкета.
 */
export function StartChooser({ options }: { options: StartOption[] }) {
  const { profile, selectSection, loaded } = useProfile();
  const [chosen, setChosen] = useState<SectionId | null>(null);

  const activeId = chosen ?? (loaded ? profile.selectedSectionId : null);
  const active = options.find((option) => option.section.sectionId === activeId) ?? null;

  async function choose(sectionId: SectionId) {
    setChosen(sectionId);
    trackEvent({ name: 'select_situation', sectionId });
    await selectSection(sectionId);
  }

  return (
    <div className="container-grid py-10 lg:py-14">
      <fieldset>
        <legend className="heading-2 max-w-[20ch]">
          Что сейчас больше всего мешает вам двигаться?
        </legend>
        <p className="body-l mt-5 max-w-[60ch] text-muted">
          Выберите один ответ. Он определит раздел и сохранится в вашем профиле — потом его можно
          поменять.
        </p>

        <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {options.map((option) => {
            const isActive = option.section.sectionId === activeId;
            return (
              <li key={option.section.sectionId} className="flex">
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => void choose(option.section.sectionId)}
                  style={sectionAccentStyle(option.section.sectionId)}
                  className={cn(
                    'card card-interactive flex w-full flex-col overflow-hidden py-5 pr-5 pl-8 text-left',
                    isActive && 'bg-ink text-white',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-3 border-r-2 border-ink bg-[var(--accent)]"
                  />
                  <span className="meta-text">
                    {option.section.sectionId} / {option.total} {pluralTracks(option.total)}
                  </span>
                  <span className="heading-3 mt-5 block">{option.section.entryQuestion}</span>
                  <span
                    className={cn(
                      'mt-4 block text-[15px] leading-snug',
                      isActive ? 'text-on-ink-muted' : 'text-muted',
                    )}
                  >
                    {option.section.shortTitle} · {option.section.promise}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <section aria-live="polite" className="mt-12">
        {active ? (
          <div className="card p-5 sm:p-8" style={sectionAccentStyle(active.section.sectionId)}>
            <Eyebrow tone="accent">
              Ваш раздел: {active.section.sectionId} · {active.section.shortTitle}
            </Eyebrow>
            <h2 className="heading-2 mt-5 max-w-[24ch]">{active.section.title}</h2>
            <p className="body-l mt-4 max-w-[62ch] text-muted">{active.section.promise}</p>

            <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)]">
              <div>
                <span className="meta-text">Логика раздела</span>
                <ol className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                  {active.section.routeLogic.map((step, index) => (
                    <li key={step} className="flex items-center gap-3">
                      {index > 0 ? (
                        <span aria-hidden="true" className="text-muted">
                          →
                        </span>
                      ) : null}
                      <span className="card-soft px-3 py-2 text-[15px] font-bold">{step}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <ButtonLink href={routes.section(active.section.sectionId)} variant="primary">
                    Показать мой раздел
                  </ButtonLink>
                  <ButtonLink href={routes.my()}>Личная главная</ButtonLink>
                </div>
              </div>

              <div>
                <span className="meta-text">
                  {active.recommended
                    ? active.recommended.publicationStatus === 'published'
                      ? 'Рекомендуемый трек'
                      : 'Первый трек раздела'
                    : 'Рекомендация'}
                </span>
                <div className="mt-4">
                  {active.recommended ? (
                    <TrackCard track={active.recommended} section={active.section} />
                  ) : (
                    <div className="card p-5">
                      <p className="text-[16px] leading-relaxed">
                        В этом разделе пока нет открытых треков. Раздел сохранён в профиле — как
                        только появится первый трек, он окажется на вашей личной главной.
                      </p>
                      <div className="mt-5">
                        <ButtonLink href={routes.library()} size="small">
                          Посмотреть библиотеку
                        </ButtonLink>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[16px] text-muted">
            Ответ пока не выбран. Выберите ситуацию выше — раздел появится здесь.
          </p>
        )}
      </section>
    </div>
  );
}
