/** Skeleton повторяет реальную геометрию экрана, а не крутит спиннер. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="sr-only">Загружаем страницу</p>
      <div className="border-b-2 border-ink">
        <div className="container-grid py-10 lg:py-14">
          <div className="h-[30px] w-[180px] border border-ink bg-surface" />
          <div className="mt-6 h-[56px] w-full max-w-[640px] bg-surface" />
          <div className="mt-4 h-[24px] w-full max-w-[460px] bg-surface" />
        </div>
      </div>
      <div className="container-grid grid gap-4 py-10 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="card h-[320px] bg-surface" />
        ))}
      </div>
    </div>
  );
}
