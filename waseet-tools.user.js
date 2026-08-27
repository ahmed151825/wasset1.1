// ==UserScript==
// @name          4احمد محمد كريم
// @namespace    waseet-tools
// @version      4.4.5
// @description  أدوات مركز خدمة العملاء + مراقب التوصيل الاحترافي — ملف موحد مع فحص تحديثات تلقائي من GitHub
// @author       Ahmed Mohammed Kareem
// @match        *://alwaseet-iq.net/*
// @match        *://*.alwaseet-iq.net/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_notification
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      raw.githubusercontent.com
// @connect      api.github.com
// @connect      api.jsonbin.io
// @connect      alwaseet-iq.net
// @icon         data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">🚚</text></svg>
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/ahmed151825/wasset1.1/main/waseet-tools.user.js
// @downloadURL  https://raw.githubusercontent.com/ahmed151825/wasset1.1/main/waseet-tools.user.js
// ==/UserScript==

// ══════════════════════════════════════════════════════════════
//  🛡️ وحدة تحكم المدير عن بُعد (خاصة حصراً بحساب "احمد محمد كريم")
// ══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var ADMIN_NAME       = 'احمد محمد كريم';
  var CONTROL_REPO     = 'ahmed151825/wasset1.1';
  var CONTROL_PATH     = 'control.json';
  var CONTROL_RAW_URL  = 'https://raw.githubusercontent.com/' + CONTROL_REPO + '/main/' + CONTROL_PATH;
  var CONTROL_API_URL  = 'https://api.github.com/repos/' + CONTROL_REPO + '/contents/' + CONTROL_PATH;

  // ─── JSONBin: تسجيل أسماء الموظفين تلقائياً (مرة واحدة فقط لكل جهاز) ───
  var JSONBIN_BIN_ID    = '6a8fef06da38895dfe16f1a5';
  var JSONBIN_WRITE_KEY = '$2a$10$Z8LedFqhdb4VbJK8HLr7yeKFw6PQir7aFJFV3MDlfSBezDfanpe2S';
  var JSONBIN_READ_KEY  = '$2a$10$QQpXwj2aZZlR/CbDP35.ruCvjfxQm8R3KNNeGN22A98Tm8rMw7Inq';
  var JSONBIN_URL       = 'https://api.jsonbin.io/v3/b/' + JSONBIN_BIN_ID;
  var JSONBIN_SENT_KEY  = 'ws_admin_jb_sent_v1'; // حُفظ محلياً بعد الإرسال — لا يرسل ثانية

  var CACHE_KEY        = 'ws_admin_control_cache_v1';
  var USERNAME_KEY      = 'ws_admin_cached_username_v1';
  var TOKEN_KEY         = 'ws_admin_gh_token_v1';
  var LAST_FETCH_KEY    = 'ws_admin_last_fetch_v1';
  var KNOWN_USERS_KEY   = 'ws_admin_known_usernames_v1';
  var FETCH_INTERVAL_MS = 15 * 60 * 1000; // 15 دقيقة

  // كل ميزة قابلة للتحكم بها عن بعد لكل موظف. المفاتيح مطابقة تماماً
  // لأسماء خصائص wsSettings الموجودة أصلاً بالملف (باستثناء آخر ميزتين).
  var FEATURE_DEFS = [
    { key: 'showStory',            label: '🔍 زر قصة الطلب' },
    { key: 'showFees',              label: '➕ زر أجور التوصيل' },
    { key: 'showEdit',               label: '🌐 زر تغيير العنوان' },
    { key: 'showWsMerchant',         label: '💬 واتساب التاجر' },
    { key: 'showWsCustomer',         label: '📦 واتساب الزبون' },
    { key: 'showSms',                label: '📱 رسالة SMS للزبون' },
    { key: 'showPhoneSearch',        label: '🔎 بحث الزبون بالهاتف' },
    { key: 'showDelayCheck',         label: '🔎 فحص التأخير' },
    { key: 'showCopyReport',         label: '📋 نسخ تقرير الأجور' },
    { key: 'showCopyReps',           label: '📋 نسخ قائمة المناديب' },
    { key: 'showRepRating',          label: '⭐ تقييم المندوب' },
    { key: 'showDeferred',           label: '🕒 زر المؤجل' },
    { key: 'showReceivedCounter',    label: '📦 عدّاد الطلبات المستلمة' },
    { key: 'smartDecisionEnabled',   label: '🧠 الزر الذكي' },
    { key: 'deliveryMonitorEnabled', label: '🚚 مراقب التوصيل' }
  ];

  // ───────────────── تخزين محلي (GM أولاً، مع مرآة localStorage) ─────────────────
  function gGet(k, d) {
    try { if (typeof GM_getValue !== 'undefined') { var v = GM_getValue(k, null); if (v !== null && v !== undefined) { return v; } } } catch (e) {}
    try { var v2 = localStorage.getItem(k); if (v2 !== null) { return v2; } } catch (e) {}
    return d;
  }
  function gSet(k, v) {
    try { if (typeof GM_setValue !== 'undefined') { GM_setValue(k, v); } } catch (e) {}
    try { localStorage.setItem(k, v); } catch (e) {}
  }

  // ───────────────── تحديد اسم الموظف الحالي ─────────────────
  function getUsername() {
    try {
      var el = document.querySelector('span.user-name');
      if (el) {
        var name = (el.textContent || '').trim();
        if (name) { gSet(USERNAME_KEY, name); return name; }
      }
    } catch (e) {}
    return gGet(USERNAME_KEY, '') || '';
  }

  function isAdmin() {
    return getUsername() === ADMIN_NAME;
  }

  function recordKnownUsername(name) {
    if (!name) { return; }
    var raw = gGet(KNOWN_USERS_KEY, '[]'), list;
    try { list = JSON.parse(raw); } catch (e) { list = []; }
    if (!Array.isArray(list)) { list = []; }
    if (list.indexOf(name) === -1) { list.push(name); gSet(KNOWN_USERS_KEY, JSON.stringify(list)); }
  }

  // يسجّل تلقائياً كل الأسماء الموجودة بالصفحة الحالية في قائمة محلية —
  // يعمل عند كل تحميل صفحة (على جهاز المدير فقط) بصمت تام
  function autoScanAndRecord() {
    try {
      var els = document.querySelectorAll('span.user-name, .user-name');
      els.forEach(function (el) {
        var name = (el.textContent || '').trim();
        if (name && name !== ADMIN_NAME && /^[\u0600-\u06FF\s.]{3,40}$/.test(name)) {
          recordKnownUsername(name);
        }
      });
    } catch (e) {}
  }

  // ─── JSONBin: إرسال اسم الموظف مرة واحدة فقط ───────────────────────────────
  // يُستدعى من boot() عند أي موظف عادي — يتحقق أولاً هل أرسل من قبل (محلياً)
  // ثم يجلب القائمة الحالية ويضيف اسمه ويرفع مرة وحدة ويحفظ علامة "تم الإرسال"
  function registerUserOnce(username) {
    if (!username || username === ADMIN_NAME) { return; }
    if (gGet(JSONBIN_SENT_KEY, '') === username) { return; } // أرسل من قبل بهذا الجهاز
    if (typeof GM_xmlhttpRequest === 'undefined') { return; }
    // أولاً: اجلب القائمة الحالية
    GM_xmlhttpRequest({
      method: 'GET',
      url: JSONBIN_URL + '/latest',
      headers: { 'X-Master-Key': JSONBIN_WRITE_KEY, 'X-Bin-Meta': 'false' },
      onload: function (res) {
        var users = [];
        try { var j = JSON.parse(res.responseText); users = Array.isArray(j.users) ? j.users : []; } catch (e) {}
        if (users.indexOf(username) !== -1) {
          gSet(JSONBIN_SENT_KEY, username); // موجود مسبقاً — علّم كتم الإرسال مجدداً
          return;
        }
        users.push(username);
        // ارفع القائمة المحدَّثة
        GM_xmlhttpRequest({
          method: 'PUT',
          url: JSONBIN_URL,
          headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_WRITE_KEY },
          data: JSON.stringify({ users: users }),
          onload: function (res2) {
            if (res2.status >= 200 && res2.status < 300) {
              gSet(JSONBIN_SENT_KEY, username); // تم بنجاح — لا يرسل ثاني مرة أبداً
            }
          },
          onerror: function () {} // صمت — يحاول مرة ثانية بالتحميل القادم
        });
      },
      onerror: function () {}
    });
  }

  // ─── JSONBin: جلب قائمة الموظفين المسجلين (للمدير فقط من لوحة التحكم) ───────
  function fetchRegisteredUsers(cb) {
    if (typeof GM_xmlhttpRequest === 'undefined') { cb([]); return; }
    GM_xmlhttpRequest({
      method: 'GET',
      url: JSONBIN_URL + '/latest',
      headers: { 'X-Master-Key': JSONBIN_READ_KEY, 'X-Bin-Meta': 'false' },
      onload: function (res) {
        try {
          var j = JSON.parse(res.responseText);
          cb(Array.isArray(j.users) ? j.users : []);
        } catch (e) { cb([]); }
      },
      onerror: function () { cb([]); }
    });
  }

  // ───────────────── قراءة/حفظ إعدادات التحكم المخزّنة محلياً ─────────────────
  function defaultConfig() {
    return { globalEnabled: true, updatedAt: null, employees: {} };
  }
  function loadCachedControl() {
    var raw = gGet(CACHE_KEY, null);
    if (!raw) { return null; }
    try { var obj = JSON.parse(raw); return (obj && typeof obj === 'object') ? obj : null; } catch (e) { return null; }
  }
  function saveCachedControl(obj) {
    try { gSet(CACHE_KEY, JSON.stringify(obj)); } catch (e) {}
  }

  function getEmployeeRule(username) {
    var cfg = loadCachedControl();
    if (!cfg) { return null; } // لا يوجد إعداد محفوظ بعد
    if (cfg.globalEnabled === false) { return { enabled: false, overrides: {} }; }
    var emp = cfg.employees && cfg.employees[username];
    if (!emp) { return { enabled: true, overrides: {} }; }
    return { enabled: emp.enabled !== false, overrides: emp.overrides || {} };
  }

  // ───────────────── واجهات يستخدمها بقية السكربت (IIFEs الأخرى) ─────────────────
  function isEnabledForMe() {
    if (isAdmin()) { return true; }
    var rule = getEmployeeRule(getUsername());
    if (!rule) { return true; } // Fail-open: لا إعداد بعد أو تعذّر الوصول
    return rule.enabled !== false;
  }

  function isDeliveryMonitorEnabledForMe() {
    if (isAdmin()) { return true; }
    var rule = getEmployeeRule(getUsername());
    if (!rule) { return true; }
    if (rule.enabled === false) { return false; }
    return rule.overrides && rule.overrides.deliveryMonitorEnabled === false ? false : true;
  }

  // يدمج قيود المدير فوق إعدادات الموظف المحلية — يعطّل فقط، لا يفرض تفعيل قسري
  function applyOverrides(settings) {
    if (isAdmin()) { return settings; }
    var rule = getEmployeeRule(getUsername());
    if (!rule || rule.enabled === false) { return settings; }
    var merged = {};
    for (var k in settings) { if (Object.prototype.hasOwnProperty.call(settings, k)) { merged[k] = settings[k]; } }
    var ov = rule.overrides || {};
    for (var fk in ov) {
      if (Object.prototype.hasOwnProperty.call(ov, fk) && ov[fk] === false && fk !== 'deliveryMonitorEnabled') {
        merged[fk] = false;
      }
    }
    return merged;
  }

  // هل هذه الميزة مقفولة من المدير؟ — تستخدمها لوحة الإعدادات لمنع الموظف
  // من إعادة تفعيل ميزة أوقفها المدير (حتى لو غيّر الـ checkbox يدوياً)
  function isFeatureLocked(featureKey) {
    if (isAdmin()) { return false; }
    var rule = getEmployeeRule(getUsername());
    if (!rule) { return false; }
    if (rule.enabled === false) { return true; }
    return rule.overrides && rule.overrides[featureKey] === false;
  }

  // يمنع saveSettings من تخزين قيمة مخالفة لقيود المدير —
  // يُستدعى من داخل saveSettings المُعدَّلة بالأسفل
  function reconcileBeforeSave(settingsObj) {
    if (isAdmin()) { return settingsObj; }
    var rule = getEmployeeRule(getUsername());
    if (!rule || rule.enabled === false) { return settingsObj; }
    var ov = rule.overrides || {};
    var out = {};
    for (var k in settingsObj) { if (Object.prototype.hasOwnProperty.call(settingsObj, k)) { out[k] = settingsObj[k]; } }
    for (var fk in ov) {
      if (Object.prototype.hasOwnProperty.call(ov, fk) && ov[fk] === false && fk !== 'deliveryMonitorEnabled') {
        out[fk] = false; // تأكيد: لا يحفظ true لميزة أوقفها المدير
      }
    }
    return out;
  }

  function showDisabledNotice() {
    if (document.getElementById('ws-admin-disabled-banner')) { return; }
    var b = document.createElement('div'); b.id = 'ws-admin-disabled-banner';
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#c0392b;color:#fff;' +
      'text-align:center;padding:8px 10px;font-family:Tahoma,Arial,sans-serif;font-size:13px;font-weight:bold;direction:rtl;';
    b.textContent = '⛔ تم إيقاف أدوات المساعدة (السكربت) لحسابك من قبل الإدارة. راجع المسؤول لمزيد من التفاصيل.';
    var appendNow = function () { if (document.body) { document.body.appendChild(b); } };
    if (document.body) { appendNow(); } else { document.addEventListener('DOMContentLoaded', appendNow); }
  }

  // ───────────────── جلب ملف control.json من GitHub (قراءة فقط، لكل الموظفين) ─────────────────
  function fetchRemoteControl(force, cb) {
    var last = parseInt(gGet(LAST_FETCH_KEY, '0'), 10) || 0;
    if (!force && (Date.now() - last) < FETCH_INTERVAL_MS) { if (cb) { cb(loadCachedControl()); } return; }
    gSet(LAST_FETCH_KEY, String(Date.now()));
    var url = CONTROL_RAW_URL + '?t=' + Date.now();
    function handle(text) {
      try {
        var obj = JSON.parse(text);
        if (obj && typeof obj === 'object') { saveCachedControl(obj); }
        if (cb) { cb(loadCachedControl()); }
      } catch (e) { if (cb) { cb(loadCachedControl()); } }
    }
    try {
      if (typeof GM_xmlhttpRequest !== 'undefined') {
        GM_xmlhttpRequest({
          method: 'GET', url: url,
          onload: function (res) { if (res.status === 200) { handle(res.responseText); } else if (cb) { cb(loadCachedControl()); } },
          onerror: function () { if (cb) { cb(loadCachedControl()); } },
          ontimeout: function () { if (cb) { cb(loadCachedControl()); } }
        });
      } else if (typeof fetch !== 'undefined') {
        fetch(url).then(function (r) { return r.ok ? r.text() : Promise.reject(); }).then(handle)
          .catch(function () { if (cb) { cb(loadCachedControl()); } });
      } else if (cb) { cb(loadCachedControl()); }
    } catch (e) { if (cb) { cb(loadCachedControl()); } }
  }

  // ───────────────── رفع إعدادات جديدة (المدير فقط) عبر GitHub API ─────────────────
  function pushControlToGitHub(newConfig, cb) {
    var token = gGet(TOKEN_KEY, '');
    if (!token) { cb(false, 'لا يوجد GitHub Token محفوظ. اضغط 🔑 أولاً وأدخل التوكن.'); return; }
    if (typeof GM_xmlhttpRequest === 'undefined') { cb(false, 'المتصفح/المدير لا يدعم GM_xmlhttpRequest.'); return; }
    newConfig.updatedAt = new Date().toISOString();
    GM_xmlhttpRequest({
      method: 'GET', url: CONTROL_API_URL,
      headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json' },
      onload: function (res) {
        var sha = null;
        if (res.status === 200) {
          try { var j = JSON.parse(res.responseText); sha = j.sha || null; } catch (e) {}
        } else if (res.status !== 404) {
          cb(false, 'فشل التحقق من الملف الحالي (HTTP ' + res.status + ').'); return;
        }
        var jsonStr = JSON.stringify(newConfig, null, 2);
        var b64;
        try { b64 = btoa(unescape(encodeURIComponent(jsonStr))); } catch (e) { cb(false, 'فشل تجهيز البيانات (ترميز).'); return; }
        var body = { message: 'تحديث إعدادات التحكم عن بعد - ' + newConfig.updatedAt, content: b64 };
        if (sha) { body.sha = sha; }
        GM_xmlhttpRequest({
          method: 'PUT', url: CONTROL_API_URL,
          headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' },
          data: JSON.stringify(body),
          onload: function (res2) {
            if (res2.status >= 200 && res2.status < 300) {
              saveCachedControl(newConfig); gSet(LAST_FETCH_KEY, String(Date.now())); cb(true);
            } else {
              cb(false, 'فشل الحفظ (HTTP ' + res2.status + '): ' + String(res2.responseText || '').slice(0, 200));
            }
          },
          onerror: function () { cb(false, 'فشل الاتصال بـ GitHub API عند الحفظ (تأكد من صلاحية التوكن).'); }
        });
      },
      onerror: function () { cb(false, 'فشل الاتصال بـ GitHub API لجلب نسخة الملف الحالية.'); }
    });
  }

  // ───────────────── مسح أسماء الموظفين بالصفحة الحالية ─────────────────
  // الموقع يستخدم نفس العنصر <span class="... user-name ..."> لعرض اسم
  // الموظف بأي مكان — سواء اسم المستخدم الحالي بأعلى الصفحة (نسخة واحدة)
  // أو اسم كل موظف بصفوف صفحة قوائم/تقارير الموظفين (نسخة لكل صف). لذا
  // نعتمد هذا العنصر كمصدر أساسي وموثوق، مع فحص احتياطي عام لصفحات أخرى.
  var arabicNameRe = /^[\u0600-\u06FF\s.]{4,40}$/;
  function scanPageForNameCandidates() {
    var found = {};
    try {
      var userNameEls = document.querySelectorAll('span.user-name, .user-name');
      userNameEls.forEach(function (el) {
        var txt = (el.textContent || '').trim();
        if (arabicNameRe.test(txt)) { found[txt] = true; }
      });
      if (Object.keys(found).length === 0) {
        var nameHintRe = /(اسم|الاسم|يوزر|مستخدم|موظف|الموظف|user|name)/i;
        var tables = document.querySelectorAll('table');
        tables.forEach(function (table) {
          var headerCells = table.querySelectorAll('thead th, thead td, tr:first-child th, tr:first-child td');
          var nameColIdx = -1;
          headerCells.forEach(function (th, idx) { if (nameHintRe.test(th.textContent || '')) { nameColIdx = idx; } });
          if (nameColIdx === -1) { return; }
          var rows = table.querySelectorAll('tbody tr, tr');
          rows.forEach(function (row) {
            var cells = row.querySelectorAll('td');
            if (cells.length > nameColIdx) {
              var txt = (cells[nameColIdx].textContent || '').trim();
              if (arabicNameRe.test(txt)) { found[txt] = true; }
            }
          });
        });
      }
      if (Object.keys(found).length === 0) {
        var hintEls = document.querySelectorAll('[class*="user" i], [class*="name" i], [class*="agent" i]');
        hintEls.forEach(function (el) {
          var txt = (el.textContent || '').trim();
          if (arabicNameRe.test(txt) && txt.split(/\s+/).length <= 5) { found[txt] = true; }
        });
      }
    } catch (e) {}
    return Object.keys(found);
  }

  // ───────────────── لوحة تحكم المدير (تُبنى فقط إذا isAdmin()) ─────────────────
  var panelDraft = null; // نسخة قيد التعديل قبل الحفظ

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function ensureDraft() {
    if (!panelDraft) {
      var cached = loadCachedControl();
      panelDraft = cached ? JSON.parse(JSON.stringify(cached)) : defaultConfig();
      if (!panelDraft.employees) { panelDraft.employees = {}; }
    }
    return panelDraft;
  }

  function ensureEmployee(name) {
    var d = ensureDraft();
    if (!d.employees[name]) {
      var ov = {};
      FEATURE_DEFS.forEach(function (f) { ov[f.key] = true; });
      d.employees[name] = { enabled: true, overrides: ov };
    }
    if (!d.employees[name].overrides) { d.employees[name].overrides = {}; }
    FEATURE_DEFS.forEach(function (f) { if (!(f.key in d.employees[name].overrides)) { d.employees[name].overrides[f.key] = true; } });
    return d.employees[name];
  }

  function renderPanel() {
    if (document.getElementById('ws-admin-overlay')) { return; }
    ensureDraft();

    var overlay = document.createElement('div'); overlay.id = 'ws-admin-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2147483647;' +
      'display:flex;align-items:center;justify-content:center;direction:rtl;font-family:Tahoma,Arial,sans-serif;';

    var panel = document.createElement('div');
    panel.style.cssText = 'background:#fff;border-radius:10px;padding:16px 18px;width:480px;max-width:94vw;' +
      'max-height:88vh;overflow:auto;box-shadow:0 6px 26px rgba(0,0,0,.4);';
    panel.innerHTML =
      '<h2 style="margin:0 0 10px;font-size:16px;color:#1a1a2e;">🛡️ لوحة تحكم المدير — ' + escapeHtml(ADMIN_NAME) + '</h2>' +
      '<div style="font-size:11.5px;color:#777;margin-bottom:10px;line-height:1.6;">' +
        'هذه اللوحة تظهر لك فقط. أي تعديل هنا لا يُطبَّق فعلياً على أجهزة الموظفين إلا بعد الضغط على "حفظ ورفع"، ' +
        'وتصل التغييرات لجهازهم خلال ١٥ دقيقة تقريباً (أو فوراً عند فتحهم صفحة جديدة).' +
      '</div>' +
      '<div id="ws-admin-status" style="font-size:12px;margin-bottom:10px;min-height:16px;"></div>' +
      '<div style="display:flex;align-items:center;gap:8px;background:#f5f5f8;border-radius:6px;padding:8px 10px;margin-bottom:12px;">' +
        '<label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:bold;cursor:pointer;flex:1;">' +
          '<input type="checkbox" id="ws-admin-global-toggle" style="width:16px;height:16px;">' +
          '🔌 تشغيل السكربت للجميع (المفتاح العام)' +
        '</label>' +
      '</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px;">' +
        '<input id="ws-admin-add-name" type="text" placeholder="اسم موظف جديد..." style="flex:1;padding:6px 8px;border:1px solid #ccc;border-radius:5px;font-size:12.5px;direction:rtl;">' +
        '<button id="ws-admin-add-btn" type="button" style="background:#2e5bff;color:#fff;border:none;border-radius:5px;padding:6px 12px;font-size:12.5px;cursor:pointer;">+ إضافة</button>' +
      '</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:12px;">' +
        '<button id="ws-admin-import-btn" type="button" style="flex:1;background:#2980b9;color:#fff;border:none;border-radius:5px;padding:7px;font-size:12px;cursor:pointer;">' +
          '📋 استيراد أسماء مكتشفة تلقائياً' +
        '</button>' +
        '<button id="ws-admin-scan-btn" type="button" style="flex:1;background:#8e44ad;color:#fff;border:none;border-radius:5px;padding:7px;font-size:12px;cursor:pointer;">' +
          '🔍 سحب من هذه الصفحة' +
        '</button>' +
      '</div>' +
      '<div id="ws-admin-employees" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;"></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
        '<button id="ws-admin-refresh" type="button" style="flex:1;min-width:110px;background:#888;color:#fff;border:none;border-radius:5px;padding:8px;font-size:12.5px;cursor:pointer;">🔄 تحديث من GitHub</button>' +
        '<button id="ws-admin-token" type="button" style="flex:1;min-width:110px;background:#34495e;color:#fff;border:none;border-radius:5px;padding:8px;font-size:12.5px;cursor:pointer;">🔑 GitHub Token</button>' +
        '<button id="ws-admin-save" type="button" style="flex:1;min-width:110px;background:#28a745;color:#fff;border:none;border-radius:5px;padding:8px;font-size:12.5px;font-weight:bold;cursor:pointer;">💾 حفظ ورفع للجميع</button>' +
      '</div>' +
      '<button id="ws-admin-close" type="button" style="width:100%;margin-top:8px;background:#eee;color:#333;border:none;border-radius:5px;padding:7px;font-size:12.5px;cursor:pointer;">إغلاق</button>';

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    function setStatus(msg, isError) {
      var s = document.getElementById('ws-admin-status');
      if (s) { s.textContent = msg; s.style.color = isError ? '#c0392b' : '#28a745'; }
    }

    function renderEmployees() {
      var list = document.getElementById('ws-admin-employees');
      if (!list) { return; }
      list.innerHTML = '';
      var names = Object.keys(panelDraft.employees).sort();
      if (names.length === 0) {
        list.innerHTML = '<div style="font-size:12px;color:#999;text-align:center;padding:10px;">لا يوجد موظفون مضافون بعد. أضِف اسماً يدوياً أو جرّب زر السحب من الصفحة.</div>';
        return;
      }
      names.forEach(function (name) {
        var emp = panelDraft.employees[name];
        var card = document.createElement('div');
        card.style.cssText = 'border:1px solid #e2e2e2;border-radius:7px;padding:8px 10px;';
        var head = document.createElement('div');
        head.style.cssText = 'display:flex;align-items:center;gap:6px;';
        var isOn = emp.enabled !== false;
        head.innerHTML =
          // زر تشغيل/إطفاء سريع مع حفظ فوري لهذا الموظف
          '<button type="button" data-emp-power="' + escapeHtml(name) + '" title="' + (isOn ? 'اضغط لإطفاء السكربت لهذا الموظف' : 'اضغط لتشغيل السكربت لهذا الموظف') + '" style="' +
            'background:' + (isOn ? '#28a745' : '#c0392b') + ';color:#fff;border:none;border-radius:20px;' +
            'padding:4px 12px;font-size:12px;font-weight:bold;cursor:pointer;white-space:nowrap;min-width:64px;">' +
            (isOn ? '✅ شغّال' : '⛔ مطفي') +
          '</button>' +
          '<span style="flex:1;font-size:12.5px;font-weight:bold;padding:0 6px;">' + escapeHtml(name) + '</span>' +
          '<button type="button" data-emp-toggle-details="' + escapeHtml(name) + '" style="background:none;border:1px solid #ccc;border-radius:4px;font-size:11px;padding:3px 8px;cursor:pointer;">الميزات ▾</button>' +
          '<button type="button" data-emp-delete="' + escapeHtml(name) + '" style="background:none;border:none;color:#c0392b;font-size:14px;cursor:pointer;">🗑️</button>';
        card.appendChild(head);

        var details = document.createElement('div');
        details.setAttribute('data-emp-details', name);
        details.style.cssText = 'display:none;margin-top:8px;padding-top:8px;border-top:1px dashed #ddd;grid-template-columns:1fr 1fr;gap:4px 10px;';
        FEATURE_DEFS.forEach(function (f) {
          var row = document.createElement('label');
          row.style.cssText = 'display:flex;align-items:center;gap:5px;font-size:11.5px;cursor:pointer;padding:2px 0;';
          var checked = emp.overrides && emp.overrides[f.key] !== false;
          row.innerHTML = '<input type="checkbox" data-emp-feat="' + escapeHtml(name) + '" data-feat-key="' + f.key + '" ' + (checked ? 'checked' : '') + ' style="width:13px;height:13px;">' + f.label;
          details.appendChild(row);
        });
        card.appendChild(details);
        list.appendChild(card);
      });

      list.querySelectorAll('[data-emp-power]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var name = btn.getAttribute('data-emp-power');
          ensureEmployee(name);
          var currentlyOn = panelDraft.employees[name].enabled !== false;
          var confirmMsg = currentlyOn
            ? ('⛔ إطفاء السكربت كامل لـ "' + name + '"؟')
            : ('✅ تشغيل السكربت لـ "' + name + '"؟');
          if (!confirm(confirmMsg)) { return; }
          panelDraft.employees[name].enabled = !currentlyOn;
          // حفظ فوري ورفع لـ GitHub
          btn.textContent = '⏳'; btn.style.background = '#888'; btn.disabled = true;
          setStatus('⏳ يتم الحفظ...', false);
          pushControlToGitHub(panelDraft, function (ok, err) {
            btn.disabled = false;
            if (ok) {
              renderEmployees(); // إعادة رسم القائمة بالحالة الجديدة
              setStatus('✅ تم ' + (!currentlyOn ? 'تشغيل' : 'إطفاء') + ' السكربت لـ "' + name + '" وحفظه.', false);
            } else {
              // تراجع عن التغيير لو فشل الحفظ
              panelDraft.employees[name].enabled = currentlyOn;
              renderEmployees();
              setStatus('❌ ' + err, true);
            }
          });
        });
      });
      list.querySelectorAll('[data-emp-feat]').forEach(function (cb) {
        cb.addEventListener('change', function () {
          var name = cb.getAttribute('data-emp-feat'), key = cb.getAttribute('data-feat-key');
          panelDraft.employees[name].overrides[key] = cb.checked;
        });
      });
      list.querySelectorAll('[data-emp-toggle-details]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var name = btn.getAttribute('data-emp-toggle-details');
          var d = list.querySelector('[data-emp-details="' + name + '"]');
          if (d) { d.style.display = (d.style.display === 'grid') ? 'none' : 'grid'; }
        });
      });
      list.querySelectorAll('[data-emp-delete]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var name = btn.getAttribute('data-emp-delete');
          if (confirm('حذف "' + name + '" من قائمة التحكم؟ (سيعود لإعداداته الافتراضية)')) {
            delete panelDraft.employees[name]; renderEmployees();
          }
        });
      });
    }

    document.getElementById('ws-admin-global-toggle').checked = panelDraft.globalEnabled !== false;
    document.getElementById('ws-admin-global-toggle').addEventListener('change', function (e) { panelDraft.globalEnabled = e.target.checked; });
    renderEmployees();

    document.getElementById('ws-admin-add-btn').addEventListener('click', function () {
      var input = document.getElementById('ws-admin-add-name');
      var name = (input.value || '').trim();
      if (!name) { return; }
      ensureEmployee(name); input.value = ''; renderEmployees();
    });
    document.getElementById('ws-admin-add-name').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { document.getElementById('ws-admin-add-btn').click(); }
    });

    // زر "استيراد أسماء مكتشفة تلقائياً" — يجلب من JSONBin قائمة الموظفين المسجّلين
    document.getElementById('ws-admin-import-btn').addEventListener('click', function () {
      var btn = document.getElementById('ws-admin-import-btn');
      btn.textContent = '⏳ جاري الجلب...'; btn.disabled = true;
      fetchRegisteredUsers(function (users) {
        btn.textContent = '📋 استيراد أسماء مكتشفة تلقائياً'; btn.disabled = false;
        if (!users || users.length === 0) {
          setStatus('⚠️ لا يوجد موظفون مسجّلون بعد — سيظهر اسم كل موظف هنا أول مرة يفتح الموقع بالسكربت.', true);
          return;
        }
        var added = 0;
        users.filter(function (n) { return n && n !== ADMIN_NAME; }).forEach(function (name) {
          if (!panelDraft.employees[name]) { ensureEmployee(name); added++; }
        });
        renderEmployees();
        if (added > 0) {
          setStatus('✅ تم استيراد ' + added + ' موظف جديد (المجموع: ' + users.length + '). راجعهم ثم اضغط حفظ ورفع.', false);
        } else {
          setStatus('ℹ️ كل الموظفين المسجّلين (' + users.length + ') موجودون مسبقاً بالقائمة.', false);
        }
      });
    });

    document.getElementById('ws-admin-scan-btn').addEventListener('click', function () {
      var candidates = scanPageForNameCandidates().filter(function (n) { return n !== ADMIN_NAME; });
      if (candidates.length === 0) { setStatus('⚠️ لم يتم العثور على أسماء واضحة بهذه الصفحة. جرّب صفحة أخرى أو أضف الاسم يدوياً.', true); return; }
      // حفظهم بالسجل المحلي أيضاً
      candidates.forEach(function (n) { recordKnownUsername(n); });
      var added = 0;
      candidates.forEach(function (name) { if (!panelDraft.employees[name]) { ensureEmployee(name); added++; } });
      renderEmployees();
      setStatus('✅ تمت إضافة ' + added + ' اسم (من أصل ' + candidates.length + ' موجود بالصفحة).', false);
    });

    document.getElementById('ws-admin-refresh').addEventListener('click', function () {
      setStatus('⏳ يتم التحديث من GitHub...', false);
      fetchRemoteControl(true, function (cfg) {
        panelDraft = cfg ? JSON.parse(JSON.stringify(cfg)) : defaultConfig();
        if (!panelDraft.employees) { panelDraft.employees = {}; }
        document.getElementById('ws-admin-global-toggle').checked = panelDraft.globalEnabled !== false;
        renderEmployees();
        setStatus('✅ تم التحديث من GitHub.', false);
      });
    });

    document.getElementById('ws-admin-token').addEventListener('click', function () {
      var cur = gGet(TOKEN_KEY, '');
      var val = prompt(
        'أدخل GitHub Personal Access Token (يُفضّل Fine-grained Token بصلاحية Contents: Read & Write على مستودع ' + CONTROL_REPO + ' فقط).\n' +
        'يُحفظ هذا التوكن على جهازك أنت فقط ولا يظهر لأي موظف آخر:',
        cur ? '' : ''
      );
      if (val === null) { return; }
      val = val.trim();
      if (val) { gSet(TOKEN_KEY, val); setStatus('✅ تم حفظ التوكن محلياً على هذا الجهاز.', false); }
    });

    document.getElementById('ws-admin-save').addEventListener('click', function () {
      setStatus('⏳ يتم الحفظ والرفع لـ GitHub...', false);
      pushControlToGitHub(panelDraft, function (ok, err) {
        setStatus(ok ? '✅ تم الحفظ والرفع بنجاح — ستصل التغييرات لأجهزة الموظفين خلال دقائق.' : ('❌ ' + err), !ok);
      });
    });

    document.getElementById('ws-admin-close').addEventListener('click', function () { overlay.remove(); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { overlay.remove(); } });
  }

  function renderAdminButton() {
    if (document.getElementById('ws-admin-fab')) { return; }
    var btn = document.createElement('button'); btn.id = 'ws-admin-fab'; btn.type = 'button'; btn.title = 'لوحة تحكم المدير';
    btn.textContent = '🛡️';
    btn.style.cssText = 'position:fixed;bottom:14px;right:14px;z-index:2147483000;width:42px;height:42px;border-radius:50%;' +
      'background:#1a1a2e;color:#fff;border:none;font-size:19px;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.35);';
    btn.addEventListener('click', renderPanel);
    document.body.appendChild(btn);
  }

  function debugInfo() {
    var username = getUsername();
    var cfg = loadCachedControl();
    var rule = getEmployeeRule(username);
    return {
      'اسم الموظف المكتشف': username || '(تعذّر تحديده)',
      'هل هذا حساب المدير': isAdmin(),
      'المفتاح العام (globalEnabled)': cfg ? cfg.globalEnabled : '(لا يوجد إعداد محفوظ بعد على هذا الجهاز)',
      'أسماء موجودة بملف control.json': cfg && cfg.employees ? Object.keys(cfg.employees) : [],
      'القاعدة المطابقة لهذا الاسم': rule,
      'السكربت مفعّل لهذا الحساب الآن': isEnabledForMe(),
      'مراقب التوصيل مفعّل لهذا الحساب الآن': isDeliveryMonitorEnabledForMe(),
      'آخر جلب لملف الإعدادات (ثانية مضت)': Math.round((Date.now() - (parseInt(gGet(LAST_FETCH_KEY, '0'), 10) || 0)) / 1000),
      'إصدار السكربت': (typeof GM_info !== 'undefined' && GM_info.script) ? GM_info.script.version : '(غير معروف)'
    };
  }

  // ───────────────── الإقلاع ─────────────────
  // نجلب الإعدادات فوراً (لا يحتاج DOM) —
  // force=true: جلب فوري من GitHub في كل تحميل صفحة (ضروري لتطبيق القيود بلا تأخير)
  // الإعدادات المخزّنة محلياً تُستخدم كاحتياط فوري ريثما يصل الجواب
  fetchRemoteControl(true, function (cfg) {
    // بعد ما وصل الملف المحدَّث: أعِد تطبيق القيود على الإعدادات المحمّلة بالذاكرة
    if (cfg && typeof window !== 'undefined' && window.WSAdmin) {
      try {
        var mainIIFE = window._wsSettingsApplyOverrides;
        if (typeof mainIIFE === 'function') { mainIIFE(); }
      } catch (e) {}
    }
  });

  function boot(attemptsLeft) {
    var name = getUsername();
    if (!name && attemptsLeft > 0) { setTimeout(function () { boot(attemptsLeft - 1); }, 1000); return; }
    if (isAdmin()) {
      recordKnownUsername(ADMIN_NAME);
      renderAdminButton();
      // سجّل كل الأسماء الموجودة بالصفحة الحالية محلياً (بصمت)
      setTimeout(autoScanAndRecord, 2000);
    }
    else {
      // موظف عادي: سجّل اسمه بـ JSONBin مرة واحدة فقط (بصمت تام)
      setTimeout(function () { registerUserOnce(name); }, 3000);
      if (!isEnabledForMe()) { showDisabledNotice(); }
    }
    setTimeout(function () {
      try { console.log('%c[WSAdmin] حالة الحساب الحالية — للتشخيص، اكتب wsAdminDebug() بالكونسول لإعادة عرضها:', 'color:#1a1a2e;font-weight:bold;font-size:12px;', debugInfo()); } catch (e) {}
    }, 1500);
  }
  function start() {
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function () { boot(8); }); }
    else { boot(8); }
  }
  start();

  // واجهة مشتركة تستخدمها بقية أجزاء السكربت (IIFEs الأخرى بنفس الملف)
  var API = {
    getUsername: getUsername,
    isAdmin: isAdmin,
    isEnabledForMe: isEnabledForMe,
    isDeliveryMonitorEnabledForMe: isDeliveryMonitorEnabledForMe,
    applyOverrides: applyOverrides,
    isFeatureLocked: isFeatureLocked,
    reconcileBeforeSave: reconcileBeforeSave,
    showDisabledNotice: showDisabledNotice,
    debug: debugInfo
  };
  try { window.WSAdmin = API; } catch (e) {}
  try { if (typeof unsafeWindow !== 'undefined') { unsafeWindow.WSAdmin = API; } } catch (e) {}
  try { window.wsAdminDebug = debugInfo; } catch (e) {}
  try { if (typeof unsafeWindow !== 'undefined') { unsafeWindow.wsAdminDebug = debugInfo; } } catch (e) {}
})();

// ══════════════════════════════════════════════════════════════
//  🔄 وحدة فحص التحديثات التلقائي (مشتركة)
// ══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var RAW_URL = 'https://raw.githubusercontent.com/ahmed151825/wasset1.1/main/waseet-tools.user.js';
  var CHECK_KEY = 'waseet_last_update_check';
  var DISMISS_KEY = 'waseet_update_dismissed_ver';
  var CHECK_INTERVAL = 6 * 60 * 60 * 1000; // كل 6 ساعات

  function sGet(k) {
    try { if (typeof GM_getValue !== 'undefined') { var v = GM_getValue(k, null); if (v !== null && v !== undefined) { return v; } } } catch (e) {}
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }
  function sSet(k, v) {
    try { if (typeof GM_setValue !== 'undefined') { GM_setValue(k, v); } } catch (e) {}
    try { localStorage.setItem(k, v); } catch (e) {}
  }
  function curVer() {
    try { if (typeof GM_info !== 'undefined' && GM_info.script && GM_info.script.version) { return GM_info.script.version; } } catch (e) {}
    return '4.1.3';
  }
  function cmpVer(a, b) {
    var pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
      var x = pa[i] || 0, y = pb[i] || 0;
      if (x > y) { return 1; }
      if (x < y) { return -1; }
    }
    return 0;
  }
  function showUpdateBanner(newVer) {
    if (document.getElementById('ws-update-banner')) { return; }
    var banner = document.createElement('div');
    banner.id = 'ws-update-banner';
    banner.style.cssText = 'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:1000003;background:#1a8a3a;color:#fff;border-radius:8px;padding:12px 18px;font-family:Tahoma,Arial,sans-serif;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.35);display:flex;align-items:center;gap:10px;direction:rtl;max-width:420px;';
    var msg = document.createElement('span');
    msg.textContent = '🔄 يتوفر تحديث جديد v' + newVer + ' (لديك v' + curVer() + ')';
    banner.appendChild(msg);
    var updBtn = document.createElement('button');
    updBtn.type = 'button'; updBtn.textContent = 'تحديث الآن';
    updBtn.style.cssText = 'background:#fff;color:#1a8a3a;border:none;border-radius:5px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:bold;flex-shrink:0;';
    updBtn.addEventListener('click', function () {
      window.open(RAW_URL, '_blank'); // Tampermonkey يلتقط الرابط ويعرض شاشة التحديث
      banner.remove();
    });
    banner.appendChild(updBtn);
    var laterBtn = document.createElement('button');
    laterBtn.type = 'button'; laterBtn.textContent = 'لاحقاً';
    laterBtn.style.cssText = 'background:none;border:1px solid rgba(255,255,255,.5);color:#fff;border-radius:5px;padding:5px 10px;cursor:pointer;font-size:12px;flex-shrink:0;';
    laterBtn.addEventListener('click', function () {
      sSet(DISMISS_KEY, newVer); // يسكت لهذا الإصدار فقط — يعود لو صدر أحدث
      banner.remove();
    });
    banner.appendChild(laterBtn);
    document.body.appendChild(banner);
  }
  function handleRemoteText(text) {
    var m = String(text || '').match(/@version\s+([\d.]+)/);
    if (!m) { return; }
    var remote = m[1];
    if (cmpVer(remote, curVer()) <= 0) { return; }       // لا يوجد أحدث
    if (String(sGet(DISMISS_KEY)) === remote) { return; } // ضغط "لاحقاً" لهذا الإصدار
    if (document.body) { showUpdateBanner(remote); }
    else { document.addEventListener('DOMContentLoaded', function () { showUpdateBanner(remote); }); }
  }
  function checkForUpdate() {
    var last = parseInt(sGet(CHECK_KEY) || '0', 10);
    if (Date.now() - last < CHECK_INTERVAL) { return; }
    sSet(CHECK_KEY, String(Date.now()));
    var url = RAW_URL + '?t=' + Date.now(); // كسر الكاش
    if (typeof GM_xmlhttpRequest !== 'undefined') {
      GM_xmlhttpRequest({ method: 'GET', url: url, onload: function (res) { handleRemoteText(res.responseText); }, onerror: function () {} });
    } else {
      try { fetch(url).then(function (r) { return r.text(); }).then(handleRemoteText).catch(function () {}); } catch (e) {}
    }
  }
  function forceCheckForUpdate(cb) {
    sSet(CHECK_KEY, String(Date.now())); // يعيد ضبط المؤقت أيضاً حتى لا يفحص الفحص التلقائي فوراً بعده
    var url = RAW_URL + '?t=' + Date.now(); // كسر الكاش
    function handle(text) {
      var m = String(text || '').match(/@version\s+([\d.]+)/);
      var remote = m ? m[1] : null;
      if (remote && cmpVer(remote, curVer()) > 0) {
        sSet(DISMISS_KEY, ''); // امسح كتم "لاحقاً" حتى يظهر البانر فوراً حتى لو كان مكتوماً سابقاً
        showUpdateBanner(remote);
        if (cb) { cb(true, remote); }
      } else if (cb) { cb(false, remote); }
    }
    if (typeof GM_xmlhttpRequest !== 'undefined') {
      GM_xmlhttpRequest({ method: 'GET', url: url, onload: function (res) { handle(res.responseText); }, onerror: function () { if (cb) { cb(null); } } });
    } else {
      try { fetch(url).then(function (r) { return r.text(); }).then(handle).catch(function () { if (cb) { cb(null); } }); } catch (e) { if (cb) { cb(null); } }
    }
  }
  try { unsafeWindow.wsForceCheckUpdate = forceCheckForUpdate; } catch (e) { window.wsForceCheckUpdate = forceCheckForUpdate; }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(checkForUpdate, 4000); });
  } else {
    setTimeout(checkForUpdate, 4000);
  }
})();

// ══════════════════════════════════════════════════════════════
//  📦 الجزء الأول: أدوات الوسيط (waseet-tools)
// ══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // 🛡️ بوابة تحكم المدير: إن أوقف "احمد محمد كريم" السكربت لهذا الموظف
  // عن بعد، نتوقف هنا فوراً قبل أي تهيئة (لا أزرار ولا أي تعديل بالصفحة).
  if (typeof window !== 'undefined' && window.WSAdmin && !window.WSAdmin.isEnabledForMe()) {
    try { window.WSAdmin.showDisabledNotice(); } catch (e) {}
    return;
  }

  var BASE_URL = 'https://alwaseet-iq.net';

  function storeSet(key, val) {
    try { if (typeof GM_setValue !== 'undefined') { GM_setValue(key, val); } } catch (e) {}
    try { localStorage.setItem(key, val); } catch (e) {}
  }
  function storeGet(key) {
    try { if (typeof GM_getValue !== 'undefined') { var v = GM_getValue(key, null); if (v !== null && v !== undefined) { return v; } } } catch (e) {}
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  // ✅ (4.3.0): سجل محلي عام لكل قرار يُتّخذ عبر زر "🕒 المؤجل" — يحفظ
  // رقم الطلب + القرار المتخذ (مؤجل/الغاء الطلب/لم يطلب/...الخ) + الوقت
  // (نفس مفتاح التخزين القديم يُستخدم لغرض التوافق مع السجلات السابقة؛
  // السجلات القديمة ما فيها حقل "decision" فتُعرض كـ"مؤجل" افتراضياً)
  var DEFERRED_LOG_KEY = 'ws_deferred_log';
  var DEFERRED_LOG_MAX = 300;
  function getDeferredLog() {
    var raw = storeGet(DEFERRED_LOG_KEY);
    if (!raw) { return []; }
    try { var arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; } catch (e) { return []; }
  }
  function logOrderDecision(orderNum, decisionLabel) {
    var list = getDeferredLog();
    list.unshift({ order: String(orderNum), decision: decisionLabel || 'مؤجل', time: Date.now() });
    if (list.length > DEFERRED_LOG_MAX) { list = list.slice(0, DEFERRED_LOG_MAX); }
    storeSet(DEFERRED_LOG_KEY, JSON.stringify(list));
  }
  function clearDeferredLog() { storeSet(DEFERRED_LOG_KEY, '[]'); }
  function fmtDeferredTime(ts) {
    var d = new Date(ts);
    var dd = String(d.getDate()).padStart(2, '0'), mm = String(d.getMonth() + 1).padStart(2, '0');
    var hh = String(d.getHours()).padStart(2, '0'), mi = String(d.getMinutes()).padStart(2, '0');
    return dd + '/' + mm + ' — ' + hh + ':' + mi;
  }
  function injectCss(css) {
    try { if (typeof GM_addStyle === 'function') { GM_addStyle(css); return; } } catch (e) {}
    try { var st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st); } catch (e) {}
  }
  function copyToClipboard(text, el) {
    function done() { if (el) { var orig = el.textContent; el.textContent = '✅ تم النسخ'; setTimeout(function () { el.textContent = orig; }, 900); } }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text); done(); }); return; }
    } catch (e) {}
    fallbackCopy(text); done();
  }

  function onReady(fn) {
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', fn); } else { fn(); }
  }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function waitFor(selector, cb, timeout) {
    var limit = timeout || 10000, start = Date.now();
    var timer = setInterval(function () {
      var el = document.querySelector(selector);
      if (el) { clearInterval(timer); cb(el); }
      else if (Date.now() - start > limit) { clearInterval(timer); }
    }, 200);
  }

  var wsOpenWindows = new Map();

  function openTab(url, name) {
    if (name && name !== '_blank') {
      var existing = wsOpenWindows.get(name);
      if (existing && !existing.closed) {
        existing.focus();
        if (existing.location.href !== url) { existing.location.href = url; }
        return;
      }
    }
    var w = window.open(url, name || '_blank');
    if (!w) {
      alert('المتصفح منع فتح النافذة.\nيرجى السماح بالنوافذ المنبثقة لهذا الموقع.');
      return;
    }
    if (name && name !== '_blank') { wsOpenWindows.set(name, w); }
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    } else { fallbackCopy(text); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch (e) { alert('فشل النسخ:\n\n' + text); }
    document.body.removeChild(ta);
  }
  function renderTemplate(tpl, vars) {
    return String(tpl || '').replace(/\{(\w+)\}/g, function (m, key) {
      return (vars[key] !== undefined && vars[key] !== null) ? String(vars[key]) : '';
    });
  }
  function makeUsedBadgeWrapper(innerEl) {
    var wrap = document.createElement('span');
    wrap.style.cssText = 'position:relative;display:inline-block;vertical-align:middle;';
    var badge = document.createElement('span');
    badge.textContent = '✅';
    badge.style.cssText = 'position:absolute;top:-6px;right:-6px;font-size:10px;line-height:1;display:none;pointer-events:none;';
    wrap.appendChild(innerEl); wrap.appendChild(badge);
    return { el: wrap, markUsed: function () { badge.style.display = 'inline'; if (innerEl.title && innerEl.title.indexOf('✓ تم الإرسال') === -1) { innerEl.title += '  —  ✓ تم الإرسال'; } } };
  }
  function openSmsLink(phone, body) {
    try {
      var iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;border:none;';
      iframe.src = 'sms:' + phone + '?body=' + encodeURIComponent(body);
      document.body.appendChild(iframe);
      setTimeout(function () { if (iframe.parentNode) { iframe.parentNode.removeChild(iframe); } }, 1000);
    } catch (e) {
      var link = document.createElement('a');
      link.href = 'sms:' + phone + '?body=' + encodeURIComponent(body);
      link.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(link); link.click();
      setTimeout(function () { if (link.parentNode) { link.parentNode.removeChild(link); } }, 500);
    }
  }
  // ✅ (4.1.6): toast مشترك على مستوى الملف كامل — لعرض رسائل حالة سريعة
  // (مثل نتيجة زر "المؤجل") من أي قسم بالسكربت بدون الحاجة لنافذة مفتوحة
  function wsGlobalToast(msg) {
    var t = document.getElementById('ws-global-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'ws-global-toast';
      t.style.cssText = 'position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(20px);background:#1b1f27;color:#fff;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:700;z-index:2147483647;opacity:0;pointer-events:none;transition:.25s;box-shadow:0 8px 24px rgba(0,0,0,.3);';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(20px)'; }, 2200);
  }
  // ✅ (4.1.6): يفحص وجود عنصر بشكل متكرر حتى يظهر بالـ DOM (نوافذ SweetAlert2
  // تُبنى ديناميكياً بجافاسكربت بعد الضغط، فنحتاج ننتظرها بدل الاعتماد على وجودها فوراً)
  function wsWaitFor(selectorFn, callback, opts) {
    var maxTries  = (opts && opts.maxTries)  || 40;
    var interval  = (opts && opts.interval)  || 100;
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var el;
      try { el = selectorFn(); } catch (e) { el = null; }
      if (el) {
        clearInterval(timer);
        callback(el);
      } else if (tries >= maxTries) {
        clearInterval(timer);
        if (opts && opts.onTimeout) { opts.onTimeout(); }
      }
    }, interval);
  }
  function observeAndRun(fn, delay) {
    var pending = false;
    function run() { fn(); applyVisibility(); pending = false; }
    run();
    var obs = new MutationObserver(function () {
      if (pending) { return; } pending = true; setTimeout(run, delay || 400);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return obs;
  }
  function renderAndSync(fn) { fn(); applyVisibility(); }
  function formatNum(n) { return (n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  var PRESET_CUSTOMER_TEMPLATES = {
    default: { label: 'الرسالة الافتراضية', text: 'معك مركز خدمة العملاء "لشركة الوسيط للنقل العام"\nلديكم طلب من بيج/ {merchant}\nسعر الطلب/ {price}\nرقم الطلب/ {order}\nيرجى التواصل معنا لإيصاله إليكم..' },
    short:   { label: 'رسالة مختصرة',      text: 'خدمة عملاء الوسيط: طلبكم رقم {order} من {merchant} بسعر {price}.\nيرجى التواصل معنا لإيصاله.' },
    friendly:{ label: 'رسالة ودية',         text: 'السلام عليكم 🌹\nمعك مركز خدمة العملاء لشركة الوسيط للنقل العام\nلديكم طلب من: {merchant}\nالسعر: {price}\nرقم الطلب: {order}\nنرجو التواصل معنا بأقرب وقت لتسليم طلبكم 🙏' },
    formal:  { label: 'رسالة رسمية',        text: 'تحية طيبة،\nنحيطكم علماً بوجود طلب باسم {merchant} برقم {order} وبسعر {price} لدى شركة الوسيط للنقل العام.\nيرجى التواصل مع مركز خدمة العملاء في أقرب وقت ممكن لتنسيق التسليم.' },
    custom:  { label: '✏️ مخصص (تحرير يدوي)', text: null }
  };
  function getCustomerMessageTemplate() {
    var id = wsSettings.customerTemplateId || 'default';
    if (id === 'custom') { return (wsSettings.customerCustomTemplate && wsSettings.customerCustomTemplate.trim()) ? wsSettings.customerCustomTemplate : PRESET_CUSTOMER_TEMPLATES.default.text; }
    var preset = PRESET_CUSTOMER_TEMPLATES[id];
    return preset && preset.text ? preset.text : PRESET_CUSTOMER_TEMPLATES.default.text;
  }

  var DEFAULT_REPORT_TEMPLATE =
    'التقرير ✅\nاسم المحطة: {station}\nاسم المؤظف : {employee}\nالتاريخ : {date}\nاليوم :  {day}\n' +
    'العادي \nعدد اجور 5000  ={normal5000}\nعدد اجور 4000={normal4000}\nعدد اجور 3000={normal3000}\nعدد اجور 2000={normal2000}\n————————-\n' +
    'Vip\nعدد اجور 5000  ={vip5000}\nعدد اجور 4000={vip4000}\nعدد اجور 3000={vip3000}\nعدد اجور 2000={vip2000}\n——————————-\n' +
    'المجموع \nعدد اجور 5000  ={total5000}\nعدد اجور 4000={total4000}\nعدد اجور 3000={total3000}\nعدد اجور 2000={total2000}\n——————————————-';

  var DAYS_AR = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

  var SETTINGS_KEY = 'waseet_ws_settings';
  var DEFAULT_SETTINGS = {
    showStory:true, showFees:true, showEdit:true, showWsMerchant:true, showWsCustomer:true,
    showSms:true, showPhoneSearch:true, showDelayCheck:true, showCopyReport:true,
    showCopyReps:true, showRepRating:true, showDeferred:true, opacity:100,
    stationName:'المنصور', reportTemplate:DEFAULT_REPORT_TEMPLATE,
    customerTemplateId:'default', customerCustomTemplate:'', delayCheckMode:'auto',
    ratingAutoReport:true, ratingScoreExcellent:3, ratingScoreGood:1, ratingScoreBad:-2,
    walletFee5000:300, walletFee4000:200, walletFee3000:150, walletFee2000:100,
    walletOffDay:5,   // 0=أحد 1=اثنين 2=ثلاثاء 3=أربعاء 4=خميس 5=جمعة 6=سبت
    showReceivedCounter:true,
    smartDecisionEnabled:false // ✅ (4.3.0): الزر الذكي (يعمل على كل القرارات) معطّل افتراضياً — يفعّله كل موظف بنفسه من الإعدادات
  };
  function loadSettings() {
    var raw = storeGet(SETTINGS_KEY);
    if (!raw) { return Object.assign({}, DEFAULT_SETTINGS); }
    try { return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw)); } catch (e) { return Object.assign({}, DEFAULT_SETTINGS); }
  }
  function saveSettings(s) {
    // 🛡️ قبل الحفظ: تأكيد عدم كتابة قيمة تخالف قيود المدير عن بعد
    var toSave = s;
    try {
      if (typeof window !== 'undefined' && window.WSAdmin && window.WSAdmin.reconcileBeforeSave) {
        toSave = window.WSAdmin.reconcileBeforeSave(s);
      }
    } catch (e) {}
    storeSet(SETTINGS_KEY, JSON.stringify(toSave));
  }
  var wsSettings = loadSettings();
  // 🛡️ تطبيق قيود المدير عن بعد (إن وُجدت) فوق إعدادات الموظف المحلية —
  // تُعطّل فقط الميزات التي أوقفها المدير تحديداً، ولا تفرض تفعيل أي شيء.
  if (typeof window !== 'undefined' && window.WSAdmin) {
    try { wsSettings = window.WSAdmin.applyOverrides(wsSettings); } catch (e) {}
  }
  // تسجيل hook يُستدعى بعد وصول الملف الجديد من GitHub لتطبيق القيود فوراً بلا reload
  try {
    window._wsSettingsApplyOverrides = function () {
      if (typeof window !== 'undefined' && window.WSAdmin) {
        var base = loadSettings();
        var newSettings = window.WSAdmin.applyOverrides(base);
        // نسخ القيم الجديدة لـ wsSettings بلا استبدال المرجع (لأن كودًا آخر يُمسك نفس المرجع)
        Object.keys(newSettings).forEach(function (k) { wsSettings[k] = newSettings[k]; });
        if (typeof applyVisibility === 'function') { applyVisibility(); }
        // لو أُوقف الموظف كاملاً: أظهر الإشعار وأخفِ الأزرار
        if (!window.WSAdmin.isEnabledForMe()) {
          window.WSAdmin.showDisabledNotice();
          Object.keys(wsSettings).forEach(function (k) {
            if (typeof wsSettings[k] === 'boolean' && k.indexOf('show') === 0) { wsSettings[k] = false; }
          });
          if (typeof applyVisibility === 'function') { applyVisibility(); }
        }
      }
    };
  } catch (e) {}

  // ══════════════════════════════════════════════════════════════
  //  📦 عدّاد الطلبات المستلمة اليوم (صفحة الكول سنتر) — لا يتكرر،
  //  يُحسب حسب رقم الطلب، ويُصفَّر تلقائياً كل يوم جديد.
  //  بنطاق مشترك حتى تتحكم به لوحة الإعدادات من أي صفحة.
  // ══════════════════════════════════════════════════════════════
  var RECEIVED_STORE_KEY = 'waseet_received_today_v1';
  function todayDateStr() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function loadReceivedToday() {
    var today = todayDateStr(), raw = storeGet(RECEIVED_STORE_KEY);
    if (raw) { try { var obj = JSON.parse(raw); if (obj && obj.date === today && Array.isArray(obj.ids)) { return obj; } } catch (e) {} }
    return { date: today, ids: [] };
  }
  var wsReceivedData = loadReceivedToday();
  function saveReceivedToday() { try { storeSet(RECEIVED_STORE_KEY, JSON.stringify(wsReceivedData)); } catch (e) {} }
  function refreshReceivedBadge() {
    var el = document.getElementById('ws-received-badge');
    if (!wsSettings.showReceivedCounter) { if (el) { el.remove(); } return; }
    var op = (wsSettings.opacity != null ? wsSettings.opacity : 100) / 100;
    if (!el) {
      el = document.createElement('div'); el.id = 'ws-received-badge';
      el.title = 'عدد الطلبات الفريدة التي ظهرت لك اليوم بصفحة الكول سنتر — يُحسب مرة واحدة فقط لكل رقم طلب';
      el.style.cssText = 'position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:99998;background:#1a1a2e;color:#fff;border-radius:20px;padding:7px 16px;font-family:Tahoma,Arial,sans-serif;font-size:12.5px;font-weight:bold;box-shadow:0 3px 10px rgba(0,0,0,.35);direction:rtl;cursor:default;user-select:none;';
      document.body.appendChild(el);
    }
    el.style.opacity = op;
    el.textContent = '📦 اليوم: ' + wsReceivedData.ids.length + ' طلب';
  }
  function recordReceivedOrder(orderId) {
    // نقرأ أحدث نسخة من التخزين مباشرة قبل الإضافة (بدل الاعتماد على
    // نسخة الذاكرة المحمّلة عند فتح الصفحة) — هذا يمنع مشكلة تعارض
    // التبويبات المتعددة: لو فاتح أكثر من تبويب لصفحة الكول سنتر
    // بنفس الوقت، كل تبويب كان يكتب فوق تخزين التبويب الآخر ويصفّر
    // طلباته بالغلط. الآن كل عملية تقرأ وتكتب على أحدث نسخة فعلية.
    var fresh = loadReceivedToday();
    if (fresh.ids.indexOf(orderId) !== -1) { wsReceivedData = fresh; refreshReceivedBadge(); return; }
    fresh.ids.push(orderId);
    wsReceivedData = fresh;
    saveReceivedToday();
    refreshReceivedBadge();
  }
  function addReceivedBadge() {
    refreshReceivedBadge();
    // مزامنة دورية: تحدّث الرقم المعروض من التخزين كل 15 ثانية حتى لو
    // ما ظهر طلب جديد بهذا التبويب تحديداً (لو إضافته صارت من تبويب ثاني)
    if (!window.__wsReceivedSyncTimer) {
      window.__wsReceivedSyncTimer = setInterval(function () {
        var fresh = loadReceivedToday();
        wsReceivedData = fresh;
        refreshReceivedBadge();
      }, 15000);
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  🔔 جسر مشترك (4.0.3): إعداد "فحص المندوب المتوقف" الخاص بمراقب
  //  التوصيل — يُكتب هنا من الإعدادات الرئيسية على نفس مفتاح تخزين
  //  المراقب (dm_stop_check_on) بنفس صيغته تماماً: GM أولاً، ومرآة
  //  localStorage باسم dm_fallback_ للأجهزة بلا صلاحيات GM.
  //  المراقب يعيد قراءة المفتاح كل دورة فحص فيسري التغيير خلال ~20 ثانية.
  // ══════════════════════════════════════════════════════════════
  var DM_STOP_CHECK_KEY = 'dm_stop_check_on';
  function dmGetStopCheck() {
    var v = null;
    try { if (typeof GM_getValue !== 'undefined') { v = GM_getValue(DM_STOP_CHECK_KEY, null); } } catch (e) {}
    if (v === null || v === undefined) {
      try { v = localStorage.getItem('dm_fallback_' + DM_STOP_CHECK_KEY); } catch (e) {}
    }
    if (v === null || v === undefined) { return true; } // الافتراضي: مفعّل
    if (typeof v === 'boolean') { return v; }
    return String(v) === 'true';
  }
  function dmSetStopCheck(on) {
    var s = on ? 'true' : 'false';
    try { if (typeof GM_setValue !== 'undefined') { GM_setValue(DM_STOP_CHECK_KEY, s); } } catch (e) {}
    try { localStorage.setItem('dm_fallback_' + DM_STOP_CHECK_KEY, s); } catch (e) {}
  }

  // ✅ (4.1.5): جسر مماثل لعدد دقائق "الفحص الخلفي بدون فتح صفحة قيد التوصيل"
  var DM_BG_POLL_MIN_KEY = 'dm_bg_poll_minutes';
  function dmGetBgPollMinutes() {
    var v = null;
    try { if (typeof GM_getValue !== 'undefined') { v = GM_getValue(DM_BG_POLL_MIN_KEY, null); } } catch (e) {}
    if (v === null || v === undefined) { try { v = localStorage.getItem('dm_fallback_' + DM_BG_POLL_MIN_KEY); } catch (e) {} }
    var n = parseInt(v, 10);
    return (!isNaN(n) && n >= 2) ? n : 5;
  }
  function dmSetBgPollMinutes(n) {
    var s = String(Math.max(2, Math.min(30, parseInt(n, 10) || 5)));
    try { if (typeof GM_setValue !== 'undefined') { GM_setValue(DM_BG_POLL_MIN_KEY, s); } } catch (e) {}
    try { localStorage.setItem('dm_fallback_' + DM_BG_POLL_MIN_KEY, s); } catch (e) {}
  }

  var VISIBILITY_MAP = {
    'story':'showStory','fees':'showFees','edit':'showEdit','ws-merchant':'showWsMerchant',
    'ws-customer':'showWsCustomer','sms-customer':'showSms','phone-search':'showPhoneSearch',
    'delay-check':'showDelayCheck','copy-report':'showCopyReport','copy-reps':'showCopyReps','rep-rating':'showRepRating',
    'deferred':'showDeferred'
  };
  function applyVisibility() {
    var op = (wsSettings.opacity != null ? wsSettings.opacity : 100) / 100;
    Object.keys(VISIBILITY_MAP).forEach(function (btnKey) {
      var visible = !!wsSettings[VISIBILITY_MAP[btnKey]];
      document.querySelectorAll('[data-ws-btn="' + btnKey + '"]').forEach(function (el) {
        el.style.display = visible ? '' : 'none'; el.style.opacity = op;
      });
    });
    var receivedBadge = document.getElementById('ws-received-badge');
    if (receivedBadge) { receivedBadge.style.opacity = op; }
  }

  function openTemplateEditor(opts) {
    if (document.getElementById('ws-tpl-overlay')) { return; }
    var overlay = document.createElement('div'); overlay.id = 'ws-tpl-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000001;display:flex;align-items:center;justify-content:center;direction:rtl;';
    var panel = document.createElement('div');
    panel.style.cssText = 'background:#fff;border-radius:8px;padding:16px 18px;width:360px;max-height:85vh;overflow:auto;box-shadow:0 4px 20px rgba(0,0,0,.35);font-family:Tahoma,Arial,sans-serif;';
    var title = document.createElement('h3'); title.textContent = opts.title; title.style.cssText = 'margin:0 0 8px;font-size:14px;color:#222;'; panel.appendChild(title);
    if (opts.help) { var help = document.createElement('div'); help.textContent = opts.help; help.style.cssText = 'font-size:11px;color:#666;background:#f5f5f5;border-radius:5px;padding:6px 8px;margin-bottom:8px;white-space:pre-line;line-height:1.6;'; panel.appendChild(help); }
    var textarea = document.createElement('textarea'); textarea.value = opts.value || ''; textarea.rows = 10;
    textarea.style.cssText = 'width:100%;box-sizing:border-box;font-family:monospace;font-size:12px;direction:rtl;padding:6px;border:1px solid #ccc;border-radius:5px;resize:vertical;'; panel.appendChild(textarea);
    var btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:6px;margin-top:10px;';
    if (opts.defaultValue) { var resetBtn = document.createElement('button'); resetBtn.type = 'button'; resetBtn.textContent = 'استعادة الافتراضي'; resetBtn.style.cssText = 'flex:1;background:#888;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;'; resetBtn.addEventListener('click', function () { textarea.value = opts.defaultValue; }); btnRow.appendChild(resetBtn); }
    var saveBtn = document.createElement('button'); saveBtn.type = 'button'; saveBtn.textContent = '💾 حفظ'; saveBtn.style.cssText = 'flex:1;background:#28a745;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;'; saveBtn.addEventListener('click', function () { opts.onSave(textarea.value); overlay.remove(); }); btnRow.appendChild(saveBtn);
    var cancelBtn = document.createElement('button'); cancelBtn.type = 'button'; cancelBtn.textContent = 'إلغاء'; cancelBtn.style.cssText = 'flex:1;background:#2e5bff;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;'; cancelBtn.addEventListener('click', function () { overlay.remove(); }); btnRow.appendChild(cancelBtn);
    panel.appendChild(btnRow); overlay.appendChild(panel);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { overlay.remove(); } });
    document.body.appendChild(overlay);
  }

  // ══════════════════════════════════════════════════════════════
  //  💰 نظام المحفظة الشهرية
  // ══════════════════════════════════════════════════════════════

  var WALLET_KEY_PREFIX = 'waseet_wallet_v1_';

  function getWalletKey(empName, yearMonth) {
    return WALLET_KEY_PREFIX + (empName || 'default').replace(/_/g,'‐') + '_' + yearMonth;
  }

  function getTodayStr() {
    var now = new Date();
    return now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
  }

  function getYearMonth(dateStr) {
    return dateStr ? dateStr.substring(0, 7) : '';
  }

  function loadWalletMonth(empName, yearMonth) {
    var key = getWalletKey(empName, yearMonth);
    var raw = storeGet(key);
    if (!raw) { return {}; }
    try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
  }

  function saveWalletMonth(empName, yearMonth, data) {
    var key = getWalletKey(empName, yearMonth);
    storeSet(key, JSON.stringify(data));
  }

  function getDataDateFromTable() {
    var latestDate = null;
    document.querySelectorAll('td, th').forEach(function (cell) {
      var text = cell.textContent.trim();
      var match = text.match(/^(\d{4}-\d{2}-\d{2})(?:\s+\d{2}:\d{2}:\d{2})?$/);
      if (match) {
        var d = new Date(match[1] + 'T00:00:00');
        if (!isNaN(d.getTime())) {
          if (!latestDate || d > latestDate) { latestDate = d; }
        }
      }
    });
    return latestDate;
  }

  function saveWalletDay(empName, totals, overrideDate) {
    var actualDate = overrideDate || getDataDateFromTable() || new Date();

    var today = actualDate.getFullYear() + '-' + pad2(actualDate.getMonth() + 1) + '-' + pad2(actualDate.getDate());
    var ym = getYearMonth(today);
    var dayOfWeek = actualDate.getDay();
    var offDay = wsSettings.walletOffDay != null ? wsSettings.walletOffDay : 5;

    if (dayOfWeek === offDay) { return; }

    var feeMap = {
      5000: wsSettings.walletFee5000 != null ? wsSettings.walletFee5000 : 300,
      4000: wsSettings.walletFee4000 != null ? wsSettings.walletFee4000 : 200,
      3000: wsSettings.walletFee3000 != null ? wsSettings.walletFee3000 : 150,
      2000: wsSettings.walletFee2000 != null ? wsSettings.walletFee2000 : 100
    };
    var amount = 0;
    [5000, 4000, 3000, 2000].forEach(function (fee) {
      amount += (totals[fee] || 0) * (feeMap[fee] || 0);
    });

    var monthData = loadWalletMonth(empName, ym);
    monthData[today] = {
      date: today,
      day: dayOfWeek,
      totals: totals,
      amount: amount,
      savedAt: Date.now()
    };
    saveWalletMonth(empName, ym, monthData);
  }

  function calcMonthTotal(empName, yearMonth) {
    var data = loadWalletMonth(empName, yearMonth);
    var offDay = wsSettings.walletOffDay != null ? wsSettings.walletOffDay : 5;
    var total = 0;
    var days = [];
    Object.keys(data).sort().forEach(function (dateStr) {
      var rec = data[dateStr];
      if (rec.day === offDay) { return; }
      total += rec.amount || 0;
      days.push(rec);
    });
    return { total: total, days: days };
  }

  function getAvailableMonths(empName) {
    var months = {};
    var now = new Date();
    var curYear = now.getFullYear();
    for (var mi = 0; mi < 14; mi++) {
      var d = new Date(curYear, now.getMonth() - mi, 1);
      var ym = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
      var data = loadWalletMonth(empName, ym);
      if (Object.keys(data).length > 0) { months[ym] = true; }
    }
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(WALLET_KEY_PREFIX) === 0) {
          var rest = k.slice(WALLET_KEY_PREFIX.length);
          var lastDash = rest.lastIndexOf('_');
          if (lastDash > -1) {
            var kEmp = rest.slice(0, lastDash);
            var kYm2 = rest.slice(lastDash + 1);
            if (kEmp === empName && /^\d{4}-\d{2}$/.test(kYm2)) {
              months[kYm2] = true;
            }
          }
        }
      }
    } catch (e) {}
    var list = Object.keys(months).sort().reverse();
    if (!list.length) {
      list.push(curYear + '-' + pad2(now.getMonth() + 1));
    }
    return list;
  }

  function getMonthLabel(ym) {
    var months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    var parts = ym.split('-');
    return months[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
  }

  function openWalletDialog(empName, todayTotals) {
    if (document.getElementById('ws-wallet-overlay')) { return; }

    var currentYm = getYearMonth(getTodayStr());
    var availableMonths = getAvailableMonths(empName);
    if (availableMonths.indexOf(currentYm) === -1) { availableMonths.unshift(currentYm); }

    var feeMap = {
      5000: wsSettings.walletFee5000 != null ? wsSettings.walletFee5000 : 300,
      4000: wsSettings.walletFee4000 != null ? wsSettings.walletFee4000 : 200,
      3000: wsSettings.walletFee3000 != null ? wsSettings.walletFee3000 : 150,
      2000: wsSettings.walletFee2000 != null ? wsSettings.walletFee2000 : 100
    };

    var todayAmount = 0;
    if (todayTotals) {
      [5000, 4000, 3000, 2000].forEach(function (fee) {
        todayAmount += (todayTotals[fee] || 0) * (feeMap[fee] || 0);
      });
    }

    var overlay = document.createElement('div'); overlay.id = 'ws-wallet-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000002;display:flex;align-items:center;justify-content:center;direction:rtl;';
    var panel = document.createElement('div');
    panel.style.cssText = 'background:#fff;border-radius:10px;padding:18px 20px;width:380px;max-height:90vh;overflow:auto;box-shadow:0 6px 28px rgba(0,0,0,.4);font-family:Tahoma,Arial,sans-serif;';

    var hdr = document.createElement('div'); hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;';
    var hdrTitle = document.createElement('h3'); hdrTitle.textContent = '💰 المحفظة الشهرية'; hdrTitle.style.cssText = 'margin:0;font-size:15px;color:#222;';
    var empLabel = document.createElement('span'); empLabel.textContent = empName; empLabel.style.cssText = 'font-size:12px;background:#e67e22;color:#fff;border-radius:12px;padding:2px 10px;';
    var hdrLeft = document.createElement('div'); hdrLeft.style.cssText = 'display:flex;align-items:center;gap:8px;';
    hdrLeft.appendChild(empLabel);
    var closeX = document.createElement('button'); closeX.type = 'button'; closeX.textContent = '✕'; closeX.style.cssText = 'background:none;border:none;font-size:18px;cursor:pointer;color:#888;padding:0;line-height:1;';
    closeX.addEventListener('click', function () { overlay.remove(); }); hdrLeft.appendChild(closeX);
    hdr.appendChild(hdrTitle); hdr.appendChild(hdrLeft); panel.appendChild(hdr);

    if (todayTotals) {
      var todayBox = document.createElement('div');
      todayBox.style.cssText = 'background:#fff8e1;border:1.5px solid #f0b429;border-radius:8px;padding:10px 14px;margin-bottom:12px;';
      var todayTitle = document.createElement('div'); todayTitle.textContent = '📅 اليوم — ' + getTodayStr(); todayTitle.style.cssText = 'font-size:12px;color:#b7791f;margin-bottom:6px;font-weight:bold;';
      todayBox.appendChild(todayTitle);
      var todayGrid = document.createElement('div'); todayGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px;color:#555;margin-bottom:6px;';
      [5000,4000,3000,2000].forEach(function (fee) {
        var cnt = todayTotals[fee] || 0;
        if (cnt > 0) {
          var cell = document.createElement('div'); cell.textContent = 'أجر ' + formatNum(fee) + ': ' + cnt + ' × ' + feeMap[fee] + ' = ' + formatNum(cnt * feeMap[fee]) + ' د';
          todayGrid.appendChild(cell);
        }
      });
      todayBox.appendChild(todayGrid);
      var todayTotal = document.createElement('div'); todayTotal.textContent = '💵 مجموع اليوم: ' + formatNum(todayAmount) + ' دينار';
      todayTotal.style.cssText = 'font-size:14px;font-weight:bold;color:#b7791f;'; todayBox.appendChild(todayTotal);
      panel.appendChild(todayBox);
    }

    var monthSelect = document.createElement('select'); monthSelect.style.cssText = 'width:100%;padding:7px;border:1px solid #ccc;border-radius:5px;font-size:13px;margin-bottom:12px;';
    availableMonths.forEach(function (ym) {
      var opt = document.createElement('option'); opt.value = ym; opt.textContent = getMonthLabel(ym) + (ym === currentYm ? ' (الحالي)' : '');
      monthSelect.appendChild(opt);
    });
    panel.appendChild(monthSelect);

    var bodyWrap = document.createElement('div'); panel.appendChild(bodyWrap);

    function renderMonth(ym) {
      bodyWrap.innerHTML = '';
      var result = calcMonthTotal(empName, ym);
      var days = result.days;

      if (!days.length) {
        var empty = document.createElement('div'); empty.style.cssText = 'text-align:center;color:#999;padding:18px 0;font-size:13px;'; empty.textContent = 'لا توجد سجلات لهذا الشهر'; bodyWrap.appendChild(empty); return;
      }

      var tbl = document.createElement('table'); tbl.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px;';
      var thead = document.createElement('thead');
      var hRow = document.createElement('tr'); hRow.style.cssText = 'background:#f0f0f0;';
      ['التاريخ','اليوم','التفاصيل','المبلغ',''].forEach(function (h) {
        var th = document.createElement('th'); th.textContent = h; th.style.cssText = 'padding:5px 6px;text-align:center;border:1px solid #ddd;color:#444;font-size:11px;'; hRow.appendChild(th);
      });
      thead.appendChild(hRow); tbl.appendChild(thead);
      var tbody = document.createElement('tbody');
      days.forEach(function (rec, idx) {
        var tr = document.createElement('tr'); tr.style.cssText = 'background:' + (idx % 2 === 0 ? '#fff' : '#fafafa') + ';';
        var tdDate = document.createElement('td'); tdDate.textContent = rec.date; tdDate.style.cssText = 'padding:5px 6px;border:1px solid #eee;text-align:center;color:#333;font-size:11px;white-space:nowrap;'; tr.appendChild(tdDate);
        var tdDay = document.createElement('td'); tdDay.textContent = DAYS_AR[rec.day] || ''; tdDay.style.cssText = 'padding:5px 6px;border:1px solid #eee;text-align:center;color:#555;font-size:11px;'; tr.appendChild(tdDay);
        var details = [];
        if (rec.totals) { [5000,4000,3000,2000].forEach(function(fee){ if(rec.totals[fee]>0){details.push(fee/1000+'k×'+rec.totals[fee]);} }); }
        var tdDet = document.createElement('td'); tdDet.textContent = details.join(' | ') || '—'; tdDet.style.cssText = 'padding:5px 6px;border:1px solid #eee;text-align:center;color:#666;font-size:10px;'; tr.appendChild(tdDet);
        var tdAmt = document.createElement('td'); tdAmt.textContent = formatNum(rec.amount) + ' د'; tdAmt.style.cssText = 'padding:5px 6px;border:1px solid #eee;text-align:center;color:#1a8a3a;font-weight:bold;font-size:12px;'; tr.appendChild(tdAmt);
        var tdDel = document.createElement('td'); tdDel.style.cssText = 'padding:2px 4px;border:1px solid #eee;text-align:center;';
        var delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.textContent = '🗑️'; delBtn.title = 'حذف يوم ' + rec.date;
        delBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:12px;color:#c0392b;padding:0;';
        delBtn.addEventListener('click', function () {
          if (!confirm('حذف سجل يوم ' + rec.date + '؟')) { return; }
          var md = loadWalletMonth(empName, ym); delete md[rec.date]; saveWalletMonth(empName, ym, md); renderMonth(ym);
        });
        tdDel.appendChild(delBtn); tr.appendChild(tdDel);
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody); bodyWrap.appendChild(tbl);

      var totalBox = document.createElement('div');
      totalBox.style.cssText = 'background:' + (result.total > 0 ? '#e8f5e9' : '#f5f5f5') + ';border:2px solid ' + (result.total > 0 ? '#1a8a3a' : '#ccc') + ';border-radius:8px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;';
      var tlbl = document.createElement('span'); tlbl.textContent = '📅 مجموع ' + getMonthLabel(ym) + ' (' + days.length + ' يوم)'; tlbl.style.cssText = 'font-size:12px;color:#333;font-weight:bold;';
      var tval = document.createElement('span'); tval.textContent = formatNum(result.total) + ' دينار'; tval.style.cssText = 'font-size:20px;font-weight:bold;color:' + (result.total > 0 ? '#1a8a3a' : '#888') + ';';
      totalBox.appendChild(tlbl); totalBox.appendChild(tval); bodyWrap.appendChild(totalBox);

      var copyBtn = document.createElement('button'); copyBtn.type = 'button'; copyBtn.textContent = '📋 نسخ التقرير الشهري'; copyBtn.style.cssText = 'width:100%;background:#28a745;color:#fff;border:none;border-radius:6px;padding:9px;cursor:pointer;font-size:13px;font-weight:bold;margin-bottom:6px;';
      copyBtn.addEventListener('click', function () {
        var lines = ['💰 تقرير المحفظة الشهرية', 'الموظف: ' + empName, 'الشهر: ' + getMonthLabel(ym), '══════════════════════════'];
        days.forEach(function (rec) {
          var det = [];
          if (rec.totals) { [5000,4000,3000,2000].forEach(function(fee){ if(rec.totals[fee]>0){det.push('أجر '+fee+': '+rec.totals[fee]+' طلب');} }); }
          lines.push(DAYS_AR[rec.day] + ' ' + rec.date + ' — ' + (det.join(' | ') || '') + ' = ' + formatNum(rec.amount) + ' د');
        });
        lines.push('══════════════════════════');
        lines.push('المجموع الشهري: ' + formatNum(result.total) + ' دينار');
        copyText(lines.join('\n'));
        var orig = copyBtn.textContent; copyBtn.textContent = '✅ تم النسخ'; setTimeout(function () { copyBtn.textContent = orig; }, 1400);
      });
      bodyWrap.appendChild(copyBtn);
    }

    monthSelect.addEventListener('change', function () { renderMonth(monthSelect.value); });
    renderMonth(currentYm);

    var closeBtn = document.createElement('button'); closeBtn.type = 'button'; closeBtn.textContent = 'إغلاق'; closeBtn.style.cssText = 'width:100%;background:#888;color:#fff;border:none;border-radius:6px;padding:9px;cursor:pointer;font-size:13px;';
    closeBtn.addEventListener('click', function () { overlay.remove(); }); panel.appendChild(closeBtn);
    overlay.appendChild(panel); overlay.addEventListener('click', function (e) { if (e.target === overlay) { overlay.remove(); } }); document.body.appendChild(overlay);
  }

  // ══════════════════════════════════════════════════════════════
  //  استخراج اسم المندوب
  // ══════════════════════════════════════════════════════════════
  var wsLastRepName = '';
  function toWesternDigits(s) { return String(s||'').replace(/[٠-٩]/g,function(d){return String(d.charCodeAt(0)-0x0660);}); }
  function normalizeSpaces(s) { return toWesternDigits(s).replace(/\s+/g,' ').trim(); }
  var EXCLUDED_WORDS=['الاجمالي','الإجمالي','المجموع','الكل','total','sum','grand'];
  function isExcludedText(name){var lower=name.toLowerCase();return EXCLUDED_WORDS.some(function(w){return lower.indexOf(w)!==-1;});}
  var RE_CODE_PREFIX=/^[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]*\s*[:\-]?\s*/,RE_AR_PREFIX=/^(?:مندوب|المندوب)\s*[:\-]?\s*/,RE_TRAILING_COUNT=/\s*[\(\[]\s*\d+\s*[\)\]]\s*$/;
  function extractRepNameFromText(rawText){var t=normalizeSpaces(rawText);if(isExcludedText(t)){return '';}t=t.replace(RE_CODE_PREFIX,'').replace(RE_AR_PREFIX,'').replace(RE_TRAILING_COUNT,'').trim();if(!/^[\u0600-\u06FFa-zA-Z]/.test(t)){return '';}if(t.length<2||t.length>60){return '';}return t;}
  function findRepNameForRow(row){if(!row){return '';}var node=row.previousElementSibling,hops=0;while(node&&hops<300){hops++;var name=extractRepNameFromHeaderRow(node);if(name){return name;}node=node.previousElementSibling;}return '';}
  function extractRepNameFromHeaderRow(tr){
    if(!tr||tr.tagName!=='TR'){return '';}
    var colspanCells=tr.querySelectorAll('td[colspan],th[colspan]');for(var i=0;i<colspanCells.length;i++){var name=extractRepNameFromText(colspanCells[i].textContent);if(name){return name;}}
    var cls=(tr.className||'').toLowerCase();if(cls.indexOf('group')!==-1||cls.indexOf('header')!==-1||cls.indexOf('rep')!==-1){var name2=extractRepNameFromText(tr.textContent);if(name2){return name2;}}
    var allCells=tr.querySelectorAll('td,th'),visibleCells=[];allCells.forEach(function(c){if(c.style.display!=='none'&&c.offsetParent!==null){visibleCells.push(c);}});if(visibleCells.length===0){allCells.forEach(function(c){visibleCells.push(c);});}if(visibleCells.length===1){var name3=extractRepNameFromText(visibleCells[0].textContent);if(name3){return name3;}}
    return '';
  }

  // ══════════════════════════════════════════════════════════════
  //  تقييم المناديب
  // ══════════════════════════════════════════════════════════════
  var REP_RATINGS_KEY='waseet_rep_ratings_v1';
  var RATING_DEFS=[{id:'excellent',label:'ممتاز',emoji:'✅',color:'#1a8a3a'},{id:'good',label:'جيد',emoji:'👍',color:'#2e5bff'},{id:'bad',label:'سيئ',emoji:'⚠️',color:'#c0392b'}];
  function ratingDef(id){for(var i=0;i<RATING_DEFS.length;i++){if(RATING_DEFS[i].id===id){return RATING_DEFS[i];}}return null;}
  function getWeekKey(date){var d=new Date(date.getFullYear(),date.getMonth(),date.getDate());d.setDate(d.getDate()-d.getDay());return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());}
  function getWeekRangeLabel(weekKey){var start=new Date(weekKey),end=new Date(start);end.setDate(end.getDate()+6);var fmt=function(d){return pad2(d.getDate())+'/'+pad2(d.getMonth()+1);};return fmt(start)+' — '+fmt(end);}
  function loadRepRatings(){var raw=storeGet(REP_RATINGS_KEY);if(!raw){return {};}try{var p=JSON.parse(raw);return(p&&typeof p==='object')?p:{};}catch(e){return {};}}
  function saveRepRatings(obj){try{storeSet(REP_RATINGS_KEY,JSON.stringify(obj));}catch(e){}}
  function saveOneRating(orderId,repName,ratingId,note){var all=loadRepRatings(),now=new Date();all[orderId]={orderId:orderId,repName:repName||'غير معروف',rating:ratingId,note:(note||'').trim(),weekKey:getWeekKey(now),ts:now.getTime()};saveRepRatings(all);return all[orderId];}
  function deleteOneRating(orderId){var all=loadRepRatings();if(all[orderId]){delete all[orderId];saveRepRatings(all);return true;}return false;}
  function getAvailableWeekKeys(){var all=loadRepRatings(),set={};Object.keys(all).forEach(function(id){set[all[id].weekKey]=true;});var keys=Object.keys(set);keys.sort(function(a,b){return b.localeCompare(a);});if(!keys.length){keys.push(getWeekKey(new Date()));}return keys;}
  function calcRepStats(weekKey){
    var all=loadRepRatings(),byRep={};
    Object.keys(all).forEach(function(orderId){var r=all[orderId];if(r.weekKey!==weekKey){return;}if(!byRep[r.repName]){byRep[r.repName]={excellent:0,good:0,bad:0,notes:[],total:0,score:0};}byRep[r.repName][r.rating]++;byRep[r.repName].total++;if(r.note){byRep[r.repName].notes.push({orderId:r.orderId,rating:r.rating,note:r.note});}});
    var sEx=wsSettings.ratingScoreExcellent!=null?wsSettings.ratingScoreExcellent:3,sGo=wsSettings.ratingScoreGood!=null?wsSettings.ratingScoreGood:1,sBa=wsSettings.ratingScoreBad!=null?wsSettings.ratingScoreBad:-2;
    Object.keys(byRep).forEach(function(name){var s=byRep[name];s.score=(s.excellent*sEx)+(s.good*sGo)+(s.bad*sBa);s.pctExcellent=s.total?Math.round((s.excellent/s.total)*100):0;s.pctGood=s.total?Math.round((s.good/s.total)*100):0;s.pctBad=s.total?Math.round((s.bad/s.total)*100):0;});
    var sorted=Object.keys(byRep).sort(function(a,b){return byRep[b].score-byRep[a].score||byRep[b].total-byRep[a].total;});
    return{byRep:byRep,sorted:sorted};
  }
  function buildWeeklyStatText(weekKey){
    var stats=calcRepStats(weekKey),byRep=stats.byRep,sorted=stats.sorted;
    if(!sorted.length){return 'إحصائية المناديب — الأسبوع '+getWeekRangeLabel(weekKey)+'\nلا توجد تقييمات مسجَّلة.';}
    var lines=['📊 إحصائية أداء المناديب','الأسبوع: '+getWeekRangeLabel(weekKey),'══════════════════════════'];
    sorted.forEach(function(name,idx){var s=byRep[name];var medal=idx===0?'🥇':idx===1?'🥈':idx===2?'🥉':(idx+1)+'.';lines.push('');lines.push(medal+' '+name);lines.push('   النقاط: '+s.score+'  |  الإجمالي: '+s.total+' تقييم');lines.push('   ✅ ممتاز: '+s.excellent+' ('+s.pctExcellent+'%)  👍 جيد: '+s.good+' ('+s.pctGood+'%)  ⚠️ سيئ: '+s.bad+' ('+s.pctBad+'%)');if(s.notes.length){lines.push('   ملاحظات:');s.notes.forEach(function(n){var d=ratingDef(n.rating);lines.push('   • طلب '+n.orderId+' ('+(d?d.label:n.rating)+'): '+n.note);});}});
    lines.push('');lines.push('══════════════════════════');lines.push('🔢 أوزان: ممتاز='+(wsSettings.ratingScoreExcellent||3)+'  جيد='+(wsSettings.ratingScoreGood||1)+'  سيئ='+(wsSettings.ratingScoreBad||-2));
    return lines.join('\n');
  }
  function openWeeklyStatDialog(weekKey){
    if(document.getElementById('ws-stat-overlay')){return;}
    var overlay=document.createElement('div');overlay.id='ws-stat-overlay';overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000002;display:flex;align-items:center;justify-content:center;direction:rtl;';
    var panel=document.createElement('div');panel.style.cssText='background:#fff;border-radius:10px;padding:18px 20px;width:400px;max-height:88vh;overflow:auto;box-shadow:0 6px 28px rgba(0,0,0,.4);font-family:Tahoma,Arial,sans-serif;';
    var hdr=document.createElement('div');hdr.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;';
    var hdrTitle=document.createElement('h3');hdrTitle.textContent='📊 إحصائية أداء المناديب';hdrTitle.style.cssText='margin:0;font-size:15px;color:#222;';
    var closeX=document.createElement('button');closeX.type='button';closeX.textContent='✕';closeX.style.cssText='background:none;border:none;font-size:18px;cursor:pointer;color:#888;line-height:1;padding:0;';closeX.addEventListener('click',function(){overlay.remove();});
    hdr.appendChild(hdrTitle);hdr.appendChild(closeX);panel.appendChild(hdr);
    var weekKeys=getAvailableWeekKeys();var weekSelect=document.createElement('select');weekSelect.style.cssText='width:100%;padding:6px;border:1px solid #ccc;border-radius:5px;font-size:12px;margin-bottom:14px;';
    weekKeys.forEach(function(wk){var opt=document.createElement('option');opt.value=wk;opt.textContent='الأسبوع '+getWeekRangeLabel(wk)+(wk===getWeekKey(new Date())?' (الحالي)':'');if(wk===weekKey){opt.selected=true;}weekSelect.appendChild(opt);});panel.appendChild(weekSelect);
    var cardsWrap=document.createElement('div');panel.appendChild(cardsWrap);
    function renderCards(wk){
      var s2=calcRepStats(wk),br=s2.byRep,so=s2.sorted;cardsWrap.innerHTML='';
      if(!so.length){var empty=document.createElement('div');empty.style.cssText='text-align:center;color:#999;padding:20px 0;font-size:13px;';empty.textContent='لا توجد تقييمات بهذا الأسبوع';cardsWrap.appendChild(empty);return;}
      var medals=['🥇','🥈','🥉'];
      so.forEach(function(name,idx){
        var s=br[name],card=document.createElement('div'),isTop=idx===0;
        card.style.cssText='border-radius:8px;padding:10px 12px;margin-bottom:10px;background:'+(isTop?'#f0fff4':'#f8f9fa')+';border:1.5px solid '+(isTop?'#1a8a3a':'#dee2e6')+';';
        var topRow=document.createElement('div');topRow.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;';
        var nameEl=document.createElement('span');nameEl.style.cssText='font-size:14px;font-weight:bold;color:#222;';nameEl.textContent=(medals[idx]||(idx+1)+'.')+' '+name;
        var scoreEl=document.createElement('span');scoreEl.style.cssText='font-size:12px;background:'+(s.score>=0?'#1a8a3a':'#c0392b')+';color:#fff;border-radius:20px;padding:2px 10px;';scoreEl.textContent=(s.score>=0?'+':'')+s.score+' نقطة';
        topRow.appendChild(nameEl);topRow.appendChild(scoreEl);card.appendChild(topRow);
        [{label:'✅ ممتاز',pct:s.pctExcellent,count:s.excellent,color:'#1a8a3a'},{label:'👍 جيد',pct:s.pctGood,count:s.good,color:'#2e5bff'},{label:'⚠️ سيئ',pct:s.pctBad,count:s.bad,color:'#c0392b'}].forEach(function(bar){
          var barRow=document.createElement('div');barRow.style.cssText='display:flex;align-items:center;gap:6px;margin-bottom:3px;';
          var lbl=document.createElement('span');lbl.style.cssText='font-size:11px;color:#555;min-width:64px;text-align:right;';lbl.textContent=bar.label+' ('+bar.count+')';
          var track=document.createElement('div');track.style.cssText='flex:1;height:8px;background:#e9ecef;border-radius:4px;overflow:hidden;';
          var fill=document.createElement('div');fill.style.cssText='height:100%;width:'+bar.pct+'%;background:'+bar.color+';border-radius:4px;';track.appendChild(fill);
          var pctLbl=document.createElement('span');pctLbl.style.cssText='font-size:11px;color:#555;min-width:34px;';pctLbl.textContent=bar.pct+'%';
          barRow.appendChild(lbl);barRow.appendChild(track);barRow.appendChild(pctLbl);card.appendChild(barRow);
        });
        var totalEl=document.createElement('div');totalEl.style.cssText='font-size:11px;color:#888;margin-top:4px;text-align:left;';totalEl.textContent='الإجمالي: '+s.total+' تقييم';card.appendChild(totalEl);
        if(s.notes.length){var notesToggle=document.createElement('button');notesToggle.type='button';notesToggle.textContent='عرض الملاحظات ('+s.notes.length+')';notesToggle.style.cssText='background:none;border:none;color:#2e5bff;font-size:11px;cursor:pointer;padding:0;margin-top:4px;';var notesBox=document.createElement('div');notesBox.style.cssText='display:none;background:#fff;border:1px solid #ddd;border-radius:5px;padding:6px 8px;margin-top:4px;font-size:11px;color:#555;line-height:1.7;';s.notes.forEach(function(n){var d=ratingDef(n.rating);var li=document.createElement('div');li.textContent='• طلب '+n.orderId+' ('+(d?d.label:n.rating)+'): '+n.note;notesBox.appendChild(li);});notesToggle.addEventListener('click',function(){var hidden=notesBox.style.display==='none';notesBox.style.display=hidden?'block':'none';notesToggle.textContent=hidden?'إخفاء الملاحظات':'عرض الملاحظات ('+s.notes.length+')';});card.appendChild(notesToggle);card.appendChild(notesBox);}
        cardsWrap.appendChild(card);
      });
    }
    weekSelect.addEventListener('change',function(){renderCards(weekSelect.value);});renderCards(weekKey);
    var actRow=document.createElement('div');actRow.style.cssText='display:flex;gap:6px;margin-top:12px;';
    var copyBtn=document.createElement('button');copyBtn.type='button';copyBtn.textContent='📋 نسخ التقرير';copyBtn.style.cssText='flex:1;background:#28a745;color:#fff;border:none;border-radius:5px;padding:8px;cursor:pointer;font-size:12px;';copyBtn.addEventListener('click',function(){copyText(buildWeeklyStatText(weekSelect.value));var orig=copyBtn.textContent;copyBtn.textContent='✅ تم النسخ';setTimeout(function(){copyBtn.textContent=orig;},1400);});actRow.appendChild(copyBtn);
    var closeBtn2=document.createElement('button');closeBtn2.type='button';closeBtn2.textContent='إغلاق';closeBtn2.style.cssText='flex:1;background:#888;color:#fff;border:none;border-radius:5px;padding:8px;cursor:pointer;font-size:12px;';closeBtn2.addEventListener('click',function(){overlay.remove();});actRow.appendChild(closeBtn2);
    panel.appendChild(actRow);overlay.appendChild(panel);overlay.addEventListener('click',function(e){if(e.target===overlay){overlay.remove();}});document.body.appendChild(overlay);
  }
  var WS_WEEKLY_NOTIF_KEY='waseet_weekly_notif_shown';
  function checkWeeklyAutoReport(){if(!wsSettings.ratingAutoReport){return;}var now=new Date();if(now.getDay()!==5){return;}var wk=getWeekKey(now),lastShown=storeGet(WS_WEEKLY_NOTIF_KEY)||'';if(lastShown===wk){return;}var all=loadRepRatings(),hasData=Object.keys(all).some(function(id){return all[id].weekKey===wk;});if(!hasData){return;}storeSet(WS_WEEKLY_NOTIF_KEY,wk);setTimeout(function(){showWeeklyNotifBanner(wk);},3000);}
  function showWeeklyNotifBanner(wk){if(document.getElementById('ws-weekly-banner')){return;}var banner=document.createElement('div');banner.id='ws-weekly-banner';banner.style.cssText='position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:1000003;background:#8e44ad;color:#fff;border-radius:8px;padding:12px 18px;font-family:Tahoma,Arial,sans-serif;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.35);display:flex;align-items:center;gap:10px;direction:rtl;max-width:380px;';var msg=document.createElement('span');msg.textContent='📊 نهاية الأسبوع — هل تريد عرض إحصائية أداء المناديب؟';banner.appendChild(msg);var viewBtn=document.createElement('button');viewBtn.type='button';viewBtn.textContent='عرض';viewBtn.style.cssText='background:#fff;color:#8e44ad;border:none;border-radius:5px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:bold;flex-shrink:0;';viewBtn.addEventListener('click',function(){banner.remove();openWeeklyStatDialog(wk);});banner.appendChild(viewBtn);var dismissBtn=document.createElement('button');dismissBtn.type='button';dismissBtn.textContent='✕';dismissBtn.style.cssText='background:none;border:none;color:#fff;font-size:16px;cursor:pointer;flex-shrink:0;padding:0;line-height:1;';dismissBtn.addEventListener('click',function(){banner.remove();});banner.appendChild(dismissBtn);document.body.appendChild(banner);setTimeout(function(){if(banner.parentNode){banner.remove();}},15000);}

  function openRatingSettingsPanel(){
    if(document.getElementById('ws-rating-settings-overlay')){return;}
    var overlay=document.createElement('div');overlay.id='ws-rating-settings-overlay';overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000001;display:flex;align-items:center;justify-content:center;direction:rtl;';
    var panel=document.createElement('div');panel.style.cssText='background:#fff;border-radius:8px;padding:18px 20px;width:340px;max-height:88vh;overflow:auto;box-shadow:0 4px 20px rgba(0,0,0,.35);font-family:Tahoma,Arial,sans-serif;';
    var title=document.createElement('h3');title.textContent='⭐ إعدادات التقييم';title.style.cssText='margin:0 0 14px;font-size:15px;color:#222;';panel.appendChild(title);
    var autoRow=document.createElement('label');autoRow.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 2px;font-size:13px;color:#333;cursor:pointer;border-bottom:1px solid #eee;margin-bottom:10px;';var autoCb=document.createElement('input');autoCb.type='checkbox';autoCb.checked=!!wsSettings.ratingAutoReport;autoCb.addEventListener('change',function(){wsSettings.ratingAutoReport=autoCb.checked;saveSettings(wsSettings);});autoRow.appendChild(autoCb);autoRow.appendChild(document.createTextNode('تنبيه تلقائي بالإحصائية كل يوم جمعة'));panel.appendChild(autoRow);
    var weightsTitle=document.createElement('div');weightsTitle.textContent='أوزان النقاط:';weightsTitle.style.cssText='font-size:13px;color:#333;font-weight:bold;margin-bottom:8px;';panel.appendChild(weightsTitle);
    [{key:'ratingScoreExcellent',label:'✅ ممتاز',color:'#1a8a3a'},{key:'ratingScoreGood',label:'👍 جيد',color:'#2e5bff'},{key:'ratingScoreBad',label:'⚠️ سيئ',color:'#c0392b'}].forEach(function(item){var row=document.createElement('div');row.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;';var lbl=document.createElement('label');lbl.textContent=item.label;lbl.style.cssText='font-size:13px;color:'+item.color+';font-weight:bold;min-width:80px;';var inp=document.createElement('input');inp.type='number';inp.value=wsSettings[item.key]!=null?wsSettings[item.key]:DEFAULT_SETTINGS[item.key];inp.style.cssText='width:80px;padding:5px;border:1px solid #ccc;border-radius:5px;font-size:13px;text-align:center;';inp.addEventListener('change',function(){wsSettings[item.key]=parseFloat(inp.value)||0;saveSettings(wsSettings);});row.appendChild(lbl);row.appendChild(inp);panel.appendChild(row);});
    var sep=document.createElement('div');sep.style.cssText='border-top:1px solid #eee;margin:14px 0;';panel.appendChild(sep);
    var weekSelect=document.createElement('select');weekSelect.style.cssText='width:100%;padding:6px;border:1px solid #ccc;border-radius:5px;font-size:12px;margin-bottom:8px;';getAvailableWeekKeys().forEach(function(wk){var opt=document.createElement('option');opt.value=wk;opt.textContent='الأسبوع '+getWeekRangeLabel(wk)+(wk===getWeekKey(new Date())?' (الحالي)':'');weekSelect.appendChild(opt);});panel.appendChild(weekSelect);
    var listBox=document.createElement('div');listBox.style.cssText='max-height:140px;overflow:auto;background:#f5f5f5;border-radius:5px;padding:6px 8px;font-size:11px;color:#444;line-height:1.7;margin-bottom:8px;';panel.appendChild(listBox);
    function renderList(){var wk=weekSelect.value,all=loadRepRatings();var rows=Object.keys(all).map(function(k){return all[k];}).filter(function(r){return r.weekKey===wk;}).sort(function(a,b){return b.ts-a.ts;});listBox.innerHTML='';if(!rows.length){var empty=document.createElement('div');empty.style.cssText='text-align:center;color:#999;';empty.textContent='لا توجد تقييمات';listBox.appendChild(empty);return;}rows.forEach(function(r){var d=ratingDef(r.rating),rowEl=document.createElement('div');rowEl.style.cssText='display:flex;align-items:flex-start;justify-content:space-between;gap:6px;padding:4px 0;border-bottom:1px solid #e5e5e5;';var textEl=document.createElement('div');textEl.style.cssText='flex:1;min-width:0;';var line1=document.createElement('div');line1.appendChild(document.createTextNode((d?d.emoji:'')+' '));var nameBold=document.createElement('b');nameBold.textContent=r.repName;line1.appendChild(nameBold);line1.appendChild(document.createTextNode(' — طلب '+r.orderId));textEl.appendChild(line1);if(r.note){var line2=document.createElement('div');line2.style.color='#777';line2.textContent='↳ '+r.note;textEl.appendChild(line2);}rowEl.appendChild(textEl);var delBtn=document.createElement('button');delBtn.type='button';delBtn.textContent='🗑️';delBtn.title='حذف';delBtn.style.cssText='flex-shrink:0;background:none;border:none;cursor:pointer;font-size:13px;color:#c0392b;padding:0 2px;';delBtn.addEventListener('click',function(){if(!confirm('حذف تقييم الطلب '+r.orderId+'؟')){return;}deleteOneRating(r.orderId);renderList();});rowEl.appendChild(delBtn);listBox.appendChild(rowEl);});}
    weekSelect.addEventListener('change',renderList);renderList();
    var statBtn=document.createElement('button');statBtn.type='button';statBtn.textContent='📊 عرض الإحصائية';statBtn.style.cssText='width:100%;background:#8e44ad;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;margin-bottom:6px;';statBtn.addEventListener('click',function(){overlay.remove();openWeeklyStatDialog(weekSelect.value);});panel.appendChild(statBtn);
    var reportBtn=document.createElement('button');reportBtn.type='button';reportBtn.textContent='📋 نسخ تقرير أسبوعي';reportBtn.style.cssText='width:100%;background:#28a745;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;margin-bottom:6px;';reportBtn.addEventListener('click',function(){copyText(buildWeeklyStatText(weekSelect.value));var orig=reportBtn.textContent;reportBtn.textContent='✅ تم النسخ';setTimeout(function(){reportBtn.textContent=orig;},1400);});panel.appendChild(reportBtn);
    var closeBtn=document.createElement('button');closeBtn.type='button';closeBtn.textContent='إغلاق';closeBtn.style.cssText='width:100%;background:#888;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;';closeBtn.addEventListener('click',function(){overlay.remove();});panel.appendChild(closeBtn);
    overlay.appendChild(panel);overlay.addEventListener('click',function(e){if(e.target===overlay){overlay.remove();}});document.body.appendChild(overlay);
  }

  function openRatingDialog(orderId,repName){
    if(document.getElementById('ws-rating-overlay')){return;}
    var existing=loadRepRatings()[orderId]||null;
    var overlay=document.createElement('div');overlay.id='ws-rating-overlay';overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000000;display:flex;align-items:center;justify-content:center;direction:rtl;';
    var panel=document.createElement('div');panel.style.cssText='background:#fff;border-radius:8px;padding:16px 18px;width:320px;max-height:85vh;overflow:auto;box-shadow:0 4px 20px rgba(0,0,0,.35);font-family:Tahoma,Arial,sans-serif;';
    var title=document.createElement('h3');title.textContent='⭐ تقييم المندوب';title.style.cssText='margin:0 0 10px;font-size:15px;color:#222;';panel.appendChild(title);
    var repNameValue=repName||'',isUnknown=!repNameValue;
    var repNameLabel=document.createElement('div');repNameLabel.style.cssText='font-size:12px;color:#555;margin-bottom:3px;';repNameLabel.textContent='اسم المندوب:';panel.appendChild(repNameLabel);
    var repNameInput=document.createElement('input');repNameInput.type='text';repNameInput.value=repNameValue;repNameInput.placeholder='اكتب اسم المندوب يدوياً...';repNameInput.style.cssText='width:100%;box-sizing:border-box;padding:7px 8px;border:2px solid '+(isUnknown?'#e67e22':'#ccc')+';border-radius:5px;font-size:13px;direction:rtl;margin-bottom:4px;';
    if(isUnknown){var warnNote=document.createElement('div');warnNote.style.cssText='font-size:11px;color:#e67e22;margin-bottom:8px;';warnNote.textContent='⚠️ لم يتم التعرف على اسم المندوب تلقائياً.';panel.appendChild(repNameInput);panel.appendChild(warnNote);}else{panel.appendChild(repNameInput);var spacer=document.createElement('div');spacer.style.height='8px';panel.appendChild(spacer);}
    var orderInfo=document.createElement('div');orderInfo.style.cssText='font-size:12px;color:#555;background:#f5f5f5;border-radius:5px;padding:6px 10px;margin-bottom:12px;';orderInfo.innerHTML='<b>رقم الطلب:</b> '+orderId;panel.appendChild(orderInfo);
    var selectedRating=existing?existing.rating:null;var btnRow=document.createElement('div');btnRow.style.cssText='display:flex;gap:6px;margin-bottom:12px;';var ratingBtns={};
    RATING_DEFS.forEach(function(def){var rb=document.createElement('button');rb.type='button';rb.textContent=def.emoji+' '+def.label;rb.style.cssText='flex:1;border:2px solid '+def.color+';background:#fff;color:'+def.color+';border-radius:6px;padding:8px 4px;cursor:pointer;font-size:12px;font-weight:bold;';rb.addEventListener('click',function(){selectedRating=def.id;Object.keys(ratingBtns).forEach(function(id){var b=ratingBtns[id],d=ratingDef(id);if(id===selectedRating){b.style.background=d.color;b.style.color='#fff';}else{b.style.background='#fff';b.style.color=d.color;}});});ratingBtns[def.id]=rb;btnRow.appendChild(rb);});panel.appendChild(btnRow);
    if(selectedRating&&ratingBtns[selectedRating]){var initDef=ratingDef(selectedRating);ratingBtns[selectedRating].style.background=initDef.color;ratingBtns[selectedRating].style.color='#fff';}
    var noteLabel=document.createElement('div');noteLabel.textContent='ملاحظة (اختياري):';noteLabel.style.cssText='font-size:12px;color:#555;margin-bottom:4px;';panel.appendChild(noteLabel);
    var noteInput=document.createElement('textarea');noteInput.rows=3;noteInput.value=existing?(existing.note||''):'';noteInput.style.cssText='width:100%;box-sizing:border-box;padding:6px;border:1px solid #ccc;border-radius:5px;font-size:12px;direction:rtl;resize:vertical;margin-bottom:12px;';panel.appendChild(noteInput);
    if(existing){var existingNote=document.createElement('div');existingNote.textContent='⚠️ يوجد تقييم سابق بتاريخ '+new Date(existing.ts).toLocaleString('ar-IQ')+'، الحفظ سيستبدله.';existingNote.style.cssText='font-size:11px;color:#e67e22;margin-bottom:10px;line-height:1.5;';panel.appendChild(existingNote);}
    var actionRow=document.createElement('div');actionRow.style.cssText='display:flex;gap:6px;';
    var saveBtn=document.createElement('button');saveBtn.type='button';saveBtn.textContent='💾 حفظ التقييم';saveBtn.style.cssText='flex:1;background:#28a745;color:#fff;border:none;border-radius:5px;padding:8px;cursor:pointer;font-size:13px;';saveBtn.addEventListener('click',function(){if(!selectedRating){alert('يرجى اختيار تقييم قبل الحفظ.');return;}var finalRepName=repNameInput.value.trim()||'غير معروف';if(finalRepName!=='غير معروف'){wsLastRepName=finalRepName;}saveOneRating(orderId,finalRepName,selectedRating,noteInput.value);overlay.remove();});actionRow.appendChild(saveBtn);
    var cancelBtn=document.createElement('button');cancelBtn.type='button';cancelBtn.textContent='إلغاء';cancelBtn.style.cssText='flex:1;background:#888;color:#fff;border:none;border-radius:5px;padding:8px;cursor:pointer;font-size:13px;';cancelBtn.addEventListener('click',function(){overlay.remove();});actionRow.appendChild(cancelBtn);
    panel.appendChild(actionRow);overlay.appendChild(panel);overlay.addEventListener('click',function(e){if(e.target===overlay){overlay.remove();}});document.body.appendChild(overlay);
    if(isUnknown){setTimeout(function(){repNameInput.focus();},100);}
  }

  function buildSettingsPanel(){
    if(document.getElementById('ws-settings-overlay')){return;}
    var overlay=document.createElement('div');overlay.id='ws-settings-overlay';overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:999999;display:flex;align-items:center;justify-content:center;direction:rtl;';
    var panel=document.createElement('div');panel.style.cssText='background:#fff;border-radius:8px;padding:18px 20px;width:320px;max-height:82vh;overflow:auto;box-shadow:0 4px 20px rgba(0,0,0,.3);font-family:Tahoma,Arial,sans-serif;';
    var title=document.createElement('h3');title.textContent='⚙️ إظهار/إخفاء الأزرار والأيقونات';title.style.cssText='margin:0 0 12px;font-size:15px;color:#222;';panel.appendChild(title);
    [{key:'showStory',label:'🔍 زر قصة الطلب'},{key:'showFees',label:'➕ زر أجور التوصيل'},{key:'showEdit',label:'🌐 زر تغيير العنوان'},{key:'showWsMerchant',label:'💬 واتساب التاجر'},{key:'showWsCustomer',label:'📦 واتساب الزبون'},{key:'showSms',label:'📱 رسالة SMS للزبون'},{key:'showPhoneSearch',label:'🔎 بحث عن الزبون برقم الهاتف'},{key:'showDelayCheck',label:'🔎 زر فحص التأخير'},{key:'showCopyReport',label:'📋 زر نسخ التقرير (صفحة الأجور)'},{key:'showCopyReps',label:'📋 زر نسخ قائمة المناديب'},{key:'showRepRating',label:'⭐ زر تقييم المندوب'},{key:'showDeferred',label:'🕒 زر المؤجل (تأجيل الطلب تلقائياً)'}].forEach(function(item){
      var locked = false;
      try { if (typeof window !== 'undefined' && window.WSAdmin) { locked = window.WSAdmin.isFeatureLocked(item.key); } } catch(e) {}
      var row=document.createElement('label');
      row.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 2px;font-size:13px;color:'+(locked?'#aaa':'#333')+';cursor:'+(locked?'not-allowed':'pointer')+';border-bottom:1px solid #eee;';
      var cb=document.createElement('input');cb.type='checkbox';cb.checked=!!wsSettings[item.key];
      if (locked) {
        cb.disabled = true;
        cb.checked = false;
        cb.style.cssText = 'opacity:0.4;';
      } else {
        cb.addEventListener('change',function(){wsSettings[item.key]=cb.checked;saveSettings(wsSettings);applyVisibility();});
      }
      var span=document.createElement('span');span.textContent=item.label+(locked?' 🔒':'');
      row.appendChild(cb);row.appendChild(span);panel.appendChild(row);
    });

    var recvRow=document.createElement('label');recvRow.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 2px;font-size:13px;color:#333;cursor:pointer;border-bottom:1px solid #eee;';var recvCb=document.createElement('input');recvCb.type='checkbox';recvCb.checked=!!wsSettings.showReceivedCounter;recvCb.addEventListener('change',function(){wsSettings.showReceivedCounter=recvCb.checked;saveSettings(wsSettings);if(typeof refreshReceivedBadge==='function'){refreshReceivedBadge();}});var recvSpan=document.createElement('span');recvSpan.textContent='📦 عداد الطلبات المستلمة اليوم (أسفل الشاشة)';recvRow.appendChild(recvCb);recvRow.appendChild(recvSpan);panel.appendChild(recvRow);

    var delaySection=document.createElement('div');delaySection.style.cssText='margin-top:14px;padding-top:12px;border-top:1px solid #ddd;';var delayTitle=document.createElement('div');delayTitle.textContent='🔎 وضع فحص الطلبات المتأخرة';delayTitle.style.cssText='font-size:13px;color:#333;margin-bottom:6px;font-weight:bold;';delaySection.appendChild(delayTitle);var modeDesc=document.createElement('div');modeDesc.style.cssText='font-size:11px;color:#666;margin-bottom:8px;line-height:1.5;';modeDesc.textContent='تلقائي: كل 90 ثانية.\nيدوي: عند الضغط فقط.';delaySection.appendChild(modeDesc);
    var currentMode=wsSettings.delayCheckMode||'auto';[{val:'auto',label:'🔄 تلقائي كل 90 ثانية'},{val:'manual',label:'👆 يدوي (عند الضغط فقط)'}].forEach(function(opt){var lbl=document.createElement('label');lbl.style.cssText='display:flex;align-items:center;gap:8px;padding:5px 2px;font-size:13px;color:#333;cursor:pointer;';var rb=document.createElement('input');rb.type='radio';rb.name='ws-delay-mode';rb.value=opt.val;rb.checked=(currentMode===opt.val);rb.addEventListener('change',function(){if(rb.checked){wsSettings.delayCheckMode=opt.val;saveSettings(wsSettings);if(typeof applyDelayMode==='function'){applyDelayMode();}if(typeof updateCheckBtnLabel==='function'){updateCheckBtnLabel();}}});lbl.appendChild(rb);lbl.appendChild(document.createTextNode(opt.label));delaySection.appendChild(lbl);});panel.appendChild(delaySection);

    // ✅ (4.0.4): قسم مراقب التوصيل — تشغيل/إيقاف المراقب كاملاً من اللوحة الرئيسية
    // عند الإيقاف: لوحة المراقب تختفي من صفحة "قيد التوصيل" كلياً ويتوقف كل الفحص
    var dmSection=document.createElement('div');dmSection.style.cssText='margin-top:14px;padding-top:12px;border-top:1px solid #ddd;';
    var dmTitle=document.createElement('div');dmTitle.textContent='🚚 مراقب التوصيل';dmTitle.style.cssText='font-size:13px;color:#333;margin-bottom:6px;font-weight:bold;';dmSection.appendChild(dmTitle);
    var dmRow=document.createElement('label');dmRow.style.cssText='display:flex;align-items:center;gap:8px;padding:5px 2px;font-size:13px;color:#333;cursor:pointer;';
    var dmCb=document.createElement('input');dmCb.type='checkbox';dmCb.checked=dmGetStopCheck();
    var dmStateLbl=document.createElement('span');dmStateLbl.textContent='إظهار وتشغيل لوحة المراقب';
    dmCb.addEventListener('change',function(){dmSetStopCheck(dmCb.checked);dmHint.textContent=dmCb.checked?'✅ مفعّل — اللوحة تظهر وتعمل بصفحة "قيد التوصيل" خلال ~3 ثوانٍ.':'🔕 موقوف — اللوحة تختفي من الشاشة كلياً ويتوقف كل الفحص خلال ~3 ثوانٍ.';});
    dmRow.appendChild(dmCb);dmRow.appendChild(dmStateLbl);dmSection.appendChild(dmRow);
    var dmHint=document.createElement('div');dmHint.style.cssText='font-size:11px;color:#666;line-height:1.5;';
    dmHint.textContent=dmCb.checked?'مفعّل — اللوحة تظهر وتعمل بصفحة "قيد التوصيل". التغيير يسري خلال ~3 ثوانٍ بدون إعادة تحميل.':'🔕 موقوف حالياً — لوحة المراقب مخفية ولا يعمل أي فحص.';
    dmSection.appendChild(dmHint);
    // ✅ (4.1.5): الفحص الخلفي بدون فتح صفحة "قيد التوصيل"
    var dmBgRow=document.createElement('div');dmBgRow.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:10px;border-top:1px dashed #ddd;';
    var dmBgLbl=document.createElement('label');dmBgLbl.textContent='📡 فحص خلفي بدون فتح الصفحة كل (دقيقة):';dmBgLbl.style.cssText='font-size:12px;color:#333;';
    var dmBgInp=document.createElement('input');dmBgInp.type='number';dmBgInp.min='2';dmBgInp.max='30';dmBgInp.value=dmGetBgPollMinutes();dmBgInp.style.cssText='width:70px;padding:5px;border:1px solid #ccc;border-radius:5px;font-size:12px;text-align:center;';
    dmBgInp.addEventListener('change',function(){dmSetBgPollMinutes(dmBgInp.value);dmBgInp.value=dmGetBgPollMinutes();});
    dmBgRow.appendChild(dmBgLbl);dmBgRow.appendChild(dmBgInp);dmSection.appendChild(dmBgRow);
    var dmBgHint=document.createElement('div');dmBgHint.style.cssText='font-size:11px;color:#666;line-height:1.5;margin-top:4px;';
    dmBgHint.textContent='إذا كانت صفحة "قيد التوصيل" غير مفتوحة بأي تبويب، يقوم أي تبويب آخر مفتوح على موقع الوسيط بجلب بيانات الصفحة وفحصها بصمت بنفس هذا الفاصل الزمني، ويحافظ على نفس إعدادات وحسابات المراقب (المدة، الموعد النهائي، إلخ) حتى تفتح اللوحة لاحقاً.';
    dmSection.appendChild(dmBgHint);
    panel.appendChild(dmSection);

    var deferredLogSep=document.createElement('div');deferredLogSep.style.cssText='margin-top:14px;padding-top:12px;border-top:1px solid #ddd;';panel.appendChild(deferredLogSep);
    var deferredLogBtn=document.createElement('button');deferredLogBtn.type='button';
    var deferredLogCount=getDeferredLog().length;
    deferredLogBtn.textContent='🕒 سجل الطلبات والقرارات'+(deferredLogCount?(' ('+deferredLogCount+')'):'');
    deferredLogBtn.style.cssText='width:100%;background:#16a085;color:#fff;border:none;border-radius:6px;padding:10px;cursor:pointer;font-size:13px;font-weight:bold;';
    deferredLogBtn.addEventListener('click',function(){overlay.remove();openDeferredLogPanel();});
    deferredLogSep.appendChild(deferredLogBtn);

    // ✅ (4.3.0): تفعيل/تعطيل "الزر الذكي" — معطّل افتراضياً لكل موظف حتى يفعّله بنفسه
    var smartSep=document.createElement('div');smartSep.style.cssText='margin-top:14px;padding-top:12px;border-top:1px solid #ddd;';panel.appendChild(smartSep);
    var smartTitle=document.createElement('div');smartTitle.textContent='🕒 الزر الذكي (يعمل على كل القرارات)';smartTitle.style.cssText='font-size:13px;color:#333;font-weight:bold;margin-bottom:8px;';smartSep.appendChild(smartTitle);
    var smartRow=document.createElement('div');smartRow.style.cssText='display:flex;align-items:center;justify-content:space-between;';
    var smartLbl=document.createElement('label');smartLbl.style.cssText='font-size:12px;color:#555;flex:1;';
    var smartCb=document.createElement('input');smartCb.type='checkbox';smartCb.checked=!!wsSettings.smartDecisionEnabled;smartCb.style.cssText='width:18px;height:18px;cursor:pointer;';
    var smartStateLbl=document.createElement('span');smartStateLbl.style.cssText='font-size:12px;font-weight:bold;margin-right:6px;color:'+(smartCb.checked?'#1a8a3a':'#999')+';';smartStateLbl.textContent=smartCb.checked?'مفعّل':'معطّل';
    smartLbl.textContent='تفعيل التصرف حسب كل القرارات';
    smartCb.addEventListener('change',function(){wsSettings.smartDecisionEnabled=smartCb.checked;saveSettings(wsSettings);smartStateLbl.textContent=smartCb.checked?'مفعّل':'معطّل';smartStateLbl.style.color=smartCb.checked?'#1a8a3a':'#999';smartHint.textContent=smartCb.checked?smartHintOn:smartHintOff;});
    smartRow.appendChild(smartCb);smartRow.appendChild(smartLbl);smartRow.appendChild(smartStateLbl);smartSep.appendChild(smartRow);
    var smartHintOn='مفعّل — الزر يتغيّر تلقائياً حسب حالة الطلب الحالية (مؤجل/الغاء/لم يطلب/...الخ) ويأكّد نفس القرار بضغطة واحدة. مستثنى دائماً: "رفض الطلب" و"العنوان غير دقيق" و"تغيير سعر" (الزر يتعطّل لهم).';
    var smartHintOff='🔕 معطّل حالياً — الزر يبقى بسيط ويسوي فقط "تأجيل الطلب" (مؤجل + ملاحظة "غدا") دايماً، بغض النظر عن حالة الطلب.';
    var smartHint=document.createElement('div');smartHint.style.cssText='font-size:11px;color:#666;line-height:1.5;margin-top:6px;';smartHint.textContent=smartCb.checked?smartHintOn:smartHintOff;smartSep.appendChild(smartHint);

    var ratingSep=document.createElement('div');ratingSep.style.cssText='margin-top:14px;padding-top:12px;border-top:1px solid #ddd;';panel.appendChild(ratingSep);var ratingBtn=document.createElement('button');ratingBtn.type='button';ratingBtn.textContent='⭐ التقييم — الإعدادات والإحصائية';ratingBtn.style.cssText='width:100%;background:#8e44ad;color:#fff;border:none;border-radius:6px;padding:10px;cursor:pointer;font-size:13px;font-weight:bold;';ratingBtn.addEventListener('click',function(){overlay.remove();openRatingSettingsPanel();});ratingSep.appendChild(ratingBtn);

    var walletSep=document.createElement('div');walletSep.style.cssText='margin-top:14px;padding-top:12px;border-top:1px solid #ddd;';panel.appendChild(walletSep);
    var walletTitle=document.createElement('div');walletTitle.textContent='💰 إعدادات المحفظة الشهرية';walletTitle.style.cssText='font-size:13px;color:#333;font-weight:bold;margin-bottom:10px;';walletSep.appendChild(walletTitle);
    var offDayLabel=document.createElement('div');offDayLabel.textContent='يوم العطلة الأسبوعية:';offDayLabel.style.cssText='font-size:12px;color:#555;margin-bottom:5px;';walletSep.appendChild(offDayLabel);
    var offDaySelect=document.createElement('select');offDaySelect.style.cssText='width:100%;padding:6px;border:1px solid #ccc;border-radius:5px;font-size:12px;margin-bottom:10px;';
    DAYS_AR.forEach(function(dayName,idx){var opt=document.createElement('option');opt.value=idx;opt.textContent=dayName;if((wsSettings.walletOffDay!=null?wsSettings.walletOffDay:5)===idx){opt.selected=true;}offDaySelect.appendChild(opt);});
    offDaySelect.addEventListener('change',function(){wsSettings.walletOffDay=parseInt(offDaySelect.value,10);saveSettings(wsSettings);});walletSep.appendChild(offDaySelect);
    var feesLabel=document.createElement('div');feesLabel.textContent='مبلغ المحفظة لكل فئة (دينار/طلب):';feesLabel.style.cssText='font-size:12px;color:#555;margin-bottom:6px;';walletSep.appendChild(feesLabel);
    [{key:'walletFee5000',label:'أجر 5000'},{key:'walletFee4000',label:'أجر 4000'},{key:'walletFee3000',label:'أجر 3000'},{key:'walletFee2000',label:'أجر 2000'}].forEach(function(item){
      var row=document.createElement('div');row.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;';var lbl=document.createElement('label');lbl.textContent=item.label;lbl.style.cssText='font-size:12px;color:#555;min-width:70px;';var inp=document.createElement('input');inp.type='number';inp.value=wsSettings[item.key]!=null?wsSettings[item.key]:DEFAULT_SETTINGS[item.key];inp.style.cssText='width:90px;padding:5px;border:1px solid #ccc;border-radius:5px;font-size:12px;text-align:center;';inp.addEventListener('change',function(){wsSettings[item.key]=parseInt(inp.value,10)||0;saveSettings(wsSettings);});row.appendChild(lbl);row.appendChild(inp);walletSep.appendChild(row);
    });

    var opacitySection=document.createElement('div');opacitySection.style.cssText='margin-top:14px;padding-top:12px;border-top:1px solid #ddd;';var opacityLabel=document.createElement('div');opacityLabel.textContent='مستوى شفافية الأزرار وعداد الطلبات: '+wsSettings.opacity+'%';opacityLabel.style.cssText='font-size:13px;color:#333;margin-bottom:6px;';var opacitySlider=document.createElement('input');opacitySlider.type='range';opacitySlider.min='20';opacitySlider.max='100';opacitySlider.step='5';opacitySlider.value=wsSettings.opacity;opacitySlider.style.cssText='width:100%;cursor:pointer;';opacitySlider.addEventListener('input',function(){wsSettings.opacity=parseInt(opacitySlider.value,10);opacityLabel.textContent='مستوى شفافية الأزرار وعداد الطلبات: '+wsSettings.opacity+'%';saveSettings(wsSettings);applyVisibility();});opacitySection.appendChild(opacityLabel);opacitySection.appendChild(opacitySlider);panel.appendChild(opacitySection);

    var custSection=document.createElement('div');custSection.style.cssText='margin-top:14px;padding-top:12px;border-top:1px solid #ddd;';var custTitle=document.createElement('div');custTitle.textContent='✉️ قالب رسالة الزبون';custTitle.style.cssText='font-size:13px;color:#333;margin-bottom:6px;font-weight:bold;';custSection.appendChild(custTitle);var custSelect=document.createElement('select');custSelect.style.cssText='width:100%;padding:6px;border:1px solid #ccc;border-radius:5px;font-size:12px;margin-bottom:6px;';Object.keys(PRESET_CUSTOMER_TEMPLATES).forEach(function(id){var opt=document.createElement('option');opt.value=id;opt.textContent=PRESET_CUSTOMER_TEMPLATES[id].label;if(id===(wsSettings.customerTemplateId||'default')){opt.selected=true;}custSelect.appendChild(opt);});var custEditBtn=document.createElement('button');custEditBtn.type='button';custEditBtn.textContent='✏️ تحرير القالب المخصص';custEditBtn.style.cssText='width:100%;background:#e67e22;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;display:'+(custSelect.value==='custom'?'block':'none')+';';custSelect.addEventListener('change',function(){wsSettings.customerTemplateId=custSelect.value;saveSettings(wsSettings);custEditBtn.style.display=(custSelect.value==='custom')?'block':'none';});custEditBtn.addEventListener('click',function(){openTemplateEditor({title:'تحرير قالب رسالة الزبون',help:'المتغيرات:\n{merchant} اسم المتجر\n{price} السعر\n{order} رقم الطلب',value:(wsSettings.customerCustomTemplate&&wsSettings.customerCustomTemplate.trim())?wsSettings.customerCustomTemplate:PRESET_CUSTOMER_TEMPLATES.default.text,defaultValue:PRESET_CUSTOMER_TEMPLATES.default.text,onSave:function(val){wsSettings.customerCustomTemplate=val;saveSettings(wsSettings);}});});custSection.appendChild(custSelect);custSection.appendChild(custEditBtn);panel.appendChild(custSection);

    var repSection=document.createElement('div');repSection.style.cssText='margin-top:14px;padding-top:12px;border-top:1px solid #ddd;';var repTitle=document.createElement('div');repTitle.textContent='📋 قالب تقرير الأجور';repTitle.style.cssText='font-size:13px;color:#333;margin-bottom:6px;font-weight:bold;';repSection.appendChild(repTitle);var stationLabel=document.createElement('div');stationLabel.textContent='اسم المحطة:';stationLabel.style.cssText='font-size:12px;color:#555;margin-bottom:3px;';repSection.appendChild(stationLabel);var stationInput=document.createElement('input');stationInput.type='text';stationInput.value=wsSettings.stationName||'المنصور';stationInput.style.cssText='width:100%;box-sizing:border-box;padding:6px;border:1px solid #ccc;border-radius:5px;font-size:12px;margin-bottom:8px;';stationInput.addEventListener('change',function(){wsSettings.stationName=stationInput.value.trim()||'المنصور';saveSettings(wsSettings);});repSection.appendChild(stationInput);var repEditBtn=document.createElement('button');repEditBtn.type='button';repEditBtn.textContent='✏️ تحرير نص التقرير';repEditBtn.style.cssText='width:100%;background:#e67e22;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;';repEditBtn.addEventListener('click',function(){openTemplateEditor({title:'تحرير قالب تقرير الأجور',help:'المتغيرات:\n{station} {employee} {date} {day}\n{normal5000..2000} {vip5000..2000} {total5000..2000}',value:(wsSettings.reportTemplate&&wsSettings.reportTemplate.trim())?wsSettings.reportTemplate:DEFAULT_REPORT_TEMPLATE,defaultValue:DEFAULT_REPORT_TEMPLATE,onSave:function(val){wsSettings.reportTemplate=val;saveSettings(wsSettings);}});});repSection.appendChild(repEditBtn);panel.appendChild(repSection);

    var updateCheckBtn=document.createElement('button');updateCheckBtn.type='button';updateCheckBtn.textContent='🔄 فحص التحديث الآن';updateCheckBtn.style.cssText='margin-top:14px;width:100%;background:#1a8a3a;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;';updateCheckBtn.addEventListener('click',function(){var fn=(typeof unsafeWindow!=='undefined'&&unsafeWindow.wsForceCheckUpdate)?unsafeWindow.wsForceCheckUpdate:(window.wsForceCheckUpdate||null);if(!fn){alert('تعذّر تشغيل الفحص.');return;}var orig=updateCheckBtn.textContent;updateCheckBtn.textContent='⏳ يفحص...';updateCheckBtn.disabled=true;fn(function(found,remote){updateCheckBtn.textContent=orig;updateCheckBtn.disabled=false;if(found===null){alert('تعذّر الاتصال بالسيرفر. حاول لاحقاً.');}else if(found){/* البانر سيظهر تلقائياً بالأسفل */}else{alert('أنت تستخدم آخر إصدار (v'+(remote||'?')+' أو أقدم — لا يوجد أحدث).');}});});panel.appendChild(updateCheckBtn);

    var resetBtn=document.createElement('button');resetBtn.type='button';resetBtn.textContent='إعادة الكل للوضع الافتراضي';resetBtn.style.cssText='margin-top:14px;width:100%;background:#888;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;';resetBtn.addEventListener('click',function(){wsSettings=Object.assign({},DEFAULT_SETTINGS);saveSettings(wsSettings);applyVisibility();if(typeof applyDelayMode==='function'){applyDelayMode();}if(typeof updateCheckBtnLabel==='function'){updateCheckBtnLabel();}overlay.remove();buildSettingsPanel();});panel.appendChild(resetBtn);
    var closeBtn=document.createElement('button');closeBtn.type='button';closeBtn.textContent='إغلاق';closeBtn.style.cssText='margin-top:8px;width:100%;background:#2e5bff;color:#fff;border:none;border-radius:5px;padding:8px;cursor:pointer;font-size:13px;';closeBtn.addEventListener('click',function(){overlay.remove();});panel.appendChild(closeBtn);
    overlay.appendChild(panel);overlay.addEventListener('click',function(e){if(e.target===overlay){overlay.remove();}});document.body.appendChild(overlay);
  }

  // ✅ (4.3.0): نافذة عرض سجل الطلبات والقرارات (رقم الطلب + القرار + الوقت)
  function openDeferredLogPanel(){
    if(document.getElementById('ws-deferred-log-overlay')){return;}
    var overlay=document.createElement('div');overlay.id='ws-deferred-log-overlay';overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:999999;display:flex;align-items:center;justify-content:center;direction:rtl;';
    var panel=document.createElement('div');panel.style.cssText='background:#fff;border-radius:8px;padding:18px 20px;width:360px;max-height:82vh;overflow:auto;box-shadow:0 4px 20px rgba(0,0,0,.3);font-family:Tahoma,Arial,sans-serif;';
    var title=document.createElement('h3');title.textContent='🕒 سجل الطلبات والقرارات';title.style.cssText='margin:0 0 10px;font-size:15px;color:#222;';panel.appendChild(title);

    var list=getDeferredLog();
    var hint=document.createElement('div');hint.style.cssText='font-size:11px;color:#666;line-height:1.5;margin-bottom:10px;';
    hint.textContent=list.length?('عدد القرارات المسجّلة: '+list.length+' (آخر '+DEFERRED_LOG_MAX+' كحد أقصى).'):'لا يوجد أي قرار مسجّل بعد. يُسجَّل الطلب والقرار المتخذ تلقائياً هنا عند نجاح ضغط زر "🕒 المؤجل".';
    panel.appendChild(hint);

    if(list.length){
      var listWrap=document.createElement('div');listWrap.style.cssText='max-height:340px;overflow:auto;border:1px solid #eee;border-radius:6px;margin-bottom:12px;';
      list.forEach(function(entry,idx){
        var row=document.createElement('div');row.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:7px 10px;font-size:12.5px;color:#333;gap:8px;'+(idx<list.length-1?'border-bottom:1px solid #f0f0f0;':'');
        var leftWrap=document.createElement('div');leftWrap.style.cssText='display:flex;flex-direction:column;gap:2px;overflow:hidden;';
        var orderSpan=document.createElement('span');orderSpan.textContent='📦 '+entry.order;orderSpan.style.cssText='font-weight:bold;';
        var decisionSpan=document.createElement('span');decisionSpan.textContent='القرار: '+(entry.decision||'مؤجل');decisionSpan.style.cssText='font-size:11px;color:#16a085;font-weight:bold;';
        leftWrap.appendChild(orderSpan);leftWrap.appendChild(decisionSpan);
        var timeSpan=document.createElement('span');timeSpan.textContent=fmtDeferredTime(entry.time);timeSpan.style.cssText='color:#888;font-size:11.5px;white-space:nowrap;';
        row.appendChild(leftWrap);row.appendChild(timeSpan);listWrap.appendChild(row);
      });
      panel.appendChild(listWrap);

      var copyBtn=document.createElement('button');copyBtn.type='button';copyBtn.textContent='📋 نسخ القائمة';
      copyBtn.style.cssText='width:100%;background:#2e5bff;color:#fff;border:none;border-radius:6px;padding:9px;cursor:pointer;font-size:13px;font-weight:bold;margin-bottom:8px;';
      copyBtn.addEventListener('click',function(){
        var text=list.map(function(e){return e.order+' — '+(e.decision||'مؤجل')+' — '+fmtDeferredTime(e.time);}).join('\n');
        var done=function(){var orig=copyBtn.textContent;copyBtn.textContent='✅ تم النسخ';setTimeout(function(){copyBtn.textContent=orig;},1500);};
        if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done).catch(function(){fallbackCopy(text);done();});}
        else{fallbackCopy(text);done();}
      });
      panel.appendChild(copyBtn);

      var clearBtn=document.createElement('button');clearBtn.type='button';clearBtn.textContent='🗑️ مسح السجل';
      clearBtn.style.cssText='width:100%;background:#c0392b;color:#fff;border:none;border-radius:6px;padding:9px;cursor:pointer;font-size:13px;font-weight:bold;margin-bottom:8px;';
      clearBtn.addEventListener('click',function(){
        if(clearBtn.getAttribute('data-confirm')==='1'){clearDeferredLog();overlay.remove();openDeferredLogPanel();return;}
        clearBtn.setAttribute('data-confirm','1');clearBtn.textContent='⚠️ اضغط مرة ثانية للتأكيد';
        setTimeout(function(){clearBtn.removeAttribute('data-confirm');clearBtn.textContent='🗑️ مسح السجل';},2500);
      });
      panel.appendChild(clearBtn);
    }

    var closeBtn=document.createElement('button');closeBtn.type='button';closeBtn.textContent='إغلاق';closeBtn.style.cssText='width:100%;background:#888;color:#fff;border:none;border-radius:5px;padding:8px;cursor:pointer;font-size:13px;';closeBtn.addEventListener('click',function(){overlay.remove();});panel.appendChild(closeBtn);

    overlay.appendChild(panel);overlay.addEventListener('click',function(e){if(e.target===overlay){overlay.remove();}});document.body.appendChild(overlay);
  }

  function addSettingsBtn(){
    if(document.getElementById('ws-settings-btn')){return;}
    var btn=document.createElement('button');btn.id='ws-settings-btn';btn.type='button';btn.textContent='⚙️ الإعدادات';btn.style.cssText='position:fixed;top:10px;left:10px;z-index:99999;background:#555;color:#fff;border:none;border-radius:4px;padding:8px 14px;cursor:pointer;font-size:13px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,.3);';
    btn.addEventListener('click',buildSettingsPanel);document.body.appendChild(btn);
  }

  // ══════════════════════════════════════════════════════════════
  //  ☎️ دليل الأرقام: الكول سنتر + المحافظات + بغداد (كرخ/رصافة)
  // ══════════════════════════════════════════════════════════════
  var CONTACTS_CALLCENTER = [
    ['07744441010', 'الخط الأول'],
    ['07744441414', 'الخط الثاني']
  ];
  var CONTACTS_INQUIRY = [ // أرقام الاستفسار العامة لكل محافظة
    ['بغداد', '07744441010'], ['المسيب', '07744442929'], ['كركوك', '07744440707'],
    ['خانقين', '07744441717'], ['النجف', '07744442323'], ['الديوانية', '07744440505'],
    ['البصرة', '07744444040'], ['الرمادي', '07744449898'], ['سامراء', '07744447373'],
    ['الناصرية', '07744446868'], ['الكوت', '07744447676'], ['ديالى', '07744441515'],
    ['الحلة', '07744442929'], ['كربلاء', '07744446464'], ['أربيل', '07744443434'],
    ['الفلوجة', '07744449292'], ['السليمانية', '07744445757'], ['السماوة', '07744440808'],
    ['الموصل', '07744447878'], ['دهوك', '07504444353']
  ];
  var CONTACTS_REPORTS = [ // أرقام التبليغات لكل محافظة
    ['البصرة', ['07719492104', '07710756532', '07731637648']],
    ['الحلة', ['07723320914', '07728759376']],
    ['الناصرية', ['07723320915', '07732882784']],
    ['الأنبار', ['07736479262', '07715767033']],
    ['النجف', ['07704180484', '07728759372']],
    ['كربلاء', ['07710759893', '07731336954']],
    ['ديالى', ['07732882647']],
    ['الموصل', ['07704182042', '07704372546', '07736478716']],
    ['أربيل', ['07728759380']],
    ['السليمانية', ['07736478724']],
    ['دهوك', ['07707402819']],
    ['صلاح الدين', ['07725378835']],
    ['السماوة', ['07723320878']],
    ['الديوانية', ['07736479263']],
    ['العمارة', ['07736479241']],
    ['كركوك', ['07736479178']],
    ['الكوت', ['07736479212']]
  ];
  var CONTACTS_KARKH = [ // [قطاع, اسم المتابعة, اسم الموظف, الرقم]
    ['كرخ1', 'متابعة البياع', 'سلام معين عبدالامير', '07705964361'],
    ['كرخ2', 'متابعة المنصور', 'احمد محمد كريم', '07734721170'],
    ['كرخ3', 'متابعة منصور2 / بياع2 اعلام', 'علي وسام عبدالامير', '07779397566'],
    ['كرخ4', 'متابعة الكاظمية', 'عبدالرزاق عصام عبدالرزاق', '07704127792'],
    ['كرخ5', 'متابعة علاوي / الطارمية', 'محمد حسن نجم', '07779397609'],
    ['كرخ6', 'متابعة اسكان / اليوسفية', 'عبدالرحمن خالد قاسم', '07779397574'],
    ['كرخ7', 'محطة التاجي', 'محمدالامين ميثم محمد', '07734087361'],
    ['كرخ8', 'محطة المحمودية', 'عباس قاسم موجد', '07727921867'],
    ['كرخ9', 'متابعة ابو غريب 1', 'حمزه محمد حسن', '07779324967'],
    ['كرخ10', 'متابعة العامرية', 'مصطفى كريم خضير', '07744442471'],
    ['كرخ11', 'متابعة حي الجهاد 1', 'احمد ليث مجيد', '07735571353'],
    ['كرخ12', 'متابعة حي الجهاد 2', 'باقر صلاح علي', '07779397573'],
    ['كرخ13', 'متابعة الغزالية', 'مصطفى عبدالكريم ابراهيم', '07705964309'],
    ['كرخ14', 'متابعة الحرية', 'منير عبدالرحمن محمد', '07747249406'],
    ['كرخ15', 'متابعة دورة 1', 'مصطفى محمد عبدالحسن', '07715767027'],
    ['كرخ16', 'متابعة الدورة 2', 'مصطفى مأرب محمد علي', '07751143382'],
    ['كرخ17', 'متابعة دورة 3', 'عبدالله فارس جعفر', '07735571724'],
    ['كرخ18', 'متابعة دورة 4', 'مهدي مالك عبدالوهاب', '07779324989'],
    ['كرخ19', 'متابعة السيدية', 'مؤمل ستار حسين', '07744442436'],
    ['كرخ20', 'متابعة الشعلة', 'عبدالله عبدالعظيم حاتم', '07744443619'],
    ['كرخ21', 'متابعة حي الجامعة', 'مصطفى علي محمد', '07747249398'],
    ['كرخ22', 'متابعة ابو غريب 2 / عامرية2 ايرموك', 'حيدر عدن عبدالحسن', '07779324969']
  ];
  var CONTACTS_RUSAFA = [ // [المنطقة, اسم الموظف, الرقم]
    ['مدينة الصدر 1', 'مرتضى احمد حسين', '07732882659'],
    ['شعب', 'علي هادي احمد', '07714096299'],
    ['زيونة', 'مصطفى كريم حسين', '07779397552'],
    ['البلديات 1', 'الحسن علي نعمة', '07734721123'],
    ['كرادة 1', 'صدام عادل حامد', '07727921842'],
    ['زعفرانية', 'عبدالله فراس عبد القادر', '07734088235'],
    ['الاعظمية 1', 'حسين علي صباح', '07707244126'],
    ['شارع فلسطين', 'علي ماجد عبد', '07704363068'],
    ['بنوك 1', 'حسن فلاح عزيز', '07734088230'],
    ['حسينية', 'مهند رحيم صاحب', '07744442832'],
    ['بغداد جديدة 1', 'سيف الدين عبد حميد', '07744442468'],
    ['مدينة الصدر 2', 'مصطفى كريم عبد انصيف', '07744443104'],
    ['اعظمية 2', 'احمد عبد الكريم', '07735571105'],
    ['جسر ديالى - مدائن', 'حسين ستار عباس', '07735571608'],
    ['بنوك 2 - كرادة 2', 'احمد جمعة الشيخ', '07735572037'],
    ['بسماية + نهروان', 'احمد خالد فيصل', '07779397537'],
    ['معامل + زعفرانية 2', 'علي كريم خضير', '07779397610'],
    ['بلديات 2', 'همام عويد صالح', '07779397578'],
    ['شعب 2', 'حسين محمد علي مطر', '07779397592'],
    ['بغداد جديدة 2', 'عمار عادل عبد الكريم', '07779397591'],
    ['اعظمية 3', 'موسى راشد وني', '07707347481'],
    ['مدينة 3', 'محمد فائز كاظم', '07744442438']
  ];

  // ══════════════════════════════════════════════════════════════
  //  ☎️ ثيم لوحة دليل الأرقام (مأخوذ من تصميم مرجعي قدّمه أحمد) —
  //  التصميم فقط؛ البيانات تبقى من مصادرنا الأصلية بالأعلى.
  // ══════════════════════════════════════════════════════════════
  injectCss(
    '#ws-contacts-btn{position:fixed;left:18px;bottom:20px;z-index:2147483646;border:0;cursor:pointer;width:62px;height:62px;border-radius:18px;background:linear-gradient(145deg,#17499d,#0b2d70);color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.28);font-size:28px;transition:.2s;}' +
    '#ws-contacts-btn:hover{transform:translateY(-3px) scale(1.04);}' +
    '#ws-contacts-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(7,20,43,.70);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:25px;direction:rtl;font-family:Tahoma,Arial,sans-serif;}' +
    '.ws-cd-modal{width:min(1200px,96vw);height:min(800px,92vh);background:#f7f9fd;border-radius:24px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.40);display:flex;flex-direction:column;animation:wsCdOpen .22s ease;}' +
    '@keyframes wsCdOpen{from{opacity:0;transform:scale(.94) translateY(15px);}to{opacity:1;transform:scale(1) translateY(0);}}' +
    '.ws-cd-header{background:linear-gradient(135deg,#123d87,#0b2d68);color:#fff;padding:22px 28px;position:relative;flex-shrink:0;}' +
    '.ws-cd-title{display:flex;align-items:center;justify-content:center;gap:12px;font-size:28px;font-weight:900;}' +
    '.ws-cd-subtitle{text-align:center;margin-top:6px;font-size:14px;opacity:.9;}' +
    '.ws-cd-close{position:absolute;right:20px;top:18px;width:42px;height:42px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.10);color:#fff;font-size:24px;cursor:pointer;line-height:1;}' +
    '.ws-cd-search{position:absolute;left:24px;top:24px;width:260px;height:42px;border:0;outline:0;border-radius:12px;padding:0 16px;font-size:13.5px;background:#fff;color:#16376d;box-sizing:border-box;}' +
    '.ws-cd-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:14px 22px;background:#fff;border-bottom:1px solid #e2e8f2;flex-shrink:0;transition:.2s;}' +
    '.ws-cd-search-mode{display:none;text-align:center;background:#eaf1ff;color:#173d79;font-size:12.5px;font-weight:800;padding:9px;border-bottom:1px solid #dbe6f7;}' +
    '.ws-cd-search-mode.show{display:block;}' +
    '.ws-cd-tabs.searching .ws-cd-tab{opacity:.42;}' +
    '.ws-cd-tabs.searching .ws-cd-tab.active{background:none;color:#12386f;box-shadow:none;border-color:transparent;opacity:.42;}' +
    '.ws-cd-hl{background:#ffe58a;color:#5a3d00;border-radius:3px;padding:0 1px;}' +
    '.ws-cd-tab{height:50px;border-radius:12px;border:1px solid #dce4f0;background:#fff;color:#173b78;font-size:14.5px;font-weight:800;cursor:pointer;transition:.2s;font-family:inherit;}' +
    '.ws-cd-tab:hover{background:#f2f6fd;}' +
    '.ws-cd-tab.active{background:linear-gradient(135deg,#17499d,#0d357c);color:#fff;box-shadow:0 8px 20px rgba(19,64,140,.20);border-color:transparent;}' +
    '.ws-cd-content{flex:1;overflow:auto;padding:18px 22px 22px;}' +
    '.ws-cd-section-title{font-size:19px;font-weight:900;color:#12386f;margin:4px 0 14px;}' +
    '.ws-cd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}' +
    '.ws-cd-card{position:relative;background:#fff;border:1px solid #e0e7f2;border-radius:14px;padding:13px 15px;display:flex;align-items:center;gap:12px;min-height:70px;box-sizing:border-box;box-shadow:0 3px 10px rgba(21,52,95,.04);transition:.18s;}' +
    '.ws-cd-source-tag{position:absolute;top:-9px;right:12px;background:linear-gradient(135deg,#17499d,#0d357c);color:#fff;font-size:10px;font-weight:800;padding:2px 9px;border-radius:20px;box-shadow:0 3px 8px rgba(19,64,140,.25);}' +
    '.ws-cd-card:hover{border-color:#9eb9e8;transform:translateY(-1px);box-shadow:0 7px 18px rgba(21,52,95,.09);}' +
    '.ws-cd-info{flex:1;min-width:0;}' +
    '.ws-cd-name{font-size:15.5px;font-weight:900;color:#183c78;margin-bottom:4px;}' +
    '.ws-cd-phone{direction:ltr;unicode-bidi:embed;font-size:17px;font-weight:900;letter-spacing:.4px;color:#152f5e;}' +
    '.ws-cd-note{color:#65799b;font-size:12px;margin-top:4px;}' +
    '.ws-cd-region{display:inline-block;margin-top:6px;padding:3px 8px;border-radius:20px;background:#e5f6ea;color:#19864a;font-size:11px;font-weight:800;}' +
    '.ws-cd-areas{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;}' +
    '.ws-cd-area-badge{background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:6px;padding:2px 7px;font-size:10.5px;font-weight:700;}' +
    '.ws-cd-actions{flex:none;display:flex;flex-direction:column;gap:6px;align-items:stretch;}' +
    '.ws-cd-copy{border:1px solid #d8e1ee;background:#fff;color:#173d79;border-radius:9px;padding:8px 13px;cursor:pointer;font-size:12.5px;font-weight:800;transition:.18s;font-family:inherit;white-space:nowrap;}' +
    '.ws-cd-copy:hover{background:#edf4ff;border-color:#8eafe0;}' +
    '.ws-cd-copy.done{background:#dff5e6;color:#168044;border-color:#a9dfb9;}' +
    '.ws-cd-wa{border:1px solid #bbf0cf;background:#e9fbf1;color:#0f7a3d;border-radius:9px;padding:8px 13px;cursor:pointer;font-size:12.5px;font-weight:800;transition:.18s;font-family:inherit;white-space:nowrap;text-decoration:none;display:inline-block;text-align:center;}' +
    '.ws-cd-wa:hover{background:#d7f6e4;border-color:#8fe3b6;}' +
    '.ws-cd-empty{text-align:center;padding:60px 20px;color:#71809a;font-size:15px;}' +
    '.ws-cd-footer{text-align:center;background:#fff;border-top:1px solid #e1e7f0;padding:11px;color:#5d7194;font-size:12px;flex-shrink:0;}' +
    '#ws-cd-toast{position:fixed;left:50%;bottom:35px;transform:translateX(-50%) translateY(20px);z-index:2147483648;background:#143e7e;color:#fff;padding:11px 20px;border-radius:12px;font-size:13.5px;font-weight:800;opacity:0;pointer-events:none;transition:.25s;box-shadow:0 10px 30px rgba(0,0,0,.25);}' +
    '#ws-cd-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}' +
    '@media(max-width:900px){.ws-cd-search{position:static;display:block;width:100%;margin-top:16px;}.ws-cd-tabs{grid-template-columns:repeat(3,1fr);}.ws-cd-grid{grid-template-columns:1fr;}.ws-cd-title{font-size:22px;}}' +
    '@media(max-width:550px){.ws-cd-modal{width:100%;height:94vh;border-radius:16px;}#ws-contacts-overlay{padding:8px;}.ws-cd-tabs{padding:10px;gap:6px;grid-template-columns:repeat(2,1fr);}.ws-cd-tab{font-size:12.5px;height:44px;}.ws-cd-content{padding:12px;}.ws-cd-card{flex-direction:column;align-items:stretch;}.ws-cd-actions{flex-direction:row;}.ws-cd-actions>*{flex:1;}}'
  );

  function formatPhoneDisplay(p) {
    p = String(p).replace(/\s/g, '');
    if (p.length === 11) { return p.slice(0, 4) + ' ' + p.slice(4, 7) + ' ' + p.slice(7); }
    return p;
  }

  function waPhoneDigits(p) {
    var d = String(p || '').replace(/\D/g, '');
    if (d.charAt(0) === '0') { d = d.substring(1); }
    if (d.substring(0, 3) !== '964') { d = '964' + d; }
    return d;
  }

  function waLink(p, msg) {
    var url = 'https://wa.me/' + waPhoneDigits(p);
    if (msg) { url += '?text=' + encodeURIComponent(msg); }
    return url;
  }

  // ── مولّد الكليشة الاحترافية بحسب نوع البطاقة ─────────────────
  function buildContactCliche(item) {
    if (item.kind === 'employee') {
      return 'الأستاذ الفاضل، تحية طيبة 🌹\n' +
        'طلبكم لدى متابع منطقة: ' + item.region + '\n' +
        'الموظف المختص: ' + item.name + '\n' +
        'رقم التواصل المباشر: ' + item.phone + '\n' +
        'يرجى التواصل لإتمام إجراءات التوصيل، ولكم فائق الشكر.';
    }
    if (item.kind === 'crm') {
      return 'الأستاذ الفاضل، تحية طيبة 🌹\n' +
        'موظف الـ CRM المسؤول عن منطقتكم: ' + item.name + '\n' +
        'رقم التواصل المباشر: ' + item.phone + '\n' +
        'مناطق التغطية: ' + item.areas.join('، ') + '\n' +
        'يرجى التواصل لمتابعة طلبكم، ولكم فائق الشكر.';
    }
    if (item.kind === 'report') {
      return 'الأستاذ الفاضل، تحية طيبة 🌹\n' +
        'لتقديم تبليغ بخصوص طلبكم في محافظة ' + item.name + '\n' +
        'يرجى التواصل مع قسم التبليغات على الرقم: ' + item.phone + '\n' +
        'وشكراً لتعاونكم.';
    }
    if (item.kind === 'inquiry') {
      return 'الأستاذ الفاضل، تحية طيبة 🌹\n' +
        'للاستفسار بخصوص طلبكم في محافظة ' + item.name + '\n' +
        'يرجى التواصل على الرقم: ' + item.phone + '\n' +
        'وشكراً لتعاونكم.';
    }
    return 'الأستاذ الفاضل، تحية طيبة 🌹\n' +
      'للاستفسار العام يرجى التواصل مع الكول سنتر على الرقم: ' + item.phone + '\n' +
      'وشكراً لتعاونكم.';
  }

  // اسم الموظف | الرقم | مناطق المسؤولية[]
  var CONTACTS_CRM = [
    ['احمد جديد', '07779397611', ['زعفرانية', 'جسر ديالى', 'كرغولية', 'ابو غريب', 'محمودية', 'نهروان', 'لطيفية', 'بسماية', 'مدائن', 'رضوانية']],
    ['محمد شاكر', '07764032129', ['باب المعظم', 'الكفاح', 'الوزيرية الصناعية', 'السنك', 'المتنبي', 'حافظ القاضي', 'المثنى', 'باب الشرقي', 'ساحة الطيران', 'الشورجة']],
    ['نور بسام', '07724036165', ['كاظمية', 'طارمية', 'سبع البور', 'عبايجي', 'مشاهدة', 'جكوك', 'شعلة', 'حي الجوادين', 'سلاميات', 'الخطيب']],
    ['احمد محمد', '07730240405', ['ناصرية', 'الحرية', 'الدولعي', 'الوشاش', 'الطوبجي', 'الاسكان', 'المنصور', 'الحارثية', 'كرادة مريم', 'الجعيفر', 'صالحية', 'العلاوي', 'شيخ معروف', 'المنطقة الخضراء']],
    ['ايناس فرج', '07779397548', ['عامرية', 'غزالية', 'حي الجامعة', 'حي حطين', 'اليرموك', 'الداخلية', 'القادسية', 'حي الخضراء', 'حي العامل', 'حي العدل', 'العطيفية', 'شالجية', 'علي الصالح']],
    ['حسن ماجد', '07735572754', ['السيدية', 'حي الاعلام التراث', 'الري', 'معالف', 'الشرطة الرابعة', 'الشرطة الخامسة', 'سويب', 'البياع', 'حي الجهاد']],
    ['حوراء علاء', '07779397549', ['الدورة', 'كرادة داخل', 'كرادة خارج', 'العرصات', 'السعدون', 'شارع الصناعة', 'الجادرية']],
    ['رفل ربيع', '07779397551', ['الشعب', 'البنوك', 'حي اور', 'سبع قصور', 'حي البساتين', 'الجزيرة', 'كميرة', 'ام الكبر والغزلان', 'ثعالبة']],
    ['مريم عامر', '07779397550', ['بلديات', 'مدينة الصدر', 'الحبيبية', 'حسينية الرشادية', 'جميلة', 'طالبية', 'سريدات', 'بوب الشام']],
    ['مروة علاء', '07759150128', ['شارع فلسطين', 'شارع الربيعي', 'الاعظمية', 'زيونة', 'القاهرة', 'صليخ', 'كريعات', 'شارع المغرب', 'سبع ابكار']],
    ['ميس', '07744441074', ['بغداد الجديدة', 'النعيرية', 'الامين', 'المشتل', 'العبيدي', 'الغدير', 'ساحة ميسلون', 'فضيلية', 'كمالية', 'معامل الحسينية']],
    ['عبير اسماعيل', '07735572761', ['الموصل', 'الديوانية', 'كركوك']],
    ['سعاد خالد', '07744442929', ['محافظة الحلة']],
    ['نهاد خالد', '07744442323', ['محافظة النجف']],
    ['علي حسين', '07744441064', ['كربلاء', 'دهوك', 'صلاح الدين', 'السماوة', 'العمارة']],
    ['كرار علي وادي', '07779397531', ['البصرة', 'الانبار', 'الكوت']],
    ['فاطمة حسين', '07744441065', ['اربيل', 'ديالى', 'السليمانية']]
  ];

  function buildContactsPanel() {
    if (document.getElementById('ws-contacts-overlay')) { return; }

    // تحويل بياناتنا الأصلية إلى شكل موحّد {name, phone, note, region, employeeNumber, kind}
    var DATA = {
      callcenter: CONTACTS_CALLCENTER.map(function (e) { return { name: e[1], phone: e[0], note: 'للاستفسارات العامة', kind: 'callcenter' }; }),
      provinces: [].concat(
        CONTACTS_INQUIRY.map(function (e) { return { name: e[0], phone: e[1], note: 'رقم الاستفسار العام', kind: 'inquiry' }; }),
        [].concat.apply([], CONTACTS_REPORTS.map(function (e) {
          return e[1].map(function (phone, i) { return { name: e[0] + (i ? ' ' + (i + 1) : ''), phone: phone, note: 'تبليغات محافظة ' + e[0], kind: 'report' }; });
        }))
      ),
      karkh: CONTACTS_KARKH.map(function (e) { return { name: e[2], phone: e[3], region: e[1], employeeNumber: e[0], kind: 'employee' }; }),
      rusafa: CONTACTS_RUSAFA.map(function (e, i) { return { name: e[1], phone: e[2], region: e[0], employeeNumber: 'رصافة ' + (i + 1), kind: 'employee' }; }),
      crm: CONTACTS_CRM.map(function (e) { return { name: e[0], phone: e[1], areas: e[2], kind: 'crm' }; })
    };

    var overlay = document.createElement('div'); overlay.id = 'ws-contacts-overlay';
    overlay.innerHTML =
      '<div class="ws-cd-modal">' +
        '<div class="ws-cd-header">' +
          '<button type="button" class="ws-cd-close" id="ws-cd-close">×</button>' +
          '<div class="ws-cd-title"><span>☎️</span><span>دليل أرقام الوسيط</span></div>' +
          '<div class="ws-cd-subtitle">الكول سنتر، المحافظات، موظفي متابعة بغداد (كرخ / رصافة)، وموظفي الـ CRM</div>' +
          '<input id="ws-cd-search" class="ws-cd-search" type="text" placeholder="ابحث عن اسم أو منطقة أو رقم...">' +
        '</div>' +
        '<div class="ws-cd-search-mode" id="ws-cd-search-mode">🔍 وضع البحث الشامل — النتائج معروضة من كل القوائم دفعة واحدة</div>' +
        '<div class="ws-cd-tabs">' +
          '<button type="button" class="ws-cd-tab active" data-section="callcenter">🎧 كول سنتر</button>' +
          '<button type="button" class="ws-cd-tab" data-section="provinces">📍 محافظات</button>' +
          '<button type="button" class="ws-cd-tab" data-section="karkh">🏢 بغداد - الكرخ</button>' +
          '<button type="button" class="ws-cd-tab" data-section="rusafa">🏢 بغداد - الرصافة</button>' +
          '<button type="button" class="ws-cd-tab" data-section="crm">📊 موظفو الـ CRM</button>' +
        '</div>' +
        '<div class="ws-cd-content" id="ws-cd-content"></div>' +
        '<div class="ws-cd-footer">دليل أرقام داخلي — waseet-tools</div>' +
      '</div>';
    document.body.appendChild(overlay);

    var toast = document.getElementById('ws-cd-toast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'ws-cd-toast'; toast.textContent = 'تم نسخ الرقم ✓'; document.body.appendChild(toast); }
    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(function () { toast.classList.remove('show'); }, 1400);
    }

    var content = document.getElementById('ws-cd-content');
    var searchInp = document.getElementById('ws-cd-search');
    var titles = { callcenter: '🎧 أرقام الكول سنتر', provinces: '📍 أرقام المحافظات', karkh: '🏢 بغداد - الكرخ', rusafa: '🏢 بغداد - الرصافة', crm: '📊 موظفو الـ CRM ومناطق مسؤوليتهم' };
    var currentSection = 'callcenter';

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    // يظلّل أول ظهور (وكل ما يليه) لنص البحث q داخل text، مع الحفاظ على الأمان من HTML injection
    function highlightMatch(text, q) {
      var str = String(text);
      if (!q) { return escapeHtml(str); }
      var lower = str.toLowerCase();
      var idx = lower.indexOf(q);
      if (idx === -1) { return escapeHtml(str); }
      var out = '', last = 0;
      while (idx !== -1) {
        out += escapeHtml(str.slice(last, idx));
        out += '<mark class="ws-cd-hl">' + escapeHtml(str.slice(idx, idx + q.length)) + '</mark>';
        last = idx + q.length;
        idx = lower.indexOf(q, last);
      }
      out += escapeHtml(str.slice(last));
      return out;
    }

    function makeCard(item, q) {
      var isEmployee = item.kind === 'employee';
      var isCrm = item.kind === 'crm';
      var card = document.createElement('div'); card.className = 'ws-cd-card';
      card.setAttribute('data-search', (item.name + ' ' + item.phone + ' ' + (item.note || '') + ' ' + (item.region || '') + ' ' + (item.areas ? item.areas.join(' ') : '')).toLowerCase());

      var info = document.createElement('div'); info.className = 'ws-cd-info';
      var nameEl = document.createElement('div'); nameEl.className = 'ws-cd-name'; nameEl.innerHTML = highlightMatch(item.name, q); info.appendChild(nameEl);
      var phoneEl = document.createElement('div'); phoneEl.className = 'ws-cd-phone';
      var phoneDisplay = formatPhoneDisplay(item.phone);
      var phoneMatches = !!q && item.phone.toLowerCase().replace(/\s/g, '').indexOf(q.replace(/\s/g, '')) !== -1;
      phoneEl.innerHTML = phoneMatches ? '<mark class="ws-cd-hl">' + escapeHtml(phoneDisplay) + '</mark>' : escapeHtml(phoneDisplay);
      info.appendChild(phoneEl);

      if (isEmployee) {
        var noteEl = document.createElement('div'); noteEl.className = 'ws-cd-note'; noteEl.innerHTML = 'المنطقة المسؤول عنها: <strong>' + highlightMatch(item.region, q) + '</strong>'; info.appendChild(noteEl);
        var badge = document.createElement('span'); badge.className = 'ws-cd-region'; badge.textContent = item.employeeNumber; info.appendChild(badge);
      } else if (isCrm) {
        var noteEl3 = document.createElement('div'); noteEl3.className = 'ws-cd-note'; noteEl3.textContent = 'مسؤول(ة) CRM — مناطق التغطية:'; info.appendChild(noteEl3);
        var areasWrap = document.createElement('div'); areasWrap.className = 'ws-cd-areas';
        item.areas.forEach(function (a) { var b = document.createElement('span'); b.className = 'ws-cd-area-badge'; b.innerHTML = highlightMatch(a, q); areasWrap.appendChild(b); });
        info.appendChild(areasWrap);
      } else if (item.note) {
        var noteEl2 = document.createElement('div'); noteEl2.className = 'ws-cd-note'; noteEl2.innerHTML = highlightMatch(item.note, q); info.appendChild(noteEl2);
      }
      card.appendChild(info);

      var actions = document.createElement('div'); actions.className = 'ws-cd-actions';

      var cliche = buildContactCliche(item);

      var waBtn = document.createElement('a');
      waBtn.className = 'ws-cd-wa'; waBtn.textContent = '🟢 واتساب';
      waBtn.href = waLink(item.phone);
      waBtn.target = '_blank'; waBtn.rel = 'noopener noreferrer';
      waBtn.title = 'فتح محادثة واتساب مباشرة بدون نص جاهز';
      actions.appendChild(waBtn);

      var copyBtn = document.createElement('button'); copyBtn.type = 'button'; copyBtn.className = 'ws-cd-copy'; copyBtn.textContent = '📋 نسخ الكليشة';
      copyBtn.title = 'نسخ كليشة تواصل احترافية جاهزة (تتضمن الرقم)';
      copyBtn.addEventListener('click', function () {
        copyToClipboard(cliche, null);
        copyBtn.classList.add('done'); copyBtn.textContent = 'تم النسخ ✓';
        showToast('✅ تم نسخ الكليشة');
        setTimeout(function () { copyBtn.classList.remove('done'); copyBtn.textContent = '📋 نسخ الكليشة'; }, 1600);
      });
      actions.appendChild(copyBtn);

      var numBtn = document.createElement('button'); numBtn.type = 'button'; numBtn.className = 'ws-cd-copy'; numBtn.textContent = '🔢 نسخ الرقم';
      numBtn.title = 'نسخ الرقم فقط بدون نص';
      numBtn.addEventListener('click', function () {
        copyToClipboard(item.phone, null);
        numBtn.classList.add('done'); numBtn.textContent = 'تم النسخ ✓';
        showToast('✅ تم نسخ الرقم');
        setTimeout(function () { numBtn.classList.remove('done'); numBtn.textContent = '🔢 نسخ الرقم'; }, 1600);
      });
      actions.appendChild(numBtn);

      card.appendChild(actions);
      return card;
    }

    function render(section, search) {
      currentSection = section;
      var q = (search || '').trim().toLowerCase();
      var searching = !!q;
      var items;
      if (searching) {
        // عند وجود نص بحث: ابحث عبر كل الأقسام (كل القوائم) دفعة واحدة
        items = [];
        Object.keys(DATA).forEach(function (sec) {
          DATA[sec].forEach(function (it) {
            var hay = (it.name + ' ' + it.phone + ' ' + (it.note || '') + ' ' + (it.region || '') + ' ' + (it.areas ? it.areas.join(' ') : '')).toLowerCase();
            if (hay.indexOf(q) !== -1) {
              var itemWithSection = {};
              for (var k in it) { if (it.hasOwnProperty(k)) { itemWithSection[k] = it[k]; } }
              itemWithSection._sectionKey = sec;
              items.push(itemWithSection);
            }
          });
        });
      } else {
        items = DATA[section];
      }
      content.innerHTML = '';
      var st = document.createElement('div'); st.className = 'ws-cd-section-title';
      st.textContent = searching ? ('🔍 نتائج البحث في كل القوائم: "' + (search || '').trim() + '" (' + items.length + ')') : titles[section];
      content.appendChild(st);

      var searchModeBar = document.getElementById('ws-cd-search-mode');
      var tabsBar = overlay.querySelector('.ws-cd-tabs');
      if (searchModeBar) { searchModeBar.classList.toggle('show', searching); }
      if (tabsBar) { tabsBar.classList.toggle('searching', searching); }

      if (!items.length) {
        var empty = document.createElement('div'); empty.className = 'ws-cd-empty'; empty.textContent = 'لا توجد نتائج مطابقة للبحث'; content.appendChild(empty);
        return;
      }
      var grid = document.createElement('div'); grid.className = 'ws-cd-grid';
      items.forEach(function (it) {
        var card = makeCard(it, searching ? q : '');
        if (searching && it._sectionKey && titles[it._sectionKey]) {
          var srcTag = document.createElement('div');
          srcTag.className = 'ws-cd-source-tag';
          srcTag.textContent = titles[it._sectionKey];
          card.insertBefore(srcTag, card.firstChild);
        }
        grid.appendChild(card);
      });
      content.appendChild(grid);
    }

    overlay.querySelectorAll('.ws-cd-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        overlay.querySelectorAll('.ws-cd-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        searchInp.value = '';
        render(tab.getAttribute('data-section'), '');
      });
    });
    searchInp.addEventListener('input', function () { render(currentSection, searchInp.value); });

    function closeModal() { overlay.remove(); document.body.style.overflow = ''; }
    document.getElementById('ws-cd-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { closeModal(); } });
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') { if (document.getElementById('ws-contacts-overlay')) { closeModal(); } document.removeEventListener('keydown', escHandler); }
    });

    document.body.style.overflow = 'hidden';
    render('callcenter', '');
    setTimeout(function () { try { searchInp.focus(); } catch (e) {} }, 60);
  }

  function addContactsBtn() {
    if (document.getElementById('ws-contacts-btn')) { return; }
    var btn = document.createElement('button'); btn.id = 'ws-contacts-btn'; btn.type = 'button'; btn.innerHTML = '☎';
    btn.title = 'دليل أرقام المحافظات والكول سنتر وبغداد (كرخ / رصافة) وموظفي CRM';
    btn.addEventListener('click', buildContactsPanel);
    document.body.appendChild(btn);
  }
  onReady(function () { setTimeout(addContactsBtn, 800); });


  var PAGE = location.href;

  // ══════════════════════════════════════════════════════════════
  //  ① call_center
  // ══════════════════════════════════════════════════════════════
  if(PAGE.indexOf('/cs/call_center')!==-1){
    var RE_ORDER=/^\d{6,}$/,RE_PHONE=/^(0|964)/;
    function directText(el){var s='';el.childNodes.forEach(function(n){if(n.nodeType===3){s+=n.textContent;}});return s.trim();}
    function makeBtn(label,tip,color,fn,key){var b=document.createElement('button');b.textContent=label;b.title=tip;b.type='button';if(key){b.setAttribute('data-ws-btn',key);}b.style.cssText='display:inline-block;margin:2px 2px 0;background:'+color+';color:#fff;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:13px;line-height:1.5;vertical-align:middle;';b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();fn(b);});return b;}
    // ✅ (4.3.0): الزر "ذكي" — يتصرف حسب الحالة الحالية المسجّلة
    // بعمود حالة الطلب، لكن **معطّل افتراضياً** لكل موظف حتى يفعّله
    // بنفسه من ⚙️ الإعدادات الرئيسية (قسم 🕒 الزر الذكي):
    //  • غير مفعّل من الإعدادات ← الزر دايماً "🕒" ويسوي فقط تأجيل
    //    الطلب (مؤجل + ملاحظة "غدا") — نفس السلوك الأصلي البسيط.
    //  • مفعّل، وما فيه حالة مسجّلة بعد (فارغة) ← نفس تأجيل الطلب.
    //  • مفعّل، وفيه حالة مسجّلة معروفة (مؤجل/الغاء/لم يطلب/...الخ)
    //    ← نص/لون الزر يتغيّر ليطابقها، وبضغطة وحدة يؤكّد نفس القرار
    //    المطابق (معالجة ← اتخذ القرار ← اختيار القيمة ← ملاحظة ← تغيير).
    //  • مفعّل، وفيه حالة "رفض الطلب" أو "العنوان غير دقيق" أو "تغيير
    //    سعر" ← الزر يعرض التسمية بس ويتعطّل تماماً (مستثناة عمداً).
    //  • مفعّل، وفيه حالة مسجّلة غير معروفة بالخريطة ← نفس تعطيل عرض
    //    التسمية (تفادي تنفيذ قرار خاطئ بالتخمين).
    //
    // ⚠️ ملاحظة: نص الملاحظة لكل الحالات ما عدا "مؤجل" (وملاحظتها
    // "غدا") يُترك فارغاً تماماً افتراضياً.
    var WS_STATUS_DECISION_OPTIONS = [
      { value: '0',  label: 'تمت المعالجة (توصيل)' },
      { value: '25', label: 'لا يرد' },
      { value: '26', label: 'لا يرد بعد الاتفاق' },
      { value: '27', label: 'مغلق' },
      { value: '28', label: 'مغلق بعد الاتفاق' },
      { value: '29', label: 'مؤجل' },
      { value: '30', label: 'مؤجل لحين اعادة الطلب لاحقا' },
      { value: '31', label: 'الغاء الطلب' },
      { value: '32', label: 'رفض الطلب' },
      { value: '33', label: 'مفصول عن الخدمة' },
      { value: '34', label: 'طلب مكرر' },
      { value: '35', label: 'مستلم مسبقا' },
      { value: '36', label: 'الرقم غير معرف' },
      { value: '37', label: 'الرقم غير داخل في الخدمة' },
      { value: '38', label: 'العنوان غير دقيق' },
      { value: '39', label: 'لم يطلب' },
      { value: '40', label: 'حظر المندوب' },
      { value: '41', label: 'لا يمكن الاتصال بالرقم' },
      { value: '42', label: 'تغيير المندوب' }
    ];
    // نص الملاحظة المخصّص لكل قيمة (value)؛ غير الموجود هنا تبقى ملاحظته فارغة تماماً افتراضياً
    var WS_STATUS_NOTE_OVERRIDES = { '29': 'غدا' };
    // ✅ (4.3.0): قرارات مستثناة تماماً من عمل الزر — الزر يعرض تسميتها
    // فقط بدون أي فعل عند الضغط، حتى لو الزر الذكي مفعّل من الإعدادات
    var WS_STATUS_EXCLUDED_VALUES = ['32', '38']; // رفض الطلب، العنوان غير دقيق
    var WS_STATUS_EXCLUDED_TEXT_PATTERNS = [/تغيير\s*سعر/]; // "تغيير سعر" (احتياط: غير موجودة حالياً بقائمة change_status)
    function isExcludedStatus(statusText, cfg) {
      if (cfg && WS_STATUS_EXCLUDED_VALUES.indexOf(cfg.value) !== -1) { return true; }
      return WS_STATUS_EXCLUDED_TEXT_PATTERNS.some(function (re) { return re.test(statusText || ''); });
    }
    // لون الزر حسب فئة الحالة (تقريبي، قابل للتعديل)
    var WS_STATUS_COLOR_MAP = {
      '0': '#27ae60', '29': '#16a085', '30': '#16a085',
      '31': '#c0392b', '32': '#c0392b', '40': '#c0392b',
      '25': '#e67e22', '26': '#e67e22', '41': '#e67e22',
      '27': '#7f8c8d', '28': '#7f8c8d', '33': '#7f8c8d', '39': '#7f8c8d',
      '34': '#8e44ad', '35': '#8e44ad', '42': '#8e44ad',
      '36': '#34495e', '37': '#34495e', '38': '#34495e'
    };
    // أطول تسمية أولاً حتى ما ينخدع بمطابقة جزئية خاطئة (مثال: "مؤجل" داخل "مؤجل لحين اعادة الطلب لاحقا")
    var WS_STATUS_OPTIONS_SORTED = WS_STATUS_DECISION_OPTIONS.slice().sort(function (a, b) { return b.label.length - a.label.length; });
    function matchStatusConfig(statusText) {
      var t = (statusText || '').trim();
      if (!t) { return null; }
      for (var i = 0; i < WS_STATUS_OPTIONS_SORTED.length; i++) {
        if (t.indexOf(WS_STATUS_OPTIONS_SORTED[i].label) !== -1) { return WS_STATUS_OPTIONS_SORTED[i]; }
      }
      return null;
    }
    function shortStatusLabel(label) { return label.length > 11 ? (label.slice(0, 10) + '…') : label; }

    function executeOrderDecision(displayOrderNum, rowEl, triggerBtn, decisionValue, noteText, decisionLabel) {
      var origLabel = triggerBtn ? triggerBtn.textContent : '';
      var origBg = triggerBtn ? triggerBtn.style.background : '';
      function setBusy(msg) { if (triggerBtn) { triggerBtn.disabled = true; triggerBtn.textContent = msg; } }
      function finish(msg, ok) {
        if (triggerBtn) {
          triggerBtn.disabled = false;
          triggerBtn.textContent = msg;
          setTimeout(function () { triggerBtn.textContent = origLabel; triggerBtn.style.background = origBg; delete triggerBtn.dataset.wsMode; }, 2400);
        }
        wsGlobalToast((ok ? '✅ ' : '⚠️ ') + msg);
      }

      setBusy('⏳ ...');

      // ✅ إصلاح: زر "معالجة" يحمل مُعرّف داخلي (id) مختلف عن رقم الطلب
      // الظاهر بالجدول (مثال: id="43330986" بينما رقم الطلب المعروض
      // "156744570")، لذلك ندوّر عليه داخل نفس صف الطلب مباشرة بدل
      // الاعتماد على تطابق الأرقام، ونستخرج المعرّف الداخلي الصحيح منه
      var processBtn = null;
      if (rowEl) {
        processBtn = rowEl.querySelector('button[onclick^="openTicket("]') || rowEl.querySelector('button.btn-info');
      }
      if (!processBtn) {
        finish('تعذر إيجاد زر "معالجة" بصف هذا الطلب', false);
        return;
      }

      var internalId = processBtn.id;
      if (!internalId) {
        var m = (processBtn.getAttribute('onclick') || '').match(/openTicket\((\d+)\)/);
        internalId = m ? m[1] : null;
      }
      if (!internalId) {
        finish('تعذر تحديد المعرّف الداخلي للطلب', false);
        return;
      }

      processBtn.click();

      wsWaitFor(function () { return document.querySelector('#decide[data-id="' + internalId + '"]'); }, function (decideBtn) {
        decideBtn.click();

        wsWaitFor(function () { return document.getElementById('change_status'); }, function (select) {
          select.value = decisionValue;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          select.dispatchEvent(new Event('input', { bubbles: true }));

          wsWaitFor(function () { return document.getElementById('notes'); }, function (notesInput) {
            notesInput.value = noteText;
            notesInput.dispatchEvent(new Event('input', { bubbles: true }));
            notesInput.dispatchEvent(new Event('change', { bubbles: true }));

            wsWaitFor(function () {
              var btns = document.querySelectorAll('.swal2-confirm.swal2-styled');
              for (var i = 0; i < btns.length; i++) { if (btns[i].offsetParent !== null) { return btns[i]; } }
              return null;
            }, function (confirmBtn) {
              confirmBtn.click();
              logOrderDecision(displayOrderNum, decisionLabel);
              finish('تم: ' + decisionLabel + ' ✓', true);
            }, { onTimeout: function () { finish('تعذر إيجاد زر "تغيير" للتأكيد', false); } });
          }, { onTimeout: function () { finish('تعذر إيجاد خانة الملاحظات', false); } });
        }, { onTimeout: function () { finish('تعذر إيجاد قائمة الحالة', false); } });
      }, { onTimeout: function () { finish('تعذر إيجاد زر "اتخذ القرار"', false); } });
    }

    // عند الضغط: يقرأ حالة الطلب الحالية بلحظة الضغط ويحدد القرار المناسب
    // (فقط إذا "الزر الذكي" مفعّل من الإعدادات؛ غير هيك يبقى تأجيل بس دايماً)
    function onDeferredBtnClick(displayOrderNum, rowEl, triggerBtn) {
      if (!wsSettings.smartDecisionEnabled) {
        executeOrderDecision(displayOrderNum, rowEl, triggerBtn, '29', 'غدا', 'مؤجل');
        return;
      }

      var statusEl = rowEl ? rowEl.querySelector('[id^="status-"]') : null;
      var statusText = statusEl ? statusEl.textContent.trim() : '';
      if (!statusText) {
        executeOrderDecision(displayOrderNum, rowEl, triggerBtn, '29', 'غدا', 'مؤجل');
        return;
      }
      var cfg = matchStatusConfig(statusText);
      if (isExcludedStatus(statusText, cfg)) {
        wsGlobalToast('⚠️ هذا القرار مستثنى من عمل الزر: ' + (cfg ? cfg.label : statusText));
        return;
      }
      if (!cfg) {
        wsGlobalToast('⚠️ حالة غير معروفة للأتمتة: ' + statusText);
        return;
      }
      var note = (WS_STATUS_NOTE_OVERRIDES[cfg.value] !== undefined) ? WS_STATUS_NOTE_OVERRIDES[cfg.value] : '';
      executeOrderDecision(displayOrderNum, rowEl, triggerBtn, cfg.value, note, cfg.label);
    }

    // ✅ يحدّث شكل/تسمية كل أزرار "المؤجل" الظاهرة حالياً بالجدول لتعكس
    // الحالة الحالية المسجّلة بكل صف (تُستدعى مع كل تحديث للجدول)
    function refreshDeferredButtons() {
      document.querySelectorAll('button[data-ws-btn="deferred"]').forEach(function (btn) {
        var row = btn.closest('tr');
        if (!row) { return; }

        function setDefaultMode() {
          if (btn.dataset.wsMode !== 'default') {
            btn.dataset.wsMode = 'default';
            btn.textContent = '🕒';
            btn.title = 'تأجيل الطلب (يختار "مؤجل" ويكتب "غدا" بالملاحظات تلقائياً)';
            btn.style.background = '#16a085';
            btn.disabled = false;
          }
        }

        // الزر الذكي غير مفعّل من الإعدادات ← يبقى دايماً بوضعه الافتراضي البسيط
        if (!wsSettings.smartDecisionEnabled) { setDefaultMode(); return; }

        var statusEl = row.querySelector('[id^="status-"]');
        var statusText = statusEl ? statusEl.textContent.trim() : '';
        if (!statusText) { setDefaultMode(); return; }

        var cfg = matchStatusConfig(statusText);
        if (isExcludedStatus(statusText, cfg)) {
          var exModeKey = 'excluded:' + (cfg ? cfg.value : 'text');
          if (btn.dataset.wsMode !== exModeKey) {
            btn.dataset.wsMode = exModeKey;
            btn.textContent = shortStatusLabel(cfg ? cfg.label : statusText);
            btn.title = 'هذا القرار مستثنى من عمل الزر: ' + (cfg ? cfg.label : statusText);
            btn.style.background = '#95a5a6';
            btn.disabled = true;
          }
          return;
        }
        if (cfg) {
          var modeKey = 'match:' + cfg.value;
          if (btn.dataset.wsMode !== modeKey) {
            btn.dataset.wsMode = modeKey;
            btn.textContent = shortStatusLabel(cfg.label);
            btn.title = 'تأكيد القرار: ' + cfg.label + ' (ضغطة واحدة تنفّذ القرار مباشرة)';
            btn.style.background = WS_STATUS_COLOR_MAP[cfg.value] || '#16a085';
            btn.disabled = false;
          }
        } else if (btn.dataset.wsMode !== 'unknown') {
          btn.dataset.wsMode = 'unknown';
          btn.textContent = shortStatusLabel(statusText);
          btn.title = 'حالة غير معروفة للأتمتة: ' + statusText;
          btn.style.background = '#888';
          btn.disabled = true;
        }
      });
    }

    function getMerchantCell(row){var cells=row.querySelectorAll('td');for(var i=0;i<cells.length;i++){var td=cells[i];if(td.style.display==='none'){continue;}if(!td.querySelector('a.phone-number')){continue;}if(td.querySelector('div')){continue;}return td;}return null;}
    function getCustomerCell(row){var cells=row.querySelectorAll('td');for(var i=0;i<cells.length;i++){var td=cells[i];if(td.style.display==='none'){continue;}if(!td.querySelector('a.phone-number')){continue;}if(!td.querySelector('div')){continue;}return td;}return null;}
    function phoneFromLink(link){if(!link){return '';}return(link.href||'').replace('https://wa.me/','').replace(/\+/g,'').trim();}
    function extractPhone(cell){return phoneFromLink(cell.querySelector('a.phone-number'));}
    function getMerchantName(row){var el=row.querySelector('[id^="merchant_name-"]');return el?el.textContent.trim():'';}
    function getPrice(row,orderNum){var orderDigits=(orderNum||'').replace(/\D/g,''),cells=row.querySelectorAll('td');for(var i=0;i<cells.length;i++){var td=cells[i];if(td.style.display==='none'){continue;}if(td.classList.contains('dtr-control')){continue;}if(td.querySelector('a')){continue;}var raw=td.textContent.trim().replace(/,/g,'');if(!/^\d+$/.test(raw)){continue;}if(raw===orderDigits){continue;}var n=parseInt(raw,10);if(n>=500&&n<=5000000){return td.textContent.trim();}}return '';}
    function addWhatsappBtns(row,orderNum){
      if(!row.dataset.wsMerchant){var mCell=getMerchantCell(row);if(mCell&&!mCell.querySelector('[data-ws-merchant]')){var mPhone=extractPhone(mCell);if(mPhone&&mPhone.length>=7){row.dataset.wsMerchant='1';var mBtn=document.createElement('button');mBtn.type='button';mBtn.textContent='💬';mBtn.title='واتساب التاجر';mBtn.setAttribute('data-ws-merchant','1');mBtn.style.cssText='display:block;margin:4px auto 0;font-size:20px;background:none;border:none;cursor:pointer;line-height:1.3;padding:0;';var mWrap=makeUsedBadgeWrapper(mBtn);mWrap.el.setAttribute('data-ws-btn','ws-merchant');mWrap.el.style.display='block';mWrap.el.style.textAlign='center';mWrap.el.style.margin='4px auto 0';mBtn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var notesEl=row.querySelector('[id^="deliver_notes-"]'),notes=notesEl?notesEl.textContent.trim():'';notes=notes.replace(/تبليغ المندوب:[^)]*\)?/gi,'').replace(/واتس لايرد\s*/gi,'').replace(/لا توجد ملاحظة من قبل المندوب\s*/gi,'').replace(/\(\s*\)/g,'').replace(/^\(|\)$/g,'').trim();var mMsg='السلام عليكم\nمعك قسم التبليغات\nلديك طلب فيه تغيير سعر\n\n';if(notes){mMsg+='( '+notes+' )\n';}mMsg+='( '+orderNum+' )\n\nشاكرين تعاونكم';openTab('https://wa.me/'+mPhone+'?text='+encodeURIComponent(mMsg),'ws_wa_m_'+orderNum);mWrap.markUsed();});mCell.appendChild(mWrap.el);}}}
      if(!row.dataset.wsCustomer){var cCell=getCustomerCell(row);if(cCell&&!cCell.querySelector('[data-ws-customer]')){var cLinks=[];cCell.querySelectorAll('a.phone-number').forEach(function(l){cLinks.push(l);});var validLinks=cLinks.filter(function(l){var p=phoneFromLink(l);return p&&p.length>=7;});if(validLinks.length){row.dataset.wsCustomer='1';function buildCustomerMessage(){var pageName=getMerchantName(row),price=getPrice(row,orderNum),cleanOrder=orderNum.replace(/\D/g,'');return renderTemplate(getCustomerMessageTemplate(),{merchant:pageName||'...',price:price||'...',order:cleanOrder});}function buildPhoneButtons(phone,afterLink,searchType,isFirst){var localPhone=phone;if(localPhone.indexOf('964')===0){localPhone='0'+localPhone.slice(3);}var labelSuffix=isFirst?'':' (الرقم الثاني)',groupWrap=document.createElement('span');groupWrap.style.cssText='display:inline-block;vertical-align:middle;';var cBtn=document.createElement('button');cBtn.type='button';cBtn.textContent='📦';cBtn.title='واتساب الزبون'+labelSuffix;if(isFirst){cBtn.setAttribute('data-ws-customer','1');}cBtn.style.cssText='display:inline-block;font-size:20px;background:none;border:none;cursor:pointer;line-height:1.3;padding:0;';var cWrap=makeUsedBadgeWrapper(cBtn);cWrap.el.setAttribute('data-ws-btn','ws-customer');cWrap.el.style.marginTop='4px';cWrap.el.style.marginLeft='4px';cBtn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();openTab('https://wa.me/'+phone+'?text='+encodeURIComponent(buildCustomerMessage()),'ws_wa_c_'+orderNum);cWrap.markUsed();});groupWrap.appendChild(cWrap.el);var smsBtn=document.createElement('button');smsBtn.type='button';smsBtn.textContent='📱';smsBtn.title='رسالة خط للزبون'+labelSuffix;smsBtn.setAttribute('data-ws-btn','sms-customer');smsBtn.style.cssText='display:inline-block;font-size:20px;background:none;border:none;cursor:pointer;line-height:1.3;padding:0;';var smsWrap=makeUsedBadgeWrapper(smsBtn);smsWrap.el.setAttribute('data-ws-btn','sms-customer');smsWrap.el.style.marginTop='4px';smsWrap.el.style.marginLeft='4px';smsBtn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();openSmsLink(localPhone,buildCustomerMessage());smsWrap.markUsed();});groupWrap.appendChild(smsWrap.el);var phoneBtn=document.createElement('button');phoneBtn.type='button';phoneBtn.textContent='🔎';phoneBtn.title='بحث عن طلبات الزبون'+labelSuffix;phoneBtn.setAttribute('data-ws-btn','phone-search');phoneBtn.style.cssText='display:inline-block;font-size:12px;background:none;border:none;cursor:pointer;line-height:1;padding:0;opacity:.8;vertical-align:middle;margin-top:4px;margin-left:4px;';phoneBtn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();openTab(BASE_URL+'/cs/view_search?ws_phone='+encodeURIComponent(phone)+'&ws_search_type='+searchType,'ws_phone_search');});groupWrap.appendChild(phoneBtn);afterLink.insertAdjacentElement('afterend',groupWrap);}validLinks.forEach(function(link,idx){buildPhoneButtons(phoneFromLink(link),link,(idx===0)?'2':'3',idx===0);});}}}
    }
    function addIcons(){
      refreshDeferredButtons();
      document.querySelectorAll('tr').forEach(function(tr){var name=extractRepNameFromHeaderRow(tr);if(name){wsLastRepName=name;}});
      document.querySelectorAll('td.dtr-control').forEach(function(cell){var txt=directText(cell);if(cell.dataset.wsAdded){var row0=cell.closest('tr');if(row0&&txt){addWhatsappBtns(row0,txt);}return;}if(!RE_ORDER.test(txt)||RE_PHONE.test(txt)){return;}cell.dataset.wsAdded='1';recordReceivedOrder(txt);var capturedTxt=txt,row=cell.closest('tr');if(row){var repNameNow=findRepNameForRow(row);if(!repNameNow&&wsLastRepName){repNameNow=wsLastRepName;}if(repNameNow){row.setAttribute('data-ws-rep',repNameNow);wsLastRepName=repNameNow;}}var wrap=document.createElement('div');wrap.style.cssText='display:flex;flex-wrap:wrap;justify-content:center;gap:3px;margin-top:4px;';wrap.appendChild(makeBtn('🔍','قصة الطلب: '+capturedTxt,'#2e5bff',function(){openTab(BASE_URL+'/order-story?ws_order='+encodeURIComponent(capturedTxt),'ws_story');},'story'));wrap.appendChild(makeBtn('➕','أجور التوصيل: '+capturedTxt,'#28a745',function(){openTab(BASE_URL+'/cs/delivery-fees-differences?ws_order='+encodeURIComponent(capturedTxt),'ws_fees');},'fees'));wrap.appendChild(makeBtn('🌐','تغيير العنوان: '+capturedTxt,'#e67e22',function(){openTab(BASE_URL+'/cs/editOrder?ws_order='+encodeURIComponent(capturedTxt),'ws_edit');},'edit'));wrap.appendChild(makeBtn('⭐','تقييم المندوب: '+capturedTxt,'#8e44ad',function(){var liveRow=cell.closest('tr'),repName='';if(liveRow){repName=liveRow.getAttribute('data-ws-rep')||'';}if(!repName&&liveRow){repName=findRepNameForRow(liveRow);}if(!repName){repName=wsLastRepName;}openRatingDialog(capturedTxt,repName);},'rep-rating'));wrap.appendChild(makeBtn('🕒','تأجيل الطلب: '+capturedTxt+' (يختار "مؤجل" ويكتب "غدا" بالملاحظات تلقائياً)','#16a085',function(btnEl){onDeferredBtnClick(capturedTxt,row,btnEl);},'deferred'));cell.appendChild(wrap);if(row){addWhatsappBtns(row,capturedTxt);}});
    }
    onReady(function(){setTimeout(function(){observeAndRun(addIcons,400);renderAndSync(addSettingsBtn);addReceivedBadge();checkWeeklyAutoReport();},800);});
  }

  // ── order-story ──
  if(PAGE.indexOf('/order-story')!==-1){var storyParams=new URLSearchParams(location.search),storyNum=storyParams.get('ws_order');if(storyNum){onReady(function(){setTimeout(function(){var btn=document.querySelector('button[onclick="getOrderStory()"]');if(btn){btn.click();}else if(typeof getOrderStory==='function'){getOrderStory();}waitFor('#swal2-input',function(inp){inp.value=storyNum;inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(function(){var ok=document.querySelector('.swal2-confirm');if(ok){ok.click();}},500);});},800);});}}

  // ══════════════════════════════════════════════════════════════
  //  ③ delivery-fees-differences — مع الحفظ التلقائي للمحفظة
  // ══════════════════════════════════════════════════════════════
  if(PAGE.indexOf('/cs/delivery-fees-differences')!==-1 && PAGE.indexOf('/cs/delivery-fees-differences/statistics')===-1){
    var feesParams=new URLSearchParams(location.search),feesNum=feesParams.get('ws_order');
    if(feesNum){onReady(function(){waitFor('input[name="orderQrId"]',function(inp){inp.value=feesNum;inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));inp.focus();});});}

    var FEE_LIST=[5000,4000,3000,2000];

    function repColumn(table){var headers=table.querySelectorAll('thead th,thead td');for(var i=0;i<headers.length;i++){if(headers[i].textContent.indexOf('مندوب')!==-1){return i;}}return -1;}

    function dateColumn(table){
      var headers=table.querySelectorAll('thead th,thead td');
      for(var i=0;i<headers.length;i++){
        var t=headers[i].textContent;
        if(t.indexOf('تاريخ')!==-1||t.indexOf('الإنشاء')!==-1||t.indexOf('date')!==-1){return i;}
      }
      return -1;
    }

    function extractDateStr(cellText){
      var m=cellText.trim().match(/(\d{4}-\d{2}-\d{2})/);
      return m?m[1]:null;
    }

    function buildCounts(targetDateStr){
      var c={};FEE_LIST.forEach(function(v){c[v]={vip:0,normal:0};});
      document.querySelectorAll('table').forEach(function(tbl){
        var ci=repColumn(tbl);if(ci<0){return;}
        var di=dateColumn(tbl);
        var fee=null;
        tbl.querySelectorAll('tbody tr').forEach(function(row){
          var m=row.textContent.match(/قيمة الفرق:\s*([\d,]+)/);
          if(m){var n=parseInt(m[1].replace(/,/g,''),10);fee=FEE_LIST.indexOf(n)!==-1?n:null;return;}
          if(!fee){return;}
          var cells=row.querySelectorAll('td');
          if(cells.length<=ci){return;}
          if(targetDateStr && di>=0 && cells.length>di){
            var rowDate=extractDateStr(cells[di].textContent);
            if(rowDate && rowDate!==targetDateStr){return;}
          }
          var name=cells[ci].textContent.trim();
          if(!name){return;}
          /[a-zA-Z]/.test(name)?c[fee].vip++:c[fee].normal++;
        });
      });
      return c;
    }
    function buildTotals(c){var ov={};FEE_LIST.forEach(function(v){ov[v]=c[v].vip+c[v].normal;});return ov;}

    function buildReport(){
      var c=buildCounts(),now=new Date();var d=pad2(now.getDate())+'/'+pad2(now.getMonth()+1)+'/'+now.getFullYear(),day=DAYS_AR[now.getDay()];var f=function(n){return n>0?n:'';},ov=buildTotals(c);var empEl=document.querySelector('span.user-name'),empName=empEl?empEl.textContent.trim():'غير معروف';var tpl=(wsSettings.reportTemplate&&wsSettings.reportTemplate.trim())?wsSettings.reportTemplate:DEFAULT_REPORT_TEMPLATE;
      return renderTemplate(tpl,{station:wsSettings.stationName||'المنصور',employee:empName,date:d,day:day,normal5000:f(c[5000].normal),normal4000:f(c[4000].normal),normal3000:f(c[3000].normal),normal2000:f(c[2000].normal),vip5000:f(c[5000].vip),vip4000:f(c[4000].vip),vip3000:f(c[3000].vip),vip2000:f(c[2000].vip),total5000:f(ov[5000]),total4000:f(ov[4000]),total3000:f(ov[3000]),total2000:f(ov[2000])});
    }

    var wsWalletEmpName = '';
    var wsWalletTodayTotals = null;
    var wsWalletSavedToday = false;

    function tryAutoSaveWallet() {
      var empEl = document.querySelector('span.user-name');
      if (!empEl) { return; }
      var empName = empEl.textContent.trim();
      if (!empName) { return; }
      wsWalletEmpName = empName;

      if (!document.querySelector('table')) { return; }

      var actualDate = getDataDateFromTable() || new Date();
      var todayStr = actualDate.getFullYear() + '-' + pad2(actualDate.getMonth() + 1) + '-' + pad2(actualDate.getDate());

      var c = buildCounts(todayStr);
      var totals = buildTotals(c);

      var hasData = FEE_LIST.some(function(fee){ return totals[fee] > 0; });
      if (!hasData) { return; }

      wsWalletTodayTotals = totals;

      if (!wsWalletSavedToday) {
        wsWalletSavedToday = true;
        saveWalletDay(empName, totals);
        updateWalletBtnLabel();
      }
    }

    function calcWalletToday(totals) {
      var feeMap = {5000:wsSettings.walletFee5000!=null?wsSettings.walletFee5000:300,4000:wsSettings.walletFee4000!=null?wsSettings.walletFee4000:200,3000:wsSettings.walletFee3000!=null?wsSettings.walletFee3000:150,2000:wsSettings.walletFee2000!=null?wsSettings.walletFee2000:100};
      var amount = 0;
      FEE_LIST.forEach(function(fee){ amount += (totals[fee]||0) * (feeMap[fee]||0); });
      return amount;
    }

    function updateWalletBtnLabel() {
      var btn = document.getElementById('ws-wallet-btn');
      if (!btn) { return; }
      if (wsWalletTodayTotals) {
        var todayAmt = calcWalletToday(wsWalletTodayTotals);
        btn.textContent = '💰 المحفظة: ' + formatNum(todayAmt) + ' د';
      } else {
        btn.textContent = '💰 المحفظة';
      }
    }

    function addReportBtn(){
      if(document.getElementById('ws-report-btn')){return;}
      var btn=document.createElement('button');btn.id='ws-report-btn';btn.type='button';btn.textContent='📋 نسخ التقرير';btn.setAttribute('data-ws-btn','copy-report');btn.style.cssText='background:#28a745;color:#fff;border:none;border-radius:4px;padding:6px 12px;cursor:pointer;font-size:13px;margin:0 4px;white-space:nowrap;';
      btn.addEventListener('click',function(){copyText(buildReport());var orig=btn.textContent;btn.textContent='✅ تم النسخ';setTimeout(function(){btn.textContent=orig;},1200);});

      var walletBtn=document.createElement('button');walletBtn.id='ws-wallet-btn';walletBtn.type='button';walletBtn.textContent='💰 المحفظة';walletBtn.style.cssText='background:#e67e22;color:#fff;border:none;border-radius:4px;padding:6px 12px;cursor:pointer;font-size:13px;margin:0 4px;white-space:nowrap;font-weight:bold;';
      walletBtn.addEventListener('click',function(){
        var empEl=document.querySelector('span.user-name');var empName=empEl?empEl.textContent.trim():'موظف';
        openWalletDialog(empName||wsWalletEmpName||'موظف', wsWalletTodayTotals);
      });

      var inp=document.querySelector('input[placeholder*="بحث"],input[placeholder*="ابحث"]')||Array.from(document.querySelectorAll('input')).find(function(i){var p=i.parentElement,d=0;while(p&&d<3){if(p.textContent.indexOf('بحث')!==-1){return true;}p=p.parentElement;d++;}});
      if(inp&&inp.parentElement){inp.parentElement.insertBefore(walletBtn,inp);inp.parentElement.insertBefore(btn,walletBtn);}
      else{btn.style.cssText+='position:fixed;top:10px;left:10px;z-index:99999;';walletBtn.style.cssText+='position:fixed;top:10px;left:145px;z-index:99999;';document.body.appendChild(btn);document.body.appendChild(walletBtn);}

      setTimeout(tryAutoSaveWallet, 1500);
    }

    onReady(function(){
      setTimeout(function(){
        addReportBtn();
        applyVisibility();

        var walletRetryCount = 0;
        var walletRetryTimer = setInterval(function(){
          walletRetryCount++;
          if(wsWalletSavedToday || walletRetryCount > 10){
            clearInterval(walletRetryTimer);
            updateWalletBtnLabel();
            return;
          }
          tryAutoSaveWallet();
        }, 3000);

      },1200);
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  ③b delivery-fees-differences/statistics — إحصائية الشهر الكامل
  //  (v4.3.6): إصلاح جذري لحساب الأجر — الجدول بهذي الصفحة مُجمّع
  //  فعلياً حسب "قيمة الفرق" (تماماً متل صفحة أجور التوصيل الأصلية):
  //  كل مجموعة برأس فيه "قيمة الفرق: X | عدد الطلبات: N | مجموع
  //  الفروقات: M" — وM هو المبلغ الحقيقي الصحيح (وليس تخميناً بسعر
  //  ثابت). الآن يُقرأ هذا المبلغ مباشرة من كل فئة موجودة فعلياً
  //  بالنتائج (بدل ضرب عدد المستلمة بسعر واحد ثابت من الإعدادات)،
  //  ويُصنَّف كل سجل داخل كل فئة إلى عادي/VIP (حسب وجود حروف
  //  إنكليزية باسم المندوب — نفس منطق صفحة أجور التوصيل بالضبط)،
  //  وزر "📋 نسخ التقرير" يبني التقرير بنفس قالب وفئات تلك الصفحة
  //  حرفياً. زر واحد فقط بهذي الصفحة ("💰 إحصائية الشهر الكامل")
  //  يقوم بكل العملية — بدون أي زر إضافي مكرر.
  // ══════════════════════════════════════════════════════════════
  if (PAGE.indexOf('/cs/delivery-fees-differences/statistics') !== -1) {

    var STATS_KNOWN_TIERS = [5000, 4000, 3000, 2000];

    // ── عناصر الصفحة (بمعرّفاتها الحقيقية) ──────────────────────
    function statsGetTable() {
      return document.getElementById('dfds_table') || document.querySelector('table');
    }
    function statsGetInfoEl() {
      return document.getElementById('dfds_table_info') || document.querySelector('.dataTables_info');
    }
    function statsGetDateInputs() {
      var fromInp = document.getElementById('min');
      var toInp = document.getElementById('max');
      if (fromInp && toInp) { return { from: fromInp, to: toInp }; }
      var inputs = Array.from(document.querySelectorAll('input[type="date"]'));
      return { from: inputs[0] || null, to: inputs[1] || null };
    }
    function statsFindSearchBtn() {
      return document.getElementById('search_btn') || Array.from(document.querySelectorAll('button')).find(function (b) {
        return b.textContent.trim() === 'بحث' && b.id !== 'ws-stats-btn';
      });
    }
    function statsFindNextBtn() {
      return Array.from(document.querySelectorAll('a,button')).find(function (el) {
        return el.textContent.trim() === 'التالي' && !el.disabled && !el.classList.contains('disabled') && !(el.parentElement && el.parentElement.classList.contains('disabled'));
      });
    }
    function statsIsLoaderBusy() {
      var loader = document.getElementById('btn-loader');
      if (!loader) { return false; }
      var style = window.getComputedStyle(loader);
      return style.display !== 'none' && style.visibility !== 'hidden' && loader.offsetParent !== null;
    }

    function statsSetInputValue(inp, val) {
      var proto = window.HTMLInputElement.prototype;
      var setter = Object.getOwnPropertyDescriptor(proto, 'value') && Object.getOwnPropertyDescriptor(proto, 'value').set;
      if (setter) { setter.call(inp, val); } else { inp.value = val; }
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function statsSetSelectValue(sel, val) {
      sel.value = val;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      try {
        var $ = (typeof unsafeWindow !== 'undefined' && unsafeWindow.jQuery) ? unsafeWindow.jQuery : window.jQuery;
        if ($) { $(sel).val(val).trigger('change'); }
      } catch (e) {}
    }

    function statsGetDT() {
      try {
        var $ = (typeof unsafeWindow !== 'undefined' && unsafeWindow.jQuery) ? unsafeWindow.jQuery : window.jQuery;
        if ($ && $.fn && $.fn.dataTable && $.fn.dataTable.isDataTable('#dfds_table')) {
          return $('#dfds_table').DataTable();
        }
      } catch (e) {}
      return null;
    }

    // انتظار حقيقي لاكتمال البحث — يتحقق من اختفاء اللودر + تغيّر نص النتائج
    // + حدث draw.dt مع مهلة أقصى صارمة (لا يعلّق)
    function statsWaitSearchComplete(prevInfoText, timeoutMs) {
      return new Promise(function (resolve) {
        var settled = false;
        var dt = statsGetDT();
        var poller = null, hardTimeout = null;

        function cleanup() {
          if (dt) { try { dt.off('draw.wsstats'); } catch (e) {} }
          if (poller) { clearInterval(poller); }
          if (hardTimeout) { clearTimeout(hardTimeout); }
        }
        function finish() {
          if (settled) { return; }
          settled = true;
          cleanup();
          setTimeout(resolve, 400); // هامش إضافي بعد الحدث
        }

        if (dt) {
          try { dt.one('draw.wsstats', finish); } catch (e) {}
        }

        var stableCount = 0; // عداد استقرار متتالي قبل الإعلان عن الاكتمال
        poller = setInterval(function () {
          var infoEl = statsGetInfoEl();
          var curText = infoEl ? infoEl.textContent.trim() : '';
          var loaderGone = !statsIsLoaderBusy();
          var textChanged = curText && curText !== prevInfoText;
          if (loaderGone && (textChanged || curText.indexOf('عرض') !== -1)) {
            stableCount++;
            if (stableCount >= 2) { finish(); } // استقرار عند قراءتين متتاليتين
          } else {
            stableCount = 0;
          }
        }, 300);

        hardTimeout = setTimeout(finish, timeoutMs || 30000);
      });
    }

    function statsGetTotalCount() {
      var infoEl = statsGetInfoEl();
      if (!infoEl) { return null; }
      var text = infoEl.textContent || '';
      var m = text.match(/من\s*[اإأ]صل\s*([\d,]+)/);
      if (m) { return parseInt(m[1].replace(/,/g, ''), 10); }
      if (/عرض\s*0\s*مدخل/.test(text) || text.indexOf('لا يوجد') !== -1) { return 0; }
      return null;
    }

    function statsEnsureShowAll() {
      var dt = statsGetDT();
      if (dt) {
        try {
          if (dt.page.len() !== -1) { dt.page.len(-1).draw(false); return true; }
          return false;
        } catch (e) {}
      }
      // احتياط: اختر أعلى قيمة متاحة بالـ select
      var lenSelect = document.querySelector('select[name="dfds_table_length"]');
      if (lenSelect) {
        var maxOpt = Array.from(lenSelect.options).reduce(function (best, o) {
          var v = parseInt(o.value, 10);
          return (v === -1 || v > (parseInt(best.value, 10) || 0)) ? o : best;
        }, lenSelect.options[0]);
        if (maxOpt && lenSelect.value !== maxOpt.value) {
          lenSelect.value = maxOpt.value;
          lenSelect.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
      return false;
    }

    function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

    // ✅ الأساس الجديد: يقرأ فئات "قيمة الفرق" الحقيقية من رؤوس
    // المجموعات (dtrg-group) — كل رأس يحمل العدد والمبلغ الصحيحين
    // فعلياً من الموقع نفسه (لا تخمين بسعر ثابت)، ويصنّف كل سجل
    // داخل كل فئة إلى عادي/VIP حسب اسم المندوب (نفس منطق صفحة أجور
    // التوصيل الأصلية بالضبط). carryFee يسمح بترحيل الفئة الحالية
    // عبر حدود الصفحات لو تعذّر عرض كل الصفوف دفعة واحدة.
    function statsExtractCategoryBreakdownFromDOM(carryFee) {
      var table = statsGetTable();
      var result = { breakdown: {}, lastFee: carryFee || null };
      if (!table) { return result; }
      var tbody = table.querySelector('tbody');
      if (!tbody) { return result; }
      var currentFee = carryFee || null;
      Array.from(tbody.children).forEach(function (tr) {
        if (tr.classList.contains('dtrg-group')) {
          var text = tr.textContent || '';
          var feeM = text.match(/قيمة الفرق:\s*([\d,]+)/);
          var cntM = text.match(/عدد الطلبات:\s*([\d,]+)/);
          var sumM = text.match(/مجموع الفروقات:\s*([\d,]+)/);
          if (feeM) {
            currentFee = parseInt(feeM[1].replace(/,/g, ''), 10);
            if (!result.breakdown[currentFee]) { result.breakdown[currentFee] = { count: 0, sum: 0, vip: 0, normal: 0 }; }
            result.breakdown[currentFee].count += cntM ? parseInt(cntM[1].replace(/,/g, ''), 10) : 0;
            result.breakdown[currentFee].sum += sumM ? parseInt(sumM[1].replace(/,/g, ''), 10) : 0;
          }
          return;
        }
        if (tr.querySelector('td.dataTables_empty')) { return; }
        if (currentFee == null) { return; }
        var cells = tr.querySelectorAll('td');
        if (cells.length < 3) { return; }
        var repName = cells[2].textContent.trim();
        if (!result.breakdown[currentFee]) { result.breakdown[currentFee] = { count: 0, sum: 0, vip: 0, normal: 0 }; }
        if (/[a-zA-Z]/.test(repName)) { result.breakdown[currentFee].vip++; } else { result.breakdown[currentFee].normal++; }
      });
      result.lastFee = currentFee;
      return result;
    }

    function statsMergeBreakdown(target, source) {
      Object.keys(source).forEach(function (fee) {
        if (!target[fee]) { target[fee] = { count: 0, sum: 0, vip: 0, normal: 0 }; }
        target[fee].count += source[fee].count;
        target[fee].sum += source[fee].sum;
        target[fee].vip += source[fee].vip;
        target[fee].normal += source[fee].normal;
      });
      return target;
    }

    async function statsCollectBreakdownAllPages(btn, label) {
      var infoEl = statsGetInfoEl();
      var prevText = infoEl ? infoEl.textContent.trim() : '';
      var didShowAll = statsEnsureShowAll();
      if (didShowAll) {
        if (btn) { btn.textContent = '⏳ يجمع فئات "' + label + '"...'; }
        await statsWaitSearchComplete(prevText, 25000);
      }

      var dt = statsGetDT();
      var isShowingAll = false;
      if (dt) {
        try { isShowingAll = (dt.page.len() === -1 || dt.page.len() >= dt.data().count()); } catch (e) {}
      }
      if (isShowingAll || !statsFindNextBtn()) {
        var res = statsExtractCategoryBreakdownFromDOM(null);
        return res.breakdown;
      }

      // احتياط: تجميع عبر عدة صفحات مع انتظار كافٍ بين كل صفحة
      var merged = {};
      var carry = null;
      var safe = 0;
      while (safe++ < 200) {
        var res2 = statsExtractCategoryBreakdownFromDOM(carry);
        statsMergeBreakdown(merged, res2.breakdown);
        carry = res2.lastFee;
        var nb = statsFindNextBtn();
        if (!nb) { break; }
        if (btn) { btn.textContent = '⏳ يجمع فئات "' + label + '" (صفحة ' + (safe + 1) + ')...'; }
        var infoBefore = statsGetInfoEl();
        var txtBefore = infoBefore ? infoBefore.textContent.trim() : '';
        nb.click();
        await statsWaitSearchComplete(txtBefore, 12000);
      }
      return merged;
    }

    // ✅ (v4.3.7): نفس آلية حساب الأجر المستخدمة بصفحة أجور التوصيل
    // الأصلية بالضبط (نظام المحفظة) — كل فئة لها سعر مختلف قابل
    // للتعديل من الإعدادات ⚙️ ← 💰 إعدادات المحفظة الشهرية، والأجر هو
    // (عدد طلبات الفئة × سعر تلك الفئة) — وليس "مجموع الفروقات" الخام
    // (اللي هو قيمة الفرق بالسعر نفسها، مو أجر المندوب الفعلي)
    function statsWalletRateFor(fee) {
      var map = {
        5000: wsSettings.walletFee5000 != null ? wsSettings.walletFee5000 : DEFAULT_SETTINGS.walletFee5000,
        4000: wsSettings.walletFee4000 != null ? wsSettings.walletFee4000 : DEFAULT_SETTINGS.walletFee4000,
        3000: wsSettings.walletFee3000 != null ? wsSettings.walletFee3000 : DEFAULT_SETTINGS.walletFee3000,
        2000: wsSettings.walletFee2000 != null ? wsSettings.walletFee2000 : DEFAULT_SETTINGS.walletFee2000
      };
      return map[fee] != null ? map[fee] : 0;
    }
    function statsSumWage(breakdown) {
      var total = 0;
      Object.keys(breakdown || {}).forEach(function (fee) {
        total += (breakdown[fee].count || 0) * statsWalletRateFor(Number(fee));
      });
      return total;
    }

    function statsMonthRange() {
      var now = new Date();
      var first = new Date(now.getFullYear(), now.getMonth(), 1);
      function fmt(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
      return { from: fmt(first), to: fmt(now), label: getMonthLabel(fmt(first).slice(0, 7)) };
    }

    // يبحث عن نوع سجل معيّن (1=مستلمة، 2=غير مستلمة) بنفس نطاق
    // التاريخ، وينتظر اكتمال البحث فعلياً، ثم يجمع تفصيل الفئات
    // الحقيقية (لا تخمين) عبر كل الصفحات
    async function statsSearchByType(typeValue, range, btn, label) {
      var dateInputs = statsGetDateInputs();
      if (dateInputs.from) { statsSetInputValue(dateInputs.from, range.from); }
      if (dateInputs.to) { statsSetInputValue(dateInputs.to, range.to); }

      var typeSel = document.getElementById('type');
      if (typeSel) { statsSetSelectValue(typeSel, typeValue); }

      await sleep(150);

      var infoElBefore = statsGetInfoEl();
      var prevInfoText = infoElBefore ? infoElBefore.textContent.trim() : '';

      if (btn) { btn.textContent = '⏳ يبحث عن "' + label + '"...'; }
      var searchBtn = statsFindSearchBtn();
      if (!searchBtn) { return { count: 0, breakdown: {} }; }
      searchBtn.click();

      await statsWaitSearchComplete(prevInfoText, 25000);

      var breakdown = await statsCollectBreakdownAllPages(btn, label);
      var totalCount = statsGetTotalCount();
      if (totalCount == null) {
        totalCount = Object.keys(breakdown).reduce(function (s, k) { return s + breakdown[k].count; }, 0);
      }
      return { count: totalCount || 0, breakdown: breakdown || {} };
    }

    function statsOpenSummaryDialog(range, receivedRes, notReceivedRes) {
      if (document.getElementById('ws-stats-overlay')) { document.getElementById('ws-stats-overlay').remove(); }

      var receivedBreakdown = receivedRes.breakdown || {};
      var notReceivedBreakdown = notReceivedRes.breakdown || {};
      // ✅ تدقيق (مراجعة v4.3.7): الفئات المعروضة بجدول التفصيل تُبنى
      // من "المستلمة" فقط (نفس عنوان الجدول)، وليس اتحاد الفئات مع
      // "غير مستلمة" — تفادياً لعرض صف فارغ (كل قيمه صفر) لفئة موجودة
      // فقط بغير المستلمة وما لها أي طلب مستلم فعلياً
      var tiers = Object.keys(receivedBreakdown).map(Number).sort(function (a, b) { return b - a; });
      var totalWage = statsSumWage(receivedBreakdown);

      var overlay = document.createElement('div'); overlay.id = 'ws-stats-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000002;display:flex;align-items:center;justify-content:center;direction:rtl;';
      var panel = document.createElement('div');
      panel.style.cssText = 'background:#fff;border-radius:10px;padding:18px 20px;width:400px;max-height:90vh;overflow:auto;box-shadow:0 6px 28px rgba(0,0,0,.4);font-family:Tahoma,Arial,sans-serif;';

      var hdr = document.createElement('div'); hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;';
      var hdrTitle = document.createElement('h3'); hdrTitle.textContent = '💰 إحصائية الشهر الكامل'; hdrTitle.style.cssText = 'margin:0;font-size:15px;color:#222;';
      var closeX = document.createElement('button'); closeX.type = 'button'; closeX.textContent = '✕'; closeX.style.cssText = 'background:none;border:none;font-size:18px;cursor:pointer;color:#888;padding:0;line-height:1;';
      closeX.addEventListener('click', function () { overlay.remove(); });
      hdr.appendChild(hdrTitle); hdr.appendChild(closeX); panel.appendChild(hdr);

      var monthLbl = document.createElement('div'); monthLbl.textContent = '📅 ' + range.label + ' (' + range.from + ' → ' + range.to + ')';
      monthLbl.style.cssText = 'font-size:12px;color:#555;margin-bottom:10px;'; panel.appendChild(monthLbl);

      if (!tiers.length) {
        var emptyNote = document.createElement('div');
        emptyNote.style.cssText = 'text-align:center;color:#999;padding:14px 0;font-size:12px;';
        emptyNote.textContent = 'لا توجد سجلات فروقات أجور بهذا النطاق.';
        panel.appendChild(emptyNote);
      } else {
        var catTitle = document.createElement('div'); catTitle.textContent = '✅ تفصيل الفئات — الطلبات المستلمة'; catTitle.style.cssText = 'font-size:12.5px;font-weight:bold;color:#1a8a3a;margin:8px 0 6px;'; panel.appendChild(catTitle);

        var tbl = document.createElement('table'); tbl.style.cssText = 'width:100%;border-collapse:collapse;font-size:11.5px;margin-bottom:10px;';
        var thead = document.createElement('thead');
        var hRow = document.createElement('tr'); hRow.style.cssText = 'background:#f0f0f0;';
        ['الفئة', 'عادي', 'VIP', 'العدد', 'سعر/طلب', 'الأجر'].forEach(function (h) {
          var th = document.createElement('th'); th.textContent = h; th.style.cssText = 'padding:5px 4px;text-align:center;border:1px solid #ddd;color:#444;font-size:10.5px;'; hRow.appendChild(th);
        });
        thead.appendChild(hRow); tbl.appendChild(thead);
        var tbodyEl = document.createElement('tbody');
        var hasUnratedTier = false;
        tiers.forEach(function (fee) {
          var r = receivedBreakdown[fee] || { count: 0, sum: 0, vip: 0, normal: 0 };
          var rate = statsWalletRateFor(fee);
          if (rate === 0 && r.count > 0) { hasUnratedTier = true; }
          var wage = r.count * rate;
          var tr = document.createElement('tr');
          [formatNum(fee), r.normal, r.vip, r.count, formatNum(rate), formatNum(wage) + ' د'].forEach(function (val, i) {
            var td = document.createElement('td'); td.textContent = val;
            td.style.cssText = 'padding:5px 4px;border:1px solid #eee;text-align:center;font-size:11px;color:' + (i === 5 ? '#1a8a3a' : '#333') + ';font-weight:' + (i === 5 ? 'bold' : 'normal') + ';';
            tr.appendChild(td);
          });
          tbodyEl.appendChild(tr);
        });
        tbl.appendChild(tbodyEl); panel.appendChild(tbl);
        if (hasUnratedTier) {
          var unratedNote = document.createElement('div');
          unratedNote.style.cssText = 'font-size:10.5px;color:#c2410c;background:#fff7ed;border-radius:6px;padding:6px 8px;margin-bottom:8px;line-height:1.6;';
          unratedNote.textContent = '⚠️ فيه فئة/فئات بدون سعر أجر مُعرّف بالإعدادات (⚙️ ← 💰 إعدادات المحفظة الشهرية) — أجرها احتُسب صفر مؤقتاً.';
          panel.appendChild(unratedNote);
        }
      }

      var totalBox = document.createElement('div');
      totalBox.style.cssText = 'background:#e8f5e9;border:2px solid #1a8a3a;border-radius:8px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;';
      var tlbl = document.createElement('span'); tlbl.textContent = '💵 إجمالي الأجر (المستلمة فقط)'; tlbl.style.cssText = 'font-size:12px;color:#333;font-weight:bold;';
      var tval = document.createElement('span'); tval.textContent = formatNum(totalWage) + ' دينار'; tval.style.cssText = 'font-size:19px;font-weight:bold;color:#1a8a3a;';
      totalBox.appendChild(tlbl); totalBox.appendChild(tval); panel.appendChild(totalBox);

      var notRecCount = notReceivedRes.count || 0;
      var notRecBox = document.createElement('div');
      notRecBox.style.cssText = 'background:#fdecea;border:1.5px solid #c0392b;border-radius:8px;padding:9px 14px;text-align:center;margin-bottom:12px;font-size:12px;color:#c0392b;';
      notRecBox.textContent = '❌ غير مستلمة: ' + notRecCount + ' سجل (لا تُحتسب بالأجر)';
      panel.appendChild(notRecBox);

      var copyReportBtn = document.createElement('button'); copyReportBtn.type = 'button'; copyReportBtn.textContent = '📋 نسخ التقرير (نفس قالب أجور التوصيل)';
      copyReportBtn.style.cssText = 'width:100%;background:#28a745;color:#fff;border:none;border-radius:6px;padding:9px;cursor:pointer;font-size:12.5px;font-weight:bold;margin-bottom:6px;';
      copyReportBtn.addEventListener('click', function () {
        var f = function (n) { return n > 0 ? n : ''; };
        var g = function (fee, key) { return receivedBreakdown[fee] ? receivedBreakdown[fee][key] : 0; };
        var empEl = document.querySelector('span.user-name'); var empName = empEl ? empEl.textContent.trim() : 'غير معروف';
        var tpl = (wsSettings.reportTemplate && wsSettings.reportTemplate.trim()) ? wsSettings.reportTemplate : DEFAULT_REPORT_TEMPLATE;
        var reportText = renderTemplate(tpl, {
          station: wsSettings.stationName || 'المنصور', employee: empName, date: range.from + ' → ' + range.to, day: range.label,
          normal5000: f(g(5000, 'normal')), normal4000: f(g(4000, 'normal')), normal3000: f(g(3000, 'normal')), normal2000: f(g(2000, 'normal')),
          vip5000: f(g(5000, 'vip')), vip4000: f(g(4000, 'vip')), vip3000: f(g(3000, 'vip')), vip2000: f(g(2000, 'vip')),
          total5000: f(g(5000, 'count')), total4000: f(g(4000, 'count')), total3000: f(g(3000, 'count')), total2000: f(g(2000, 'count'))
        });
        var extraTiers = tiers.filter(function (t) { return STATS_KNOWN_TIERS.indexOf(t) === -1; });
        if (extraTiers.length) {
          reportText += '\n\nفئات إضافية غير مدرجة بالقالب الأساسي (بلا سعر أجر مُعرّف):\n' + extraTiers.map(function (t) {
            var r = receivedBreakdown[t]; return formatNum(t) + ': ' + (r ? r.count : 0) + ' سجل';
          }).join('\n');
        }
        reportText += '\n\nإجمالي الأجر: ' + formatNum(totalWage) + ' دينار';
        copyText(reportText);
        var orig = copyReportBtn.textContent; copyReportBtn.textContent = '✅ تم النسخ'; setTimeout(function () { copyReportBtn.textContent = orig; }, 1600);
      });
      panel.appendChild(copyReportBtn);

      var closeBtn = document.createElement('button'); closeBtn.type = 'button'; closeBtn.textContent = 'إغلاق'; closeBtn.style.cssText = 'width:100%;background:#888;color:#fff;border:none;border-radius:6px;padding:9px;cursor:pointer;font-size:13px;';
      closeBtn.addEventListener('click', function () { overlay.remove(); });
      panel.appendChild(closeBtn);

      overlay.appendChild(panel);
      overlay.addEventListener('click', function (e) { if (e.target === overlay) { overlay.remove(); } });
      document.body.appendChild(overlay);
    }

    async function runMonthStats(btn) {
      var orig = btn.textContent;
      try {
        btn.disabled = true;
        var range = statsMonthRange();

        var typeSelCheck = document.getElementById('type');
        if (!typeSelCheck) { alert('تعذّر إيجاد قائمة "نوع السجل" بالصفحة.'); return; }

        var receivedRes = await statsSearchByType('1', range, btn, 'مستلمة');
        var notReceivedRes = await statsSearchByType('2', range, btn, 'غير مستلمة');

        statsOpenSummaryDialog(range, receivedRes, notReceivedRes);
      } catch (e) {
        alert('حدث خطأ أثناء جمع الإحصائية:\n' + (e && e.message ? e.message : e));
      } finally {
        btn.disabled = false;
        btn.textContent = orig;
      }
    }

    // زر واحد فقط بهذه الصفحة يقوم بكل العملية — لا يوجد أي زر إضافي
    // (مثل "نسخ القيد" أو "نسخ التقرير" القديم) على هذه الصفحة تحديداً
    function statsAddBtn() {
      if (document.getElementById('ws-stats-btn')) { return; }
      var oldReportBtn = document.getElementById('ws-report-btn');
      if (oldReportBtn) { oldReportBtn.remove(); }

      var btn = document.createElement('button');
      btn.id = 'ws-stats-btn';
      btn.type = 'button';
      btn.textContent = '💰 إحصائية الشهر الكامل';
      btn.setAttribute('data-ws-btn', 'month-stats');
      btn.style.cssText = 'background:#e67e22;color:#fff;border:none;border-radius:4px;padding:6px 12px;cursor:pointer;font-size:13px;margin:0 4px;white-space:nowrap;font-weight:bold;';
      btn.addEventListener('click', function () { runMonthStats(btn); });

      var oldWalletBtn = document.getElementById('ws-wallet-btn');
      if (oldWalletBtn) { oldWalletBtn.replaceWith(btn); return; }

      var inp = document.querySelector('input[placeholder*="بحث"],input[placeholder*="ابحث"]') || Array.from(document.querySelectorAll('input')).find(function (i) {
        var p = i.parentElement, d = 0;
        while (p && d < 3) { if (p.textContent.indexOf('بحث') !== -1) { return true; } p = p.parentElement; d++; }
        return false;
      });
      if (inp && inp.parentElement) { inp.parentElement.insertBefore(btn, inp); }
      else { btn.style.cssText += 'position:fixed;top:10px;left:10px;z-index:99999;'; document.body.appendChild(btn); }
    }

    onReady(function () { setTimeout(function () { observeAndRun(statsAddBtn, 500); }, 900); });
  }

  // ── editOrder ──
  if(PAGE.indexOf('/cs/editOrder')!==-1){var editParams=new URLSearchParams(location.search),editNum=editParams.get('ws_order');if(editNum){onReady(function(){waitFor('#search',function(inp){inp.value=editNum;inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));inp.focus();setTimeout(function(){var searchBtn=document.querySelector('#btn-text')||document.querySelector('button[type="submit"]')||document.querySelector('form button')||document.querySelector('input[type="submit"]');if(searchBtn){searchBtn.click();}},500);});});}}

  // ── delivering-orders ──
  if(PAGE.indexOf('/cs/delivering-orders')!==-1){
    function collectPage(){var data={};document.querySelectorAll('td[colspan]').forEach(function(cell){if(cell.closest('#dm-panel')){return;}var m=cell.textContent.trim().match(/^(.*?)\((\d+)\)\s*$/);if(!m){return;}var name=m[1].trim();data[name]=(data[name]||0)+parseInt(m[2],10);});return data;}
    function lastPage2(){var max=1;document.querySelectorAll('.pagination a,.pagination button,.page-item a,.page-link').forEach(function(el){var n=parseInt(el.textContent.trim(),10);if(!isNaN(n)&&n>max){max=n;}});return max;}
    function currentPage2(){var active=document.querySelector('.pagination .active a,.pagination .active button,.page-item.active .page-link');if(active){return parseInt(active.textContent.trim(),10)||1;}var cur=Array.from(document.querySelectorAll('.pagination a,.pagination button')).find(function(el){return el.getAttribute('aria-current')==='page';});return cur?parseInt(cur.textContent.trim(),10)||1:1;}
    function nextBtn2(){return Array.from(document.querySelectorAll('a,button')).find(function(el){return el.textContent.trim()==='التالي'&&!el.disabled&&!el.classList.contains('disabled')&&!el.parentElement.classList.contains('disabled');});}
    function formatReps(data){return Object.keys(data).map(function(name){var n=data[name];return name+' ('+n+')'+(n>10?' - ❌ القيد عالي':'');}).join('\n');}
    async function collectAll(btn){var orig=btn.textContent;btn.textContent='⏳ جاري الجمع...';btn.disabled=true;var all={};function merge(d){Object.keys(d).forEach(function(k){all[k]=(all[k]||0)+d[k];});}merge(collectPage());var last=lastPage2(),cur=currentPage2(),safe=0;while(safe++<100){if(cur>=last){break;}var nb=nextBtn2();if(!nb){break;}nb.click();await new Promise(function(resolve){var tries=0,prev=cur,check=setInterval(function(){tries++;var now=currentPage2();if(now!==prev&&document.querySelector('td[colspan]')){clearInterval(check);cur=now;resolve();}if(tries>40){clearInterval(check);resolve();}},300);});merge(collectPage());btn.textContent='⏳ صفحة '+cur+' / '+last;}copyText(formatReps(all));btn.textContent='✅ تم النسخ ('+Object.keys(all).length+' مندوب)';btn.disabled=false;setTimeout(function(){btn.textContent=orig;},3000);}
    function addRepsBtn(){if(document.getElementById('ws-reps-btn')){return;}if(!document.querySelector('td[colspan]')){return;}var btn=document.createElement('button');btn.id='ws-reps-btn';btn.type='button';btn.textContent='📋 نسخ قائمة المناديب';btn.setAttribute('data-ws-btn','copy-reps');btn.style.cssText='background:#2e5bff;color:#fff;border:none;border-radius:4px;padding:6px 12px;cursor:pointer;font-size:13px;margin:0 6px;white-space:nowrap;';btn.addEventListener('click',function(){collectAll(btn);});var inp=Array.from(document.querySelectorAll('input')).find(function(i){if(i.closest('#dm-panel')){return false;}var p=i.parentElement,d=0;while(p&&d<3){if(p.textContent.indexOf('بحث')!==-1){return true;}p=p.parentElement;d++;}});if(inp&&inp.parentElement){inp.parentElement.insertBefore(btn,inp);}else{btn.style.cssText+='position:fixed;top:10px;left:10px;z-index:99999;';document.body.appendChild(btn);}}
    onReady(function(){setTimeout(function(){observeAndRun(addRepsBtn,400);},900);});
  }

  // ══════════════════════════════════════════════════════════════
  //  ⑥ فحص الطلبات المتأخرة
  // ══════════════════════════════════════════════════════════════
  if(PAGE.indexOf('/cs/call_center')!==-1){
    var STATUS_DELIVERING='3',ONE_DAY=24*60*60*1000,UNKNOWN_RECHECK_MS=3*60*1000,AUTO_CHECK_INTERVAL_MS=90*1000;
    function parseDate(str){if(!str){return null;}var d=new Date(str.replace(' ','T'));return isNaN(d.getTime())?null:d;}
    function getCsrfToken(){var meta=document.querySelector('meta[name="csrf-token"]');if(meta&&meta.content){return meta.content;}var input=document.querySelector('input[name="_token"]');if(input&&input.value){return input.value;}return null;}
    function getCookie(name){var match=document.cookie.match('(?:^|; )'+name+'=([^;]*)');return match?decodeURIComponent(match[1]):null;}
    function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
    function fetchStory(orderId){var headers={'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest'};var token=getCsrfToken();if(token){headers['X-CSRF-TOKEN']=token;}var xsrfCookie=getCookie('XSRF-TOKEN');if(xsrfCookie){headers['X-XSRF-TOKEN']=xsrfCookie;}return fetch(BASE_URL+'/order-story/get-order-story',{method:'POST',headers:headers,credentials:'same-origin',body:'order_id='+encodeURIComponent(orderId)}).then(function(r){return r.text();}).then(function(t){var json=null;try{json=JSON.parse(t);}catch(e){json=null;}if(json&&json.status===false&&(json.errNum===99||json.errNum==='99')){return{__rateLimited:true};}return json;}).catch(function(){return null;});}
    function firstDeliveryDate(json){if(!json||!json.data||!Array.isArray(json.data.story)){return null;}var dates=json.data.story.filter(function(item){return item.status_id===STATUS_DELIVERING;}).map(function(item){return parseDate(item.log_created_at);}).filter(function(d){return d!==null;});return dates.length?new Date(Math.min.apply(null,dates.map(function(d){return d.getTime();}))):null;}
    function getRows(){var rows=[],seen=new Set();document.querySelectorAll('td').forEach(function(cell){var txt='';cell.childNodes.forEach(function(n){if(n.nodeType===3){txt+=n.textContent;}});txt=txt.trim();if(!/^\d{6,}$/.test(txt)){return;}if(/^(0|964)/.test(txt)){return;}var tr=cell.closest('tr');if(!tr||seen.has(tr)){return;}seen.add(tr);rows.push({id:txt,row:tr});});return rows;}
    var wsDelayResults=new Map(),wsDelayPending=new Set(),wsDelayIntervalId=null,wsDelayRunning=false,wsRateLimitedUntil=0;
    var RATE_LIMIT_COOLDOWN_MS=5*60*1000,KNOWN_RECHECK_MS=6*60*1000,FETCH_CONCURRENCY=2,FETCH_GAP_MS=350;
    var DELAY_STORE_KEY='waseet_delay_results_v1',DELAY_STORE_MAX_AGE_MS=48*60*60*1000,wsDelayStoreSaveTimer=null,DELAY_STORE_SAVE_DEBOUNCE_MS=1500;
    function loadDelayResultsFromStorage(){var raw=storeGet(DELAY_STORE_KEY);if(!raw){return;}try{var parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object'){return;}var now=Date.now();Object.keys(parsed).forEach(function(orderId){var entry=parsed[orderId];if(!entry||!entry.checkedAt){return;}if(now-entry.checkedAt>DELAY_STORE_MAX_AGE_MS){return;}wsDelayResults.set(orderId,entry);});}catch(e){}}
    function saveDelayResultsToStorageNow(){var obj={},now=Date.now();wsDelayResults.forEach(function(entry,orderId){if(!entry||!entry.checkedAt){return;}if(now-entry.checkedAt>DELAY_STORE_MAX_AGE_MS){return;}obj[orderId]=entry;});try{storeSet(DELAY_STORE_KEY,JSON.stringify(obj));}catch(e){}}
    function scheduleDelayResultsSave(){if(wsDelayStoreSaveTimer){clearTimeout(wsDelayStoreSaveTimer);}wsDelayStoreSaveTimer=setTimeout(function(){wsDelayStoreSaveTimer=null;saveDelayResultsToStorageNow();},DELAY_STORE_SAVE_DEBOUNCE_MS);}
    loadDelayResultsFromStorage();
    function reapplyAllColors(){var rows=getRows();rows.forEach(function(item){var result=wsDelayResults.get(item.id);if(result&&!result.unknown){applyDelayResult(item.row,result);}else{resetRowStyle(item.row);}});}
    function resetRowStyle(row){row.style.backgroundColor='';row.style.color='';row.removeAttribute('title');}
    function applyDelayResult(row,result){if(result&&result.late){row.style.backgroundColor='#ffd6d6';row.style.color='#8a0000';row.title='قيد التوصيل منذ '+result.hours.toFixed(1)+' ساعة';}else{resetRowStyle(row);}}
    function updateCheckBtnLabel(){var badge=document.getElementById('ws-check-btn');if(!badge){return;}var late=0;wsDelayResults.forEach(function(r){if(r&&r.late){late++;}});var mode=wsSettings.delayCheckMode||'auto',modeLabel=mode==='auto'?'🔄':'👆';if(wsDelayRunning){badge.textContent='⏳ جاري الفحص...';badge.style.background='#2e5bff';badge.disabled=true;return;}badge.disabled=false;if(Date.now()<wsRateLimitedUntil){var remainMin=Math.ceil((wsRateLimitedUntil-Date.now())/60000);badge.textContent='⏸️ توقف ('+remainMin+'د) — متأخر: '+late;badge.style.background='#888';return;}badge.textContent=modeLabel+' متأخر: '+late;badge.style.background=late>0?'#c0392b':'#1a8a3a';}
    function applyDelayMode(){if(wsDelayIntervalId!==null){clearInterval(wsDelayIntervalId);wsDelayIntervalId=null;}if((wsSettings.delayCheckMode||'auto')==='auto'){wsDelayIntervalId=setInterval(checkNewRows,AUTO_CHECK_INTERVAL_MS);}}
    async function checkNewRows(){if(!wsSettings.showDelayCheck){return;}if(wsDelayRunning){return;}if(Date.now()<wsRateLimitedUntil){reapplyAllColors();updateCheckBtnLabel();return;}wsDelayRunning=true;updateCheckBtnLabel();
      try{var rows=getRows(),now=new Date(),toFetch=[];rows.forEach(function(item){var orderId=item.id;if(wsDelayPending.has(orderId)){return;}var cached=wsDelayResults.get(orderId);if(!cached){toFetch.push(orderId);}else if(cached.unknown){if(now.getTime()-(cached.checkedAt||0)>UNKNOWN_RECHECK_MS){toFetch.push(orderId);}}else{applyDelayResult(item.row,cached);if(now.getTime()-(cached.checkedAt||0)>KNOWN_RECHECK_MS){toFetch.push(orderId);}}});
      if(toFetch.length>0){toFetch.forEach(function(id){wsDelayPending.add(id);});var idx=0,rateLimitHit=false;function worker(){if(rateLimitHit){return Promise.resolve();}if(idx>=toFetch.length){return Promise.resolve();}var orderId=toFetch[idx++],fetchTime=new Date();return fetchStory(orderId).then(function(json){if(json&&json.__rateLimited){rateLimitHit=true;wsRateLimitedUntil=Date.now()+RATE_LIMIT_COOLDOWN_MS;return;}var date=firstDeliveryDate(json);if(date){var hours=(fetchTime-date)/3600000,isLate=(fetchTime-date)>=ONE_DAY;wsDelayResults.set(orderId,{late:isLate,hours:hours,checkedAt:Date.now()});scheduleDelayResultsSave();var currentRows=getRows();currentRows.forEach(function(item){if(item.id===orderId){applyDelayResult(item.row,wsDelayResults.get(orderId));}});}else{wsDelayResults.set(orderId,{unknown:true,checkedAt:Date.now()});}}).catch(function(){wsDelayResults.set(orderId,{unknown:true,checkedAt:Date.now()});}).then(function(){wsDelayPending.delete(orderId);if(rateLimitHit){return;}return sleep(FETCH_GAP_MS).then(worker);});}var pool=[];for(var i=0;i<FETCH_CONCURRENCY;i++){pool.push(worker());}await Promise.all(pool);toFetch.forEach(function(id){wsDelayPending.delete(id);});}
      reapplyAllColors();updateCheckBtnLabel();}catch(err){console.error('[أدوات الوسيط] خطأ:',err);}finally{wsDelayRunning=false;}
    }
    function addCheckBtn(){if(document.getElementById('ws-check-btn')){return;}var btn=document.createElement('button');btn.id='ws-check-btn';btn.type='button';btn.setAttribute('data-ws-btn','delay-check');btn.style.cssText='position:fixed;top:10px;right:10px;z-index:99999;background:#1a8a3a;color:#fff;border:none;border-radius:4px;padding:8px 14px;cursor:pointer;font-size:13px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,.3);';btn.addEventListener('click',function(){if(Date.now()<wsRateLimitedUntil){var remainMin=Math.ceil((wsRateLimitedUntil-Date.now())/60000);alert('السيرفر طلب التوقف.\nانتظر '+remainMin+' دقيقة.');return;}wsDelayResults.forEach(function(v,k){if(v&&v.unknown){wsDelayResults.delete(k);}});wsDelayPending.clear();wsDelayRunning=false;checkNewRows();});document.body.appendChild(btn);updateCheckBtnLabel();}
    onReady(function(){setTimeout(function(){renderAndSync(addCheckBtn);reapplyAllColors();updateCheckBtnLabel();if((wsSettings.delayCheckMode||'auto')==='auto'){checkNewRows();}applyDelayMode();setInterval(updateCheckBtnLabel,10000);},1000);});
  }

  // ── view_search ──
  if(PAGE.indexOf('/cs/view_search')!==-1){var phoneSearchParams=new URLSearchParams(location.search),phoneSearchNum=phoneSearchParams.get('ws_phone'),phoneSearchType=phoneSearchParams.get('ws_search_type')||'2';if(phoneSearchNum){onReady(function(){waitFor('#search-type',function(sel){sel.value=phoneSearchType;sel.dispatchEvent(new Event('input',{bubbles:true}));sel.dispatchEvent(new Event('change',{bubbles:true}));waitFor('#order_id',function(inp){inp.value=phoneSearchNum;inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));inp.focus();setTimeout(function(){var btn=document.querySelector('#myBtn');if(btn){btn.click();}},400);});});});}}

  // ══════════════════════════════════════════════════════════════
  //  ⑦ صفحة "تقارير المدن" — زر كليشة أعلى المناديب واصلةً
  //  (v4.3.0): بجانب زر البحث، عند الضغط يبني كليشة جاهزة للنسخ:
  //  3 مراكز، كل مركز 3 أسماء (أعلى 9 مناديب حسب عمود "الواصلة")
  // ══════════════════════════════════════════════════════════════
  if (PAGE.indexOf('/cs/city/reports') !== -1) {
    function getReportsTable() {
      return document.querySelector('#example') || document.querySelector('table');
    }
    // يحدد رقم عمود "اسم المندوب" وعمود "الواصلة" ديناميكياً من رؤوس
    // الجدول (بدل تثبيت رقم العمود) حتى يستمر يعمل لو تغيّر ترتيب الأعمدة
    function getReportsColIndexes(table) {
      var ths = table.querySelectorAll('thead th'), nameIdx = -1, waselIdx = -1;
      ths.forEach(function (th, i) {
        var t = th.textContent.trim();
        if (nameIdx === -1 && t.indexOf('اسم المندوب') !== -1) { nameIdx = i; }
        if (t.indexOf('الواصل') !== -1) { waselIdx = i; }
      });
      return { nameIdx: nameIdx, waselIdx: waselIdx };
    }
    // يستخرج الجزء العربي فقط من اسم المندوب (يحذف أي كلمات/حروف
    // إنكليزية أو رموز مثل "MAN_C"، "P_"...الخ ويُبقي الاسم العربي فقط)
    function extractArabicName(raw) {
      var text = String(raw || '').replace(/[٠-٩۰-۹]/g, ' ').trim();
      var arabicRuns = text.match(/[\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+)*/g);
      if (!arabicRuns || !arabicRuns.length) { return text.trim(); }
      return arabicRuns.join(' ').replace(/\s+/g, ' ').trim();
    }
    function collectReportsRows() {
      var table = getReportsTable();
      if (!table) { return []; }
      var idx = getReportsColIndexes(table);
      if (idx.nameIdx === -1 || idx.waselIdx === -1) { return []; }
      var out = [];
      table.querySelectorAll('tbody tr').forEach(function (tr) {
        var cells = tr.children;
        if (!cells || cells.length <= Math.max(idx.nameIdx, idx.waselIdx)) { return; }
        var rawName = (cells[idx.nameIdx].textContent || '').trim();
        var name = extractArabicName(rawName);
        var waselTxt = (cells[idx.waselIdx].textContent || '').trim();
        var wasel = parseInt(waselTxt.replace(/[^\d\-]/g, ''), 10);
        if (!name || isNaN(wasel)) { return; }
        out.push({ name: name, wasel: wasel });
      });
      return out;
    }
    // يبني نص الكليشة: 3 مراكز، كل مركز 3 أسماء (الاسم العربي فقط)،
    // مرتّبة تنازلياً حسب "الواصلة" (أعلى 9 مناديب مقسّمين لثلاث مجموعات)
    // مع تنسيق واضح: أسماء غامقة (*الاسم* — تنسيق واتساب) وسمايلات
    // تعبّر عن السرعة تميّز كل مركز عن الآخر
    var TOP_WASEL_RANKS = [
      { medal: '🥇', title: 'المركز الأول', speed: '🚀' },
      { medal: '🥈', title: 'المركز الثاني', speed: '🏍️' },
      { medal: '🥉', title: 'المركز الثالث', speed: '⚡' }
    ];
    function buildTopWaselCliche() {
      var rows = collectReportsRows();
      if (!rows.length) { return ''; }
      rows.sort(function (a, b) { return b.wasel - a.wasel; });
      var top9 = rows.slice(0, 9);
      var lines = ['🏁 *الأعلى سرعة بالتوصيل* 🏁', '━━━━━━━━━━━━━━━'];
      var any = false;
      for (var g = 0; g < TOP_WASEL_RANKS.length; g++) {
        var group = top9.slice(g * 3, g * 3 + 3);
        if (!group.length) { break; }
        any = true;
        var r = TOP_WASEL_RANKS[g];
        lines.push('');
        lines.push(r.medal + ' *' + r.title + '* ' + r.speed);
        group.forEach(function (item, i) {
          lines.push(r.speed + ' ' + (i + 1) + '. *' + item.name + '* ➜ ' + item.wasel);
        });
      }
      if (!any) { return ''; }
      lines.push('');
      lines.push('━━━━━━━━━━━━━━━');
      return lines.join('\n');
    }
    function findReportsSearchInput() {
      var dtInput = document.querySelector('.dataTables_filter input');
      if (dtInput) { return dtInput; }
      return Array.from(document.querySelectorAll('input')).find(function (i) {
        var p = i.parentElement, d = 0;
        while (p && d < 3) { if (p.textContent.indexOf('بحث') !== -1) { return true; } p = p.parentElement; d++; }
        return false;
      });
    }
    function addTopWaselBtn() {
      if (document.getElementById('ws-top-wasel-btn')) { return; }
      var table = getReportsTable();
      if (!table || !table.querySelector('tbody tr')) { return; }
      var btn = document.createElement('button');
      btn.id = 'ws-top-wasel-btn';
      btn.type = 'button';
      btn.textContent = '🏆 كليشة الأعلى واصلة';
      btn.setAttribute('data-ws-btn', 'top-wasel');
      btn.style.cssText = 'background:#2e5bff;color:#fff;border:none;border-radius:4px;padding:6px 12px;cursor:pointer;font-size:13px;margin:0 6px;white-space:nowrap;';
      btn.addEventListener('click', function () {
        var text = buildTopWaselCliche();
        if (!text) { alert('تعذر إيجاد بيانات الجدول لبناء الكليشة.'); return; }
        copyText(text);
        var orig = btn.textContent;
        btn.textContent = '✅ تم النسخ';
        setTimeout(function () { btn.textContent = orig; }, 1400);
      });
      var inp = findReportsSearchInput();
      if (inp && inp.parentElement) {
        inp.parentElement.insertBefore(btn, inp);
      } else {
        btn.style.cssText += 'position:fixed;top:10px;left:10px;z-index:99999;';
        document.body.appendChild(btn);
      }
    }
    onReady(function () { setTimeout(function () { observeAndRun(addTopWaselBtn, 400); }, 900); });
  }

})();

// ══════════════════════════════════════════════════════════════
//  🚚 الجزء الثاني: مراقب التوصيل الاحترافي (Delivery Monitor Pro)
//  يعمل فقط في صفحة delivering-orders
// ══════════════════════════════════════════════════════════════
(function () {
    'use strict';

    // 🛡️ بوابة تحكم المدير: إيقاف كامل للسكربت، أو إيقاف "مراقب التوصيل"
    // تحديداً لهذا الموظف، يمنع تشغيل هذا الجزء بالكامل.
    if (typeof window !== 'undefined' && window.WSAdmin &&
        (!window.WSAdmin.isEnabledForMe() || !window.WSAdmin.isDeliveryMonitorEnabledForMe())) {
        return;
    }

    const _hasGM = {
        get:    typeof GM_getValue     === 'function',
        set:    typeof GM_setValue     === 'function',
        del:    typeof GM_deleteValue  === 'function',
        list:   typeof GM_listValues   === 'function',
        notify: typeof GM_notification === 'function',
        style:  typeof GM_addStyle     === 'function'
    };

    const gmGet = _hasGM.get ? GM_getValue : function (key, def) {
        try {
            const raw = localStorage.getItem('dm_fallback_' + key);
            return raw === null ? def : raw;
        } catch (e) { return def; }
    };
    const gmSet = _hasGM.set ? GM_setValue : function (key, value) {
        try { localStorage.setItem('dm_fallback_' + key, String(value)); } catch (e) {}
    };
    const gmDelete = _hasGM.del ? GM_deleteValue : function (key) {
        try { localStorage.removeItem('dm_fallback_' + key); } catch (e) {}
    };
    const gmList = _hasGM.list ? GM_listValues : function () {
        try {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('dm_fallback_')) keys.push(k.replace('dm_fallback_', ''));
            }
            return keys;
        } catch (e) { return []; }
    };
    const gmNotify = _hasGM.notify ? GM_notification : function (opts) {
        try {
            if (window.Notification) {
                if (Notification.permission === 'granted') {
                    const n = new Notification(opts.title || '', { body: opts.text || '' });
                    if (opts.onclick) n.onclick = opts.onclick;
                } else if (Notification.permission !== 'denied') {
                    Notification.requestPermission();
                }
            }
        } catch (e) { /* تجاهل */ }
        console.log('[Delivery Monitor]', opts && opts.title, '-', opts && opts.text);
    };
    const gmAddStyle = _hasGM.style ? GM_addStyle : function (css) {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
        return style;
    };

    const STORAGE_KEYS = {
        STATE:               'dm_state_v6',
        THRESHOLD_MIN:       'dm_threshold_minutes',
        DEADLINE_HOUR:       'dm_deadline_hour',
        AUTO_REFRESH_ON:     'dm_autorefresh_on',
        AUTO_REFRESH_MIN:    'dm_autorefresh_minutes',
        SOUND_ON:            'dm_sound_on',
        HIDE_DONE:           'dm_hide_done',
        PRE_DEADLINE_WARN:   'dm_pre_deadline_warn',
        STOP_CHECK_ON:       'dm_stop_check_on',
        PANEL_SIZE:          'dm_panel_scale',
        PANEL_POS:           'dm_panel_pos',
        DAILY_ARCHIVE_PREFIX:'dm_archive_'
    };

    const CHECK_INTERVAL_MS    = 20000;
    const RECOVERY_DISPLAY_MS  = 15 * 60 * 1000;
    const MAX_ARCHIVE_DAYS     = 30;
    const MAX_LOG_ENTRIES      = 50;
    const MISSED_CHECKS_BEFORE_DONE = 3;

    // ترحيل تلقائي لمرة واحدة من localStorage إلى تخزين GM
    (function migrateFallbackData() {
        try {
            if (!_hasGM.get || !_hasGM.set) return;
            if (GM_getValue(STORAGE_KEYS.STATE, null) !== null) return;
            let migrated = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith('dm_fallback_')) {
                    GM_setValue(k.replace('dm_fallback_', ''), localStorage.getItem(k));
                    migrated++;
                }
            }
            if (migrated > 0) console.log('[Delivery Monitor] ✅ تم ترحيل ' + migrated + ' مفتاح من localStorage إلى تخزين GM');
        } catch (e) { /* تجاهل */ }
    })();

    function todayKey() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    function fmtTime(ts)    { return new Date(ts).toLocaleTimeString('ar-IQ'); }
    function fmtElapsed(ms) {
        const mins = Math.floor(ms / 60000);
        if (mins < 60) return `${mins} د`;
        const h = Math.floor(mins / 60), m = mins % 60;
        return `${h}س ${m}د`;
    }
    function gmGetBool(key, def) {
        const val = gmGet(key, null);
        if (val === null || val === undefined) return def;
        if (typeof val === 'boolean') return val;
        return String(val) === 'true';
    }
    function gmSetBool(key, val) { gmSet(key, val ? 'true' : 'false'); }

    // ══════════════════════════════════════════════════════════════
    //  📡 المراقب الخلفي (4.1.5): يعمل بدون الحاجة لفتح صفحة "قيد
    //  التوصيل" — أي تبويب مفتوح على موقع الوسيط (على أي صفحة) يجلب
    //  محتوى صفحة قيد التوصيل عبر الشبكة كل بضع دقائق، ويحسب نفس
    //  حسابات اللوحة الحيّة بالضبط (نفس مفاتيح التخزين، نفس منطق
    //  التوقف/الموعد النهائي)، فتبقى الإعدادات والأرقام محفوظة سواء
    //  فُتحت اللوحة يدوياً أو لا.
    // ══════════════════════════════════════════════════════════════
    const DELIVERING_ORDERS_PATH = '/cs/delivering-orders';
    const BG_POLL_MIN_KEY   = 'dm_bg_poll_minutes';
    const BG_LOCK_KEY       = 'dm_bg_lock_ts';
    const LIVE_HEARTBEAT_KEY = 'dm_live_heartbeat_ts';
    const LIVE_HEARTBEAT_FRESH_MS = 60 * 1000; // إذا فيه تبويب حيّ يفحص فعلياً خلال آخر دقيقة، الخلفي يتنحّى له

    function groupCellOf(row) {
        let cell = row.querySelector('td[colspan]');
        if (cell) return cell;
        if (/(^|\s)(group|dtrg)/.test(row.className || '')) return row.querySelector('td');
        return null;
    }
    function extractNameFromRow(row) {
        const cell = groupCellOf(row);
        if (!cell) return null;
        const text = cell.textContent.replace(/[٠-٩۰-۹]/g, ' ').replace(/\s+/g, ' ').trim();
        if (!text || text.length < 2) return null;
        const arabicRuns = text.match(/[\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+)*/g);
        if (!arabicRuns || arabicRuns.length === 0) return null;
        const cleanName = arabicRuns.join(' ').replace(/\s+/g, ' ').trim();
        return cleanName.length >= 2 ? cleanName : null;
    }
    function extractCountFromRow(row) {
        const cell = groupCellOf(row);
        if (!cell) return null;
        const text = cell.textContent.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
        const match = text.match(/\((\d+)\)/);
        return match ? parseInt(match[1]) : null;
    }
    function getRowsFromRoot(root) {
        const rowSet = new Set();
        root.querySelectorAll('table tbody tr').forEach(tr => { if (!tr.closest('#dm-panel')) rowSet.add(tr); });
        if (rowSet.size === 0) root.querySelectorAll('tbody tr').forEach(tr => { if (!tr.closest('#dm-panel')) rowSet.add(tr); });
        return Array.from(rowSet);
    }

    // ✅ نفس حساب اللوحة الحيّة تماماً (مرآة مطابقة لمنطق runCheck داخل الكلاس)
    // يُطبَّق هنا على الحالة المحفوظة عبر GM مباشرة، بدون الحاجة للوحة مفتوحة
    function processBackgroundRows(rows) {
        let raw = gmGet(STORAGE_KEYS.STATE, null);
        let state;
        try { state = raw ? JSON.parse(raw) : null; } catch (e) { state = null; }
        if (!state || typeof state !== 'object') state = { dateKey: todayKey(), mandoubs: {} };
        if (state.dateKey !== todayKey()) {
            // بداية يوم جديد: لا نؤرشف من هنا (تفادياً لتضارب الأرشفة مع اللوحة)؛ فقط نبدأ حالة نظيفة لليوم الجديد
            state = { dateKey: todayKey(), mandoubs: {} };
        }
        if (!state.mandoubs) state.mandoubs = {};

        const thresholdMinutes = parseInt(gmGet(STORAGE_KEYS.THRESHOLD_MIN, '10'), 10) || 10;
        const deadlineHour     = parseInt(gmGet(STORAGE_KEYS.DEADLINE_HOUR, '18'), 10) || 18;
        const preDeadlineWarn  = gmGetBool(STORAGE_KEYS.PRE_DEADLINE_WARN, true);

        const now         = Date.now();
        const thresholdMs = thresholdMinutes * 60 * 1000;
        const seenNames    = new Set();
        const newlyStopped = [];
        let matchedCount   = 0;

        rows.forEach(row => {
            const name = extractNameFromRow(row);
            if (!name) return;
            const count = extractCountFromRow(row);
            if (count === null) return;
            matchedCount++;
            seenNames.add(name);

            let m = state.mandoubs[name];
            if (!m) {
                state.mandoubs[name] = {
                    first: count, current: count,
                    lastProgressTs: now, firstSeenTs: now, lastUpdateTs: now,
                    notified: false, deadlineNotified: false, preDeadlineNotified: false,
                    present: true, stopCount: 0, stalledAt: null, missedChecks: 0
                };
                return;
            }
            const wasAbsent = !m.present;
            m.missedChecks = 0;
            m.lastUpdateTs = now;
            m.present = true;
            if (wasAbsent) { m.deadlineNotified = false; m.preDeadlineNotified = false; }

            if (count < m.current) {
                m.current = count;
                m.lastProgressTs = now;
                if (m.notified) { m.notified = false; m.stalledAt = null; m.recoveredUntil = now + RECOVERY_DISPLAY_MS; }
            } else if (count > m.current) {
                m.current = count;
            } else {
                const elapsed = now - m.lastProgressTs;
                if (elapsed >= thresholdMs && !m.notified) {
                    m.notified = true;
                    m.stalledAt = m.current;
                    m.stopCount = (m.stopCount || 0) + 1;
                    newlyStopped.push({ name, minutes: Math.round(elapsed / 60000) });
                }
            }
        });

        if (matchedCount === 0) {
            console.warn('[Delivery Monitor BG] ' + rows.length + ' صف بالجدول لكن لم يتم التعرف على أي مندوب — تُرك الفحص بدون حفظ لتفادي طمس بيانات صحيحة سابقة.');
            return;
        }

        const knownPresent = Object.values(state.mandoubs).filter(x => x.present).length;
        const partialRead  = knownPresent >= 4 && matchedCount < knownPresent / 2;
        if (!partialRead) {
            Object.keys(state.mandoubs).forEach(name => {
                const m = state.mandoubs[name];
                if (seenNames.has(name)) return;
                if (!m.present) return;
                m.missedChecks = (m.missedChecks || 0) + 1;
                if (m.missedChecks >= MISSED_CHECKS_BEFORE_DONE) { m.present = false; m.missedChecks = 0; }
            });
        }

        newlyStopped.forEach(s => {
            gmNotify({ title: `⚠️ المندوب ${s.name} متوقف`, text: `لم يتغيّر عدد طلباته منذ ${s.minutes} دقيقة (فحص خلفي بدون فتح الصفحة)`, timeout: 8000, onclick: () => window.focus() });
        });

        const d = new Date(now);
        const deadlineTs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), deadlineHour, 0, 0, 0).getTime();
        const preWarnTs  = deadlineTs - 30 * 60 * 1000;
        Object.entries(state.mandoubs).forEach(([name, m]) => {
            if (!m.present || m.current === 0) {
                m.deadlineNotified = true; m.preDeadlineNotified = true; return;
            }
            if (preDeadlineWarn && now >= preWarnTs && now < deadlineTs && !m.preDeadlineNotified) {
                m.preDeadlineNotified = true;
                gmNotify({ title: `⏳ ${name} — 30 دقيقة للموعد النهائي`, text: `الساعة ${deadlineHour}:00 تقترب وما زال لديه ${m.current} طلب (فحص خلفي)`, timeout: 8000, onclick: () => window.focus() });
            }
            if (now >= deadlineTs && !m.deadlineNotified) {
                m.deadlineNotified = true;
                gmNotify({ title: `⏰ ${name} تجاوز الموعد النهائي`, text: `الساعة ${deadlineHour}:00 وصلت وما زال لديه ${m.current} طلب (فحص خلفي)`, timeout: 8000, onclick: () => window.focus() });
            }
        });

        gmSet(STORAGE_KEYS.STATE, JSON.stringify(state));
        console.log(`[Delivery Monitor BG] ✅ فحص خلفي — ${matchedCount} مندوب من ${rows.length} صف، ${newlyStopped.length} متوقف جديد`);
    }

    function runBackgroundDeliveryCheck() {
        if (typeof GM_xmlhttpRequest === 'undefined') return; // بيئة بدون صلاحية الجلب عبر GM — لا يمكن العمل بالخلفية
        if (!gmGetBool(STORAGE_KEYS.STOP_CHECK_ON, true)) return; // المراقب موقوف كلياً من الإعدادات الرئيسية

        // إذا فيه تبويب حيّ يراقب صفحة "قيد التوصيل" فعلياً الآن (نبض حديث)، نتنحّى له تفادياً لازدواج الفحص
        const heartbeat = parseInt(gmGet(LIVE_HEARTBEAT_KEY, '0'), 10) || 0;
        if (Date.now() - heartbeat < LIVE_HEARTBEAT_FRESH_MS) return;

        // قفل بسيط بين التبويبات: تبويب واحد بس يقوم فعلياً بالجلب بكل دورة، الباقي يتجاهل
        const pollMinutes = parseInt(gmGet(BG_POLL_MIN_KEY, '5'), 10) || 5;
        const pollMs = Math.max(2, pollMinutes) * 60 * 1000;
        const lockTs = parseInt(gmGet(BG_LOCK_KEY, '0'), 10) || 0;
        if (Date.now() - lockTs < pollMs - 5000) return;
        gmSet(BG_LOCK_KEY, String(Date.now()));

        GM_xmlhttpRequest({
            method: 'GET',
            url: location.origin + DELIVERING_ORDERS_PATH,
            onload: function (res) {
                try {
                    const doc  = new DOMParser().parseFromString(res.responseText, 'text/html');
                    const rows = getRowsFromRoot(doc);
                    if (!rows.length) {
                        console.warn('[Delivery Monitor BG] لم يتم العثور على صفوف بالصفحة المجلوبة — تأكد من تسجيل الدخول، أو قد يكون شكل الصفحة تغيّر.');
                        return;
                    }
                    processBackgroundRows(rows);
                } catch (e) {
                    console.error('[Delivery Monitor BG] خطأ أثناء تحليل الصفحة المجلوبة:', e);
                }
            },
            onerror: function () {
                console.warn('[Delivery Monitor BG] فشل الجلب الخلفي لصفحة "قيد التوصيل" (شبكة/جلسة).');
            }
        });
    }

    function startBackgroundPoller() {
        // فحص أول بعد فارق زمني عشوائي قصير — يمنع تدافع كل التبويبات المفتوحة بنفس اللحظة
        setTimeout(runBackgroundDeliveryCheck, 4000 + Math.floor(Math.random() * 4000));
        // نتحقق كل دقيقة إن كان قد حان دور الفحص الفعلي؛ الفاصل الحقيقي بين عمليات الجلب يحدده القفل + الإعداد بالأعلى
        setInterval(runBackgroundDeliveryCheck, 60 * 1000);
    }

    // ✅ الدمج: بناء اللوحة الكاملة فقط بصفحة "قيد التوصيل"؛ أي صفحة أخرى
    // على موقع الوسيط تكتفي بتشغيل المراقب الخلفي أعلاه بدون أي واجهة
    if (location.href.indexOf(DELIVERING_ORDERS_PATH) === -1) {
        startBackgroundPoller();
        return;
    }

    // ✅ إصلاح: منع ظهور لوحتين عند التحميل المزدوج
    if (document.getElementById('dm-panel')) return;

    class DeliveryMonitor {
        constructor() {
            this.thresholdMinutes   = parseInt(gmGet(STORAGE_KEYS.THRESHOLD_MIN, 10)) || 10;
            this.deadlineHour       = parseInt(gmGet(STORAGE_KEYS.DEADLINE_HOUR, 18)) || 18;
            this.autoRefreshOn      = gmGetBool(STORAGE_KEYS.AUTO_REFRESH_ON, false);
            this.autoRefreshMinutes = parseInt(gmGet(STORAGE_KEYS.AUTO_REFRESH_MIN, 5)) || 5;
            this.soundOn            = gmGetBool(STORAGE_KEYS.SOUND_ON, true);
            this.hideDone           = gmGetBool(STORAGE_KEYS.HIDE_DONE, false);
            this.preDeadlineWarn    = gmGetBool(STORAGE_KEYS.PRE_DEADLINE_WARN, true);
            // ✅ (4.0.4): مفتاح تشغيل/إيقاف المراقب كاملاً — عند الإيقاف تختفي اللوحة من الشاشة
            this.monitorOn          = gmGetBool(STORAGE_KEYS.STOP_CHECK_ON, true);
            this.panelScale         = parseInt(gmGet(STORAGE_KEYS.PANEL_SIZE, '100')) || 100;

            this.isRunning         = false;
            this.checkTimer        = null;
            this.refreshTimer      = null;
            this.countdownTimer    = null;
            this.refreshAt         = null;
            this.searchFilter      = '';
            this.sortCol           = 'status';
            this.sortDir           = 1;
            this.lastCheckTs       = null;

            this.state = this.loadOrInitState();

            this.buildPanel();
            this.attachEvents();
            this.renderTable();
            this.updateStatsUI();
            this.addLog('✅ السكربت جاهز — تم تحميل البيانات المحفوظة');

            if (this.monitorOn) {
                this.start();
                if (this.autoRefreshOn) this.scheduleAutoRefresh();
            } else {
                this.applyMonitorState(); // إخفاء اللوحة فوراً إن كان المفتاح موقوفاً
            }
            // ✅ (4.0.4): مراقب خفيف يلتقط تغيير المفتاح من الإعدادات الرئيسية خلال ~3 ثوانٍ
            setInterval(() => this.applyMonitorState(), 3000);
        }

        loadOrInitState() {
            let raw = gmGet(STORAGE_KEYS.STATE, null);
            let state;
            try { state = raw ? JSON.parse(raw) : null; } catch (e) { state = null; }
            if (!state) state = { dateKey: todayKey(), mandoubs: {} };
            if (state.dateKey !== todayKey()) {
                this.archiveDay(state);
                state = { dateKey: todayKey(), mandoubs: {} };
            }
            this.normalizeStateKeys(state);
            return state;
        }

        normalizeStateKeys(state) {
            const map = state.mandoubs || {};
            Object.keys(map).forEach(key => {
                const stripped = key.replace(/[٠-٩۰-۹]/g, ' ');
                const runs  = stripped.match(/[\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+)*/g);
                const clean = runs ? runs.join(' ').replace(/\s+/g, ' ').trim() : '';
                if (!clean) { delete map[key]; return; }
                if (clean === key) return;
                if (!map[clean]) {
                    map[clean] = map[key];
                } else {
                    const a = map[clean], b = map[key];
                    const newer = (b.lastUpdateTs || 0) > (a.lastUpdateTs || 0) ? b : a;
                    newer.first     = Math.max(a.first || 0, b.first || 0);
                    newer.stopCount = (a.stopCount || 0) + (b.stopCount || 0);
                    newer.firstSeenTs = Math.min(a.firstSeenTs || Infinity, b.firstSeenTs || Infinity);
                    map[clean] = newer;
                }
                delete map[key];
            });
        }
        persistState() { gmSet(STORAGE_KEYS.STATE, JSON.stringify(this.state)); }

        archiveDay(oldState) {
            if (!oldState?.mandoubs || Object.keys(oldState.mandoubs).length === 0) return;
            gmSet(STORAGE_KEYS.DAILY_ARCHIVE_PREFIX + oldState.dateKey, JSON.stringify(oldState));
            const dates = this.listArchiveDates().slice(MAX_ARCHIVE_DAYS);
            dates.forEach(d => gmDelete(STORAGE_KEYS.DAILY_ARCHIVE_PREFIX + d));
        }

        getPageJQuery() {
            try { if (typeof unsafeWindow !== 'undefined' && unsafeWindow.jQuery) return unsafeWindow.jQuery; } catch (e) {}
            if (window.jQuery) return window.jQuery;
            return null;
        }

        ensureShowAllRows() {
            const $ = this.getPageJQuery();
            if (!$ || !$.fn?.dataTable) {
                if (!this._noJqLogged) { this.addLog('🔎 jQuery/DataTables غير محمّل — سيتم الاعتماد على DOM'); this._noJqLogged = true; }
                return;
            }
            try {
                let dtApi = null;
                const settingsArr = $.fn.dataTable.settings;
                if (settingsArr && settingsArr.length > 0) {
                    dtApi = new $.fn.dataTable.Api(settingsArr[0]);
                } else if ($.fn.dataTable.isDataTable('#example')) {
                    dtApi = $('#example').DataTable();
                }
                if (!dtApi) {
                    if (!this._noDtLogged) { this.addLog('🔎 لم يتم العثور على جدول DataTable مُفعّل'); this._noDtLogged = true; }
                    return;
                }

                const currentLen = dtApi.page.len();
                if (currentLen !== -1) {
                    dtApi.page.len(-1).draw(false);
                    this.addLog('🔧 عاد ترقيم الصفحات — تم ضبط الجدول لعرض كل المندوبين دفعة واحدة');
                }
            } catch (e) {
                if (!this._showAllErrLogged) { this.addLog('🔎 تعذر ضبط عرض كل الصفوف — ' + e.message); this._showAllErrLogged = true; }
            }
        }

        getAllRows() {
            this.ensureShowAllRows();
            const rowSet = new Set();
            document.querySelectorAll('table tbody tr').forEach(tr => { if (!tr.closest('#dm-panel')) rowSet.add(tr); });
            if (rowSet.size === 0) document.querySelectorAll('tbody tr').forEach(tr => { if (!tr.closest('#dm-panel')) rowSet.add(tr); });
            if (!this._loggedRowCount || this._lastRowCount !== rowSet.size) {
                this._lastRowCount = rowSet.size;
                this.addLog(`🔎 تم العثور على ${rowSet.size} صف بالجدول`);
                this._loggedRowCount = true;
            }
            return Array.from(rowSet);
        }

        _groupCell(row) {
            let cell = row.querySelector('td[colspan]');
            if (cell) return cell;
            if (/(^|\s)(group|dtrg)/.test(row.className || '')) return row.querySelector('td');
            return null;
        }
        extractName(row) {
            const cell = this._groupCell(row);
            if (!cell) return null;
            const text = cell.textContent.replace(/[٠-٩۰-۹]/g, ' ').replace(/\s+/g, ' ').trim();
            if (!text || text.length < 2) return null;
            const arabicRuns = text.match(/[\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+)*/g);
            if (!arabicRuns || arabicRuns.length === 0) return null;
            const cleanName = arabicRuns.join(' ').replace(/\s+/g, ' ').trim();
            return cleanName.length >= 2 ? cleanName : null;
        }
        extractCount(row) {
            const cell = this._groupCell(row);
            if (!cell) return null;
            const text = cell.textContent.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
            const match = text.match(/\((\d+)\)/);
            return match ? parseInt(match[1]) : null;
        }

        check() {
            if (!this.isRunning) return;
            try { this.runCheck(); }
            catch (e) {
                this.showDataWarning(true, 'حدث خطأ أثناء الفحص: ' + e.message);
                this.addLog('❌ خطأ غير متوقع: ' + e.message);
                console.error('Delivery Monitor error:', e);
            }
        }

        runCheck() {
            if (this.state.dateKey !== todayKey()) {
                this.archiveDay(this.state);
                this.state = { dateKey: todayKey(), mandoubs: {} };
                this.addLog('📅 بدأ يوم جديد — تمت أرشفة بيانات الأمس');
            }

            const rows = this.getAllRows();
            if (rows.length === 0) {
                this.showDataWarning(true, 'لم يتم العثور على أي صف — تحقق من أنك بصفحة "قيد التوصيل"');
                this.addLog('⚠️ لم يتم العثور على أي صف بالجدول');
                return;
            }
            this.showDataWarning(false);

            const now          = Date.now();
            const thresholdMs  = this.thresholdMinutes * 60 * 1000;
            const seenNames    = new Set();
            let newlyStopped   = [];
            let matchedCount   = 0;

            rows.forEach(row => {
                const name  = this.extractName(row);
                if (!name) return;
                const count = this.extractCount(row);
                if (count === null) return;
                matchedCount++;
                seenNames.add(name);

                let m = this.state.mandoubs[name];
                if (!m) {
                    this.state.mandoubs[name] = {
                        first: count, current: count,
                        lastProgressTs: now, firstSeenTs: now, lastUpdateTs: now,
                        notified: false, deadlineNotified: false, preDeadlineNotified: false,
                        present: true, stopCount: 0,
                        stalledAt: null,
                        missedChecks: 0
                    };
                    return;
                }

                const wasAbsent = !m.present;
                m.missedChecks  = 0;
                m.lastUpdateTs  = now;
                m.present       = true;
                if (wasAbsent) {
                    m.deadlineNotified    = false;
                    m.preDeadlineNotified = false;
                }

                if (count < m.current) {
                    const delivered = m.current - count;
                    m.current = count;
                    m.lastProgressTs = now;
                    if (m.notified) {
                        m.notified = false;
                        m.stalledAt = null;
                        m.recoveredUntil = now + RECOVERY_DISPLAY_MS;
                        this.addLog(`✅ ${name} كان متأخرًا وبدأ التوصيل — أنجز ${delivered} طلب (متبقي ${count})`);
                    }
                } else if (count > m.current) {
                    const added = count - m.current;
                    m.current = count;
                    this.addLog(`📦 ${name} استلم ${added} طلب إضافي — لا يُحتسب نشاطًا`);
                } else {
                    const elapsed = now - m.lastProgressTs;
                    if (elapsed >= thresholdMs && !m.notified) {
                        m.notified = true;
                        m.stalledAt = m.current;
                        m.stopCount = (m.stopCount || 0) + 1;
                        newlyStopped.push({ name, minutes: Math.round(elapsed / 60000) });
                    }
                }
            });

            if (matchedCount === 0) {
                this.showDataWarning(true, `${rows.length} صف بالجدول لكن لم يتم استخراج أي اسم — قد يكون شكل الجدول تغيّر`);
                this.addLog(`⚠️ ${rows.length} صف — 0 مندوب تم التعرف عليه`);
                const sampleCell = rows.map(r => this._groupCell(r)).find(c => c);
                if (sampleCell) this.addLog('🧪 عيّنة نص صف التجميع: "' + sampleCell.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) + '"');
                return;
            } else if (!this._loggedMatchCount || this._lastMatchCount !== matchedCount) {
                this._lastMatchCount = matchedCount;
                this._loggedMatchCount = true;
                this.addLog(`🔎 تم التعرف على ${matchedCount} مندوب من ${rows.length} صف`);
            }

            const knownPresent = Object.values(this.state.mandoubs).filter(x => x.present).length;
            const partialRead  = knownPresent >= 4 && matchedCount < knownPresent / 2;

            if (partialRead) {
                this.addLog(`⚠️ قراءة ناقصة محتملة (${matchedCount} من ${knownPresent} مندوب) — تم تجاهل تحديث "تم التختيم" لهذا الفحص`);
            } else {
                Object.keys(this.state.mandoubs).forEach(name => {
                    const m = this.state.mandoubs[name];
                    if (seenNames.has(name)) return;
                    if (!m.present) return;
                    m.missedChecks = (m.missedChecks || 0) + 1;
                    if (m.missedChecks >= MISSED_CHECKS_BEFORE_DONE) {
                        m.present = false;
                        m.missedChecks = 0;
                        this.addLog(`✅ ${name} تم التختيم (اختفى من القائمة)`);
                    }
                });
            }

            newlyStopped.forEach(s => this.notify(s.name, s.minutes));
            this.checkDeadline(now);

            this.lastCheckTs = now;
            gmSet(LIVE_HEARTBEAT_KEY, String(now)); // ✅ (4.1.5): إعلام أي مراقب خلفي بوجود تبويب حي يفحص فعلياً الآن
            this.persistState();
            this.renderTable();
            this.updateStatsUI();
            this.updateLastCheckUI();
        }

        checkDeadline(now) {
            const d = new Date(now);
            const deadlineTs   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), this.deadlineHour, 0, 0, 0).getTime();
            const preWarnTs    = deadlineTs - 30 * 60 * 1000;

            Object.entries(this.state.mandoubs).forEach(([name, m]) => {
                if (!m.present || m.current === 0) {
                    if (!m.deadlineNotified)  m.deadlineNotified  = true;
                    if (!m.preDeadlineNotified) m.preDeadlineNotified = true;
                    return;
                }

                if (this.preDeadlineWarn && now >= preWarnTs && now < deadlineTs && !m.preDeadlineNotified) {
                    m.preDeadlineNotified = true;
                    this.notifyPreDeadline(name, m.current);
                }

                if (now >= deadlineTs && !m.deadlineNotified) {
                    m.deadlineNotified = true;
                    this.notifyDeadline(name, m.current);
                }
            });
        }

        notify(name, minutes) {
            const title   = `⚠️ المندوب ${name} متوقف`;
            const message = `لم يتغيّر عدد طلباته منذ ${minutes} دقيقة`;
            gmNotify({ title, text: message, timeout: 8000, onclick: () => window.focus() });
            if (this.soundOn) this.playBeep(880, 0.4);
            this.addLog(`⚠️ ${name} متوقف منذ ${minutes} دقيقة`);
        }
        notifyPreDeadline(name, remaining) {
            const title   = `⏳ ${name} — 30 دقيقة للموعد النهائي`;
            const message = `الساعة ${this.deadlineHour}:00 تقترب وما زال لديه ${remaining} طلب`;
            gmNotify({ title, text: message, timeout: 8000, onclick: () => window.focus() });
            if (this.soundOn) this.playBeep(660, 0.3);
            this.addLog(`⏳ ${name} — 30 دقيقة للموعد — متبقي ${remaining} طلب`);
        }
        notifyDeadline(name, remaining) {
            const title   = `⏰ ${name} تجاوز الموعد النهائي`;
            const message = `الساعة ${this.deadlineHour}:00 وصلت وما زال لديه ${remaining} طلب`;
            gmNotify({ title, text: message, timeout: 8000, onclick: () => window.focus() });
            if (this.soundOn) this.playBeep(440, 0.6);
            this.addLog(`⏰ ${name} تجاوز الموعد — متبقي ${remaining} طلب`);
        }

        playBeep(freq = 880, duration = 0.3) {
            try {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                const o   = ctx.createOscillator();
                const g   = ctx.createGain();
                o.connect(g); g.connect(ctx.destination);
                o.frequency.value = freq;
                g.gain.setValueAtTime(0.3, ctx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
                o.start(); o.stop(ctx.currentTime + duration);
                setTimeout(() => ctx.close(), (duration + 0.1) * 1000);
            } catch (e) { /* تجاهل إذا لم يكن AudioContext متاحاً */ }
        }

        start() {
            this.isRunning = true;
            if (this.checkTimer) clearInterval(this.checkTimer);
            this.check();
            this.checkTimer = setInterval(() => this.check(), CHECK_INTERVAL_MS);
            this.updateRunButton();
        }
        stop() {
            this.isRunning = false;
            if (this.checkTimer) clearInterval(this.checkTimer);
            this.updateRunButton();
        }
        toggleRun() {
            this.isRunning ? this.stop() : this.start();
            this.addLog(this.isRunning ? '▶️ تم بدء المراقبة' : '⏹️ تم إيقاف المراقبة');
        }

        // ✅ (4.0.4): تطبيق حالة مفتاح المراقب القادم من الإعدادات الرئيسية ⚙️
        // إيقاف = اللوحة تختفي من الشاشة كلياً + يتوقف كل الفحص والتحديث التلقائي
        // تشغيل = اللوحة تظهر ويستأنف الفحص فوراً
        applyMonitorState() {
            const on = gmGetBool(STORAGE_KEYS.STOP_CHECK_ON, true);
            const panel = document.getElementById('dm-panel');
            if (panel) { panel.style.display = on ? '' : 'none'; }
            if (on === this.monitorOn) { return; } // لا تغيير بالحالة
            this.monitorOn = on;
            if (on) {
                this.start(); // يفحص فوراً ثم كل 20 ثانية
                if (this.autoRefreshOn) { this.scheduleAutoRefresh(); }
                this.addLog('▶️ تم تشغيل المراقب (من الإعدادات الرئيسية)');
            } else {
                this.stop();
                if (this.refreshTimer)   { clearTimeout(this.refreshTimer); }
                if (this.countdownTimer) { clearInterval(this.countdownTimer); }
                this.refreshAt = null;
                this.addLog('⏹️ تم إيقاف المراقب وإخفاء اللوحة (من الإعدادات الرئيسية)');
            }
        }
        resetToday() {
            this.state = { dateKey: todayKey(), mandoubs: {} };
            this.persistState();
            this.renderTable();
            this.updateStatsUI();
            this.addLog('🔄 تمت إعادة تعيين بيانات اليوم');
        }
        setThreshold(minutes) {
            this.thresholdMinutes = minutes;
            gmSet(STORAGE_KEYS.THRESHOLD_MIN, minutes);
            this.addLog(`⏱️ مدة التوقف = ${minutes} دقيقة`);
        }
        setDeadlineHour(hour) {
            this.deadlineHour = hour;
            gmSet(STORAGE_KEYS.DEADLINE_HOUR, hour);
            this.addLog(`⏰ الموعد النهائي = الساعة ${hour}:00`);
        }

        scheduleAutoRefresh() {
            if (this.refreshTimer)   clearTimeout(this.refreshTimer);
            if (this.countdownTimer) clearInterval(this.countdownTimer);
            this.refreshAt = Date.now() + this.autoRefreshMinutes * 60 * 1000;
            this.refreshTimer = setTimeout(() => {
                this.addLog('🔄 تحديث تلقائي...');
                location.reload();
            }, this.autoRefreshMinutes * 60 * 1000);
            this.countdownTimer = setInterval(() => this.updateCountdownUI(), 1000);
            this.updateCountdownUI();
        }
        updateCountdownUI() {
            const el = document.getElementById('dm-countdown');
            if (!el) return;
            if (!this.autoRefreshOn || !this.refreshAt) { el.textContent = ''; return; }
            const rem = Math.max(0, Math.round((this.refreshAt - Date.now()) / 1000));
            const m = Math.floor(rem / 60), s = rem % 60;
            el.textContent = `تحديث في: ${m}:${String(s).padStart(2,'0')}`;
        }
        updateLastCheckUI() {
            const el = document.getElementById('dm-last-check');
            if (el && this.lastCheckTs) el.textContent = `آخر فحص: ${fmtTime(this.lastCheckTs)}`;
        }

        buildPanel() {
            this.addStyles();
            const panel = document.createElement('div');
            panel.id = 'dm-panel';
            panel.innerHTML = `
                <div class="dm-header" id="dm-header">
                    <div class="dm-header-left">
                        <span class="dm-dot" id="dm-dot"></span>
                        <span class="dm-title">مراقب التوصيل</span>
                    </div>
                    <div class="dm-header-right">
                        <button id="dm-size-down" class="dm-icon-btn" title="تصغير اللوحة">−</button>
                        <button id="dm-size-up"   class="dm-icon-btn" title="تكبير اللوحة">+</button>
                        <button id="dm-run-toggle" class="dm-run-btn">إيقاف</button>
                        <button id="dm-collapse" class="dm-icon-btn" title="طي/فتح">‹</button>
                    </div>
                </div>

                <div class="dm-body">
                    <div id="dm-warning" class="dm-warning" style="display:none">
                        ⚠️ لم يتم العثور على بيانات بالجدول
                    </div>

                    <div class="dm-summary">
                        <div class="dm-sum-item">
                            <span id="dm-sum-total"   class="dm-sum-num">0</span>
                            <span class="dm-sum-label">الإجمالي</span>
                        </div>
                        <div class="dm-sum-item">
                            <span id="dm-sum-stopped" class="dm-sum-num dm-c-red">0</span>
                            <span class="dm-sum-label">متوقف</span>
                        </div>
                        <div class="dm-sum-item">
                            <span id="dm-sum-done"    class="dm-sum-num dm-c-blue">0</span>
                            <span class="dm-sum-label">تم التختيم</span>
                        </div>
                        <div class="dm-sum-item">
                            <span id="dm-sum-qaid" class="dm-sum-num dm-c-green">—</span>
                            <span class="dm-sum-label">القيد</span>
                        </div>
                    </div>

                    <div class="dm-meta-bar">
                        <span id="dm-last-check" class="dm-meta-txt"></span>
                        <span id="dm-countdown"  class="dm-meta-txt dm-c-orange"></span>
                    </div>

                    <div class="dm-tabs">
                        <button class="dm-tab active" data-tab="live">📋 المراقبة</button>
                        <button class="dm-tab" data-tab="settings">⚙️ الإعدادات</button>
                        <button class="dm-tab" data-tab="archive">📊 الأرشيف</button>
                    </div>

                    <!-- تبويب المراقبة -->
                    <div class="dm-panel-tab" id="dm-tab-live">
                        <div class="dm-search-row">
                            <input type="text" id="dm-search" class="dm-search" placeholder="🔍 ابحث عن مندوب...">
                            <label class="dm-hide-done-label" title="إخفاء المُختَّمين">
                                <input type="checkbox" id="dm-hide-done-check" ${this.hideDone ? 'checked' : ''}>
                                إخفاء ✅
                            </label>
                        </div>
                        <button id="dm-copy-stopped" class="dm-btn dm-btn-copy" title="نسخ أسماء المتوقفين للحافظة">
                            📋 نسخ المتوقفين
                        </button>
                        <div class="dm-table-wrap">
                            <table class="dm-live-table">
                                <thead>
                                    <tr>
                                        <th class="dm-sort-th" data-col="name">المندوب <span class="dm-sort-icon"></span></th>
                                        <th class="dm-sort-th" data-col="first">كان <span class="dm-sort-icon"></span></th>
                                        <th class="dm-sort-th" data-col="current">الآن <span class="dm-sort-icon"></span></th>
                                        <th class="dm-sort-th" data-col="status">الحالة <span class="dm-sort-icon"></span></th>
                                    </tr>
                                </thead>
                                <tbody id="dm-live-tbody"></tbody>
                            </table>
                        </div>
                    </div>

                    <!-- تبويب الإعدادات -->
                    <div class="dm-panel-tab" id="dm-tab-settings" style="display:none">
                        <div class="dm-field">
                            <label>مدة التوقف قبل التنبيه (دقيقة)</label>
                            <div class="dm-field-row">
                                <input type="number" id="dm-threshold-input" min="1" max="180" value="${this.thresholdMinutes}">
                                <button id="dm-threshold-save" class="dm-btn dm-btn-sm">حفظ</button>
                            </div>
                            <p class="dm-hint">تُحسب من آخر نقصان فعلي بعدد الطلبات</p>
                        </div>
                        <div class="dm-field">
                            <label>ساعة الموعد النهائي (0-23)</label>
                            <div class="dm-field-row">
                                <input type="number" id="dm-deadline-input" min="0" max="23" value="${this.deadlineHour}">
                                <button id="dm-deadline-save" class="dm-btn dm-btn-sm">حفظ</button>
                            </div>
                            <p class="dm-hint">مثال: 18 = الساعة 6 عصرًا</p>
                        </div>
                        <div class="dm-field">
                            <label class="dm-checkbox-label">
                                <input type="checkbox" id="dm-autorefresh-check" ${this.autoRefreshOn ? 'checked' : ''}>
                                تحديث تلقائي للصفحة كل
                                <input type="number" id="dm-autorefresh-min" min="1" max="120" value="${this.autoRefreshMinutes}" style="width:50px">
                                دقيقة
                            </label>
                        </div>
                        <div class="dm-field">
                            <label class="dm-checkbox-label">
                                <input type="checkbox" id="dm-sound-check" ${this.soundOn ? 'checked' : ''}>
                                تنبيه صوتي عند التوقف
                            </label>
                        </div>
                        <div class="dm-field">
                            <label class="dm-checkbox-label">
                                <input type="checkbox" id="dm-predeadline-check" ${this.preDeadlineWarn ? 'checked' : ''}>
                                تحذير قبل 30 دقيقة من الموعد النهائي
                            </label>
                        </div>
                        <div class="dm-field-row" style="gap:6px">
                            <button id="dm-check-now" class="dm-btn dm-btn-sm">🔍 فحص الآن</button>
                            <button id="dm-reset"     class="dm-btn dm-btn-sm dm-btn-danger">🗑️ تصفير اليوم</button>
                        </div>
                        <div class="dm-field" style="margin-top:10px">
                            <button id="dm-backup-btn"  class="dm-btn dm-btn-sm dm-btn-ghost" style="width:100%;margin-bottom:6px">💾 نسخ احتياطي (JSON)</button>
                            <label class="dm-btn dm-btn-sm dm-btn-ghost" style="width:100%;text-align:center;cursor:pointer">
                                📂 استعادة نسخة احتياطية
                                <input type="file" id="dm-restore-input" accept=".json" style="display:none">
                            </label>
                        </div>
                        <div class="dm-field">
                            <button id="dm-log-toggle" class="dm-btn dm-btn-sm dm-btn-ghost">📋 عرض سجل الأحداث</button>
                            <div id="dm-log-content" class="dm-log-content" style="display:none"></div>
                        </div>
                    </div>

                    <!-- تبويب الأرشيف -->
                    <div class="dm-panel-tab" id="dm-tab-archive" style="display:none">
                        <button id="dm-weekly-btn" class="dm-btn dm-btn-ghost" style="width:100%;margin-bottom:10px;font-size:11px">📅 إحصائيات الأسبوع</button>
                        <div id="dm-weekly-content" style="display:none;margin-bottom:10px"></div>
                        <div class="dm-field-row">
                            <select id="dm-archive-select" class="dm-select"></select>
                        </div>
                        <div class="dm-field-row" style="margin-top:6px">
                            <button id="dm-archive-export-csv"  class="dm-btn dm-btn-sm">⬇️ CSV</button>
                            <button id="dm-archive-export-json" class="dm-btn dm-btn-sm dm-btn-ghost">⬇️ JSON</button>
                        </div>
                        <div id="dm-archive-stats" class="dm-archive-stats"></div>
                        <div id="dm-archive-table-wrap"></div>
                    </div>
                </div>
            `;
            document.body.insertBefore(panel, document.body.firstChild);
            try {
                const savedPos = JSON.parse(gmGet(STORAGE_KEYS.PANEL_POS, 'null'));
                if (savedPos?.left) { panel.style.left = savedPos.left; panel.style.top = savedPos.top; }
            } catch(e) {}
            this.applyPanelWidth();
        }

        attachEvents() {
            document.getElementById('dm-collapse').addEventListener('click', () => {
                const body = document.querySelector('#dm-panel .dm-body');
                const btn  = document.getElementById('dm-collapse');
                const collapsed = body.style.display === 'none';
                body.style.display = collapsed ? 'block' : 'none';
                btn.textContent = collapsed ? '‹' : '›';
            });

            document.getElementById('dm-size-down').addEventListener('click', () => {
                if (this.panelScale > 60) { this.panelScale = Math.max(60, this.panelScale - 15); this.applyPanelWidth(); }
            });
            document.getElementById('dm-size-up').addEventListener('click', () => {
                this.panelScale += 15; this.applyPanelWidth();
            });

            this.initDraggable();

            document.getElementById('dm-copy-stopped').addEventListener('click', () => this.copyStoppedAgents());

            document.getElementById('dm-run-toggle').addEventListener('click', () => this.toggleRun());
            document.getElementById('dm-check-now').addEventListener('click', () => {
                this.isRunning = true; this.check(); this.updateRunButton();
            });
            document.getElementById('dm-reset').addEventListener('click', () => {
                if (confirm('تصفير بيانات اليوم بالكامل؟')) this.resetToday();
            });

            document.querySelectorAll('.dm-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    document.querySelectorAll('.dm-tab').forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.dm-panel-tab').forEach(p => p.style.display = 'none');
                    tab.classList.add('active');
                    document.getElementById('dm-tab-' + tab.dataset.tab).style.display = 'block';
                    if (tab.dataset.tab === 'archive') this.populateArchiveTab();
                });
            });

            document.getElementById('dm-search').addEventListener('input', (e) => {
                this.searchFilter = e.target.value.trim();
                this.renderTable();
            });

            document.querySelectorAll('.dm-sort-th').forEach(th => {
                th.addEventListener('click', () => {
                    const col = th.dataset.col;
                    if (this.sortCol === col) { this.sortDir *= -1; }
                    else { this.sortCol = col; this.sortDir = 1; }
                    this.renderTable();
                    this.updateSortIcons();
                });
            });

            document.getElementById('dm-hide-done-check').addEventListener('change', (e) => {
                this.hideDone = e.target.checked;
                gmSetBool(STORAGE_KEYS.HIDE_DONE, this.hideDone);
                this.renderTable();
            });

            document.getElementById('dm-threshold-save').addEventListener('click', () => {
                const val = parseInt(document.getElementById('dm-threshold-input').value);
                if (val > 0 && val <= 180) this.setThreshold(val);
                else alert('أدخل رقمًا بين 1 و 180');
            });
            document.getElementById('dm-deadline-save').addEventListener('click', () => {
                const val = parseInt(document.getElementById('dm-deadline-input').value);
                if (val >= 0 && val <= 23) this.setDeadlineHour(val);
                else alert('أدخل ساعة بين 0 و 23');
            });
            document.getElementById('dm-autorefresh-check').addEventListener('change', (e) => {
                this.autoRefreshOn = e.target.checked;
                gmSetBool(STORAGE_KEYS.AUTO_REFRESH_ON, this.autoRefreshOn);
                if (this.autoRefreshOn) {
                    this.scheduleAutoRefresh();
                } else {
                    if (this.refreshTimer)   clearTimeout(this.refreshTimer);
                    if (this.countdownTimer) clearInterval(this.countdownTimer);
                    this.refreshAt = null;
                    this.updateCountdownUI();
                }
            });
            document.getElementById('dm-autorefresh-min').addEventListener('change', (e) => {
                const val = parseInt(e.target.value);
                if (val > 0 && val <= 120) {
                    this.autoRefreshMinutes = val;
                    gmSet(STORAGE_KEYS.AUTO_REFRESH_MIN, val);
                    if (this.autoRefreshOn) this.scheduleAutoRefresh();
                }
            });
            document.getElementById('dm-sound-check').addEventListener('change', (e) => {
                this.soundOn = e.target.checked;
                gmSetBool(STORAGE_KEYS.SOUND_ON, this.soundOn);
                if (this.soundOn) this.playBeep(880, 0.2);
            });
            document.getElementById('dm-predeadline-check').addEventListener('change', (e) => {
                this.preDeadlineWarn = e.target.checked;
                gmSetBool(STORAGE_KEYS.PRE_DEADLINE_WARN, this.preDeadlineWarn);
            });

            document.getElementById('dm-log-toggle').addEventListener('click', () => {
                const el = document.getElementById('dm-log-content');
                el.style.display = el.style.display === 'none' ? 'block' : 'none';
            });

            document.getElementById('dm-backup-btn').addEventListener('click', () => this.exportBackup());

            document.getElementById('dm-restore-input').addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const data = JSON.parse(ev.target.result);
                        if (confirm(`استعادة ${Object.keys(data).length} مفتاح من النسخة الاحتياطية؟ سيُستبدل الكل.`)) {
                            Object.entries(data).forEach(([k, v]) => gmSet(k, v));
                            this.state = this.loadOrInitState();
                            this.renderTable();
                            this.updateStatsUI();
                            this.addLog('📂 تمت الاستعادة من النسخة الاحتياطية');
                        }
                    } catch (err) { alert('ملف غير صالح: ' + err.message); }
                };
                reader.readAsText(file);
                e.target.value = '';
            });

            document.getElementById('dm-weekly-btn').addEventListener('click', () => {
                const el = document.getElementById('dm-weekly-content');
                const visible = el.style.display !== 'none';
                el.style.display = visible ? 'none' : 'block';
                if (!visible) this.renderWeeklyStats();
            });

            document.getElementById('dm-archive-export-csv').addEventListener('click', () => {
                const sel  = document.getElementById('dm-archive-select').value;
                const data = this._getArchiveData(sel);
                this.exportCSV(data.mandoubs || {}, sel === '__today__' ? this.state.dateKey : sel);
            });
            document.getElementById('dm-archive-export-json').addEventListener('click', () => {
                const sel  = document.getElementById('dm-archive-select').value;
                const data = this._getArchiveData(sel);
                this.exportJSON(data.mandoubs || {}, sel === '__today__' ? this.state.dateKey : sel);
            });
        }

        _getArchiveData(sel) {
            if (sel === '__today__') return this.state;
            try { return JSON.parse(gmGet(STORAGE_KEYS.DAILY_ARCHIVE_PREFIX + sel, '{}')); }
            catch (e) { return { mandoubs: {} }; }
        }

        updateRunButton() {
            const btn = document.getElementById('dm-run-toggle');
            const dot = document.getElementById('dm-dot');
            if (!btn || !dot) return;
            btn.textContent = this.isRunning ? 'إيقاف' : 'تشغيل';
            btn.className   = 'dm-run-btn ' + (this.isRunning ? 'dm-run-on' : 'dm-run-off');
            dot.className   = 'dm-dot ' + (this.isRunning ? 'dm-dot-on' : 'dm-dot-off');
        }

        showDataWarning(show, message) {
            const el = document.getElementById('dm-warning');
            if (!el) return;
            el.style.display = show ? 'block' : 'none';
            if (show && message) el.textContent = '⚠️ ' + message;
        }

        updateSortIcons() {
            document.querySelectorAll('.dm-sort-th').forEach(th => {
                const icon = th.querySelector('.dm-sort-icon');
                if (!icon) return;
                if (th.dataset.col === this.sortCol) {
                    icon.textContent = this.sortDir === 1 ? ' ▲' : ' ▼';
                } else {
                    icon.textContent = '';
                }
            });
        }

        computeStatus(m, now, thresholdMs) {
            if (!m.present) return 'done';
            const elapsed = now - m.lastProgressTs;
            if (elapsed >= thresholdMs) return 'stopped';
            if (m.recoveredUntil && now < m.recoveredUntil) return 'recovered';
            return 'active';
        }

        // ✅ (4.0.5): قراءة "القيد" = إجمالي المدخلات من شريط معلومات الجدول
        // أسفل الصفحة: <div class="dataTables_info" id="example_info">عرض 1 إلى 511 من اصل 511 مدخل</div>
        readTotalEntries() {
            let el = document.querySelector('#example_info');
            if (!el) {
                // احتياط: أي شريط معلومات DataTables خارج لوحة المراقب
                const all = document.querySelectorAll('.dataTables_info');
                for (let i = 0; i < all.length; i++) {
                    if (!all[i].closest('#dm-panel')) { el = all[i]; break; }
                }
            }
            if (!el) return null;
            // تحويل الأرقام العربية الشرقية إن وُجدت، ثم التقاط الرقم بعد "من اصل/أصل"
            const text = el.textContent.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
            const m = text.match(/من\s*[اأ]صل\s*([\d,]+)/);
            if (m) return parseInt(m[1].replace(/,/g, ''), 10);
            // احتياط أخير: آخر رقم بالنص (صيغة الشريط قد تتغير)
            const nums = text.match(/[\d,]+/g);
            if (nums && nums.length) return parseInt(nums[nums.length - 1].replace(/,/g, ''), 10);
            return null;
        }

        renderTable() {
            const tbody = document.getElementById('dm-live-tbody');
            if (!tbody) return;

            const now        = Date.now();
            const thresholdMs = this.thresholdMinutes * 60 * 1000;
            const d          = new Date(now);
            const deadlineTs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), this.deadlineHour, 0, 0, 0).getTime();
            const pastDeadline = now >= deadlineTs;

            const statusOrder = { stopped: 0, recovered: 1, active: 2, done: 3 };

            let entries = Object.entries(this.state.mandoubs);

            if (this.searchFilter) {
                const f = this.searchFilter.toLowerCase();
                entries = entries.filter(([name]) => name.toLowerCase().includes(f));
            }
            if (this.hideDone) {
                entries = entries.filter(([, m]) => this.computeStatus(m, now, thresholdMs) !== 'done');
            }

            if (entries.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="dm-empty">لا توجد بيانات</td></tr>`;
                return;
            }

            entries.sort((a, b) => {
                const [nameA, mA] = a, [nameB, mB] = b;
                const sA = this.computeStatus(mA, now, thresholdMs);
                const sB = this.computeStatus(mB, now, thresholdMs);
                let cmp = 0;
                switch (this.sortCol) {
                    case 'name':    cmp = nameA.localeCompare(nameB, 'ar'); break;
                    case 'first':   cmp = mA.first - mB.first;              break;
                    case 'current': cmp = mA.current - mB.current;          break;
                    case 'status':
                    default:
                        cmp = statusOrder[sA] - statusOrder[sB];
                        if (cmp === 0) cmp = (now - mA.lastProgressTs) > (now - mB.lastProgressTs) ? 1 : -1;
                        break;
                }
                return cmp * this.sortDir;
            });

            tbody.innerHTML = entries.map(([name, m]) => {
                const status  = this.computeStatus(m, now, thresholdMs);
                const elapsed = now - m.lastProgressTs;

                let badge;
                if (status === 'done')
                    badge = `<span class="dm-badge dm-badge-blue">✅ تم التختيم</span>`;
                else if (status === 'stopped')
                    badge = `<span class="dm-badge dm-badge-red">🔴 متوقف ${fmtElapsed(elapsed)}</span>`;
                else if (status === 'recovered')
                    badge = `<span class="dm-badge dm-badge-yellow">🟡 كان متأخرًا - بدأ التوصيل</span>`;
                else
                    badge = `<span class="dm-badge dm-badge-green">🟢 نشط</span>`;

                if (status !== 'done' && pastDeadline && m.current > 0)
                    badge += ` <span class="dm-badge dm-badge-orange">⏰ متبقي ${m.current}</span>`;

                const pct     = m.first > 0 ? Math.min(100, Math.round((1 - m.current / m.first) * 100)) : 0;
                const barColor = status === 'stopped' ? '#ef4444' : status === 'done' ? '#3b82f6' : '#22c55e';
                const progressBar = `
                    <div class="dm-progress-wrap">
                        <div class="dm-progress-bar" style="width:${pct}%;background:${barColor}"></div>
                    </div>`;

                let stallNote = '';
                if (status === 'stopped' && m.stalledAt != null) {
                    const addedWhileStopped = m.current - m.stalledAt;
                    stallNote = `<div class="dm-stall-note">توقف عند ${m.stalledAt}${addedWhileStopped > 0 ? ` <span class="dm-c-orange">(+${addedWhileStopped} جديد)</span>` : ''}</div>`;
                }

                return `<tr>
                    <td class="dm-name">
                        ${escapeHtml(name)}
                        ${m.stopCount > 0 ? `<span class="dm-stop-count">${m.stopCount}x</span>` : ''}
                        ${progressBar}
                    </td>
                    <td>${m.first}</td>
                    <td>${m.current}${stallNote}</td>
                    <td>${badge}</td>
                </tr>`;
            }).join('');

            this.updateSortIcons();
        }

        updateStatsUI() {
            const now        = Date.now();
            const thresholdMs = this.thresholdMinutes * 60 * 1000;
            const entries    = Object.values(this.state.mandoubs);
            const total      = entries.length;
            const stopped    = entries.filter(m => this.computeStatus(m, now, thresholdMs) === 'stopped').length;
            const done       = entries.filter(m => this.computeStatus(m, now, thresholdMs) === 'done').length;
            // ✅ (4.0.5): القيد من شريط معلومات الجدول بدل عداد المُنجزة
            const qaid       = this.readTotalEntries();

            document.getElementById('dm-sum-total').textContent     = total;
            document.getElementById('dm-sum-stopped').textContent   = stopped;
            document.getElementById('dm-sum-done').textContent      = done;
            document.getElementById('dm-sum-qaid').textContent      = (qaid !== null) ? qaid : '—';
            this.updateRunButton();
        }

        addLog(message) {
            const logContent = document.getElementById('dm-log-content');
            if (!logContent) return;
            const entry = document.createElement('div');
            entry.className = 'dm-log-entry';
            entry.innerHTML = `<span class="dm-time">${fmtTime(Date.now())}</span> ${message}`;
            logContent.insertBefore(entry, logContent.firstChild);
            while (logContent.children.length > MAX_LOG_ENTRIES) logContent.removeChild(logContent.lastChild);
        }

        listArchiveDates() {
            return gmList()
                .filter(k => k.startsWith(STORAGE_KEYS.DAILY_ARCHIVE_PREFIX))
                .map(k => k.replace(STORAGE_KEYS.DAILY_ARCHIVE_PREFIX, ''))
                .sort((a, b) => b.localeCompare(a));
        }

        populateArchiveTab() {
            const select = document.getElementById('dm-archive-select');
            const dates  = this.listArchiveDates();
            select.innerHTML = `<option value="__today__">اليوم (${this.state.dateKey})</option>` +
                dates.map(d => `<option value="${d}">${d}</option>`).join('');
            select.onchange = () => this.renderArchiveTable(select.value);
            this.renderArchiveTable('__today__');
        }

        renderArchiveTable(dateKey) {
            const data    = this._getArchiveData(dateKey);
            const entries = Object.entries(data.mandoubs || {});
            const wrap    = document.getElementById('dm-archive-table-wrap');
            const stats   = document.getElementById('dm-archive-stats');

            if (entries.length === 0) {
                wrap.innerHTML  = `<div class="dm-empty">لا توجد بيانات لهذا اليوم</div>`;
                stats.innerHTML = '';
                return;
            }

            entries.sort((a, b) => (a[1].current - a[1].first) - (b[1].current - b[1].first));

            const totalDelivered = entries.reduce((s, [, m]) => s + Math.max(0, m.first - m.current), 0);
            const avg            = entries.length > 0 ? Math.round(totalDelivered / entries.length) : 0;
            const topEntry       = entries.reduce((best, e) => {
                const d = Math.max(0, e[1].first - e[1].current);
                return d > (best ? Math.max(0, best[1].first - best[1].current) : -1) ? e : best;
            }, null);

            stats.innerHTML = `
                <div class="dm-archive-stat-grid">
                    <div class="dm-archive-stat"><span class="dm-sum-num dm-c-green">${totalDelivered}</span><span class="dm-sum-label">إجمالي المُنجزة</span></div>
                    <div class="dm-archive-stat"><span class="dm-sum-num">${entries.length}</span><span class="dm-sum-label">عدد المندوبين</span></div>
                    <div class="dm-archive-stat"><span class="dm-sum-num dm-c-blue">${avg}</span><span class="dm-sum-label">متوسط/مندوب</span></div>
                    <div class="dm-archive-stat"><span class="dm-sum-num dm-c-orange" title="${topEntry ? topEntry[0] : ''}">${topEntry ? Math.max(0, topEntry[1].first - topEntry[1].current) : 0}</span><span class="dm-sum-label">الأفضل</span></div>
                </div>
                ${topEntry ? `<div class="dm-archive-best">🏆 الأفضل: <strong>${escapeHtml(topEntry[0])}</strong> — أنجز ${Math.max(0,topEntry[1].first-topEntry[1].current)} طلباً</div>` : ''}
            `;

            wrap.innerHTML = `
                <div class="dm-table-wrap">
                <table class="dm-live-table">
                    <thead><tr><th>المندوب</th><th>كان</th><th>أصبح</th><th>أنجز</th><th>توقف</th></tr></thead>
                    <tbody>
                        ${entries.map(([name, m]) => {
                            const delivered = Math.max(0, m.first - m.current);
                            return `<tr>
                                <td class="dm-name">${escapeHtml(name)}</td>
                                <td>${m.first}</td>
                                <td>${m.current}</td>
                                <td class="dm-c-green">${delivered}</td>
                                <td class="${m.stopCount > 0 ? 'dm-c-red' : 'dm-c-gray'}">${m.stopCount || 0}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
                </div>`;
        }

        exportCSV(mandoubs, dateLabel) {
            let csv = '\uFEFF' + 'الاسم,كان,أصبح,أنجز,مرات التوقف\n';
            Object.entries(mandoubs).forEach(([name, m]) => {
                const delivered = Math.max(0, m.first - m.current);
                csv += `"${name.replace(/"/g,'""')}",${m.first},${m.current},${delivered},${m.stopCount||0}\n`;
            });
            this._downloadBlob(csv, `تقرير_المندوبين_${dateLabel}.csv`, 'text/csv;charset=utf-8;');
            this.addLog(`⬇️ تم تصدير CSV — ${dateLabel}`);
        }

        exportJSON(mandoubs, dateLabel) {
            const json = JSON.stringify(mandoubs, null, 2);
            this._downloadBlob(json, `تقرير_المندوبين_${dateLabel}.json`, 'application/json');
            this.addLog(`⬇️ تم تصدير JSON — ${dateLabel}`);
        }

        exportBackup() {
            const backup = {};
            gmList().forEach(k => { backup[k] = gmGet(k); });
            this._downloadBlob(JSON.stringify(backup, null, 2), `backup_delivery_monitor_${todayKey()}.json`, 'application/json');
            this.addLog('💾 تم إنشاء نسخة احتياطية كاملة');
        }

        applyPanelWidth() {
            const panel = document.getElementById('dm-panel');
            if (!panel) return;

            const scale = this.panelScale / 100;
            panel.style.zoom = String(scale);

            panel.style.maxWidth  = '96vw';
            panel.style.maxHeight = '92vh';

            const btnDown = document.getElementById('dm-size-down');
            const btnUp   = document.getElementById('dm-size-up');
            if (btnDown) {
                const atMin = this.panelScale <= 60;
                btnDown.style.opacity = atMin ? '0.35' : '1';
                btnDown.style.cursor  = atMin ? 'default' : 'pointer';
            }
            if (btnUp) { btnUp.style.opacity = '1'; btnUp.style.cursor = 'pointer'; }

            gmSet(STORAGE_KEYS.PANEL_SIZE, String(this.panelScale));
        }

        initDraggable() {
            const header = document.getElementById('dm-header');
            const panel  = document.getElementById('dm-panel');
            if (!header || !panel) return;
            header.style.cursor = 'grab';
            let dragging = false, sx = 0, sy = 0, ol = 0, ot = 0;

            header.addEventListener('mousedown', (e) => {
                if (e.target.closest('button')) return;
                dragging = true;
                sx = e.clientX; sy = e.clientY;
                ol = panel.offsetLeft; ot = panel.offsetTop;
                header.style.cursor = 'grabbing';
                e.preventDefault();
            });
            document.addEventListener('mousemove', (e) => {
                if (!dragging) return;
                const newL = Math.max(0, Math.min(window.innerWidth  - panel.offsetWidth,  ol + (e.clientX - sx)));
                const newT = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, ot + (e.clientY - sy)));
                panel.style.left = newL + 'px';
                panel.style.top  = newT + 'px';
            });
            document.addEventListener('mouseup', () => {
                if (!dragging) return;
                dragging = false;
                header.style.cursor = 'grab';
                gmSet(STORAGE_KEYS.PANEL_POS, JSON.stringify({ left: panel.style.left, top: panel.style.top }));
            });
        }

        renderWeeklyStats() {
            const el = document.getElementById('dm-weekly-content');
            if (!el) return;
            const dates = [this.state.dateKey, ...this.listArchiveDates()].slice(0, 7);
            if (dates.length === 0) { el.innerHTML = '<div class="dm-empty">لا يوجد أرشيف كافٍ</div>'; return; }

            const agentMap = {}, dayTotals = {};
            dates.forEach(date => {
                const data    = date === this.state.dateKey ? this.state : this._getArchiveData(date);
                const entries = Object.entries(data.mandoubs || {});
                let daySum = 0;
                entries.forEach(([name, m]) => {
                    const d = Math.max(0, m.first - m.current);
                    if (!agentMap[name]) agentMap[name] = { total: 0, days: 0 };
                    agentMap[name].total += d;
                    agentMap[name].days++;
                    daySum += d;
                });
                dayTotals[date] = daySum;
            });

            const agents   = Object.entries(agentMap).sort((a, b) => b[1].total - a[1].total);
            const weekTotal = agents.reduce((s, [, v]) => s + v.total, 0);
            const bestDay   = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0];
            const avgPerDay = dates.length ? Math.round(weekTotal / dates.length) : 0;

            el.innerHTML = `
                <div class="dm-archive-stat-grid">
                    <div class="dm-archive-stat"><span class="dm-sum-num dm-c-green">${weekTotal}</span><span class="dm-sum-label">مُنجزة الأسبوع</span></div>
                    <div class="dm-archive-stat"><span class="dm-sum-num">${dates.length}</span><span class="dm-sum-label">أيام</span></div>
                    <div class="dm-archive-stat"><span class="dm-sum-num dm-c-blue">${avgPerDay}</span><span class="dm-sum-label">متوسط يومي</span></div>
                    <div class="dm-archive-stat"><span class="dm-sum-num dm-c-orange">${bestDay ? bestDay[1] : 0}</span><span class="dm-sum-label">أفضل يوم</span></div>
                </div>
                ${bestDay ? `<div class="dm-archive-best">📅 أفضل يوم: <strong>${bestDay[0]}</strong> — ${bestDay[1]} طلباً</div>` : ''}
                <div class="dm-table-wrap">
                <table class="dm-live-table">
                    <thead><tr><th>المندوب</th><th>الأسبوع</th><th>متوسط/يوم</th></tr></thead>
                    <tbody>
                        ${agents.map(([name, v], i) => `
                            <tr>
                                <td class="dm-name">${i === 0 ? '🏆 ' : ''}${escapeHtml(name)}</td>
                                <td class="dm-c-green">${v.total}</td>
                                <td>${Math.round(v.total / v.days)}</td>
                            </tr>`).join('')}
                    </tbody>
                </table></div>`;
        }

        copyStoppedAgents() {
            const now         = Date.now();
            const thresholdMs = this.thresholdMinutes * 60 * 1000;
            const stopped     = Object.entries(this.state.mandoubs)
                .filter(([, m]) => this.computeStatus(m, now, thresholdMs) === 'stopped')
                .map(([name, m]) => {
                    const mins = Math.round((now - m.lastProgressTs) / 60000);
                    return `${name} (متوقف ${mins} د - متبقي ${m.current})`;
                });

            const btn = document.getElementById('dm-copy-stopped');
            if (stopped.length === 0) {
                if (btn) { btn.textContent = '✅ لا يوجد متوقفون'; setTimeout(() => { btn.textContent = '📋 نسخ المتوقفين'; }, 2000); }
                return;
            }

            const text = stopped.join('\n');
            navigator.clipboard.writeText(text).then(() => {
                this.addLog(`📋 تم نسخ ${stopped.length} متوقف للحافظة`);
                if (btn) {
                    btn.textContent = `✅ تم نسخ ${stopped.length} مندوب`;
                    btn.classList.add('dm-btn-copied');
                    setTimeout(() => { btn.textContent = '📋 نسخ المتوقفين'; btn.classList.remove('dm-btn-copied'); }, 2500);
                }
            }).catch(() => {
                const ta = document.createElement('textarea');
                ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select(); document.execCommand('copy');
                document.body.removeChild(ta);
                this.addLog(`📋 تم نسخ ${stopped.length} متوقف (fallback)`);
                if (btn) { btn.textContent = `✅ تم نسخ ${stopped.length}`; setTimeout(() => { btn.textContent = '📋 نسخ المتوقفين'; }, 2500); }
            });
        }

        _downloadBlob(content, filename, mimeType) {
            const blob = new Blob([content], { type: mimeType });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
        }

        addStyles() {
            const css = `
                #dm-panel {
                    position: fixed; top: 16px; left: 16px; z-index: 10000; width: 360px;
                    background: #ffffff; border-radius: 14px; box-shadow: 0 8px 30px rgba(15,23,42,.15);
                    font-family: -apple-system, "Segoe UI", Tahoma, Arial, sans-serif; direction: rtl;
                    border: 1px solid #eef0f4; overflow: hidden;
                }
                .dm-header { background: #4f46e5; color:#fff; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; }
                .dm-header-left { display:flex; align-items:center; gap:8px; }
                .dm-title { font-weight:700; font-size:14px; }
                .dm-dot { width:8px; height:8px; border-radius:50%; display:inline-block; }
                .dm-dot-on  { background:#4ade80; box-shadow:0 0 0 3px rgba(74,222,128,.3); }
                .dm-dot-off { background:#f87171; }
                .dm-header-right { display:flex; align-items:center; gap:6px; }
                .dm-run-btn { border:none; border-radius:8px; padding:5px 12px; font-size:11px; font-weight:700; cursor:pointer; }
                .dm-run-on  { background:#ef4444; color:#fff; }
                .dm-run-off { background:#22c55e; color:#fff; }
                .dm-icon-btn { background:rgba(255,255,255,.18); border:none; color:#fff; width:26px; height:26px; border-radius:8px; cursor:pointer; font-size:14px; }
                .dm-icon-btn:hover { background:rgba(255,255,255,.3); }

                .dm-body { padding: 12px; max-height: 600px; overflow-y:auto; }
                .dm-warning { background:#fff7ed; color:#c2410c; border:1px solid #fed7aa; border-radius:10px; padding:8px 10px; font-size:11px; margin-bottom:10px; }

                .dm-summary { display:flex; gap:6px; margin-bottom:8px; }
                .dm-sum-item { flex:1; background:#f8fafc; border-radius:10px; padding:6px 4px; text-align:center; }
                .dm-sum-num { display:block; font-size:17px; font-weight:800; color:#334155; }
                .dm-sum-label { display:block; font-size:9px; color:#94a3b8; margin-top:2px; }

                .dm-meta-bar { display:flex; justify-content:space-between; font-size:10px; color:#94a3b8; margin-bottom:8px; padding:0 2px; }
                .dm-meta-txt { }

                .dm-c-red    { color:#ef4444 !important; }
                .dm-c-blue   { color:#3b82f6 !important; }
                .dm-c-green  { color:#22c55e !important; }
                .dm-c-orange { color:#f97316 !important; }
                .dm-c-gray   { color:#94a3b8 !important; }

                .dm-tabs { display:flex; background:#f1f5f9; border-radius:10px; padding:3px; margin-bottom:10px; }
                .dm-tab  { flex:1; border:none; background:transparent; padding:7px 4px; font-size:11px; font-weight:700; color:#64748b; border-radius:8px; cursor:pointer; }
                .dm-tab.active { background:#fff; color:#4f46e5; box-shadow:0 1px 3px rgba(0,0,0,.08); }

                .dm-search-row { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
                .dm-search { flex:1; padding:8px 10px; border:1px solid #e2e8f0; border-radius:9px; font-size:12px; }
                .dm-hide-done-label { display:flex; align-items:center; gap:4px; font-size:11px; color:#64748b; white-space:nowrap; cursor:pointer; }

                .dm-table-wrap { max-height:320px; overflow-y:auto; border:1px solid #f1f5f9; border-radius:10px; }
                .dm-live-table { width:100%; border-collapse:collapse; font-size:11.5px; }
                .dm-live-table thead th { position:sticky; top:0; background:#f8fafc; padding:7px 6px; font-size:10.5px; color:#64748b; font-weight:700; }
                .dm-sort-th { cursor:pointer; user-select:none; }
                .dm-sort-th:hover { color:#4f46e5; }
                .dm-sort-icon { font-size:9px; }
                .dm-live-table td { padding:6px 6px 4px; text-align:center; border-top:1px solid #f4f6f8; vertical-align:middle; }
                .dm-name { text-align:right !important; font-weight:700; color:#334155; }
                .dm-stop-count { font-size:9px; background:#fee2e2; color:#dc2626; border-radius:4px; padding:1px 4px; margin-right:4px; vertical-align:middle; }
                .dm-empty { text-align:center; padding:24px; color:#94a3b8; font-size:12px; }

                .dm-stall-note { font-size:9px; color:#94a3b8; margin-top:2px; line-height:1.3; white-space:nowrap; }

                .dm-progress-wrap { height:3px; background:#f1f5f9; border-radius:2px; margin-top:4px; overflow:hidden; }
                .dm-progress-bar  { height:100%; border-radius:2px; transition:width .4s ease; }

                .dm-badge { padding:3px 7px; border-radius:20px; font-size:10px; font-weight:700; white-space:nowrap; display:inline-block; }
                .dm-badge-green  { background:#dcfce7; color:#16a34a; }
                .dm-badge-red    { background:#fee2e2; color:#dc2626; }
                .dm-badge-blue   { background:#dbeafe; color:#2563eb; }
                .dm-badge-orange { background:#ffedd5; color:#ea580c; }
                .dm-badge-yellow { background:#fef9c3; color:#a16207; }
                .dm-badge-gray   { background:#f1f5f9; color:#64748b; }

                .dm-field { margin-bottom:12px; }
                .dm-field label { display:block; font-size:11.5px; color:#475569; font-weight:700; margin-bottom:5px; }
                .dm-field-row { display:flex; gap:6px; align-items:center; }
                .dm-field-row input[type=number] { width:70px; padding:6px 8px; border:1px solid #e2e8f0; border-radius:8px; font-size:12px; }
                .dm-checkbox-label { display:flex; align-items:center; gap:6px; font-size:11.5px; color:#475569; font-weight:600; flex-wrap:wrap; }
                .dm-hint   { font-size:10px; color:#94a3b8; margin-top:4px; }
                .dm-select { flex:1; padding:6px 8px; border:1px solid #e2e8f0; border-radius:8px; font-size:12px; }

                .dm-btn         { padding:7px 12px; border:none; border-radius:8px; cursor:pointer; font-size:11.5px; font-weight:700; background:#4f46e5; color:#fff; transition:.15s; display:inline-block; text-align:center; }
                .dm-btn:hover   { background:#4338ca; }
                .dm-btn-sm      { flex:1; }
                .dm-btn-danger  { background:#ef4444; } .dm-btn-danger:hover { background:#dc2626; }
                .dm-btn-ghost   { background:#f1f5f9; color:#475569; }
                .dm-btn-ghost:hover { background:#e2e8f0; }
                .dm-btn-copy    { width:100%; margin-bottom:8px; background:#f97316; font-size:11px; padding:6px 10px; }
                .dm-btn-copy:hover  { background:#ea580c; }
                .dm-btn-copied  { background:#16a34a !important; }

                .dm-log-content { max-height:150px; overflow-y:auto; background:#f8fafc; border-radius:8px; padding:8px; margin-top:8px; }
                .dm-log-entry   { font-size:10.5px; padding:3px 0; border-bottom:1px solid #eef0f4; color:#475569; }
                .dm-log-entry:last-child { border-bottom:none; }
                .dm-time { color:#94a3b8; font-weight:700; margin-left:5px; }

                .dm-archive-stat-grid { display:flex; gap:6px; margin-bottom:8px; }
                .dm-archive-stat { flex:1; background:#f8fafc; border-radius:8px; padding:6px 4px; text-align:center; }
                .dm-archive-best { font-size:11px; color:#475569; margin-bottom:8px; padding:6px 8px; background:#f0fdf4; border-radius:8px; }

                @media (max-width:600px) {
                    #dm-panel { width:94%; left:3%; }
                }
            `;
            try {
                gmAddStyle(css);
            } catch (e) {
                const style = document.createElement('style');
                style.textContent = css;
                (document.head || document.documentElement).appendChild(style);
            }
        }
    }

    let dmStartAttempts = 0;
    function startDeliveryMonitor() {
        dmStartAttempts++;
        try {
            if (document.getElementById('dm-panel')) return;
            if (!document.body) throw new Error('document.body غير جاهز بعد');
            new DeliveryMonitor();
            console.log('[Delivery Monitor] ✅ تم التشغيل بنجاح');
        } catch (e) {
            console.error('[Delivery Monitor] ❌ فشل التشغيل (محاولة ' + dmStartAttempts + '):', e);
            if (dmStartAttempts < 5) {
                setTimeout(startDeliveryMonitor, 1000 * dmStartAttempts);
            } else {
                console.error('[Delivery Monitor] توقف بعد عدة محاولات. أرسل هذه الرسالة للدعم الفني.');
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startDeliveryMonitor);
    } else {
        startDeliveryMonitor();
    }
    window.addEventListener('load', () => {
        if (!document.getElementById('dm-panel')) startDeliveryMonitor();
    });

})();
