(function (root) {
  'use strict';

  var TRACK_ID = 'A2-008';
  var VERSION = '1.0.2';
  var D = root.MLMA || {};
  var STORAGE_KEY = D.RUNTIME_KEY || 'mlma.runtime.v1';
  var MAX_CANDIDATES = 10;
  var MIN_CANDIDATES = 5;
  var DAY_MS = 24 * 60 * 60 * 1000;
  var lastContext = null;
  var uid = 0;

  var passport = {
    trackId: TRACK_ID,
    version: VERSION,
    type: 'track',
    status: 'complete',
    title: 'Выбрать пять людей для следующего действия',
    trigger: 'Я бесконечно составляю списки и никому не пишу',
    inputState: 'Есть намерение без действия',
    targetState: 'Выбраны пять уместных контактов и по каждому определён следующий шаг на ближайшие семь дней',
    mainTask: 'Составить shortlist из пяти уместных контактов и календарный план первых действий',
    businessFunction: { id: 'FUN-006', name: 'Подготовка к действию' },
    leadingMechanic: { id: 'MEC-014', name: 'Ранжирование' },
    supportingMechanic: { id: 'MEC-063', name: 'Заполнение шаблона' },
    dominantGenre: 'GEN-011',
    genreLabel: 'Профессиональная практика',
    genrePattern: 'Матрица → приоритет → действие',
    genreAccent: 'practice',
    tone: ['TON-005', 'TON-006'],
    topology: 'TOP-002',
    scenarioPattern: { id: 'SCN-122', name: 'Недельный спринт' },
    artifact: { id: 'ART-006', name: 'План действий «Мои пять»' },
    evidence: { id: 'EVD-003', name: 'Заполненная форма' },
    completionCriteria: { technical: 'CMP-002', quality: 'CMP-011', business: null },
    container: 'CNT-001',
    nextTrackIds: ['A3-002', 'A3-003'],
    correctiveTrackId: 'A2-010',
    routeSegment: 'activation.first-contact.preparation',
    companyMarketingPlanSegment: null,
    needsContent: false,
    executable: true,
    class: 'track',
    privacy: {
      artifactStorage: 'local_only',
      serverPayload: 'metadata_only',
      forbiddenInput: ['full_name', 'phone', 'email', 'address', 'income', 'solvency_score'],
    },
    source: {
      book: 'Иван Рыбкин. Система продаж страховых продуктов',
      printedPages: '236–238',
      adaptation: 'Сохранены письменный рабочий список и план контактов; исключены оценка платёжеспособности, давление и лишние персональные данные.',
    },
    analyticsEvents: ['track_started', 'step_completed', 'artifact_created', 'track_completed', 'next_track_opened'],
  };

  var ACTIONS = [
    ['', 'Выберите действие'],
    ['message', 'Написать короткое личное сообщение'],
    ['voice_note', 'Отправить голосовое сообщение'],
    ['call', 'Позвонить и договориться о разговоре'],
    ['referral_call', 'Позвонить по рекомендации'],
    ['invite_conversation', 'Пригласить на короткий разговор'],
    ['share_material', 'Поделиться уместным материалом'],
    ['other', 'Другое уважительное действие'],
  ];
  var CHANNELS = [
    ['', 'Выберите канал'],
    ['telegram', 'Telegram'],
    ['whatsapp', 'WhatsApp'],
    ['phone', 'Телефон'],
    ['social', 'Социальная сеть'],
    ['in_person', 'Лично'],
    ['other', 'Другой канал'],
  ];
  var SCORE_FIELDS = [
    ['relationship', 'Есть реальный контекст', 'Вы не берёте человека из воздуха: есть знакомство, рекомендация или понятный повод.'],
    ['reason', 'Есть причина действовать сейчас', 'Повод существует в реальности, а не придуман ради продажи.'],
    ['respect', 'Контакт добровольный', 'Человеку легко отказаться; нет давления, маскировки и обещаний.'],
    ['clarity', 'Первый шаг понятен', 'Вы можете назвать одно конкретное действие на ближайшие семь дней.'],
  ];

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function dateValue(date) {
    var d;
    if (date instanceof Date) d = new Date(date.getTime());
    else if (typeof date === 'string' && date) d = new Date(date + 'T12:00:00');
    else d = new Date();
    if (Number.isNaN(d.getTime())) d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function minDate() {
    return dateValue(new Date());
  }

  function maxDate() {
    return dateValue(new Date(Date.now() + 7 * DAY_MS));
  }

  function humanDate(value) {
    if (!value) return 'дата не выбрана';
    try {
      return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(value + 'T12:00:00'));
    } catch (err) {
      return value;
    }
  }

  function labelFor(list, value) {
    for (var i = 0; i < list.length; i += 1) if (list[i][0] === value) return list[i][1];
    return value || 'не выбрано';
  }

  function newCandidate() {
    uid += 1;
    return {
      id: 'c_' + Date.now().toString(36) + '_' + uid,
      descriptor: '',
      reasonText: '',
      scores: { relationship: '', reason: '', respect: '', clarity: '' },
    };
  }

  function defaultModuleData() {
    var candidates = [];
    for (var i = 0; i < MIN_CANDIDATES; i += 1) candidates.push(newCandidate());
    return {
      version: VERSION,
      stage: 1,
      candidates: candidates,
      shortlistIds: [],
      plan: {},
      confirmations: { noWorthScore: false, noPressure: false, rightToDecline: false },
      message: '',
      nextTrackId: '',
      completedArtifact: '',
    };
  }

  function readAll() {
    try {
      var raw = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      return {};
    }
  }

  function writeAll(all) {
    try {
      if (root.localStorage) root.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (err) {
      /* A full browser storage must not break the track. */
    }
  }

  function normalizeRuntime(runtime) {
    runtime = runtime && typeof runtime === 'object' ? runtime : {};
    runtime.trackId = TRACK_ID;
    runtime.status = runtime.status || 'preview';
    runtime.step = runtime.step || 'preview';
    runtime.attempts = Number(runtime.attempts || 0);
    runtime.branch = runtime.branch || '';
    runtime.startedAt = runtime.startedAt || nowIso();
    runtime.updatedAt = runtime.updatedAt || nowIso();
    runtime.trackVersion = VERSION;
    if (!runtime.moduleData || typeof runtime.moduleData !== 'object') runtime.moduleData = defaultModuleData();
    runtime.moduleData.version = VERSION;
    if (!Array.isArray(runtime.moduleData.candidates)) runtime.moduleData.candidates = defaultModuleData().candidates;
    while (runtime.moduleData.candidates.length < MIN_CANDIDATES) runtime.moduleData.candidates.push(newCandidate());
    runtime.moduleData.plan = runtime.moduleData.plan || {};
    runtime.moduleData.confirmations = Object.assign({ noWorthScore: false, noPressure: false, rightToDecline: false }, runtime.moduleData.confirmations || {});
    return runtime;
  }

  function getState() {
    var all = readAll();
    var state = normalizeRuntime(all[TRACK_ID]);
    all[TRACK_ID] = state;
    writeAll(all);
    return state;
  }

  function persistMeta(state) {
    if (!D.getRepo) return;
    try {
      var repo = D.getRepo();
      var session = D.readMembersSession ? D.readMembersSession() : { loggedIn: false };
      if (repo && repo.saveRun) {
        repo.saveRun(session, TRACK_ID, {
          status: state.status,
          step: state.step,
          trackVersion: VERSION,
          startedAt: state.startedAt || '',
          completedAt: state.status === 'complete' ? state.completedAt || state.updatedAt || '' : '',
          branch: state.branch || '',
          nextTrackId: (state.moduleData && state.moduleData.nextTrackId) || '',
        });
      }
    } catch (err) {
      /* Local completion remains available if the network is offline. */
    }
  }

  function saveState(state, syncMeta) {
    state = normalizeRuntime(state);
    state.updatedAt = nowIso();
    var all = readAll();
    all[TRACK_ID] = state;
    writeAll(all);
    if (syncMeta) persistMeta(state);
    return state;
  }

  function safeAnalyticsPayload(extra) {
    var state = getState();
    var data = {
      trackId: TRACK_ID,
      trackVersion: VERSION,
      stage: state.moduleData.stage,
      candidateCount: filledCandidates(state).length,
      shortlistCount: state.moduleData.shortlistIds.length,
      branch: state.branch || '',
    };
    Object.keys(extra || {}).forEach(function (key) { data[key] = extra[key]; });
    return data;
  }

  function emit(name, extra) {
    var data = safeAnalyticsPayload(extra || {});
    if (D.trackEvent && passport.analyticsEvents.indexOf(name) !== -1) D.trackEvent(name, data);
    try {
      root.dispatchEvent(new CustomEvent('mlma:track-event', { detail: { name: name, data: data } }));
    } catch (err) {
      /* CustomEvent is optional in older browsers. */
    }
  }

  function candidateById(state, id) {
    var list = state.moduleData.candidates;
    for (var i = 0; i < list.length; i += 1) if (list[i].id === id) return list[i];
    return null;
  }

  function filledCandidates(state) {
    return state.moduleData.candidates.filter(function (candidate) {
      return String(candidate.descriptor || '').trim() || String(candidate.reasonText || '').trim();
    });
  }

  function hasPrivateData(text) {
    text = String(text || '');
    var email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text);
    var phone = /(?:\+?\d[\s().-]*){7,}/.test(text);
    var address = /(?:ул(?:ица)?|дом|квартир|адрес).{0,24}\d/iu.test(text);
    return email || phone || address;
  }

  function hasPressure(text) {
    return /(гарантир(?:ую|ованный)|точно заработа|без риска|последний шанс|обязан|должен купить|лёгкие деньги|легкие деньги)/iu.test(String(text || ''));
  }

  function validationError(text) {
    return '<div class="a2008-alert a2008-alert-error" role="alert"><strong>Нужно поправить.</strong> ' + esc(text) + '</div>';
  }

  function stageName(stage) {
    return ['Кандидаты', 'Уместность', 'План', 'Артефакт'][Math.max(0, Math.min(3, stage - 1))];
  }

  function progress(stage, complete) {
    var labels = ['Кандидаты', 'Уместность', 'План', 'Артефакт'];
    var html = '<ol class="a2008-progress" aria-label="Прогресс трека">';
    for (var i = 0; i < labels.length; i += 1) {
      var number = i + 1;
      var cls = complete || number < stage ? ' is-done' : number === stage ? ' is-current' : '';
      html += '<li class="' + cls.trim() + '"><span>' + (complete || number < stage ? '✓' : number) + '</span><b>' + labels[i] + '</b></li>';
    }
    return html + '</ol>';
  }

  function messageHtml(state) {
    var message = state.moduleData.message;
    return message ? validationError(message) : '';
  }

  function inputRow(candidate, index, canRemove) {
    return (
      '<article class="a2008-candidate" data-candidate-id="' + esc(candidate.id) + '">' +
      '<div class="a2008-candidate-head"><span class="a2008-index">' + (index + 1) + '</span><strong>Описание без имени</strong>' +
      (canRemove ? '<button type="button" class="a2008-link" data-a2008-action="remove" data-id="' + esc(candidate.id) + '">Убрать</button>' : '') +
      '</div><div class="a2008-two">' +
      '<label><span>Как вы знаете человека</span><input class="mlma-field" maxlength="80" data-candidate-field="descriptor" data-id="' + esc(candidate.id) + '" value="' + esc(candidate.descriptor) + '" placeholder="Например: коллега из прошлого проекта"></label>' +
      '<label><span>Почему контакт уместен сейчас</span><input class="mlma-field" maxlength="140" data-candidate-field="reasonText" data-id="' + esc(candidate.id) + '" value="' + esc(candidate.reasonText) + '" placeholder="Например: недавно спрашивал о дополнительном доходе"></label>' +
      '</div></article>'
    );
  }

  function renderCandidates(state) {
    var list = state.moduleData.candidates;
    var rows = '';
    for (var i = 0; i < list.length; i += 1) rows += inputRow(list[i], i, list.length > MIN_CANDIDATES);
    return (
      '<div class="a2008-stage"><div class="a2008-stage-head"><span class="mlma-eyebrow">Шаг 1 из 4</span><h2>Соберите 5–10 вариантов</h2>' +
      '<p>Записывайте не ФИО, а контекст: «коллега из проекта», «знакомая из бегового клуба». Так план останется рабочим и не превратится в базу чужих данных.</p></div>' +
      '<div class="a2008-alert"><strong>Мы не оцениваем людей.</strong> На следующем шаге вы оцените только уместность вашего первого действия — без баллов за доход, статус или «прибыльность» человека.</div>' +
      messageHtml(state) + '<div class="a2008-stack">' + rows + '</div>' +
      '<div class="a2008-actions"><button type="button" class="mlma-btn" data-a2008-action="add"' + (list.length >= MAX_CANDIDATES ? ' disabled' : '') + '>+ Добавить вариант</button>' +
      '<button type="button" class="mlma-btn mlma-btn-primary" data-a2008-action="candidates-next">Проверить уместность</button></div>' +
      '<p class="a2008-footnote">Не вводите имена, телефоны, email, адреса и сведения о доходах. Черновик остаётся только в этом браузере.</p></div>'
    );
  }

  function scoreSelect(candidate, field) {
    var value = candidate.scores && candidate.scores[field] != null ? String(candidate.scores[field]) : '';
    var options = [
      ['', 'Не оценено'],
      ['0', 'Нет'],
      ['1', 'Частично'],
      ['2', 'Да'],
    ];
    var html = '<select class="mlma-field" data-score-field="' + esc(field) + '" data-id="' + esc(candidate.id) + '">';
    for (var i = 0; i < options.length; i += 1) html += '<option value="' + options[i][0] + '"' + (value === options[i][0] ? ' selected' : '') + '>' + options[i][1] + '</option>';
    return html + '</select>';
  }

  function renderRank(state) {
    var list = filledCandidates(state);
    var rows = '';
    for (var i = 0; i < list.length; i += 1) {
      var c = list[i];
      rows += '<article class="a2008-rank-card"><div><span class="a2008-index">' + (i + 1) + '</span><strong>' + esc(c.descriptor) + '</strong><p>' + esc(c.reasonText) + '</p></div><div class="a2008-score-grid">';
      for (var f = 0; f < SCORE_FIELDS.length; f += 1) {
        rows += '<label><span>' + esc(SCORE_FIELDS[f][1]) + '</span><small>' + esc(SCORE_FIELDS[f][2]) + '</small>' + scoreSelect(c, SCORE_FIELDS[f][0]) + '</label>';
      }
      rows += '</div></article>';
    }
    var fitCount = list.filter(isActionFit).length;
    var fitHint = '<p class="a2008-footnote">Уместных для первого действия сейчас: <strong>' + fitCount + ' из ' + list.length + '</strong>. Нужны пять. «Частично» считается: это честная оценка, а не отсев.</p>';
    return (
      '<div class="a2008-stage"><div class="a2008-stage-head"><span class="mlma-eyebrow">Шаг 2 из 4</span><h2>Оцените уместность действия</h2>' +
      '<p>Не «насколько ценен человек», а «есть ли у меня честный и понятный следующий шаг».</p></div>' +
      messageHtml(state) +
      fitHint +
      (state.branch === 'not_enough_candidates' ? '<div class="a2008-actions"><a class="mlma-btn" href="/track?id=A2-010">Открыть A2-010 · Карта тёплых кругов</a></div>' : '') +
      '<div class="a2008-stack">' + rows + '</div>' +
      '<div class="a2008-actions"><button type="button" class="mlma-btn" data-a2008-action="back-candidates">Назад</button>' +
      '<button type="button" class="mlma-btn mlma-btn-primary" data-a2008-action="rank-next">Собрать мои пять</button></div></div>'
    );
  }

  function optionList(list, selected) {
    var html = '';
    for (var i = 0; i < list.length; i += 1) html += '<option value="' + esc(list[i][0]) + '"' + (selected === list[i][0] ? ' selected' : '') + '>' + esc(list[i][1]) + '</option>';
    return html;
  }

  function shortlist(state) {
    var ids = state.moduleData.shortlistIds;
    return ids.map(function (id) { return candidateById(state, id); }).filter(Boolean);
  }

  function renderPlan(state) {
    var list = shortlist(state);
    var rows = '';
    for (var i = 0; i < list.length; i += 1) {
      var c = list[i];
      var plan = state.moduleData.plan[c.id] || { action: '', channel: '', date: '' };
      rows += (
        '<article class="a2008-plan-card"><div class="a2008-plan-title"><span class="a2008-index">' + (i + 1) + '</span><div><strong>' + esc(c.descriptor) + '</strong><p>' + esc(c.reasonText) + '</p></div><span class="a2008-score">' + scoreCandidate(c) + '/8</span></div>' +
        '<div class="a2008-three"><label><span>Первое действие</span><select class="mlma-field" data-plan-field="action" data-id="' + esc(c.id) + '">' + optionList(ACTIONS, plan.action) + '</select></label>' +
        '<label><span>Канал</span><select class="mlma-field" data-plan-field="channel" data-id="' + esc(c.id) + '">' + optionList(CHANNELS, plan.channel) + '</select></label>' +
        '<label><span>Дата</span><input class="mlma-field" type="date" min="' + minDate() + '" max="' + maxDate() + '" data-plan-field="date" data-id="' + esc(c.id) + '" value="' + esc(plan.date) + '"></label></div></article>'
      );
    }
    return (
      '<div class="a2008-stage"><div class="a2008-stage-head"><span class="mlma-eyebrow">Шаг 3 из 4</span><h2>Назначьте пять действий</h2>' +
      '<p>Выберите действие, канал и реальную дату в пределах ближайших семи дней. Можно начать с самого простого контакта.</p></div>' +
      messageHtml(state) + '<div class="a2008-stack">' + rows + '</div>' +
      '<div class="a2008-actions"><button type="button" class="mlma-btn" data-a2008-action="back-rank">Изменить приоритеты</button>' +
      '<button type="button" class="mlma-btn mlma-btn-primary" data-a2008-action="plan-next">Проверить план</button></div></div>'
    );
  }

  function planSummary(state, editable) {
    var list = shortlist(state);
    var html = '<ol class="a2008-summary">';
    for (var i = 0; i < list.length; i += 1) {
      var c = list[i];
      var p = state.moduleData.plan[c.id] || {};
      html += '<li><span>' + (i + 1) + '</span><div><strong>' + esc(c.descriptor) + '</strong><p>' + esc(labelFor(ACTIONS, p.action)) + ' · ' + esc(labelFor(CHANNELS, p.channel)) + ' · ' + esc(humanDate(p.date)) + '</p><small>' + esc(c.reasonText) + '</small></div></li>';
    }
    return html + '</ol>' + (editable ? '<p class="a2008-footnote">До завершения можно вернуться и изменить любое действие.</p>' : '');
  }

  function renderArtifact(state) {
    var c = state.moduleData.confirmations;
    return (
      '<div class="a2008-stage"><div class="a2008-stage-head"><span class="mlma-eyebrow">Шаг 4 из 4</span><h2>Примите план «Мои пять»</h2>' +
      '<p>Проверьте не красоту списка, а готовность выполнить первое действие.</p></div>' +
      messageHtml(state) + planSummary(state, true) +
      '<fieldset class="a2008-checks"><legend>Критерии принятия</legend>' +
      '<label><input type="checkbox" data-confirmation="noWorthScore"' + (c.noWorthScore ? ' checked' : '') + '> Я не оценивал доход, статус или «стоимость» людей.</label>' +
      '<label><input type="checkbox" data-confirmation="noPressure"' + (c.noPressure ? ' checked' : '') + '> В действиях нет давления, выдуманной срочности и обещаний результата.</label>' +
      '<label><input type="checkbox" data-confirmation="rightToDecline"' + (c.rightToDecline ? ' checked' : '') + '> У каждого человека остаётся простой и безопасный способ отказаться.</label></fieldset>' +
      '<div class="a2008-actions"><button type="button" class="mlma-btn" data-a2008-action="back-plan">Изменить план</button>' +
      '<button type="button" class="mlma-btn mlma-btn-primary" data-a2008-action="complete">Создать рабочий артефакт</button></div>' +
      '<p class="a2008-footnote">Система сохранит сам план локально. В отчёт прохождения попадут только: факт завершения, число действий, типы действий, срок до первого шага и выбранная ветка.</p></div>'
    );
  }

  function renderComplete(state, context) {
    var nextId = state.moduleData.nextTrackId || 'A3-002';
    var trackHref = context && context.R && typeof context.R.track === 'function' ? context.R.track(nextId) : '/track?id=' + encodeURIComponent(nextId);
    return (
      '<div class="a2008-stage a2008-complete"><div class="a2008-complete-mark">✓</div><div class="a2008-stage-head"><span class="mlma-eyebrow">Трек завершён</span><h2>План «Мои пять» готов</h2>' +
      '<p>У вас есть пять конкретных действий на ближайшие семь дней. Начните с самой ранней даты — не перестраивайте список ещё раз.</p></div>' +
      planSummary(state, false) +
      '<div class="a2008-alert a2008-alert-success"><strong>Следующее лучшее действие — ' + esc(nextId) + '.</strong> ' + (nextId === 'A3-003' ? 'Подготовить звонок человеку, с которым вас связали по рекомендации.' : 'Подготовить первое личное сообщение без давления и массовой рассылки.') + '</div>' +
      '<div class="a2008-actions"><a class="mlma-btn mlma-btn-primary" href="' + esc(trackHref) + '" data-a2008-next="' + esc(nextId) + '">Перейти к следующему треку</a>' +
      '<button type="button" class="mlma-btn" data-a2008-action="copy">Скопировать план</button><button type="button" class="mlma-btn" data-a2008-action="download">Скачать .txt</button></div>' +
      '<button type="button" class="a2008-link a2008-reset" data-a2008-action="reset">Начать заново на этом устройстве</button></div>'
    );
  }

  function render(context) {
    lastContext = context || lastContext || {};
    ensureStyles();
    var state = getState();
    if (state.status === 'preview') {
      state.status = 'active';
      state.step = 'candidates';
      saveState(state, true);
      emit('track_started', { source: 'a2_008_module' });
    }
    var stage = Number(state.moduleData.stage || 1);
    var body = state.status === 'complete'
      ? renderComplete(state, lastContext)
      : stage === 1
        ? renderCandidates(state)
        : stage === 2
          ? renderRank(state)
          : stage === 3
            ? renderPlan(state)
            : renderArtifact(state);
    return (
      '<section class="mlma-runtime mlma-card mlma-pad-lg a2008" id="mlma-runtime" data-mlma-track-runtime="' + TRACK_ID + '" data-a2008-version="' + VERSION + '">' +
      '<div class="a2008-kicker"><span class="mlma-eyebrow">Интерактивный трек · 20 минут</span><span class="a2008-local">Черновик хранится локально</span></div>' +
      progress(stage, state.status === 'complete') + body + '</section>'
    );
  }

  function refresh() {
    var current = root.document && root.document.querySelector('[data-mlma-track-runtime="' + TRACK_ID + '"]');
    if (!current) return;
    current.outerHTML = render(lastContext || {});
    var next = root.document.querySelector('[data-mlma-track-runtime="' + TRACK_ID + '"]');
    if (next && next.scrollIntoView) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function scoreCandidate(candidate) {
    var scores = candidate.scores || {};
    return SCORE_FIELDS.reduce(function (sum, item) { return sum + Number(scores[item[0]] || 0); }, 0);
  }

  function completedScores(candidate) {
    var scores = candidate.scores || {};
    return SCORE_FIELDS.every(function (item) { return scores[item[0]] !== '' && scores[item[0]] != null; });
  }

  function isActionFit(candidate) {
    return completedScores(candidate) && scoreCandidate(candidate) > 0;
  }

  function syncScoresFromDom(state) {
    if (!root.document) return state;
    var rootEl = root.document.querySelector('[data-mlma-track-runtime="' + TRACK_ID + '"]');
    if (!rootEl) return state;
    var selects = rootEl.querySelectorAll('select[data-score-field][data-id]');
    for (var i = 0; i < selects.length; i += 1) {
      var el = selects[i];
      var scored = candidateById(state, el.getAttribute('data-id'));
      if (!scored) continue;
      scored.scores = scored.scores || { relationship: '', reason: '', respect: '', clarity: '' };
      scored.scores[el.getAttribute('data-score-field')] = String(el.value || '');
    }
    return state;
  }

  function validateCandidateStage(state) {
    var list = filledCandidates(state);
    if (list.length < MIN_CANDIDATES) return 'Заполните хотя бы пять вариантов. Если список не складывается, используйте трек A2-010 «Карта тёплых кругов».';
    for (var i = 0; i < list.length; i += 1) {
      if (String(list[i].descriptor || '').trim().length < 3 || String(list[i].reasonText || '').trim().length < 5) return 'У каждого заполненного варианта нужны и контекст знакомства, и реальная причина контакта.';
      var text = list[i].descriptor + ' ' + list[i].reasonText;
      if (hasPrivateData(text)) return 'Обнаружен телефон, email или адрес. Удалите персональные данные и оставьте только нейтральное описание контекста.';
      if (hasPressure(text)) return 'В формулировке есть давление или обещание. Перепишите причину контакта нейтрально и честно.';
    }
    return '';
  }

  function buildShortlist(state) {
    var list = filledCandidates(state);
    for (var i = 0; i < list.length; i += 1) {
      if (!completedScores(list[i])) return { error: 'Оцените все четыре критерия у каждого варианта. «Частично» — нормальный ответ и входит в пятёрку.', ids: [] };
    }
    var eligible = list.filter(isActionFit);
    eligible.sort(function (a, b) {
      var diff = scoreCandidate(b) - scoreCandidate(a);
      return diff || list.indexOf(a) - list.indexOf(b);
    });
    if (eligible.length < MIN_CANDIDATES) {
      return {
        error:
          'Уместных вариантов ' +
          eligible.length +
          ' из ' +
          list.length +
          '. Нужны пять человек хотя бы с одной оценкой «Частично» или «Да». Четыре «Нет» человека не считаем. Добавьте кандидатов или откройте A2-010 «Карта тёплых кругов».',
        ids: [],
      };
    }
    return { error: '', ids: eligible.slice(0, MIN_CANDIDATES).map(function (candidate) { return candidate.id; }) };
  }

  function validatePlan(state) {
    var list = shortlist(state);
    if (list.length !== MIN_CANDIDATES) return 'Shortlist должен содержать ровно пять вариантов.';
    for (var i = 0; i < list.length; i += 1) {
      var plan = state.moduleData.plan[list[i].id] || {};
      if (!plan.action || !plan.channel || !plan.date) return 'Для каждого из пяти вариантов выберите действие, канал и дату.';
      if (plan.date < minDate() || plan.date > maxDate()) return 'Все действия должны быть запланированы на ближайшие семь дней.';
    }
    return '';
  }

  function artifactText(state) {
    var lines = [
      'MLM Academy · A2-008',
      'МОИ ПЯТЬ · план первых действий',
      'Создан: ' + new Intl.DateTimeFormat('ru-RU').format(new Date()),
      '',
    ];
    shortlist(state).forEach(function (candidate, index) {
      var plan = state.moduleData.plan[candidate.id] || {};
      lines.push((index + 1) + '. ' + candidate.descriptor);
      lines.push('   Почему сейчас: ' + candidate.reasonText);
      lines.push('   Действие: ' + labelFor(ACTIONS, plan.action));
      lines.push('   Канал: ' + labelFor(CHANNELS, plan.channel));
      lines.push('   Дата: ' + humanDate(plan.date));
      lines.push('');
    });
    lines.push('Правила: без оценки дохода и статуса; без давления и обещаний; отказ — нормальный ответ.');
    lines.push('Данные этого плана хранятся только на моём устройстве.');
    return lines.join('\n');
  }

  function chooseNextTrack(state) {
    var list = shortlist(state).slice();
    list.sort(function (a, b) {
      var pa = state.moduleData.plan[a.id] || {};
      var pb = state.moduleData.plan[b.id] || {};
      return String(pa.date || '').localeCompare(String(pb.date || ''));
    });
    var first = list[0] && state.moduleData.plan[list[0].id];
    return first && first.action === 'referral_call' ? 'A3-003' : 'A3-002';
  }

  function updateFromField(target, state) {
    var candidateField = target.getAttribute('data-candidate-field');
    var scoreField = target.getAttribute('data-score-field');
    var planField = target.getAttribute('data-plan-field');
    var id = target.getAttribute('data-id');
    if (candidateField && id) {
      var candidate = candidateById(state, id);
      if (candidate) candidate[candidateField] = String(target.value || '').slice(0, candidateField === 'descriptor' ? 80 : 140);
    }
    if (scoreField && id) {
      var scored = candidateById(state, id);
      if (scored) scored.scores[scoreField] = String(target.value);
    }
    if (planField && id) {
      state.moduleData.plan[id] = state.moduleData.plan[id] || { action: '', channel: '', date: '' };
      state.moduleData.plan[id][planField] = String(target.value || '');
    }
    var confirmation = target.getAttribute('data-confirmation');
    if (confirmation) state.moduleData.confirmations[confirmation] = !!target.checked;
    state.moduleData.message = '';
    saveState(state, false);
  }

  function handleAction(action, button) {
    var state = getState();
    var m = state.moduleData;
    m.message = '';
    if (action === 'add') {
      if (m.candidates.length < MAX_CANDIDATES) m.candidates.push(newCandidate());
    } else if (action === 'remove') {
      var id = button.getAttribute('data-id');
      if (m.candidates.length > MIN_CANDIDATES) m.candidates = m.candidates.filter(function (candidate) { return candidate.id !== id; });
    } else if (action === 'candidates-next') {
      var candidateError = validateCandidateStage(state);
      if (candidateError) m.message = candidateError;
      else {
        m.stage = 2;
        state.step = 'rank';
        emit('step_completed', { stage: 2, completedStage: 'candidates' });
      }
    } else if (action === 'back-candidates') {
      m.stage = 1;
      state.step = 'candidates';
    } else if (action === 'rank-next') {
      state = syncScoresFromDom(state);
      var result = buildShortlist(state);
      if (result.error) {
        m.message = result.error;
        state.branch = result.ids.length ? '' : 'not_enough_candidates';
      } else {
        m.shortlistIds = result.ids;
        m.stage = 3;
        state.step = 'plan';
        state.branch = '';
        result.ids.forEach(function (id) { m.plan[id] = m.plan[id] || { action: '', channel: '', date: '' }; });
        emit('step_completed', { stage: 3, completedStage: 'rank', shortlistCount: result.ids.length });
      }
    } else if (action === 'back-rank') {
      m.stage = 2;
      state.step = 'rank';
    } else if (action === 'plan-next') {
      var planError = validatePlan(state);
      if (planError) m.message = planError;
      else {
        m.stage = 4;
        state.step = 'artifact';
        emit('step_completed', { stage: 4, completedStage: 'plan' });
      }
    } else if (action === 'back-plan') {
      m.stage = 3;
      state.step = 'plan';
    } else if (action === 'complete') {
      var checks = m.confirmations;
      if (!checks.noWorthScore || !checks.noPressure || !checks.rightToDecline) {
        m.message = 'Подтвердите все три критерия — без них результат нельзя принять.';
      } else {
        state.status = 'complete';
        state.step = 'feedback';
        state.branch = 'success';
        state.completedAt = nowIso();
        state.verificationStatus = 'self_checked';
        state.verificationLabel = 'Самопроверка по рубрике';
        m.completedArtifact = artifactText(state);
        m.nextTrackId = chooseNextTrack(state);
        state.artifact = m.completedArtifact;
        state.evidenceNote = 'Создан локальный план из пяти действий на ближайшие семь дней.';
        var actionTypes = shortlist(state).map(function (candidate) { return m.plan[candidate.id].action; }).join(',');
        emit('artifact_created', { stage: 4, artifactType: 'plan', actionTypes: actionTypes, selectedActionTypes: actionTypes });
        emit('track_completed', { stage: 4, branch: 'success', nextTrackId: m.nextTrackId, daysToFirstAction: daysToFirstAction(state), selectedActionTypes: actionTypes });
      }
    } else if (action === 'copy') {
      copyArtifact(state);
      return;
    } else if (action === 'download') {
      downloadArtifact(state);
      return;
    } else if (action === 'reset') {
      if (root.confirm && !root.confirm('Удалить локальный черновик A2-008 и начать заново?')) return;
      var all = readAll();
      delete all[TRACK_ID];
      writeAll(all);
      refresh();
      return;
    }
    saveState(state, action === 'complete');
    refresh();
  }

  function daysToFirstAction(state) {
    var dates = shortlist(state).map(function (candidate) { return (state.moduleData.plan[candidate.id] || {}).date; }).filter(Boolean).sort();
    if (!dates.length) return null;
    return Math.max(0, Math.round((new Date(dates[0] + 'T12:00:00').getTime() - new Date(minDate() + 'T12:00:00').getTime()) / DAY_MS));
  }

  function copyArtifact(state) {
    var text = state.moduleData.completedArtifact || artifactText(state);
    if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
      root.navigator.clipboard.writeText(text).then(function () { showToast('План скопирован'); }, function () { fallbackCopy(text); });
    } else fallbackCopy(text);
  }

  function fallbackCopy(text) {
    var area = root.document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    root.document.body.appendChild(area);
    area.select();
    try { root.document.execCommand('copy'); showToast('План скопирован'); } catch (err) { showToast('Не удалось скопировать — скачайте файл'); }
    root.document.body.removeChild(area);
  }

  function downloadArtifact(state) {
    var text = state.moduleData.completedArtifact || artifactText(state);
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = root.document.createElement('a');
    link.href = url;
    link.download = 'MLM-Academy_A2-008_moi-pyat.txt';
    root.document.body.appendChild(link);
    link.click();
    root.document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }

  function showToast(text) {
    var old = root.document.querySelector('.a2008-toast');
    if (old) old.remove();
    var toast = root.document.createElement('div');
    toast.className = 'a2008-toast';
    toast.setAttribute('role', 'status');
    toast.textContent = text;
    root.document.body.appendChild(toast);
    setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 2200);
  }

  function bindEvents() {
    if (!root.document || root.document.documentElement.getAttribute('data-a2008-bound') === '1') return;
    root.document.documentElement.setAttribute('data-a2008-bound', '1');
    root.document.addEventListener('input', function (event) {
      var target = event.target;
      if (!target || !target.closest || !target.closest('[data-mlma-track-runtime="' + TRACK_ID + '"]')) return;
      if (target.hasAttribute('data-candidate-field')) updateFromField(target, getState());
    });
    root.document.addEventListener('change', function (event) {
      var target = event.target;
      if (!target || !target.closest || !target.closest('[data-mlma-track-runtime="' + TRACK_ID + '"]')) return;
      updateFromField(target, getState());
    });
    root.document.addEventListener('click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('[data-a2008-action]') : null;
      if (button && button.closest('[data-mlma-track-runtime="' + TRACK_ID + '"]')) {
        event.preventDefault();
        handleAction(button.getAttribute('data-a2008-action'), button);
        return;
      }
      var next = event.target && event.target.closest ? event.target.closest('[data-a2008-next]') : null;
      if (next) emit('next_track_opened', { nextTrackId: next.getAttribute('data-a2008-next') });
    });
  }

  function ensureStyles() {
    if (!root.document) return;
    var css = [
      '.a2008{--a2:#3D6B4F;--a2-soft:#e3ece5;--ink:#1c1914;--paper:#f4f0e8;--surface:#fffcf7;overflow:visible}',
      '.a2008 *{box-sizing:border-box}',
      '.a2008-kicker{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}',
      '.a2008-local{font:600 12px/1.2 "JetBrains Mono",monospace;color:#526057;background:var(--a2-soft);padding:7px 10px;border-radius:3px}',
      '.a2008-progress{list-style:none;margin:22px 0 32px;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;overflow:visible}',
      '.a2008-progress li{position:relative;display:block!important;margin:0!important;list-style:none!important;min-width:0;padding:36px 10px 0 0;color:#7b756c;font-size:12px;background:transparent!important}',
      '.a2008-progress li:after{content:"";position:absolute;left:27px;right:-8px;top:13px;height:2px;background:#d7d0c5;z-index:0;pointer-events:none}',
      '.a2008-progress li:last-child:after{display:none}',
      '.a2008-progress li>span{position:absolute;left:0;top:0;z-index:1;display:grid;place-items:center;width:27px;height:27px;border:1px solid #b8afa3;border-radius:50%;background:var(--surface);font-weight:800}',
      '.a2008-progress b{display:block!important;position:relative;z-index:1;font-weight:700;line-height:1.25;max-width:100%;background:var(--surface);padding:2px 4px 0 0}',
      '.a2008-progress .is-current,.a2008-progress .is-done{color:var(--ink)}',
      '.a2008-progress .is-current span{border-color:var(--a2);box-shadow:0 0 0 3px var(--a2-soft)}',
      '.a2008-progress .is-done span{background:var(--a2);border-color:var(--a2);color:white}',
      '.a2008-progress .is-done:after{background:var(--a2)}',
      '.a2008-stage{display:grid;gap:22px}',
      '.a2008-stage-head{display:grid;gap:9px;max-width:760px}',
      '.a2008-stage-head h2{font-size:clamp(24px,4vw,38px);line-height:1.05;letter-spacing:-.035em;margin:0}',
      '.a2008-stage-head p{font-size:16px;line-height:1.55;color:#5f5a52;margin:0;max-width:68ch}',
      '.a2008-alert{border:1px solid #9e968a;background:#f0ece4;padding:15px 17px;font-size:14px;line-height:1.5}',
      '.a2008-alert-error{border-color:#8b2e1f;background:#f7e9e5;color:#652318}',
      '.a2008-alert-success{border-color:var(--a2);background:var(--a2-soft);color:#284735}',
      '.a2008-stack{display:grid;gap:12px}',
      '.a2008-candidate,.a2008-rank-card,.a2008-plan-card{border:1px solid var(--ink);background:var(--surface);padding:17px;box-shadow:3px 3px 0 rgba(28,25,20,.08)}',
      '.a2008-candidate-head,.a2008-plan-title{display:flex;align-items:center;gap:10px;margin-bottom:13px}',
      '.a2008-candidate-head .a2008-link{margin-left:auto}',
      '.a2008-index{display:grid;place-items:center;min-width:28px;height:28px;border-radius:50%;background:var(--a2);color:white;font-weight:800;font-size:13px}',
      '.a2008-two,.a2008-three{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}',
      '.a2008-three{grid-template-columns:2fr 1fr 1fr}',
      '.a2008 label>span{display:block;font-size:12px;font-weight:800;margin-bottom:7px;text-transform:uppercase;letter-spacing:.02em}',
      '.a2008 .mlma-field{width:100%;min-height:46px;border:1px solid #8e867b;background:white;border-radius:3px;padding:10px 12px;font:inherit;color:var(--ink)}',
      '.a2008 .mlma-field:focus{outline:3px solid var(--a2-soft);border-color:var(--a2)}',
      '.a2008-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
      '.a2008 .mlma-btn{min-height:44px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--ink);background:var(--surface);color:var(--ink);padding:10px 16px;text-decoration:none;font-weight:800;cursor:pointer;border-radius:3px}',
      '.a2008 .mlma-btn:hover{transform:translateY(-1px);box-shadow:2px 2px 0 var(--ink)}',
      '.a2008 .mlma-btn-primary{background:var(--ink);color:white}',
      '.a2008 .mlma-btn:disabled{opacity:.45;cursor:not-allowed;box-shadow:none;transform:none}',
      '.a2008-link{border:0;background:none;color:var(--a2);font:700 13px/1.2 inherit;text-decoration:underline;cursor:pointer;padding:4px}',
      '.a2008-footnote{font-size:12px;line-height:1.5;color:#756f66;margin:0}',
      '.a2008-rank-card{display:grid;gap:16px}',
      '.a2008-rank-card>div:first-child{display:grid;grid-template-columns:auto 1fr;column-gap:10px;align-items:center}',
      '.a2008-rank-card>div:first-child p{grid-column:2;margin:3px 0 0;color:#6b655c;font-size:13px}',
      '.a2008-score-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 18px;align-items:start}',
      '.a2008-score-grid label{border-top:0!important;padding-top:0}',
      '.a2008-score-grid label:nth-child(n+3){border-top:1px solid #ddd5ca!important;padding-top:12px}',
      '.a2008-score-grid small{display:block;min-height:0;color:#756f66;font-size:11px;line-height:1.35;margin:0 0 8px;position:relative;z-index:1;background:var(--surface);border:0!important}',
      '.a2008-plan-title{align-items:flex-start}',
      '.a2008-plan-title>div{flex:1}',
      '.a2008-plan-title p{margin:3px 0 0;color:#6b655c;font-size:13px}',
      '.a2008-score{font:700 12px/1.2 "JetBrains Mono",monospace;color:var(--a2);background:var(--a2-soft);padding:6px 8px}',
      '.a2008-summary{list-style:none;margin:0;padding:0;display:grid;gap:10px}',
      '.a2008-summary li{display:flex;gap:12px;border-bottom:1px solid #d9d2c7;padding:0 0 13px}',
      '.a2008-summary li>span{font:800 14px/1.2 "JetBrains Mono",monospace;color:var(--a2);padding-top:2px}',
      '.a2008-summary p{margin:4px 0;font-size:14px}',
      '.a2008-summary small{display:block;color:#756f66;font-size:12px}',
      '.a2008-checks{border:1px solid var(--ink);padding:16px;display:grid;gap:12px;background:var(--surface)}',
      '.a2008-checks legend{font-weight:900;padding:0 7px}',
      '.a2008-checks label{display:flex;align-items:flex-start;gap:10px;font-size:14px;line-height:1.4}',
      '.a2008-checks input{width:18px;height:18px;accent-color:var(--a2);flex:0 0 auto}',
      '.a2008-complete-mark{display:grid;place-items:center;width:54px;height:54px;border-radius:50%;background:var(--a2);color:white;font-size:28px;font-weight:900}',
      '.a2008-reset{justify-self:start;margin-top:6px}',
      '.a2008-toast{position:fixed;left:50%;bottom:28px;z-index:99999;transform:translateX(-50%);background:#1c1914;color:white;padding:12px 18px;border-radius:3px;font-weight:800;box-shadow:0 6px 24px rgba(0,0,0,.25)}',
      '@media(max-width:720px){.a2008-progress{grid-template-columns:repeat(4,27px);justify-content:space-between}.a2008-progress li{padding:0}.a2008-progress b{display:none!important}.a2008-progress li:after{right:-45px}.a2008-two,.a2008-three,.a2008-score-grid{grid-template-columns:1fr}.a2008{padding:20px!important}.a2008-actions .mlma-btn,.a2008-actions a.mlma-btn{width:100%}.a2008-stage-head h2{font-size:28px}}',
      '@media(prefers-reduced-motion:reduce){.a2008 *{scroll-behavior:auto!important;transition:none!important}}',
    ].join('');
    var style = root.document.getElementById('a2008-styles');
    if (!style) {
      style = root.document.createElement('style');
      style.id = 'a2008-styles';
      root.document.head.appendChild(style);
    }
    if (style.getAttribute('data-a2008-css') !== VERSION) {
      style.textContent = css;
      style.setAttribute('data-a2008-css', VERSION);
    }
  }

  function installCoreAdapters() {
    if (!D || D.__A2008_INSTALLED) return;
    D.__A2008_INSTALLED = true;
    var previousPassport = D.derivePassport;
    D.derivePassport = function (track) {
      if (track && String(track.trackId || '').toUpperCase() === TRACK_ID) return clone(passport);
      return previousPassport ? previousPassport(track) : null;
    };
    var previousNext = D.nextBestAction;
    D.nextBestAction = function (track, catalog, runtime, profile) {
      if (track && String(track.trackId || '').toUpperCase() === TRACK_ID && runtime && runtime.moduleData && runtime.moduleData.nextTrackId) {
        var id = runtime.moduleData.nextTrackId;
        var picked = null;
        for (var i = 0; i < (catalog || []).length; i += 1) if (catalog[i].trackId === id) picked = catalog[i];
        if (picked) return { kind: 'open_track', reason: 'branch_next_action', track: picked, title: picked.title, why: 'Выбрано по первому запланированному действию в A2-008.' };
      }
      return previousNext ? previousNext(track, catalog, runtime, profile) : null;
    };
  }

  root.MLMA_TRACK_MODULES = root.MLMA_TRACK_MODULES || {};
  root.MLMA_TRACK_MODULES[TRACK_ID] = {
    id: TRACK_ID,
    version: VERSION,
    passport: passport,
    render: render,
    refresh: refresh,
    getState: getState,
    saveState: saveState,
    handleAction: handleAction,
    hasPrivateData: hasPrivateData,
    hasPressure: hasPressure,
    validateCandidateStage: validateCandidateStage,
    buildShortlist: buildShortlist,
    isActionFit: isActionFit,
    validatePlan: validatePlan,
    chooseNextTrack: chooseNextTrack,
    artifactText: artifactText,
    daysToFirstAction: daysToFirstAction,
    safeAnalyticsPayload: safeAnalyticsPayload,
    persistMeta: persistMeta,
    reset: function () {
      var all = readAll();
      delete all[TRACK_ID];
      writeAll(all);
      return getState();
    },
  };

  installCoreAdapters();
  bindEvents();
})(typeof window !== 'undefined' ? window : globalThis);
