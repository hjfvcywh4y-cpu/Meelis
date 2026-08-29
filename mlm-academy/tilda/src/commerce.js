/**
 * Предплатёжная витрина. Не подключает ЮKассу, не выдаёт право, не включает подписку.
 * Track ID и product_code — разные сущности.
 */
(function (root) {
  'use strict';
  var api = root.MLMA;
  if (!api) return;

  var PAYMENTS_ENABLED = false;
  var COMMERCE_PREVIEW_ENABLED = false;
  var REQUIRED_CODES = [
    'B2C-FREE-001',
    'B2C-TRACK-001',
    'B2C-PACK3-001',
    'B2C-ROUTE6-001',
    'B2C-LIB-M-001',
    'B2C-LIB-Y-001',
    'B2C-PRO-M-001',
    'B2B-PILOT30-001',
    'B2B-TEAM20-M-001',
  ];

  var FALLBACK_CATALOG = root.MLMA_PRODUCTS || { schema: 'mlma.products.v1', products: [] };

  function readCatalog() {
    if (root.MLMA_PAYLOAD && root.MLMA_PAYLOAD.products && root.MLMA_PAYLOAD.products.products) {
      return root.MLMA_PAYLOAD.products;
    }
    if (root.MLMA_PAYLOAD && Array.isArray(root.MLMA_PAYLOAD.products)) {
      return { products: root.MLMA_PAYLOAD.products, flags: root.MLMA_PAYLOAD.productFlags || {} };
    }
    return FALLBACK_CATALOG;
  }

  function listProducts() {
    var cat = readCatalog();
    return (cat && cat.products) || [];
  }

  function getProductByCode(code) {
    var list = listProducts();
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].product_code === code) return list[i];
    }
    return null;
  }

  function formatPrice(value) {
    if (value == null || value === '') return '';
    var n = Number(value);
    if (!isFinite(n)) return '';
    var s = String(Math.round(n));
    var out = '';
    for (var i = 0; i < s.length; i += 1) {
      out = s.charAt(s.length - 1 - i) + out;
      if (i % 3 === 2 && i !== s.length - 1) out = '\u00a0' + out;
    }
    return out + '\u00a0₽';
  }

  function isLocalPreviewHost() {
    try {
      var h = String((root.location && root.location.hostname) || '');
      return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || /\.tilda\.ws$/.test(h);
    } catch (err) {
      return false;
    }
  }

  function isProductionHost() {
    try {
      var h = String((root.location && root.location.hostname) || '');
      return h === 'mlmacademy.ru' || h === 'www.mlmacademy.ru';
    } catch (err) {
      return false;
    }
  }

  function commercePreviewAllowed() {
    if (COMMERCE_PREVIEW_ENABLED === true) return false;
    if (isProductionHost()) return false;
    return isLocalPreviewHost();
  }

  function legalPagesReady(legal) {
    legal = legal || {};
    return !!(legal.offerPublished && legal.privacyApproved && legal.requisitesFilled);
  }

  function trackById(tracks, id) {
    if (!id || !tracks) return null;
    for (var i = 0; i < tracks.length; i += 1) {
      if (tracks[i].trackId === id || tracks[i].id === id) return tracks[i];
    }
    return null;
  }

  function hasText(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function trackContentReady(track) {
    if (!track) return { ok: false, missing: ['track'] };
    var missing = [];
    if (track.publicationStatus !== 'published') missing.push('publication_status');
    if (track.contentStatus !== 'complete') missing.push('content_status');
    if (!hasText(track.title)) missing.push('title');
    if (!hasText(track.situation)) missing.push('situation');
    if (!hasText(track.outcome)) missing.push('outcome');
    var duration = track.duration || track.durationMin || track.format;
    if (!hasText(duration)) missing.push('duration');
    var action = track.action || track.actions || track.steps || track.practice;
    var hasAction = Array.isArray(action) ? action.length > 0 : hasText(action);
    if (!hasAction) missing.push('action');
    if (!hasText(track.completionCriteria) && !hasText(track.completion_criteria) && !hasText(track.doneWhen)) {
      missing.push('completion_criteria');
    }
    if (!hasText(track.composition) && !hasText(track.outline) && !hasText(track.contentOutline)) {
      missing.push('content_outline');
    }
    return { ok: missing.length === 0, missing: missing };
  }

  function relatedComplete(tracks, ids, expected) {
    if (!ids || ids.length !== expected) {
      return { ok: false, missing: ['track_ids:' + expected] };
    }
    var missing = [];
    for (var i = 0; i < ids.length; i += 1) {
      var ready = trackContentReady(trackById(tracks, ids[i]));
      if (!ready.ok) missing.push(ids[i] + ':' + ready.missing.join(','));
    }
    return { ok: missing.length === 0, missing: missing };
  }

  function evaluateLaunchGate(product, context) {
    context = context || {};
    var tracks = context.tracks || [];
    var legal = context.legal || (readCatalog().legal || {});
    var reasons = [];
    if (!product) return { ok: false, can_activate: false, reasons: ['product_missing'] };
    if (product.publication_status === 'planned') {
      return { ok: false, can_activate: false, reasons: ['planned'], product_code: product.product_code, publication_status: product.publication_status };
    }
    if (product.billing_type === 'subscription_month' || product.billing_type === 'subscription_year') {
      reasons.push('subscription_not_implemented');
    }
    if (product.sale_channel === 'negotiation' || product.sale_channel === 'hidden') {
      reasons.push('not_card_checkout');
    }
    if (!legalPagesReady({
      offerPublished: legal.offer_status === 'published' || legal.offerPublished,
      privacyApproved: legal.privacy_status === 'approved' || legal.privacyApproved,
      requisitesFilled: legal.requisites_status === 'filled' || legal.requisitesFilled,
    })) {
      reasons.push('legal_pages_unpublished');
    }
    if (context.paymentsBackendTestsPassed !== true) reasons.push('payments_backend_untested');
    if (PAYMENTS_ENABLED !== true) reasons.push('PAYMENTS_ENABLED=false');

    var gate = product.launch_gate;
    if (gate === 'promo_track_published_complete') {
      var promoId = product.bound_track_id || (product.track_ids && product.track_ids[0]);
      var promo = trackContentReady(trackById(tracks, promoId));
      if (!promo.ok) reasons.push('promo_track_not_complete');
    }
    if (gate === 'single_track_complete') {
      var tid = product.bound_track_id || (product.track_ids && product.track_ids[0]);
      if (!tid) reasons.push('bound_track_id_missing');
      else {
        if (!trackById(tracks, tid)) reasons.push('track_id_not_in_catalog');
        var single = trackContentReady(trackById(tracks, tid));
        if (!single.ok) reasons.push.apply(reasons, single.missing);
      }
      if (!(product.access_days > 0)) reasons.push('access_days');
      if (product.launch_price == null || product.regular_price == null) reasons.push('price');
    }
    if (gate === 'pack3_related_complete') {
      var pack = relatedComplete(tracks, product.track_ids, 3);
      if (!pack.ok) reasons.push.apply(reasons, pack.missing);
      if (!(product.access_days > 0)) reasons.push('access_days');
      if (product.launch_price == null || product.regular_price == null) reasons.push('price');
    }
    if (gate === 'route6_related_complete') {
      var route = relatedComplete(tracks, product.track_ids, 6);
      if (!route.ok) reasons.push.apply(reasons, route.missing);
      if (!(product.access_days > 0)) reasons.push('access_days');
      if (product.launch_price == null || product.regular_price == null) reasons.push('price');
    }
    if (gate === 'leader_cockpit_required' && context.leaderCockpitReady !== true) {
      reasons.push('leader_cockpit_missing');
    }
    if (gate === 'b2b_negotiation_only') reasons.push('negotiation_only');

    var can = reasons.length === 0;
    return {
      ok: can,
      can_activate: can,
      reasons: reasons,
      product_code: product.product_code,
      publication_status: product.publication_status,
    };
  }

  function isProductPurchasable(product, context) {
    if (!product) return false;
    if (PAYMENTS_ENABLED !== true) return false;
    if (product.publication_status !== 'active') return false;
    if (product.checkout_eligible !== true) return false;
    if (product.sale_channel !== 'storefront') return false;
    if (product.billing_type !== 'one_time' && product.billing_type !== 'free') return false;
    var gate = evaluateLaunchGate(product, context);
    return gate.ok === true && product.publication_status === 'active';
  }

  function canShowBuyButton(product, track, context) {
    if (track) {
      if (track.publicationStatus === 'planned') return false;
      if (track.contentStatus === 'metadata_only') return false;
      if (track.contentStatus !== 'complete') return false;
      if (track.publicationStatus !== 'published') return false;
    }
    return isProductPurchasable(product, context);
  }

  function activateProductClient() {
    return {
      ok: false,
      reason: 'client_cannot_activate',
      publication_status: 'unchanged',
    };
  }

  function grantFromQuery() {
    return [];
  }

  function grantFromLocalStorage() {
    return [];
  }

  function grantFromTildaGroup(groups) {
    var out = [];
    groups = groups || [];
    for (var i = 0; i < groups.length; i += 1) {
      if (groups[i] === 'START' || groups[i] === 'FULL' || groups[i] === 'PILOT') {
        return [];
      }
    }
    return out;
  }

  function listPricingProducts() {
    var list = listProducts();
    var out = [];
    for (var i = 0; i < list.length; i += 1) {
      if (!list[i].show_in_pricing) continue;
      if (list[i].sale_channel === 'hidden') continue;
      out.push(list[i]);
    }
    return out;
  }

  function publicB2CProducts() {
    var codes = ['B2C-FREE-001', 'B2C-TRACK-001', 'B2C-PACK3-001', 'B2C-ROUTE6-001'];
    var out = [];
    for (var i = 0; i < codes.length; i += 1) {
      var p = getProductByCode(codes[i]);
      if (p) out.push(p);
    }
    return out;
  }

  function storefrontStatusLabel(product) {
    if (!product) return 'Недоступно';
    if (product.publication_status === 'active' && isProductPurchasable(product)) return 'Можно купить';
    if (product.publication_status === 'gated') return 'Готовится к запуску';
    if (product.publication_status === 'planned') return 'Пока не предлагается';
    return 'Готовится к запуску';
  }

  function productCardView(product) {
    product = product || {};
    var launch = formatPrice(product.launch_price);
    var regular = formatPrice(product.regular_price);
    return {
      product_code: product.product_code,
      display_name: product.display_name,
      short_description: product.short_description,
      buyer_segment: product.buyer_segment,
      billing_type: product.billing_type,
      launch_price_label: launch,
      regular_price_label: regular,
      access_days: product.access_days || 0,
      status: product.publication_status,
      status_label: storefrontStatusLabel(product),
      composition: product.grant_scope,
      buy_enabled: false,
      cta: product.sale_channel === 'negotiation' ? 'discuss' : 'preparing',
    };
  }

  function purchaseUiStates() {
    return [
      { key: 'card', title: 'Карточка продукта', note: 'Цена, состав, статус. Кнопки «Купить» нет.' },
      { key: 'composition', title: 'Состав продукта', note: 'Track ID задаёт сервер. Карточка трека — не продукт.' },
      { key: 'confirm', title: 'Подтверждение', note: 'Будущий шаг до оплаты. Сейчас недоступен.' },
      { key: 'waiting', title: 'Ожидание оплаты', note: 'Форма провайдера ещё не подключена.' },
      { key: 'success', title: 'Успешная оплата', note: 'Redirect не является оплатой. Право появится только после webhook.' },
      { key: 'cancelled', title: 'Оплата отменена', note: 'Заказ не создаёт доступ.' },
      { key: 'error', title: 'Ошибка оплаты', note: 'Деньги не списаны, право не выдано.' },
      { key: 'refund', title: 'Возврат', note: 'Возврат не удаляет платёж. Право отзывается отдельно.' },
      { key: 'granted', title: 'Право выдано', note: 'Только после verified user и проверенного webhook.' },
      { key: 'expired', title: 'Право истекло', note: 'Срок разового доступа — 365 дней.' },
      { key: 'revoked', title: 'Право отозвано', note: 'История платежа сохраняется.' },
    ];
  }

  function classifyAccessRow(track, account, savedIds) {
    savedIds = savedIds || [];
    var saved = savedIds.indexOf(track && track.trackId) !== -1;
    var access = api.normalizeAccess ? api.normalizeAccess(track && track.access) : 'paid';
    var entitled = api.isEntitledToTrack ? api.isEntitledToTrack(track, account) : false;
    if (entitled && access === 'paid') return { key: 'purchased', label: 'куплено' };
    if (access === 'public' || access === 'promo') return { key: 'free', label: 'доступно бесплатно' };
    if (track && (track.publicationStatus === 'planned' || track.contentStatus === 'metadata_only')) {
      if (saved) return { key: 'saved', label: 'сохранено' };
      return { key: 'preparing', label: 'готовится' };
    }
    if (!entitled && access === 'paid') {
      if (saved) return { key: 'saved', label: 'сохранено' };
      return { key: 'closed', label: 'закрыто' };
    }
    if (saved) return { key: 'saved', label: 'сохранено' };
    return { key: 'preparing', label: 'готовится' };
  }

  function paymentsSafeState() {
    return {
      ok: false,
      reason: 'payments_disabled',
      message: 'Оплата ещё не запущена',
      PAYMENTS_ENABLED: false,
      COMMERCE_PREVIEW_ENABLED: false,
    };
  }

  api.PAYMENTS_ENABLED = PAYMENTS_ENABLED;
  api.COMMERCE_PREVIEW_ENABLED = COMMERCE_PREVIEW_ENABLED;
  api.PRODUCT_CODES = REQUIRED_CODES;
  api.readProductCatalog = readCatalog;
  api.listProducts = listProducts;
  api.getProductByCode = getProductByCode;
  api.formatPrice = formatPrice;
  api.evaluateLaunchGate = evaluateLaunchGate;
  api.isProductPurchasable = isProductPurchasable;
  api.canShowBuyButton = canShowBuyButton;
  api.activateProductClient = activateProductClient;
  api.grantFromQuery = grantFromQuery;
  api.grantFromLocalStorage = grantFromLocalStorage;
  api.grantFromTildaGroup = grantFromTildaGroup;
  api.listPricingProducts = listPricingProducts;
  api.publicB2CProducts = publicB2CProducts;
  api.productCardView = productCardView;
  api.storefrontStatusLabel = storefrontStatusLabel;
  api.purchaseUiStates = purchaseUiStates;
  api.commercePreviewAllowed = commercePreviewAllowed;
  api.isLocalPreviewHost = isLocalPreviewHost;
  api.classifyAccessRow = classifyAccessRow;
  api.paymentsSafeState = paymentsSafeState;
  api.trackContentReady = trackContentReady;
  api.PRODUCTS = publicB2CProducts();

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
