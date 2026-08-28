import type { ReactNode } from 'react';

import { Eyebrow } from './eyebrow';

interface PageHeadProps {
  eyebrow: string;
  title: string;
  lead?: string;
  aside?: ReactNode;
  breadcrumbs?: ReactNode;
}

export function PageHead({ eyebrow, title, lead, aside, breadcrumbs }: PageHeadProps) {
  return (
    <div className="border-b-2 border-ink">
      <div className="container-grid pt-8 pb-8 sm:pt-12 sm:pb-10">
        {breadcrumbs ? <div className="mb-6">{breadcrumbs}</div> : null}
        <Eyebrow tone="dark">{eyebrow}</Eyebrow>
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[900px]">
            <h1 className="heading-1">{title}</h1>
            {lead ? <p className="body-l mt-5 max-w-[760px] text-muted">{lead}</p> : null}
          </div>
          {aside ? <div className="shrink-0">{aside}</div> : null}
        </div>
      </div>
    </div>
  );
}
