# Архитектурная привязка A3-008 к full graph v3

## Роль узла

`A3-008` — `SYSTEM_ACTION / SYSTEM_UI`. Он не является корнем графа и не имеет внешнего entry rule.

## Входящие вызовы, которые уже имеют RouteRule

| Rule | Источник | Outcome источника | Действие |
|---|---|---|---|
| RR2-014 | A3-002 | MESSAGE_SENT | открыть A3-008 в том же source instance context |
| RR2-017 | A2-013 | REFERRAL_REQUEST_SENT | открыть A3-008 без предвыбранного результата |
| RR2-020 | A3-003 | CALL_COMPLETED | открыть A3-008 без предвыбранного результата |

Эти правила имеют destinationType `SYSTEM_ACTION`, поэтому они не входят в track-to-track `connectionIndex.incomingRouteRuleIds`. Пакет хранит их отдельно в `inboundSystemActionInvocationRules`.

## Входящие design connections

Их шесть: A3-002, A3-003, alias A3-004→A3-003, A3-005, A4-016 и alias A6-029→A3-008. Это направления карты, но без отдельного исполняемого RouteRule они остаются закрытыми слотами. Наличие стрелки не даёт права открыть форму.

## Исходящие правила

- RR2-026 → A3-010;
- RR2-027 → A5-010;
- RR2-028 → A5-014;
- RR2-029 → WAIT_UNTIL;
- RR2-030 → A3-003;
- RR2-031 → DONE.

Track-to-track connections образуют только четыре правила. WAIT_UNTIL и DONE не создают edge.

## Закрытые исходящие слоты

TR-083 → A3-013 и TR-084 → A6-010 остаются `LOCKED_NEXT_ACTION_SLOT`. Они не становятся кнопками, пока не появится проверенный структурированный RouteRule.

## Контрольные числа

- incoming design/effective: 6 / 6;
- outgoing design/effective: 2 / 6;
- outgoing RouteRule: 6;
- inbound system-action invocation Rule: 3;
- external entry: 0;
- executable legacy archive edge: 0.

Установка не меняет `track_connections`, full graph v3, соседние страницы и статусы правил.
