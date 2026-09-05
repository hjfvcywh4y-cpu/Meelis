import { OPERATORS, type OperatorCode } from './types';

const FIELD_PATH = /^[a-z][a-z0-9_.]*$/;

export function isAllowedFieldPath(field: string): boolean {
  return FIELD_PATH.test(field);
}

export function isAllowedOperator(operator: string): operator is OperatorCode {
  return (OPERATORS as readonly string[]).includes(operator);
}

function readPath(facts: Record<string, unknown>, field: string): unknown {
  if (Object.prototype.hasOwnProperty.call(facts, field)) return facts[field];
  const parts = field.split('.');
  let current: unknown = facts;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left === 'boolean') {
    if (right === left) return true;
    if (right === String(left) || right === (left ? 1 : 0)) return true;
  }
  if (typeof right === 'boolean') {
    if (left === String(right) || left === (right ? 1 : 0)) return true;
  }
  if (left == null && (right === '' || right == null)) return true;
  return String(left) === String(right);
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

/**
 * Безопасный evaluator. Никакого eval, Function() или произвольных путей.
 */
export function evaluateCondition(
  facts: Record<string, unknown>,
  field: string,
  operator: string,
  expected: unknown,
): boolean {
  if (!isAllowedFieldPath(field) || !isAllowedOperator(operator)) return false;
  const actual = readPath(facts, field);

  switch (operator) {
    case 'EXISTS':
      return actual !== undefined && actual !== null && actual !== '';
    case '=':
      return sameValue(actual, expected);
    case '!=':
      return !sameValue(actual, expected);
    case 'IN':
      return asList(expected).some((item) => sameValue(actual, item));
    case 'NOT_IN':
      return !asList(expected).some((item) => sameValue(actual, item));
    case '>':
    case '>=':
    case '<':
    case '<=': {
      const left = asNumber(actual);
      const right = asNumber(expected);
      if (left == null || right == null) return false;
      if (operator === '>') return left > right;
      if (operator === '>=') return left >= right;
      if (operator === '<') return left < right;
      return left <= right;
    }
    default:
      return false;
  }
}
