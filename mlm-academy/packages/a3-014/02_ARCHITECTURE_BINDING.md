# Архитектурная привязка A3-014

## Каноническая сущность

- ID: A3-014
- entityType: REMEDIATION
- surface: ON_DEMAND_TRACK
- canonical URL: /track?id=a3-014
- content: server-only, version 0.1.0, REVIEW

## Вход

Существующий RR2-016:

`A3-002 + MESSAGE_NOT_SENT_ANXIETY + message.status=BLOCKED_ANXIETY → A3-014`.

## Полный граф v3

- incoming design: 0;
- incoming effective: 1;
- outgoing design/effective: 2/2;
- TR-095 → A3-013;
- TR-096 → A6-020;
- исходящих structured rules до этого пакета: 0.

## Overlay пакета

Пять RR3-правил остаются PILOT_DRAFT_TO_TEST. Они не переписывают full graph v3 и соседние страницы. Installer регистрирует правила как overlay пакета; visibility и execution по-прежнему зависят от policy, entitlement и paid-navigation flag.

## Важная граница

Порядок производства A3-016 → A3-014 → A3-005 не является пользовательской стрелкой. Cursor не должен создавать переход A3-014→A3-005 только потому, что A3-005 делается следующим.
