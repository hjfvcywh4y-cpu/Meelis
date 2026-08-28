(function (root) {
  'use strict';
  var api = root.MLMA;
  if (!api) return;

  var PAGE_SIZE = 15;
  var LIBRARY_STATE_KEY = 'mlma.library.v1';

  var STOP_WORDS = {
    а: 1, и: 1, или: 1, но: 1, да: 1, нет: 1, не: 1, ни: 1, на: 1, в: 1, во: 1, с: 1, со: 1,
    к: 1, ко: 1, от: 1, до: 1, по: 1, из: 1, у: 1, о: 1, об: 1, про: 1, для: 1, при: 1,
    я: 1, ты: 1, он: 1, она: 1, мы: 1, вы: 1, они: 1, мне: 1, меня: 1, мой: 1, моя: 1,
    это: 1, этот: 1, эта: 1, эти: 1, тот: 1, то: 1, как: 1, что: 1, чтобы: 1, чем: 1,
    кто: 1, где: 1, когда: 1, куда: 1, зачем: 1, почему: 1, какой: 1, какая: 1, какие: 1,
    делать: 1, сделать: 1, надо: 1, нужно: 1, можно: 1, есть: 1, быть: 1, вот: 1,
    уже: 1, ещё: 1, еще: 1, же: 1, бы: 1, ли: 1, ведь: 1, там: 1, тут: 1, здесь: 1,
    очень: 1, просто: 1, также: 1, если: 1, только: 1, себе: 1, себя: 1, свой: 1,
    все: 1, всё: 1, всего: 1, ну: 1, под: 1, над: 1, без: 1, тебя: 1, происходит: 1,
    хочу: 1, сейчас: 1, больше: 1, человек: 1, сказал: 1,
  };

  var SYNONYMS = {
    покупатель: ['клиент', 'заказчик'],
    клиент: ['покупатель', 'заказчик'],
    страшно: ['боюсь', 'страх', 'неловко'],
    боюсь: ['страшно', 'страх', 'тревога'],
    страх: ['боюсь', 'страшно'],
    неловко: ['стыдно', 'навязываться'],
    стыдно: ['неловко', 'впаривание', 'навязываться'],
    начало: ['старт', 'новичок', 'начать'],
    старт: ['начало', 'новичок', 'начать'],
    новичок: ['новичку', 'новичка'],
    начать: ['старт', 'начало'],
    продажа: ['продавать', 'сделка'],
    разговор: ['диалог', 'беседа'],
    диалог: ['разговор', 'беседа'],
    навязываться: ['впаривать', 'давить', 'навязывать'],
    впаривать: ['навязываться', 'впаривание'],
    продукт: ['товар', 'каталог'],
    команда: ['партнеры', 'наставник'],
    отказ: ['сомнение', 'пауза'],
    сомнение: ['пауза', 'возражение'],
    пауза: ['сомнение', 'подумает'],
    сообщение: ['текст', 'переписка', 'написать'],
    написать: ['сообщение', 'текст', 'переписка'],
    первый: ['первые', 'начало'],
    рассказать: ['презентация', 'объяснить'],
    наставник: ['спонсор', 'лидер', 'команда'],
    пропал: ['молчит', 'не отвечает', 'followup'],
    подумает: ['пауза', 'сомнение', 'не сейчас'],
  };

  var SECTION_ALIASES = {
    A1: ['старт', 'система', 'новичок', 'роль', 'план', 'этика'],
    A2: ['база', 'клиент', 'люди', 'контакты', 'круги'],
    A3: ['диалог', 'разговор', 'сообщение', 'контакт', 'первый'],
    A4: ['продукт', 'потребность', 'решение', 'предложить'],
    A5: ['отказ', 'сомнение', 'пауза', 'возражение', 'подумает'],
    A6: ['повтор', 'клиентский', 'ритм', 'followup', 'рост'],
  };

  var TRACK_ALIASES = {
    'A1-001': ['стыдно продавать', 'навязываться', 'впаривание', 'этика'],
    'A1-004': ['роль', 'кем быть'],
    'A1-006': ['зачем', 'личная причина'],
    'A1-010': ['план действий', '30 дней'],
    'A1-011': ['продуктовый фокус', 'один продукт'],
    'A1-012': ['честная карточка', 'карточка продукта'],
    'A1-013': ['вопросы и ограничения', 'что можно обещать'],
    'A1-014': ['не стыдно рекомендовать'],
    'A1-016': ['стандарт рекомендации'],
    'A2-001': ['профиль клиента', 'кому подходит'],
    'A2-006': ['аудит базы'],
    'A2-007': ['сегментация базы'],
    'A2-008': ['пять контактов', 'пять людей', 'с кем начать', 'некому писать'],
    'A2-010': ['карта теплых кругов', 'теплые круги'],
    'A2-011': ['реальные контексты', 'где искать'],
    'A3-001': ['канал', 'написать или позвонить'],
    'A3-002': ['первое сообщение', 'написать знакомому', 'теплый контакт', 'боюсь написать', 'что написать'],
    'A3-003': ['позвонить по рекомендации', 'звонок'],
    'A3-005': ['назначить разговор'],
    'A3-008': ['зафиксировать результат', 'следующий контакт'],
    'A3-016': ['открыть разговор', 'настоящий повод'],
    'A4-001': ['от презентации к человеку', 'не рассказывать продукт сразу'],
    'A5-001': ['диагностика сомнения', 'подумает'],
    'A5-008': ['посоветоваться'],
    'A5-009': ['не срочно'],
    'A5-010': ['follow-up', 'не отвечает'],
    'A5-011': ['план после паузы'],
    'A5-014': ['завершить отказ'],
    'A6-001': ['клиентский опыт', 'купил и пропал'],
    'A6-006': ['дата повтора', 'вернуть клиента'],
    'A6-010': ['статусы', 'следующие действия'],
    'A6-011': ['рабочий ритм'],
    'A6-012': ['план из действий'],
    'A6-013': ['разбор практики', 'наставничество'],
  };

  var INTENTS = [
    {
      id: 'first-write',
      why: ['первое сообщение', 'тёплый контакт', 'страх навязаться'],
      phrases: ['боюсь написать', 'написать знакомому', 'первое сообщение', 'что написать', 'написать человеку', 'не знаю что написать', 'первым написать'],
      boostIds: ['A3-002'],
      writeBias: true,
    },
    {
      id: 'no-people',
      why: ['нет людей', 'база', 'пять контактов'],
      phrases: ['некому писать', 'некому', 'с кем начать', 'нет людей', 'не знаю с кем', 'нет контактов', 'не понимаю с кем'],
      boostIds: ['A2-008', 'A2-010', 'A2-006', 'A2-011', 'A2-001'],
    },
    {
      id: 'ethics',
      why: ['этика', 'без впаривания', 'стыд продавать'],
      phrases: ['стыдно продавать', 'навязываться', 'впариван', 'стыдно предлагать', 'боюсь навязываться'],
      boostIds: ['A1-001'],
    },
    {
      id: 'pause',
      why: ['пауза', 'сомнение', 'подумает'],
      phrases: ['подумает', 'не сейчас', 'дорого', 'сомневается', 'надо подумать', 'сказал что подумает', 'взял паузу'],
      boostIds: ['A5-001', 'A5-008', 'A5-009', 'A5-010', 'A5-011', 'A5-003'],
    },
    {
      id: 'lost-client',
      why: ['follow-up', 'клиентский опыт', 'повторный контакт'],
      phrases: ['купил и пропал', 'больше не отвечает', 'вернуть клиента', 'не отвечает', 'клиент купил', 'пропал'],
      boostIds: ['A6-001', 'A6-006', 'A5-010', 'A6-003', 'A6-010'],
    },
    {
      id: 'product-talk',
      why: ['карточка продукта', 'продуктовый фокус', 'ограничения'],
      phrases: ['рассказать о продукте', 'не знаю продукт', 'как рассказать', 'не знаю как рассказать', 'что можно обещать', 'презентация продукта'],
      boostIds: ['A1-012', 'A1-011', 'A1-013', 'A4-001', 'A1-014'],
    },
    {
      id: 'team',
      why: ['наставничество', 'ритм', 'стандарт'],
      phrases: ['партнеры ничего не делают', 'партнёры ничего не делают', 'команда не работает', 'развивать команду', 'наставлять', 'партнеры не делают'],
      boostIds: ['A1-016', 'A6-011', 'A6-012', 'A6-013', 'A6-010', 'A1-010'],
      teamOnly: true,
    },
  ];

  var PRESETS = [
    { id: 'just-started', title: 'Я только начал', hint: 'Роль, причина, план и первые пять контактов', trackIds: ['A1-004', 'A1-006', 'A1-010', 'A1-011', 'A2-008'] },
    { id: 'first-result', title: 'Хочу первый результат', hint: 'План, контакты, сообщение, разговор, фиксация', trackIds: ['A1-010', 'A2-008', 'A3-002', 'A3-016', 'A3-008'] },
    { id: 'who-to-work', title: 'Не понимаю, с кем работать', hint: 'Профиль, база, круги и реальные контексты', trackIds: ['A2-001', 'A2-006', 'A2-007', 'A2-008', 'A2-010', 'A2-011'] },
    { id: 'want-write', title: 'Хочу написать человеку', hint: 'Канал, первое сообщение, повод и фиксация', trackIds: ['A3-001', 'A3-002', 'A3-016', 'A3-005', 'A3-008'] },
    { id: 'tell-product', title: 'Хочу нормально рассказать о продукте', hint: 'Фокус, честная карточка и переход к человеку', trackIds: ['A1-011', 'A1-012', 'A1-013', 'A1-014', 'A4-001'] },
    { id: 'person-doubts', title: 'Человек сомневается', hint: 'Пауза, follow-up и корректное завершение', trackIds: ['A5-001', 'A5-009', 'A5-010', 'A5-011', 'A5-014'] },
    { id: 'return-client', title: 'Хочу вернуть клиента', hint: 'Опыт, повтор и следующий контакт', trackIds: ['A6-001', 'A6-003', 'A6-006', 'A5-010', 'A6-010'] },
    { id: 'grow-team', title: 'Хочу развивать команду', hint: 'Стандарт, ритм и разбор практики', trackIds: ['A1-010', 'A1-016', 'A6-010', 'A6-011', 'A6-012', 'A6-013'] },
  ];

  var GOALS = [
    { id: 'first-result', title: 'Первый результат' },
    { id: 'find-client', title: 'Найти клиента' },
    { id: 'first-dialogue', title: 'Первый диалог' },
    { id: 'understand-need', title: 'Понять потребность' },
    { id: 'handle-doubt', title: 'Пройти сомнения' },
    { id: 'grow-repeat', title: 'Повтор и рост' },
  ];

  var SIT_FILTERS = [
    { id: 'start', title: 'Старт', test: function (m) { return m.sectionId === 'A1' || m.sit === 'start'; } },
    { id: 'people', title: 'Поиск людей', test: function (m) { return m.sit === 'people'; } },
    { id: 'contact', title: 'Первый контакт', test: function (m) { return m.sit === 'contact'; } },
    { id: 'talk', title: 'Разговор', test: function (m) { return m.sit === 'talk'; } },
    { id: 'offer', title: 'Предложение', test: function (m) { return m.sit === 'offer'; } },
    { id: 'doubt', title: 'Сомнение', test: function (m) { return m.sit === 'doubt'; } },
    { id: 'refuse', title: 'Отказ', test: function (m) { return m.sit === 'refuse'; } },
    { id: 'followup', title: 'Follow-up', test: function (m) { return m.sit === 'followup'; } },
    { id: 'repeat', title: 'Повтор', test: function (m) { return m.sit === 'repeat'; } },
    { id: 'base', title: 'Управление базой', test: function (m) { return m.sit === 'base'; } },
    { id: 'team', title: 'Команда', test: function (m) { return m.sit === 'team'; } },
  ];

  var FMT_FILTERS = [
    { id: 'message', title: 'Сообщение' },
    { id: 'list', title: 'Список' },
    { id: 'map', title: 'Карта' },
    { id: 'plan', title: 'План' },
    { id: 'checklist', title: 'Чек-лист' },
    { id: 'conversation', title: 'Разговор' },
    { id: 'calculator', title: 'Калькулятор' },
    { id: 'decision', title: 'Решение' },
    { id: 'result', title: 'Фиксация результата' },
  ];

  var CH_FILTERS = [
    { id: 'chat', title: 'Переписка' },
    { id: 'call', title: 'Звонок' },
    { id: 'meeting', title: 'Встреча' },
    { id: 'content', title: 'Контент' },
    { id: 'crm', title: 'CRM' },
    { id: 'any', title: 'Универсальный' },
  ];

  var LVL_FILTERS = [
    { id: 'beginner', title: 'Начинаю' },
    { id: 'working', title: 'Уже работаю' },
    { id: 'system', title: 'Развиваю систему' },
    { id: 'mentor', title: 'Наставляю команду' },
  ];

  var AVAIL_FILTERS = [
    { id: 'description', title: 'Описание готово' },
    { id: 'playable', title: 'Можно пройти' },
  ];

  var EXPERIENCE = [
    { id: 'start', title: 'Я только начинаю', level: 'beginner' },
    { id: 'first-steps', title: 'Уже делал несколько попыток', level: 'working' },
    { id: 'practice', title: 'У меня уже есть клиенты', level: 'system' },
    { id: 'growth', title: 'Я развиваю команду', level: 'mentor' },
  ];

  var MATERIAL_TYPES = [{ id: 'track', title: 'Трек' }];
  var SITUATIONS = SIT_FILTERS.map(function (item) {
    return { id: item.id, title: item.title };
  });

  var FIELD_WEIGHTS = {
    titleExact: 400,
    title: 60,
    situation: 50,
    aliases: 50,
    outcome: 40,
    tags: 30,
    section: 20,
    format: 10,
    id: 16,
    phrase: 48,
    multi: 18,
    intent: 220,
    emotion: 24,
  };


  api.STOP_WORDS = STOP_WORDS;
  api.SYNONYMS = SYNONYMS;
  api.INTENTS = INTENTS;
  api.TRACK_ALIASES = TRACK_ALIASES;
  api.SECTION_ALIASES = SECTION_ALIASES;
  api.GOALS = GOALS;
  api.SITUATIONS = SITUATIONS;
  api.SIT_FILTERS = SIT_FILTERS;
  api.FMT_FILTERS = FMT_FILTERS;
  api.CH_FILTERS = CH_FILTERS;
  api.LVL_FILTERS = LVL_FILTERS;
  api.AVAIL_FILTERS = AVAIL_FILTERS;
  api.EXPERIENCE = EXPERIENCE;
  api.MATERIAL_TYPES = MATERIAL_TYPES;
  api.PRESETS = PRESETS;
  api.FIELD_WEIGHTS = FIELD_WEIGHTS;
  api.PAGE_SIZE = 15;
  api.LIBRARY_STATE_KEY = LIBRARY_STATE_KEY;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);

/* __MLMA_UI_SPLIT__ */
(function (root) {
  'use strict';
  var api = root.MLMA;
  if (!api) return;
  var STOP_WORDS = api.STOP_WORDS;
  var SYNONYMS = api.SYNONYMS;
  var INTENTS = api.INTENTS;
  var TRACK_ALIASES = api.TRACK_ALIASES;
  var SECTION_ALIASES = api.SECTION_ALIASES;
  var GOALS = api.GOALS;
  var SITUATIONS = api.SITUATIONS;
  var SIT_FILTERS = api.SIT_FILTERS;
  var FMT_FILTERS = api.FMT_FILTERS;
  var CH_FILTERS = api.CH_FILTERS;
  var LVL_FILTERS = api.LVL_FILTERS;
  var AVAIL_FILTERS = api.AVAIL_FILTERS;
  var EXPERIENCE = api.EXPERIENCE;
  var PRESETS = api.PRESETS;
  var FIELD_WEIGHTS = api.FIELD_WEIGHTS;
  var PAGE_SIZE = api.PAGE_SIZE || 15;
  var LIBRARY_STATE_KEY = api.LIBRARY_STATE_KEY || 'mlma.library.v1';

  var metaCache = {};

  function stem(word) {
    var value = String(word || '');
    if (value.length < 4) return value;
    var suffixes = [
      'ться', 'тся', 'ешь', 'ишь', 'ать', 'ять', 'ить', 'ость', 'ение', 'ание',
      'ого', 'ему', 'ами', 'ями', 'ому', 'ыми', 'ими',
      'ов', 'ев', 'ах', 'ях', 'ой', 'ый', 'ий', 'ая', 'ое', 'ые',
      'ть', 'ся', 'сь', 'ам', 'ям', 'ом', 'ем', 'ую', 'ей',
    ];
    for (var i = 0; i < suffixes.length; i += 1) {
      var sfx = suffixes[i];
      if (value.length - sfx.length >= 3 && value.slice(-sfx.length) === sfx) {
        return value.slice(0, -sfx.length);
      }
    }
    return value;
  }

  function tokenize(value) {
    var normalized = api.normalizeSearchText(value);
    if (!normalized) return [];
    return normalized.split(' ').filter(Boolean);
  }

  function isStopWord(token) {
    return token.length < 2 || !!STOP_WORDS[token];
  }

  function usefulTokens(tokens) {
    var out = [];
    for (var i = 0; i < tokens.length; i += 1) {
      if (!isStopWord(tokens[i])) out.push(tokens[i]);
    }
    return out;
  }

  function expandToken(token) {
    var out = [token];
    var stemmed = stem(token);
    if (stemmed.length >= 4) out.push(stemmed);
    var extras = SYNONYMS[token];
    if (extras) {
      for (var i = 0; i < extras.length; i += 1) {
        out.push(extras[i]);
        out.push(stem(extras[i]));
      }
    }
    var seen = {};
    var uniq = [];
    for (var j = 0; j < out.length; j += 1) {
      if (out[j] && !seen[out[j]]) {
        seen[out[j]] = true;
        uniq.push(out[j]);
      }
    }
    return uniq;
  }

  function analyzeQuery(raw) {
    var original = String(raw || '').trim();
    var tokens = tokenize(original);
    var useful = usefulTokens(tokens);
    if (original && useful.length === 0) {
      return { kind: 'need_more', original: original, tokens: tokens, useful: [], expanded: [], norm: '', intents: [] };
    }
    var expanded = [];
    var seen = {};
    for (var i = 0; i < useful.length; i += 1) {
      var pack = expandToken(useful[i]);
      for (var j = 0; j < pack.length; j += 1) {
        if (!seen[pack[j]]) {
          seen[pack[j]] = true;
          expanded.push(pack[j]);
        }
      }
    }
    var norm = api.normalizeSearchText(original);
    var intents = matchIntents(norm);
    return { kind: 'ok', original: original, tokens: tokens, useful: useful, expanded: expanded, norm: norm, intents: intents };
  }

  function matchIntents(norm) {
    var hits = [];
    if (!norm) return hits;
    for (var i = 0; i < INTENTS.length; i += 1) {
      var intent = INTENTS[i];
      for (var p = 0; p < intent.phrases.length; p += 1) {
        var phrase = api.normalizeSearchText(intent.phrases[p]);
        if (phrase && norm.indexOf(phrase) !== -1) {
          hits.push(intent);
          break;
        }
      }
    }
    return hits;
  }

  function fieldHas(haystack, variants) {
    if (!haystack) return false;
    var words = haystack.split(' ').filter(Boolean);
    for (var i = 0; i < variants.length; i += 1) {
      var needle = variants[i];
      if (!needle || needle.length < 3) continue;
      var needleStem = stem(needle);
      var prefixLen = needle.length >= 5 ? 5 : 4;
      var prefix = needle.length >= 4 ? needle.slice(0, prefixLen) : '';
      for (var w = 0; w < words.length; w += 1) {
        var word = words[w];
        if (word === needle) return true;
        if (needle.length >= 4 && word.indexOf(needle) === 0) return true;
        if (needleStem.length >= 4 && stem(word) === needleStem) return true;
        if (prefix && word.length >= prefix.length && word.slice(0, prefix.length) === prefix) return true;
      }
    }
    return false;
  }

  function formatGroup(format) {
    var s = api.normalizeSearchText(format);
    if (/сообщен|конструктор сообщения|текст переписк/.test(s)) return 'message';
    if (/список/.test(s)) return 'list';
    if (/карт/.test(s)) return 'map';
    if (/план/.test(s)) return 'plan';
    if (/чек/.test(s)) return 'checklist';
    if (/разговор|диалог|встреч/.test(s)) return 'conversation';
    if (/калькул|посчитать/.test(s)) return 'calculator';
    if (/решен|фильтр/.test(s)) return 'decision';
    if (/фиксац|результат/.test(s)) return 'result';
    return 'other';
  }

  function channelOf(track) {
    var s = api.normalizeSearchText(track.title + ' ' + track.format + ' ' + track.situation);
    if (/звонок|телефон|позвон/.test(s)) return 'call';
    if (/встреч/.test(s)) return 'meeting';
    if (/сообщен|переписк|написать|мессендж|чат/.test(s)) return 'chat';
    if (/контент|пост|видео|ролик/.test(s)) return 'content';
    if (/crm|баз|статус/.test(s)) return 'crm';
    return 'any';
  }

  function sitOf(track) {
    var s = api.normalizeSearchText(track.title + ' ' + track.situation + ' ' + track.module);
    if (track.sectionId === 'A1' && /команд|настав|стандарт/.test(s)) return 'team';
    if (track.sectionId === 'A1') return 'start';
    if (/аудит|баз|сегмент|статус/.test(s) && track.sectionId === 'A2') return 'base';
    if (/пять людей|кругов|контекст|поиск|профиль|рекомендац/.test(s) && track.sectionId === 'A2') return 'people';
    if (track.sectionId === 'A2') return 'people';
    if (/сообщен|позвон|канал|перв/.test(s) && track.sectionId === 'A3') return 'contact';
    if (/встреч|разговор|повод/.test(s) && track.sectionId === 'A3') return 'talk';
    if (track.sectionId === 'A3') return 'contact';
    if (track.sectionId === 'A4') return /предлож|цен|выбор|заверш/.test(s) ? 'offer' : 'talk';
    if (/отказ/.test(s) && track.sectionId === 'A5') return 'refuse';
    if (/follow|повтор|пауз|не отвечает/.test(s) && track.sectionId === 'A5') return 'followup';
    if (track.sectionId === 'A5') return 'doubt';
    if (/команд|настав|ритм|разбор|план роста/.test(s) && track.sectionId === 'A6') return 'team';
    if (/повтор|клиентск|встроить|дата/.test(s) && track.sectionId === 'A6') return 'repeat';
    if (track.sectionId === 'A6') return 'followup';
    return 'start';
  }

  function levelOf(track) {
    var s = api.normalizeSearchText(track.title + ' ' + track.situation + ' ' + track.module);
    if (/настав|команд|передач стандарт|самостоятельност/.test(s)) return 'mentor';
    if (track.sectionId === 'A6' || /систем|ритм|план роста/.test(s)) return 'system';
    if (track.sectionId === 'A1' || /перв|старт|начал|пять людей|первое сообщение/.test(s)) return 'beginner';
    return 'working';
  }

  function deriveMeta(track) {
    var cacheKey = track.trackId + '\n' + track.title + '\n' + track.situation + '\n' + track.format;
    if (metaCache[cacheKey]) return metaCache[cacheKey];
    var aliases = (TRACK_ALIASES[track.trackId] || []).concat(SECTION_ALIASES[track.sectionId] || []);
    var fmt = formatGroup(track.format);
    var meta = {
      trackId: track.trackId,
      sectionId: track.sectionId,
      fmt: fmt,
      ch: channelOf(track),
      sit: sitOf(track),
      lvl: levelOf(track),
      aliases: aliases,
      playable: track.publicationStatus === 'published' && track.contentStatus === 'published',
      fields: {
        title: api.normalizeSearchText(track.title),
        situation: api.normalizeSearchText(track.situation),
        outcome: api.normalizeSearchText(track.outcome),
        module: api.normalizeSearchText(track.module),
        format: api.normalizeSearchText(track.format),
        aliases: api.normalizeSearchText(aliases.join(' ')),
        section: api.normalizeSearchText(track.sectionId + ' ' + (SECTION_ALIASES[track.sectionId] || []).join(' ')),
        id: api.normalizeSearchText(track.trackId),
      },
    };
    metaCache[cacheKey] = meta;
    return meta;
  }

  function queryHasWrite(analysis) {
    var blob = (analysis.norm || '') + ' ' + (analysis.useful || []).join(' ');
    return /написа|сообщен|переписк|текст/.test(blob);
  }

  function queryHasCall(analysis) {
    return /позвон|звонок|телефон/.test(analysis.norm || '');
  }

  function scoreTrack(track, analysis, mode) {
    if (!analysis || analysis.kind !== 'ok' || !analysis.useful.length) return { score: 0, why: [] };
    var meta = deriveMeta(track);
    var fields = meta.fields;
    var queryNorm = analysis.norm;
    var score = 0;
    var why = [];
    var matchedUseful = 0;
    if (queryNorm && fields.title === queryNorm) score += FIELD_WEIGHTS.titleExact;

    for (var i = 0; i < analysis.useful.length; i += 1) {
      var token = analysis.useful[i];
      var variants = expandToken(token);
      var hits = 0;
      if (fieldHas(fields.title, variants)) {
        score += FIELD_WEIGHTS.title;
        hits += 1;
        if (why.length < 4) why.push(token);
      }
      if (fieldHas(fields.situation, variants)) {
        score += FIELD_WEIGHTS.situation;
        hits += 1;
      }
      if (fieldHas(fields.aliases, variants)) {
        score += FIELD_WEIGHTS.aliases;
        hits += 1;
        if (why.indexOf(token) === -1 && why.length < 4) why.push(token);
      }
      if (fieldHas(fields.outcome, variants)) {
        score += FIELD_WEIGHTS.outcome;
        hits += 1;
      }
      if (fieldHas(fields.module, variants) || fieldHas(fields.format, variants)) {
        score += FIELD_WEIGHTS.format;
        hits += 1;
      }
      if (fieldHas(fields.section, variants)) {
        score += FIELD_WEIGHTS.section;
        hits += 1;
      }
      if (fieldHas(fields.id, variants)) {
        score += FIELD_WEIGHTS.id;
        hits += 1;
      }
      if (hits) matchedUseful += 1;
      if (hits > 1) score += FIELD_WEIGHTS.multi * (hits - 1);
    }

    if (queryNorm.length >= 8) {
      if (fields.title.indexOf(queryNorm) !== -1) score += FIELD_WEIGHTS.phrase * 2;
      else if (fields.situation.indexOf(queryNorm) !== -1 || fields.aliases.indexOf(queryNorm) !== -1) score += FIELD_WEIGHTS.phrase;
    }
    var parts = queryNorm.split(' ');
    if (parts.length >= 2) {
      for (var p = 0; p < parts.length - 1; p += 1) {
        var gram = parts[p] + ' ' + parts[p + 1];
        if (gram.length < 7) continue;
        if (fields.title.indexOf(gram) !== -1 || fields.aliases.indexOf(gram) !== -1) score += FIELD_WEIGHTS.phrase;
      }
    }

    var writeQ = queryHasWrite(analysis);
    var callQ = queryHasCall(analysis);
    if (writeQ && !callQ) {
      if (meta.ch === 'call' && fields.title.indexOf('написа') === -1 && fields.aliases.indexOf('первое сообщение') === -1) {
        score -= 140;
      }
      if (fields.title.indexOf('написа') !== -1 || fields.aliases.indexOf('первое сообщение') !== -1) {
        score += 70;
      }
    }

    var intents = analysis.intents || [];
    var intentHit = false;
    for (var n = 0; n < intents.length; n += 1) {
      var intent = intents[n];
      if (intent.boostIds.indexOf(track.trackId) !== -1) {
        score += FIELD_WEIGHTS.intent + Math.max(0, 40 - n * 8);
        intentHit = true;
        for (var w = 0; w < intent.why.length && why.length < 5; w += 1) {
          if (why.indexOf(intent.why[w]) === -1) why.push(intent.why[w]);
        }
      } else if (intent.teamOnly && track.sectionId === 'A6' && intent.boostIds.indexOf(track.trackId) === -1) {
        score -= 80;
      } else if (intent.writeBias && meta.ch === 'call') {
        score -= 90;
      }
    }
    if (/боюсь|страш|стыд|неловк/.test(queryNorm) && /боюсь|страш|стыд|неловк|навяз/.test(fields.situation + ' ' + fields.aliases)) {
      score += FIELD_WEIGHTS.emotion;
    }
    if (!intentHit && matchedUseful === 1 && analysis.useful.length >= 3) {
      score = Math.floor(score * 0.45);
    }
    if (matchedUseful < analysis.useful.length) {
      if (mode === 'soft' && (matchedUseful > 0 || intentHit)) {
        return { score: Math.max(1, Math.floor(score * ((matchedUseful + (intentHit ? 1 : 0)) / (analysis.useful.length + 0.5)))), why: why };
      }
      if (intentHit) return { score: Math.max(1, score), why: why };
      return { score: 0, why: [] };
    }
    return { score: score, why: why };
  }

  function getPreset(id) {
    for (var i = 0; i < PRESETS.length; i += 1) {
      if (PRESETS[i].id === id) return PRESETS[i];
    }
    return null;
  }

  function getGoal(id) {
    for (var i = 0; i < GOALS.length; i += 1) {
      if (GOALS[i].id === id) return GOALS[i];
    }
    return null;
  }

  function getSituation(id) {
    for (var i = 0; i < SIT_FILTERS.length; i += 1) {
      if (SIT_FILTERS[i].id === id) return SIT_FILTERS[i];
    }
    return null;
  }

  function getExperience(id) {
    for (var i = 0; i < EXPERIENCE.length; i += 1) {
      if (EXPERIENCE[i].id === id) return EXPERIENCE[i];
    }
    return null;
  }

  function splitCsv(value) {
    if (!value) return [];
    return String(value)
      .split(',')
      .map(function (item) { return item.trim(); })
      .filter(Boolean);
  }

  function emptyLibraryState() {
    return {
      q: '',
      stage: null,
      stages: [],
      goal: null,
      situation: null,
      sit: [],
      type: null,
      format: null,
      fmt: [],
      ch: [],
      lvl: [],
      avail: null,
      skill: null,
      experience: null,
      sort: null,
      preset: null,
    };
  }

  function parseLibraryState(search, extra) {
    extra = extra || {};
    var params;
    try {
      params = typeof search === 'string' ? new URLSearchParams(search.replace(/^\?/, '')) : new URLSearchParams();
    } catch (err) {
      params = new URLSearchParams();
    }
    var state = emptyLibraryState();
    var q = (params.get('q') || extra.q || '').trim();
    if (q) state.q = q;
    var stageRaw = params.get('stage') || params.get('section') || extra.stage || '';
    var stages = splitCsv(stageRaw).map(function (item) { return api.normalizeSectionId(item); }).filter(Boolean);
    if (stages.length === 1) state.stage = stages[0];
    if (stages.length) state.stages = stages;
    var goal = params.get('goal') || extra.goal || '';
    if (goal && getGoal(goal)) state.goal = goal;
    var situation = params.get('situation') || extra.situation || '';
    var sit = splitCsv(params.get('sit') || situation);
    if (sit.length) {
      state.sit = sit.filter(function (id) { return !!getSituation(id); });
      if (state.sit.length === 1) state.situation = state.sit[0];
    }
    var type = params.get('type') || extra.type || '';
    if (type) state.type = type;
    var format = params.get('format') || extra.format || '';
    var fmt = splitCsv(params.get('fmt') || format);
    if (fmt.length) state.fmt = fmt;
    if (format && fmt.length === 0) state.format = format;
    var ch = splitCsv(params.get('ch') || '');
    if (ch.length) state.ch = ch;
    var lvl = splitCsv(params.get('lvl') || '');
    if (lvl.length) state.lvl = lvl;
    var avail = params.get('avail') || extra.avail || '';
    if (avail && (avail === 'description' || avail === 'playable')) state.avail = avail;
    var skill = params.get('skill') || extra.skill || '';
    if (skill) state.skill = skill;
    var experience = params.get('experience') || extra.experience || '';
    if (experience && getExperience(experience)) {
      state.experience = experience;
      var exp = getExperience(experience);
      if (exp.level && state.lvl.indexOf(exp.level) === -1) state.lvl.push(exp.level);
    }
    var sort = params.get('sort') || extra.sort || '';
    if (sort && sort !== 'relevance') state.sort = sort;
    var preset = params.get('preset') || extra.preset || '';
    if (preset && getPreset(preset)) state.preset = preset;
    return state;
  }

  function serializeLibraryState(state) {
    state = state || emptyLibraryState();
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    var stages = state.stages && state.stages.length ? state.stages : (state.stage ? [state.stage] : []);
    if (stages.length) params.set('stage', stages.map(function (id) { return String(id).toLowerCase(); }).join(','));
    if (state.goal) params.set('goal', state.goal);
    if (state.sit && state.sit.length) params.set('sit', state.sit.join(','));
    else if (state.situation) params.set('situation', state.situation);
    if (state.type) params.set('type', state.type);
    if (state.fmt && state.fmt.length) params.set('fmt', state.fmt.join(','));
    else if (state.format) params.set('format', state.format);
    if (state.ch && state.ch.length) params.set('ch', state.ch.join(','));
    if (state.lvl && state.lvl.length) params.set('lvl', state.lvl.join(','));
    if (state.avail) params.set('avail', state.avail);
    if (state.skill) params.set('skill', state.skill);
    if (state.experience) params.set('experience', state.experience);
    if (state.sort && state.sort !== 'relevance') params.set('sort', state.sort);
    if (state.preset) params.set('preset', state.preset);
    return params.toString();
  }

  function libraryHref(state) {
    var qs = serializeLibraryState(state);
    return qs ? '/library?' + qs : '/library';
  }

  function hasActiveFilters(state) {
    if (!state) return false;
    return !!(
      state.q ||
      state.stage ||
      (state.stages && state.stages.length) ||
      state.goal ||
      state.situation ||
      (state.sit && state.sit.length) ||
      (state.type && state.type !== 'track') ||
      state.format ||
      (state.fmt && state.fmt.length) ||
      (state.ch && state.ch.length) ||
      (state.lvl && state.lvl.length) ||
      state.avail ||
      state.skill ||
      state.experience ||
      state.preset
    );
  }

  function inGroup(values, value) {
    if (!values || !values.length) return true;
    return values.indexOf(value) !== -1;
  }

  function applyFacets(tracks, state) {
    state = state || emptyLibraryState();
    var preset = state.preset ? getPreset(state.preset) : null;
    var allowed = null;
    if (preset && preset.trackIds && preset.trackIds.length) {
      allowed = {};
      for (var a = 0; a < preset.trackIds.length; a += 1) allowed[preset.trackIds[a]] = true;
    }
    var stages = state.stages && state.stages.length ? state.stages : (state.stage ? [state.stage] : []);
    var sit = state.sit && state.sit.length ? state.sit : (state.situation ? [state.situation] : []);
    var fmt = state.fmt && state.fmt.length ? state.fmt : [];
    var out = [];
    for (var i = 0; i < tracks.length; i += 1) {
      var track = tracks[i];
      if (allowed && !allowed[track.trackId]) continue;
      if (state.type && state.type !== 'track') continue;
      var meta = deriveMeta(track);
      if (stages.length && stages.indexOf(track.sectionId) === -1) continue;
      if (sit.length && sit.indexOf(meta.sit) === -1) continue;
      if (fmt.length && fmt.indexOf(meta.fmt) === -1) continue;
      if (state.format && track.format !== state.format && fmt.length === 0) continue;
      if (!inGroup(state.ch, meta.ch)) continue;
      if (!inGroup(state.lvl, meta.lvl)) continue;
      if (state.avail === 'playable' && !meta.playable) continue;
      if (state.avail === 'description' && meta.playable) continue;
      if (state.skill) continue;
      out.push(track);
    }
    return out;
  }

  function rankTracks(tracks, analysis, sort, mode) {
    if (!analysis || analysis.kind !== 'ok' || !analysis.useful.length) {
      var copy = tracks.slice();
      if (sort === 'title') {
        copy.sort(function (a, b) {
          return a.title.localeCompare(b.title, 'ru');
        });
      }
      return copy.map(function (track) {
        return { track: track, score: 0, why: [] };
      });
    }
    var scored = [];
    for (var i = 0; i < tracks.length; i += 1) {
      var result = scoreTrack(tracks[i], analysis, mode);
      if (result.score > 0) scored.push({ track: tracks[i], score: result.score, why: result.why });
    }
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.track.trackId.localeCompare(b.track.trackId);
    });
    return scored;
  }

  function chipLabel(key, value) {
    if (key === 'q') return '«' + value + '»';
    if (key === 'stage' || key === 'stages') return value;
    if (key === 'goal') {
      var goal = getGoal(value);
      return goal ? goal.title : value;
    }
    if (key === 'situation' || key === 'sit') {
      var sit = getSituation(value);
      return sit ? sit.title : value;
    }
    if (key === 'type') return value === 'track' ? 'Трек' : value;
    if (key === 'format') return value;
    if (key === 'fmt') {
      for (var f = 0; f < FMT_FILTERS.length; f += 1) if (FMT_FILTERS[f].id === value) return FMT_FILTERS[f].title;
      return value;
    }
    if (key === 'ch') {
      for (var c = 0; c < CH_FILTERS.length; c += 1) if (CH_FILTERS[c].id === value) return CH_FILTERS[c].title;
      return value;
    }
    if (key === 'lvl') {
      for (var l = 0; l < LVL_FILTERS.length; l += 1) if (LVL_FILTERS[l].id === value) return LVL_FILTERS[l].title;
      return value;
    }
    if (key === 'avail') {
      for (var a = 0; a < AVAIL_FILTERS.length; a += 1) if (AVAIL_FILTERS[a].id === value) return AVAIL_FILTERS[a].title;
      return value;
    }
    if (key === 'experience') {
      var exp = getExperience(value);
      return exp ? exp.title : value;
    }
    if (key === 'preset') {
      var preset = getPreset(value);
      return preset ? preset.title : value;
    }
    return String(value);
  }

  function pushChip(chips, key, value) {
    if (!value) return;
    chips.push({ key: key, value: value, label: chipLabel(key, value) });
  }

  function buildChips(state) {
    var chips = [];
    if (state.q) pushChip(chips, 'q', state.q);
    var stages = state.stages && state.stages.length ? state.stages : (state.stage ? [state.stage] : []);
    for (var s = 0; s < stages.length; s += 1) pushChip(chips, 'stage', stages[s]);
    if (state.goal) pushChip(chips, 'goal', state.goal);
    var sit = state.sit && state.sit.length ? state.sit : (state.situation ? [state.situation] : []);
    for (var i = 0; i < sit.length; i += 1) pushChip(chips, 'sit', sit[i]);
    if (state.type && state.type !== 'track') pushChip(chips, 'type', state.type);
    if (state.fmt && state.fmt.length) {
      for (var f = 0; f < state.fmt.length; f += 1) pushChip(chips, 'fmt', state.fmt[f]);
    } else if (state.format) pushChip(chips, 'format', state.format);
    if (state.ch) for (var c = 0; c < state.ch.length; c += 1) pushChip(chips, 'ch', state.ch[c]);
    if (state.lvl) for (var l = 0; l < state.lvl.length; l += 1) pushChip(chips, 'lvl', state.lvl[l]);
    if (state.avail) pushChip(chips, 'avail', state.avail);
    if (state.experience) pushChip(chips, 'experience', state.experience);
    if (state.preset) pushChip(chips, 'preset', state.preset);
    return chips;
  }

  function foundLabel(count, total, state) {
    var filtered = hasActiveFilters(state);
    if (!filtered && count === total) return 'Показаны все ' + total + ' ' + api.pluralTracks(total);
    if (state.preset && !state.q && (!state.stage && !(state.sit && state.sit.length))) {
      return 'В этой подборке ' + count + ' ' + api.pluralTracks(count);
    }
    var verb = count % 10 === 1 && count % 100 !== 11 ? 'Найден' : 'Найдено';
    return verb + ' ' + count + ' ' + api.pluralTracks(count) + ' из ' + total;
  }

  function relaxOrder() {
    return ['avail', 'fmt', 'ch', 'lvl', 'sit', 'experience', 'stage', 'preset', 'q'];
  }

  function clearKey(state, key) {
    var next = Object.assign({}, state);
    if (key === 'q') next.q = '';
    else if (key === 'stage') {
      next.stage = null;
      next.stages = [];
    } else if (key === 'sit') {
      next.sit = [];
      next.situation = null;
    } else if (key === 'fmt') {
      next.fmt = [];
      next.format = null;
    } else if (key === 'ch') next.ch = [];
    else if (key === 'lvl') next.lvl = [];
    else next[key] = null;
    if (key !== 'q') next.preset = key === 'preset' ? null : next.preset;
    return next;
  }

  function relaxSearch(tracks, state, analysis) {
    var order = relaxOrder();
    for (var i = 0; i < order.length; i += 1) {
      var key = order[i];
      var active = key === 'q' ? state.q : key === 'stage' ? state.stage || (state.stages && state.stages.length) : key === 'sit' ? (state.sit && state.sit.length) || state.situation : key === 'fmt' ? (state.fmt && state.fmt.length) || state.format : Array.isArray(state[key]) ? state[key].length : state[key];
      if (!active) continue;
      var next = clearKey(state, key);
      var faceted = applyFacets(tracks, next);
      var ranked = rankTracks(faceted, next.q ? analysis : { kind: 'ok', useful: [] }, next.sort, 'soft');
      if (ranked.length) {
        return { key: key, items: ranked.slice(0, 6).map(function (row) { return row.track; }), close: ranked.slice(0, 6) };
      }
    }
    var fallback = rankTracks(tracks, analysis && analysis.useful && analysis.useful.length ? analysis : { kind: 'ok', useful: [] }, state.sort, 'soft');
    return { key: 'all', items: fallback.slice(0, 6).map(function (row) { return row.track; }), close: fallback.slice(0, 6) };
  }

  function searchCatalog(tracks, state) {
    state = state || emptyLibraryState();
    var analysis = analyzeQuery(state.q || '');
    var chips = buildChips(state);
    if (state.q && analysis.kind === 'need_more') {
      return { kind: 'need_more', items: [], featured: [], other: [], whyMap: {}, analysis: analysis, chips: chips, relaxedKey: null, close: [], total: tracks.length, label: 'Нужна более конкретная формулировка' };
    }
    var faceted = applyFacets(tracks, state);
    var ranked = rankTracks(faceted, analysis, state.sort);
    var items = [];
    var whyMap = {};
    for (var i = 0; i < ranked.length; i += 1) {
      items.push(ranked[i].track);
      if (ranked[i].why && ranked[i].why.length) whyMap[ranked[i].track.trackId] = ranked[i].why;
    }
    if (items.length) {
      var featured = state.q && items.length ? items.slice(0, Math.min(3, items.length)) : [];
      var other = featured.length ? items.slice(featured.length) : items;
      return {
        kind: 'ok',
        items: items,
        featured: featured,
        other: other,
        whyMap: whyMap,
        analysis: analysis,
        chips: chips,
        relaxedKey: null,
        close: [],
        total: tracks.length,
        label: foundLabel(items.length, tracks.length, state),
      };
    }
    if (!hasActiveFilters(state) && !state.q) {
      return { kind: 'ok', items: [], featured: [], other: [], whyMap: {}, analysis: analysis, chips: chips, relaxedKey: null, close: [], total: tracks.length, label: foundLabel(0, tracks.length, state) };
    }
    var relaxed = relaxSearch(tracks, state, analysis);
    return {
      kind: 'zero',
      items: [],
      featured: [],
      other: [],
      whyMap: {},
      analysis: analysis,
      chips: chips,
      relaxedKey: relaxed.key,
      close: relaxed.close,
      total: tracks.length,
      label: 'Точного совпадения пока нет',
    };
  }

  function matchesQuery(track, query) {
    query = query || {};
    var state = parseLibraryState('', {
      q: query.query || query.q || '',
      stage: query.sectionId || query.stage || null,
      format: query.format || null,
      goal: query.goal || null,
      situation: query.situation || null,
    });
    if (query.availability === 'available' && track.publicationStatus !== 'published') return false;
    if (query.availability === 'preparing' && track.publicationStatus === 'published') return false;
    var result = searchCatalog([track], state);
    return result.kind === 'ok' && result.items.length > 0;
  }

  function filterTracks(tracks, query) {
    query = query || {};
    var state = parseLibraryState('', {
      q: query.query || query.q || '',
      stage: query.sectionId || query.stage || null,
      format: query.format || null,
      goal: query.goal || null,
      situation: query.situation || null,
      type: query.type || null,
      experience: query.experience || null,
    });
    var filtered = [];
    for (var i = 0; i < tracks.length; i += 1) {
      var track = tracks[i];
      if (query.availability === 'available' && track.publicationStatus !== 'published') continue;
      if (query.availability === 'preparing' && track.publicationStatus === 'published') continue;
      filtered.push(track);
    }
    var result = searchCatalog(filtered, state);
    if (result.kind === 'need_more') return [];
    return result.items;
  }

  function uniqueFormats(tracks) {
    var seen = {};
    var out = [];
    for (var i = 0; i < tracks.length; i += 1) {
      var format = tracks[i].format;
      if (format && !seen[format]) {
        seen[format] = true;
        out.push(format);
      }
    }
    out.sort(function (a, b) {
      return a.localeCompare(b, 'ru');
    });
    return out;
  }

  function facetOptions(tracks) {
    var counts = { sit: {}, fmt: {}, ch: {}, lvl: {}, avail: { description: 0, playable: 0 } };
    for (var i = 0; i < tracks.length; i += 1) {
      var meta = deriveMeta(tracks[i]);
      counts.sit[meta.sit] = (counts.sit[meta.sit] || 0) + 1;
      counts.fmt[meta.fmt] = (counts.fmt[meta.fmt] || 0) + 1;
      counts.ch[meta.ch] = (counts.ch[meta.ch] || 0) + 1;
      counts.lvl[meta.lvl] = (counts.lvl[meta.lvl] || 0) + 1;
      counts.avail.description += 1;
      if (meta.playable) counts.avail.playable += 1;
    }
    function present(list, bag) {
      var out = [];
      for (var i = 0; i < list.length; i += 1) {
        if (bag[list[i].id]) out.push({ id: list[i].id, title: list[i].title, count: bag[list[i].id] });
      }
      return out;
    }
    return {
      sit: present(SIT_FILTERS, counts.sit),
      fmt: present(FMT_FILTERS, counts.fmt),
      ch: present(CH_FILTERS, counts.ch),
      lvl: present(LVL_FILTERS, counts.lvl),
      avail: AVAIL_FILTERS.filter(function (item) { return counts.avail[item.id] > 0; }).map(function (item) {
        return { id: item.id, title: item.title, count: counts.avail[item.id] };
      }),
    };
  }

  function relatedTracks(track, catalog, limit, context) {
    limit = limit || 3;
    context = context || {};
    if (!track) return [];
    var byId = {};
    for (var i = 0; i < catalog.length; i += 1) byId[catalog[i].trackId] = catalog[i];
    var out = [];
    var seen = {};
    seen[track.trackId] = true;
    var ids = (track.nextTrackIds || []).concat(track.relatedTrackIds || []);
    for (var n = 0; n < ids.length && out.length < limit; n += 1) {
      if (byId[ids[n]] && !seen[ids[n]]) {
        seen[ids[n]] = true;
        out.push(byId[ids[n]]);
      }
    }
    if (context.query) {
      var ranked = rankTracks(catalog, analyzeQuery(context.query), null, 'soft');
      for (var r = 0; r < ranked.length && out.length < limit; r += 1) {
        if (seen[ranked[r].track.trackId]) continue;
        seen[ranked[r].track.trackId] = true;
        out.push(ranked[r].track);
      }
    }
    for (var t = 0; t < catalog.length && out.length < limit; t += 1) {
      var other = catalog[t];
      if (seen[other.trackId]) continue;
      if (other.module === track.module || other.sectionId === track.sectionId) {
        seen[other.trackId] = true;
        out.push(other);
      }
    }
    return out;
  }

  function nextTrackBundle(track, catalog, context) {
    var byId = {};
    for (var i = 0; i < catalog.length; i += 1) byId[catalog[i].trackId] = catalog[i];
    var primary = null;
    if (track.nextTrackIds && track.nextTrackIds[0] && byId[track.nextTrackIds[0]]) {
      primary = byId[track.nextTrackIds[0]];
    }
    var variants = relatedTracks(track, catalog, 4, context).filter(function (item) {
      return !primary || item.trackId !== primary.trackId;
    }).slice(0, 3);
    return { primary: primary, variants: variants };
  }

  function startPicks(sectionId, level, catalog) {
    var map = {
      A1: { start: ['A1-001', 'A1-004', 'A1-010'], later: ['A1-011', 'A1-012'], other: ['A2-008'] },
      A2: { start: ['A2-008', 'A2-006', 'A2-010'], later: ['A2-001', 'A2-011'], other: ['A3-002'] },
      A3: { start: ['A3-002', 'A3-001', 'A3-016'], later: ['A3-008', 'A3-005'], other: ['A2-008'] },
      A4: { start: ['A4-001', 'A1-012', 'A1-011'], later: ['A1-013', 'A1-014'], other: ['A5-001'] },
      A5: { start: ['A5-001', 'A5-010', 'A5-009'], later: ['A5-011', 'A5-014'], other: ['A3-008'] },
      A6: { start: ['A6-001', 'A6-010', 'A6-006'], later: ['A6-011', 'A6-013'], other: ['A1-016'] },
    };
    if (level === 'mentor') {
      map.A6 = { start: ['A6-013', 'A6-011', 'A1-016'], later: ['A6-012', 'A6-010'], other: ['A1-010'] };
    }
    if (level === 'beginner' && sectionId === 'A1') {
      map.A1 = { start: ['A1-004', 'A1-006', 'A1-010'], later: ['A1-011', 'A2-008'], other: ['A1-001'] };
    }
    var spec = map[sectionId] || map.A1;
    var byId = {};
    for (var i = 0; i < catalog.length; i += 1) byId[catalog[i].trackId] = catalog[i];
    function pick(ids) {
      for (var k = 0; k < ids.length; k += 1) if (byId[ids[k]]) return byId[ids[k]];
      return null;
    }
    return {
      start: pick(spec.start),
      later: pick(spec.later),
      other: pick(spec.other),
    };
  }

  function sectionEntryTracks(sectionId, catalog) {
    var preferred = {
      A1: ['A1-001', 'A1-004', 'A1-010'],
      A2: ['A2-008', 'A2-006', 'A2-010'],
      A3: ['A3-002', 'A3-001', 'A3-016'],
      A4: ['A4-001', 'A1-012', 'A1-011'],
      A5: ['A5-001', 'A5-010', 'A5-009'],
      A6: ['A6-001', 'A6-010', 'A6-013'],
    };
    var ids = preferred[sectionId] || [];
    var byId = {};
    for (var i = 0; i < catalog.length; i += 1) byId[catalog[i].trackId] = catalog[i];
    var out = [];
    for (var n = 0; n < ids.length; n += 1) {
      if (byId[ids[n]] && (byId[ids[n]].sectionId === sectionId || sectionId === 'A4')) out.push(byId[ids[n]]);
    }
    if (out.length < 3) {
      for (var t = 0; t < catalog.length && out.length < 3; t += 1) {
        if (catalog[t].sectionId === sectionId && ids.indexOf(catalog[t].trackId) === -1) out.push(catalog[t]);
      }
    }
    return out.slice(0, 3);
  }

  function exampleQueries() {
    return [
      'Боюсь первым написать знакомому',
      'Не понимаю, с кем начать',
      'Человек сказал, что подумает',
      'Клиент купил и пропал',
      'Хочу получить первый результат',
    ];
  }

  function saveLibraryRestore(payload) {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return;
      window.sessionStorage.setItem(LIBRARY_STATE_KEY, JSON.stringify(payload));
    } catch (err) {
      /* ignore */
    }
  }

  function readLibraryRestore() {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return null;
      var raw = window.sessionStorage.getItem(LIBRARY_STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function trackEvent(name, payload) {
    var data = { event: name };
    if (payload) {
      var keys = Object.keys(payload);
      for (var i = 0; i < keys.length; i += 1) {
        if (payload[keys[i]] != null && payload[keys[i]] !== '') data[keys[i]] = payload[keys[i]];
      }
    }
    try {
      if (typeof window !== 'undefined') {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(data);
      }
    } catch (err) {
      /* ignore */
    }
    return data;
  }

  function itemType() {
    return 'track';
  }

  function stagesForState(state) {
    if (state.stages && state.stages.length) return state.stages.slice();
    if (state.stage) return [state.stage];
    return [];
  }

  api.analyzeQuery = analyzeQuery;
  api.searchCatalog = searchCatalog;
  api.parseLibraryState = parseLibraryState;
  api.serializeLibraryState = serializeLibraryState;
  api.libraryHref = libraryHref;
  api.emptyLibraryState = emptyLibraryState;
  api.getPreset = getPreset;
  api.getGoal = getGoal;
  api.getSituation = getSituation;
  api.getExperience = getExperience;
  api.buildChips = buildChips;
  api.hasActiveFilters = hasActiveFilters;
  api.uniqueFormats = uniqueFormats;
  api.facetOptions = facetOptions;
  api.relatedTracks = relatedTracks;
  api.nextTrackBundle = nextTrackBundle;
  api.startPicks = startPicks;
  api.sectionEntryTracks = sectionEntryTracks;
  api.exampleQueries = exampleQueries;
  api.deriveMeta = deriveMeta;
  api.foundLabel = foundLabel;
  api.trackEvent = trackEvent;
  api.itemType = itemType;
  api.stagesForState = stagesForState;
  api.matchesQuery = matchesQuery;
  api.filterTracks = filterTracks;
  api.saveLibraryRestore = saveLibraryRestore;
  api.readLibraryRestore = readLibraryRestore;
  api.clearFilterKey = clearKey;

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
