# Архитектурная привязка A3-016

## Входы

Исполняемые входы два:

- RR2-009: A2-008 / NEXT_NEEDS_REASON → A3-016;
- RR2-015: A3-002 / MESSAGE_NOT_SENT_NO_REASON → A3-016.

Design-направления из A3-013, A3-015 и A6-027 остаются закрытыми. A6-027 — embedded component A3-016, а не самостоятельная страница.

## Выходы

- RR2-012: REASON_FOUND / real_reason=true → A3-002;
- RR2-013: NO_REASON / real_reason=false → WAIT_UNTIL;
- RR3-A3-016-STOP: CONTACT_STOPPED / contact_allowed=false → DONE.

Последнее правило — терминальный overlay пакета. Оно не создаёт track_connection и не изменяет full graph v3.

TR-099→A4-001 и TR-100→A3-017 остаются LOCKED_NEXT_ACTION_SLOT.

## Контрольные числа full graph v3

- incoming design/effective: 4 / 5;
- outgoing design/effective: 2 / 3;
- incoming RouteRule: 2;
- outgoing base RouteRule: 2;
- external entry: 0;
- package terminal overlay: 1;
- executable legacy edge: 0.

AI search dataset ранжирует публичную карточку, но не создаёт live instance и не является скрытым external entry rule.
