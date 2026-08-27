# Как подключить первый настоящий трек

Оболочка для этого уже готова. Ни одна страница, ссылка или карточка вручную не
создаётся: каталог и навигация строятся из JSON по Track ID.

Пример ниже — для `A3-002`. Для любого другого трека всё то же самое.

## Шаг 1. Создать файл содержания

`src/data/content/A3-002.json` по контракту
`src/data/schemas/future-track-content.schema.json`:

```json
{
  "trackId": "A3-002",
  "version": "1.0.0",
  "status": "draft",
  "estimatedMinutes": null,
  "steps": [
    { "stepId": "s1", "type": "read", "title": "…" },
    { "stepId": "s2", "type": "do", "title": "…" },
    { "stepId": "s3", "type": "upload", "title": "…" }
  ],
  "completionRule": {
    "requiresAction": true,
    "requiresEvidence": true,
    "requiresNextStep": true
  }
}
```

`estimatedMinutes` заполняйте только если длительность действительно измерена.
`null` честнее выдуманных «10 минут»: интерфейс просто не покажет это поле.

## Шаг 2. Добавить загрузчик содержания

В `src/server/catalog.ts` рядом с загрузкой реестра:

```ts
import { futureTrackContentSchema } from '@/domain/schemas';

export function getTrackContent(trackId: string): FutureTrackContent | null {
  // читать из src/data/content, валидировать схемой, кэшировать в модуле
}
```

Валидация обязательна: битый файл должен ронять сборку, а не показываться
пользователю наполовину.

## Шаг 3. Передать шаги в оболочку

В `src/app/track/[trackId]/page.tsx` заменить одну строку:

```diff
-  const steps: TrackStep[] = [];
+  const steps: TrackStep[] = getTrackContent(track.trackId)?.steps ?? [];
```

Больше в этом файле ничего менять не нужно. `TrackStepNavigation` и
`TrackStepViewport` сами перестанут показывать blueprint и отрисуют шаги.

## Шаг 4. Перевести статусы в каталоге

В `src/data/tracks.catalog.json` у записи `A3-002`:

```diff
-  "publicationStatus": "planned",
-  "contentStatus": "metadata_only",
+  "publicationStatus": "published",
+  "contentStatus": "published",
```

С этого момента:

- трек появляется в production-каталоге и в разделе A3;
- на карточке статус меняется на «Доступен»;
- на странице трека появляется кнопка «Начать трек»;
- трек становится валидным продолжением для всех, кто на него ссылается;
- он может стать «следующим действием» на `/my`.

Если содержание ещё не готово, но карточку нужно открыть, поставьте
`publicationStatus: "published"` и оставьте `contentStatus: "metadata_only"`.
Оболочка покажет статус «Открыт, содержание готовится» и не предложит начать.

## Шаг 5. Проверить

```bash
pnpm test          # целостность каталога, граф, санитайзер
pnpm build
pnpm e2e
```

Тест `honest-states.test.ts` содержит проверку «ни один трек не заявляет готовое
содержание». После публикации первого настоящего трека её нужно переписать под
новое ожидание — это намеренный контрольный рубеж, а не помеха.

## Чего делать не нужно

- создавать страницу или маршрут для трека;
- добавлять ссылку в навигацию, каталог или раздел;
- трогать компоненты карточек и Track Player;
- писать что-либо про этот трек в коде экранов.
