# Архитектурная привязка A3-005

- ID: A3-005
- entityType: TRACK
- surface: PUBLIC_TRACK
- canonical URL: /track?id=a3-005
- content: server-only 0.1.0 REVIEW

## Граф v3

- incoming design/effective: 2/3;
- outgoing design/effective: 2/4;
- вход RR2-008: A2-008 + NEXT_SCHEDULE + contact.next_action=SCHEDULE_TALK;
- RR2-023: CONFIRMED → A3-010;
- RR2-024: LATER → WAIT_UNTIL;
- RR2-025: DECLINED → A5-014;
- package overlay: CLOSED_NO_FOLLOWUP → DONE.

TR-077→A3-008 и TR-078→A3-013 остаются LOCKED_NEXT_ACTION_SLOT. A6-030 остаётся shared reference с canonicalId=A3-001. Установка пакета не переписывает full graph, соседние страницы или канонические связи.
