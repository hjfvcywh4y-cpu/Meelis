import Link from 'next/link';

import { sectionAccentStyle } from '@/components/ui/section-accent';
import { routes } from '@/domain/routes';
import type { SectionId } from '@/domain/types';
import { cn } from '@/lib/cn';

export interface RouteNode {
  trackId: string;
  sectionId: SectionId;
  label: string;
  state: 'done' | 'current' | 'future';
  linkable: boolean;
}

/**
 * Текущая ветка маршрута, а не полный граф из 112 узлов.
 * На desktop — горизонтальная лента, на mobile — вертикальный stepper.
 */
export function RouteStepper({ nodes, branches }: { nodes: RouteNode[]; branches?: RouteNode[] }) {
  return (
    <div>
      <ol className="grid gap-0 md:grid-flow-col md:auto-cols-fr">
        {nodes.map((node) => (
          <li
            key={node.trackId}
            style={sectionAccentStyle(node.sectionId)}
            className={cn(
              'relative border-l-[3px] border-ink py-3 pr-3 pl-8 md:border-t-[3px] md:border-l-0 md:pt-12 md:pr-4 md:pb-3 md:pl-3',
              node.state === 'future' && 'text-muted',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'absolute top-3 -left-[11px] size-[18px] border-2 border-ink md:top-[-11px] md:left-3',
                node.state === 'done' && 'bg-success',
                node.state === 'current' && 'bg-[var(--accent)]',
                node.state === 'future' && 'bg-surface',
              )}
            />
            <span className="meta-text block">{node.trackId}</span>
            <span className="mt-2 block text-[15px] leading-snug font-bold">
              {node.linkable ? (
                <Link
                  href={routes.track(node.trackId)}
                  className="underline-offset-4 hover:underline"
                >
                  {node.label}
                </Link>
              ) : (
                node.label
              )}
            </span>
            <span className="meta-text mt-2 block text-muted">
              {node.state === 'done' ? 'Сделано' : node.state === 'current' ? 'Сейчас' : 'Дальше'}
            </span>
          </li>
        ))}
      </ol>

      {branches && branches.length > 0 ? (
        <div className="mt-8">
          <span className="meta-text">Развилки после текущего шага · не больше трёх</span>
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            {branches.slice(0, 3).map((branch) => (
              <li key={branch.trackId}>
                <Link
                  href={routes.track(branch.trackId)}
                  style={sectionAccentStyle(branch.sectionId)}
                  className="card-soft card-interactive block p-4"
                >
                  <span className="meta-text">{branch.trackId}</span>
                  <span className="mt-2 block text-[15px] leading-snug font-bold">
                    {branch.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
