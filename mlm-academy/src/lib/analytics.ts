/**
 * Контракт аналитики без внешнего сервиса.
 * В production реализация — no-op, в dev события видны в консоли.
 */

export type AnalyticsEvent =
  | { name: 'view_home' }
  | { name: 'select_situation'; sectionId: string }
  | { name: 'view_section'; sectionId: string }
  | { name: 'search_catalog'; query: string; results: number }
  | { name: 'view_track_card'; trackId: string }
  | { name: 'open_track_shell'; trackId: string }
  | { name: 'save_track'; trackId: string; saved: boolean }
  | { name: 'select_next_action'; trackId: string }
  | { name: 'view_route' }
  | { name: 'view_results' };

export function trackEvent(event: AnalyticsEvent): void {
  if (process.env.NODE_ENV === 'development' && typeof console !== 'undefined') {
    console.debug('[analytics]', event.name, event);
  }
}
