import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, before } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function memoryStore() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

const local = memoryStore();
const savedRuns = [];
const analytics = [];
global.window = {
  localStorage: local,
  MLMA_TRACK_MODULES: {},
};
global.localStorage = local;
global.MLMA = {
  RUNTIME_KEY: 'mlma.runtime.v1',
  trackEvent: function (name, data) {
    analytics.push({ name: name, data: data });
  },
  getRepo: function () {
    return {
      saveRun: function (session, trackId, runtime) {
        savedRuns.push({ session: session, trackId: trackId, runtime: JSON.parse(JSON.stringify(runtime)) });
      },
    };
  },
  readMembersSession: function () {
    return { loggedIn: false };
  },
  derivePassport: function () {
    return { trackId: 'OTHER' };
  },
  nextBestAction: function () {
    return { kind: 'open_track', track: { trackId: 'A3-002' } };
  },
};
global.window.MLMA = global.MLMA;

require('../src/tracks/a2-008.module.js');

const trackModule = (global.window.MLMA_TRACK_MODULES || global.MLMA_TRACK_MODULES)['A2-008'];
const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(offsetDays) {
  const d = new Date(Date.now() + offsetDays * DAY_MS);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function fillFive(state, extras) {
  const base = [
    ['коллега из прошлого проекта', 'недавно спрашивал про рабочий ритм'],
    ['знакомая из бегового клуба', 'сама заговорила о смене деятельности'],
    ['сосед по дачному товариществу', 'договорились пересечься на выходных'],
    ['бывший одногруппник', 'написал после общей встречи выпускников'],
    ['наставница с прошлой работы', 'попросила коротко рассказать, чем занят'],
  ].concat(extras || []);
  while (state.moduleData.candidates.length < base.length) {
    trackModule.handleAction('add');
    state = trackModule.getState();
  }
  base.forEach(function (row, index) {
    state.moduleData.candidates[index].descriptor = row[0];
    state.moduleData.candidates[index].reasonText = row[1];
  });
  trackModule.saveState(state, false);
  return trackModule.getState();
}

function scoreAll(state, mode) {
  state.moduleData.candidates.forEach(function (candidate, index) {
    if (mode === 'weak' && index >= 3) {
      candidate.scores = { relationship: '0', reason: '0', respect: '0', clarity: '0' };
    } else if (mode === 'partial') {
      candidate.scores = { relationship: '2', reason: '1', respect: '1', clarity: '1' };
    } else {
      candidate.scores = { relationship: '2', reason: '2', respect: '2', clarity: '2' };
    }
  });
  trackModule.saveState(state, false);
  return trackModule.getState();
}

function planAll(state, firstAction) {
  state.moduleData.shortlistIds.forEach(function (id, index) {
    state.moduleData.plan[id] = {
      action: index === 0 ? firstAction : 'message',
      channel: index === 0 && firstAction === 'referral_call' ? 'phone' : 'telegram',
      date: isoDate(index === 0 ? 1 : 3),
    };
  });
  trackModule.saveState(state, false);
  return trackModule.getState();
}

describe('A2-008 исполняемый трек', () => {
  before(() => {
    trackModule.reset();
    savedRuns.length = 0;
    analytics.length = 0;
  });

  it('полный путь, приватность и ветки', () => {
    let assertions = 0;
    function check(value, message) {
      assert.ok(value, message);
      assertions += 1;
    }

    check(!!trackModule, 'модуль зарегистрирован по trackId');
    check(
      trackModule.passport.businessFunction.id === 'FUN-006' &&
        trackModule.passport.leadingMechanic.id === 'MEC-014' &&
        trackModule.passport.dominantGenre === 'GEN-011' &&
        trackModule.passport.topology === 'TOP-002' &&
        trackModule.passport.scenarioPattern.id === 'SCN-122' &&
        trackModule.passport.artifact.id === 'ART-006' &&
        trackModule.passport.evidence.id === 'EVD-003',
      'паспорт FUN-006 MEC-014 GEN-011 TOP-002 SCN-122 ART-006 EVD-003',
    );

    check(trackModule.hasPrivateData('коллега ivan@mail.test') === true, 'email блокируется');
    check(trackModule.hasPrivateData('+7 999 123-45-67 коллега') === true, 'телефон блокируется');
    check(trackModule.hasPrivateData('улица Ленина дом 10') === true, 'адрес блокируется');
    check(trackModule.hasPressure('гарантирую доход без риска') === true, 'давление блокируется');

    let state = trackModule.reset();
    state = fillFive(state);
    state.moduleData.candidates[0].reasonText = 'написать на ivan@mail.test';
    trackModule.saveState(state, false);
    check(!!trackModule.validateCandidateStage(trackModule.getState()), 'PII на шаге кандидатов');

    state = trackModule.reset();
    state = fillFive(state);
    trackModule.handleAction('candidates-next');
    state = scoreAll(trackModule.getState(), 'weak');
    const weak = trackModule.buildShortlist(state);
    check(!!weak.error && weak.ids.length === 0, 'меньше пяти уместных → A2-010');

    state = trackModule.reset();
    state = fillFive(state);
    trackModule.handleAction('candidates-next');
    state = scoreAll(trackModule.getState(), 'partial');
    const partial = trackModule.buildShortlist(state);
    check(!partial.error && partial.ids.length === 5, 'пять человек с «Частично» собираются в shortlist');

    const stored = JSON.parse(local.getItem('mlma.runtime.v1'));
    stored['A2-008'].moduleData.version = '1.0.0';
    stored['A2-008'].trackVersion = '1.0.0';
    local.setItem('mlma.runtime.v1', JSON.stringify(stored));
    const migrated = trackModule.getState();
    check(migrated.moduleData.candidates[0].descriptor === 'коллега из прошлого проекта', 'патч версии не стирает черновик');

    const moduleSrc = fs.readFileSync(path.join(__dirname, '../src/tracks/a2-008.module.js'), 'utf8');
    check(
      moduleSrc.includes('flex-direction:column') &&
        moduleSrc.includes('.a2008-progress b{position:relative;z-index:1') &&
        !moduleSrc.includes('__MLMA_UI_SPLIT__'),
      'подписи шагов ниже линии прогресса, модуль не режется маркером T123',
    );

    state = trackModule.reset();
    state = fillFive(state);
    trackModule.handleAction('candidates-next');
    state = scoreAll(trackModule.getState(), 'strong');
    trackModule.handleAction('rank-next');
    state = trackModule.getState();
    check(state.moduleData.shortlistIds.length === 5, 'shortlist из пяти');

    state.moduleData.plan[state.moduleData.shortlistIds[0]].date = isoDate(20);
    trackModule.saveState(state, false);
    check(!!trackModule.validatePlan(trackModule.getState()), 'дата позже семи дней отклоняется');

    state = planAll(trackModule.getState(), 'message');
    trackModule.handleAction('plan-next');
    state = trackModule.getState();
    trackModule.handleAction('complete');
    check(!!trackModule.getState().moduleData.message, 'без трёх подтверждений план не принимается');
    state = trackModule.getState();
    state.moduleData.confirmations = { noWorthScore: true, noPressure: true, rightToDecline: true };
    trackModule.saveState(state, false);
    savedRuns.length = 0;
    analytics.length = 0;
    trackModule.handleAction('complete');
    state = trackModule.getState();
    check(state.status === 'complete' && state.moduleData.nextTrackId === 'A3-002', 'обычное завершение → A3-002');
    check(state.artifact.indexOf('коллега из прошлого проекта') !== -1, 'локальный артефакт «Мои пять»');

    const lastRun = savedRuns[savedRuns.length - 1];
    const runText = JSON.stringify(lastRun);
    check(
      lastRun &&
        lastRun.trackId === 'A2-008' &&
        !/коллега|бегового|ivan@|descriptor|reasonText|Мои пять/.test(runText),
      'на сервер уходят только метаданные',
    );

    const payload = JSON.stringify(trackModule.safeAnalyticsPayload({ selectedActionTypes: 'message' }));
    check(!/коллега из прошлого|бегового клуба/.test(payload), 'аналитика без описаний людей');

    state = trackModule.reset();
    state = fillFive(state);
    trackModule.handleAction('candidates-next');
    state = scoreAll(trackModule.getState(), 'strong');
    trackModule.handleAction('rank-next');
    state = planAll(trackModule.getState(), 'referral_call');
    state.moduleData.confirmations = { noWorthScore: true, noPressure: true, rightToDecline: true };
    trackModule.saveState(state, false);
    trackModule.handleAction('complete');
    check(trackModule.getState().moduleData.nextTrackId === 'A3-003', 'звонок по рекомендации → A3-003');

    const generic = fs.readFileSync(path.join(__dirname, '../src/ui.js'), 'utf8');
    check(
      generic.includes('MLMA_TRACK_MODULES') && !/if \(track\.trackId === 'A2-008'\)/.test(generic),
      'универсальный hook без условий на trackId',
    );

    console.log('A2-008: ' + assertions + ' assertions passed; full path and privacy gate verified.');
    assert.equal(assertions, 20);
  });
});
