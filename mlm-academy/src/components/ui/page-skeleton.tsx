/**
 * Skeleton повторяет реальную геометрию экрана, а не крутит спиннер.
 *
 * Loading-границы намеренно стоят только на сегментах, которые не вызывают
 * notFound() и редиректы: Suspense на верхнем уровне зафиксировал бы статус 200
 * ещё до того, как страница решит вернуть 404 или 308.
 */
export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="sr-only">Загружаем страницу</p>
      <div className="border-b-2 border-ink">
        <div className="container-grid py-10 lg:py-14">
          <div className="h-[30px] w-[180px] border border-ink bg-surface" />
          <div className="mt-6 h-[52px] w-full max-w-[620px] bg-surface" />
          <div className="mt-4 h-[22px] w-full max-w-[440px] bg-surface" />
        </div>
      </div>
      <div className="container-grid grid gap-4 py-10 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <div key={index} className="card h-[280px] bg-surface" />
        ))}
      </div>
    </div>
  );
}
