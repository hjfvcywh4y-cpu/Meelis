import Link from 'next/link';

import { ButtonLink } from '@/components/ui/button';
import { sectionAccentStyle } from '@/components/ui/section-accent';
import type { SectionId } from '@/domain/types';

export interface NextAction {
  eyebrow: string;
  title: string;
  why: string;
  outcome: string | null;
  href: string;
  cta: string;
  sectionId: SectionId | null;
  secondary?: { href: string; label: string };
}

/**
 * Самый заметный блок личного кабинета — и единственный такой на экране.
 * Больше одного главного next action показывать нельзя.
 */
export function NextActionCard({ action }: { action: NextAction }) {
  return (
    <article
      style={action.sectionId ? sectionAccentStyle(action.sectionId) : undefined}
      className="card bg-a2 p-5 sm:p-8"
    >
      <span className="meta-text">{action.eyebrow}</span>
      <h2 className="heading-2 mt-5 max-w-[22ch]">
        <Link href={action.href} className="underline-offset-4 hover:underline">
          {action.title}
        </Link>
      </h2>
      <p className="body-l mt-5 max-w-[62ch]">{action.why}</p>
      {action.outcome ? (
        <p className="mt-4 max-w-[62ch] text-[16px] leading-snug">
          <span className="meta-text mr-2">На выходе</span>
          {action.outcome}
        </p>
      ) : null}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href={action.href} variant="primary">
          {action.cta}
        </ButtonLink>
        {action.secondary ? (
          <ButtonLink href={action.secondary.href}>{action.secondary.label}</ButtonLink>
        ) : null}
      </div>
    </article>
  );
}
