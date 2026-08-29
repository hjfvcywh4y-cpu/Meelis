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

  if (hasRecoverFlag()) {
    if (!clickRecover()) {
      setTimeout(clickRecover, 400);
      setTimeout(clickRecover, 1200);
    }
  }
})();
