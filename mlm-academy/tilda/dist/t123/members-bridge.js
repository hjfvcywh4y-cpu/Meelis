/**
 * Дополнительный скрипт страниц Tilda Members.
 * Вставлять только в настройки Members, не в общесайтовый HEAD B2B.
 * Не доказывает личность и не выдаёт платные права.
 */
(function () {
  'use strict';
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

  function ensureRegistrationConsent() {
    var form = document.getElementById('form-signup');
    if (!form || form.querySelector('#mlma-members-consent')) return;
    var submit = form.querySelector('.tlk-form__submit-wrap, button[type="submit"], input[type="submit"]');
    if (!submit) return;
    var wrap = document.createElement('div');
    wrap.className = 'mlma-members-consent';
    wrap.innerHTML =
      '<label><input type="checkbox" id="mlma-members-consent" name="mlma_members_consent" required> ' +
      '<span>Я принимаю <a href="/consent" target="_blank" rel="noopener">согласие на обработку и передачу персональных данных</a> ' +
      'и <a href="/privacy" target="_blank" rel="noopener">политику конфиденциальности</a>.</span></label>';
    var submitWrap = submit.closest ? submit.closest('.tlk-form__submit-wrap') || submit : submit;
    submitWrap.parentNode.insertBefore(wrap, submitWrap);
    form.addEventListener(
      'submit',
      function (event) {
        var checkbox = form.querySelector('#mlma-members-consent');
        if (checkbox && !checkbox.checked) {
          event.preventDefault();
          event.stopImmediatePropagation();
          checkbox.reportValidity();
        }
      },
      true,
    );
  }

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
    ensureRegistrationConsent();
  }

  translateAll();
  setTimeout(translateAll, 400);
  setTimeout(translateAll, 1200);
  try {
    var obs = new MutationObserver(function () {
      translateAll();
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
