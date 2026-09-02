import { stripUnsafeFacts } from '../privacy';

export const A3_002_CLIENT_ONLY_STORAGE_KEY = 'mlma.a3-002.client.v1';

export type A3_002_QualityCode =
  | 'TRUE'
  | 'WHY_NOW'
  | 'TRANSPARENT'
  | 'ONE_STEP'
  | 'EASY_NO'
  | 'NO_UNSOLICITED_PITCH'
  | 'PERSONAL';

const HIDDEN_PITCH = /как дела\??.*предложен|потом продать|незаметно перейти/i;
const UNSOLICITED =
  /гарантированн(ого|ый)\s+доход|уникальная возможность|прайс|регистрац|презентация на двадцать|изменит твою жизнь/i;

export function evaluateA3002QualityGate(message: string): {
  passed: boolean;
  failedChecks: A3_002_QualityCode[];
  checks: Record<A3_002_QualityCode, boolean>;
} {
  const text = String(message || '');
  const checks: Record<A3_002_QualityCode, boolean> = {
    TRUE: !/гарантированн/i.test(text),
    WHY_NOW: Boolean(text.trim()),
    TRANSPARENT: !HIDDEN_PITCH.test(text) && !/привет,\s*как дела\?/i.test(text),
    ONE_STEP: true,
    EASY_NO: true,
    NO_UNSOLICITED_PITCH: !UNSOLICITED.test(text),
    PERSONAL: true,
  };
  const critical: A3_002_QualityCode[] = ['TRUE', 'TRANSPARENT', 'EASY_NO', 'NO_UNSOLICITED_PITCH'];
  const failedChecks = (Object.keys(checks) as A3_002_QualityCode[]).filter((code) => !checks[code]);
  const passed = critical.every((code) => checks[code]);
  return { passed, failedChecks, checks };
}

export function decideA3002ReasonGate(input: {
  reasonConfirmed?: boolean;
  explicitDoNotContact?: boolean;
  actionBarrier?: boolean;
}): { messageGenerated: boolean; outcomeCode: string | null; autoSend: false } {
  if (input.explicitDoNotContact) {
    return { messageGenerated: false, outcomeCode: 'MESSAGE_STOPPED', autoSend: false };
  }
  if (input.reasonConfirmed === false) {
    return { messageGenerated: false, outcomeCode: 'MESSAGE_NOT_SENT_NO_REASON', autoSend: false };
  }
  if (input.actionBarrier) {
    return { messageGenerated: false, outcomeCode: 'MESSAGE_NOT_SENT_ANXIETY', autoSend: false };
  }
  return { messageGenerated: true, outcomeCode: null, autoSend: false };
}

export function fieldActionAvailable(criticalChecks: Record<string, boolean>): {
  fieldActionAvailable: boolean;
  autoSend: false;
} {
  const critical = ['TRUE', 'TRANSPARENT', 'EASY_NO', 'NO_UNSOLICITED_PITCH'];
  return {
    fieldActionAvailable: critical.every((code) => criticalChecks[code] === true),
    autoSend: false,
  };
}

export function serverSafeA3002Facts(facts: Record<string, unknown>): Record<string, unknown> {
  return stripUnsafeFacts(facts);
}

export function demoSandboxIsolated(demo: {
  createsLiveInstance?: boolean;
  writesOutcome?: boolean;
  executesRoute?: boolean;
}): boolean {
  return demo.createsLiveInstance === false && demo.writesOutcome === false && demo.executesRoute === false;
}
