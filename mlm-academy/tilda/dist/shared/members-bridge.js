/**
 * Дополнительный скрипт страниц Tilda Members.
 * Вставлять только в настройки Members, не в общесайтовый HEAD B2B.
 * Не доказывает личность и не выдаёт платные права.
 *
 * SIGNUP_ENABLED держать синхронно с tilda/src/commerce.js.
 * После уведомления в Роскомнадзор: true, generate, deploy Worker, обновить extra JS Members.
 */
(function () {
  'use strict';
  var SIGNUP_ENABLED = false;

  if (SIGNUP_ENABLED !== true) {
    try {
      var blockStyle = document.createElement('style');
      blockStyle.id = 'mlma-signup-block-style';
      blockStyle.textContent =
        'a[href*="/members/signup"], a[href*="members/signup"], form[action*="/api/signup"], form[action*="signup"] { display: none !important; visibility: hidden !important; }';
      (document.head || document.documentElement).appendChild(blockStyle);
    } catch (err) {
      /* ignore */
    }
  }

  function isSignupPath() {
    try {
      return /\/members\/signup/i.test(String(location.pathname || ''));
    } catch (err) {
      return false;
    }
  }

  if (SIGNUP_ENABLED !== true && isSignupPath()) {
    try {
      var redirect = '/members/login?signup=paused';
      if (String(location.search || '').indexOf('redirecturl=') !== -1) {
        redirect += '&' + String(location.search || '').replace(/^\?/, '');
      }
      location.replace(redirect);
    } catch (err2) {
      /* fallback to paused UI below */
    }
  }

  try {
    var link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href =
      'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#C45F42"/><rect x="7" y="7" width="18" height="18" rx="3" fill="none" stroke="#1c1914" stroke-width="2"/></svg>',
      );
    document.head.appendChild(link);
  } catch (err) {
    /* ignore */
  }

  function hasRecoverFlag() {
    try {
      return /(?:^|[?&])mlma=recover(?:&|$)/.test(String(location.search || ''));
    } catch (err) {
      return false;
    }
  }

  function clickRecover() {
    var nodes = document.querySelectorAll('a, button');
    for (var i = 0; i < nodes.length; i += 1) {
      var text = String(nodes[i].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!text) continue;
      if (/забыли пароль|забыл пароль|восстанов|remind password|forgot password/.test(text)) {
        nodes[i].click();
        return true;
      }
    }
    return false;
  }

  var RU = {
    'Log In To Your Account': 'Войти в кабинет',
    'Log in to your account': 'Войти в кабинет',
    'Sign Up': 'Создать кабинет',
    'Sign up': 'Создать кабинет',
    'Create Account': 'Создать кабинет',
    'Create an account': 'Создать кабинет',
    Password: 'Пароль',
    'Confirm Password': 'Повторите пароль',
    'Confirm password': 'Повторите пароль',
    'Forgot password?': 'Забыли пароль?',
    'Forgot Password?': 'Забыли пароль?',
    'Remember me': 'Запомнить меня',
    'Remember Me': 'Запомнить меня',
    'Log In': 'Войти',
    'Log in': 'Войти',
    'Sign In': 'Войти',
    "Don't have an account?": 'Ещё нет кабинета?',
    'Already have an account?': 'Уже есть кабинет?',
    'Reset Password': 'Восстановить пароль',
    Send: 'Отправить',
    Submit: 'Отправить',
    Name: 'Имя',
    'First Name': 'Имя',
    'Last Name': 'Фамилия',
  };

  function translateNode(root) {
    if (!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var raw = String(node.nodeValue || '');
      var key = raw.replace(/\s+/g, ' ').trim();
      if (RU[key]) node.nodeValue = raw.replace(key, RU[key]);
    }
    var placeholders = root.querySelectorAll ? root.querySelectorAll('input[placeholder], textarea[placeholder]') : [];
    for (var i = 0; i < placeholders.length; i += 1) {
      var ph = placeholders[i].getAttribute('placeholder') || '';
      if (RU[ph]) placeholders[i].setAttribute('placeholder', RU[ph]);
    }
  }

  function translateAll() {
    translateNode(document.getElementById('allrecords') || document.body);
  }

  translateAll();
  setTimeout(translateAll, 400);
  setTimeout(translateAll, 1200);

  var CONSENT_LABEL =
    '<label class="mlma-pdn-consent" style="display:flex;gap:8px;align-items:flex-start;text-align:left;font-size:13px;line-height:1.45;margin:12px 0">' +
    '<input type="checkbox" name="pdn_consent" required>' +
    '<span>Я даю согласие на обработку персональных данных на условиях ' +
    '<a href="https://mlmacademy.ru/consent" target="_blank" rel="noopener">Согласия</a> ' +
    'и ознакомлен(а) с ' +
    '<a href="https://mlmacademy.ru/privacy" target="_blank" rel="noopener">Политикой</a>.</span></label>';

  var MARKETING_LABEL =
    '<label class="mlma-marketing-consent" style="display:flex;gap:8px;align-items:flex-start;text-align:left;font-size:13px;line-height:1.45;margin:12px 0">' +
    '<input type="checkbox" name="marketing_consent">' +
    '<span>Я хочу получать новости и специальные предложения MLM Academy и принимаю ' +
    '<a href="https://mlmacademy.ru/marketing-consent" target="_blank" rel="noopener">Согласие на рекламные сообщения</a>.</span></label>';

  var SIGNUP_NOTE =
    '<p class="mlma-signup-note" style="font-size:12px;line-height:1.45;margin:8px 0 16px;text-align:left">Создавая аккаунт, я принимаю правила использования бесплатных функций MLM Academy. При покупке продукта применяется редакция публичной оферты, которую я отдельно приму перед оплатой.</p>';

  function findSignupForm() {
    var forms = document.querySelectorAll('form');
    for (var i = 0; i < forms.length; i += 1) {
      var action = String(forms[i].getAttribute('action') || forms[i].getAttribute('data-formaction') || '').toLowerCase();
      if (action.indexOf('/api/signup') !== -1) return forms[i];
    }
    if (!isSignupPath()) return null;
    for (var j = 0; j < forms.length; j += 1) {
      var hasPass = forms[j].querySelector('input[type="password"]');
      var hasEmail = forms[j].querySelector('input[type="email"], input[name="email"]');
      if (hasPass && hasEmail) return forms[j];
    }
    return null;
  }

  function hideSignupLinks() {
    var links = document.querySelectorAll('a[href*="/members/signup"], a[href*="members/signup"]');
    for (var i = 0; i < links.length; i += 1) {
      links[i].style.display = 'none';
      links[i].setAttribute('aria-hidden', 'true');
      links[i].setAttribute('tabindex', '-1');
      if (links[i].parentNode && links[i].parentNode.tagName === 'P') {
        var parentText = String(links[i].parentNode.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (/ещё нет кабинета|don't have an account|создать кабинет|sign up|create account/.test(parentText)) {
          links[i].parentNode.style.display = 'none';
        }
      }
    }
    var nodes = document.querySelectorAll('a, button, p, span, div');
    for (var j = 0; j < nodes.length; j += 1) {
      var text = String(nodes[j].textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!text) continue;
      if (/don't have an account|ещё нет кабинета|создать кабинет|sign up|create account/.test(text) && text.length < 80) {
        if (nodes[j].tagName === 'A' || nodes[j].tagName === 'BUTTON') {
          nodes[j].style.display = 'none';
        }
      }
    }
  }

  function blockForm(form) {
    if (!form || form.getAttribute('data-mlma-signup-blocked') === '1') return;
    form.setAttribute('data-mlma-signup-blocked', '1');
    form.setAttribute('aria-hidden', 'true');
    form.style.display = 'none';
    var fields = form.querySelectorAll('input, button, select, textarea');
    for (var i = 0; i < fields.length; i += 1) {
      fields[i].disabled = true;
    }
    form.addEventListener(
      'submit',
      function (event) {
        event.preventDefault();
        event.stopPropagation();
      },
      true,
    );
  }

  function showSignupPaused() {
    if (document.querySelector('.mlma-signup-paused')) return;
    var box = document.createElement('div');
    box.className = 'mlma-signup-paused';
    box.innerHTML =
      '<p class="mlma-signup-paused-title">Регистрация временно закрыта</p>' +
      '<p>Новые кабинеты не создаём. Каталог, документы и вход в уже существующий кабинет работают как раньше.</p>' +
      '<p class="mlma-signup-paused-actions"><a href="/members/login">Войти</a> · <a href="/academy">В Академию</a></p>';
    var form = findSignupForm();
    var host = (form && form.parentNode) || document.getElementById('allrecords') || document.body;
    if (form && form.parentNode) host.insertBefore(box, form);
    else host.appendChild(box);
  }

  function pauseSignup() {
    if (SIGNUP_ENABLED === true) return;
    hideSignupLinks();
    if (!isSignupPath()) return;
    var form = findSignupForm();
    if (form) blockForm(form);
    showSignupPaused();
  }

  function injectSignupConsent() {
    if (SIGNUP_ENABLED !== true) return;
    if (!isSignupPath()) return;
    var form = findSignupForm();
    if (!form) return;
    if (!form.querySelector('input[name="pdn_consent"]')) {
      var wrap = document.createElement('div');
      wrap.className = 'mlma-pdn-consent-wrap';
      wrap.innerHTML = CONSENT_LABEL + MARKETING_LABEL + SIGNUP_NOTE;
      var holder = form.querySelector('.tlk-form__sub-text');
      var submit = form.querySelector('button[type="submit"], input[type="submit"], .t-submit, [data-tilda-submit]');
      if (holder) holder.appendChild(wrap);
      else if (submit && submit.parentNode) submit.parentNode.insertBefore(wrap, submit);
      else form.appendChild(wrap);
    } else if (!form.querySelector('input[name="marketing_consent"]')) {
      var extra = document.createElement('div');
      extra.className = 'mlma-marketing-consent-wrap';
      extra.innerHTML = MARKETING_LABEL + SIGNUP_NOTE;
      var pdn = form.querySelector('.mlma-pdn-consent-wrap') || form.querySelector('input[name="pdn_consent"]').parentNode;
      if (pdn && pdn.parentNode) pdn.parentNode.insertBefore(extra, pdn.nextSibling);
      else form.appendChild(extra);
    }
    if (form.getAttribute('data-mlma-pdn-bound') === '1') return;
    form.setAttribute('data-mlma-pdn-bound', '1');
    form.addEventListener(
      'submit',
      function (event) {
        var box = form.querySelector('input[name="pdn_consent"]');
        if (box && !box.checked) {
          event.preventDefault();
          event.stopPropagation();
          if (box.reportValidity) box.reportValidity();
          else box.focus();
        }
      },
      true,
    );
    var buttons = form.querySelectorAll('button, input[type="submit"], .t-submit');
    for (var b = 0; b < buttons.length; b += 1) {
      buttons[b].addEventListener(
        'click',
        function (event) {
          var box = form.querySelector('input[name="pdn_consent"]');
          if (box && !box.checked) {
            event.preventDefault();
            event.stopPropagation();
            if (box.reportValidity) box.reportValidity();
            else box.focus();
          }
        },
        true,
      );
    }
  }

  injectSignupConsent();
  setTimeout(injectSignupConsent, 400);
  setTimeout(injectSignupConsent, 1200);
  pauseSignup();
  setTimeout(pauseSignup, 400);
  setTimeout(pauseSignup, 1200);

  try {
    var obs = new MutationObserver(function () {
      translateAll();
      injectSignupConsent();
      pauseSignup();
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  } catch (err) {
    /* ignore */
  }

  if (hasRecoverFlag()) {
    if (!clickRecover()) {
      setTimeout(clickRecover, 400);
      setTimeout(clickRecover, 1200);
    }
  }
})();
