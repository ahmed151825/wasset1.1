// ==UserScript==
// @name          4احمد محمد كريم
// @namespace    waseet-tools
// @version      4.0.1
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
// @icon         data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">🚚</text></svg>
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/ahmed151825/wasset1.1/main/waseet-tools.user.js
// @downloadURL  https://raw.githubusercontent.com/ahmed151825/wasset1.1/main/waseet-tools.user.js
// ==/UserScript==

/*
  سجل التحديثات (v4.0.1):
  ───────────────────────────────────────────────────────────
  • إصلاح حاسم: استعادة الاسم الأصلي للسكربت حتى يستبدل
    Tampermonkey النسخة القديمة بدل تثبيت نسخة مكررة بجانبها.
    (النسختان معاً كانتا تضاعفان طلبات فحص التأخير فيوقفها السيرفر)
  • إزالة noframes لمطابقة سلوك النسخة الأصلية تماماً.
  ───────────────────────────────────────────────────────────
  سجل التحديثات (v4.0.0):
  ───────────────────────────────────────────────────────────
  • دمج كامل: أدوات الوسيط (v3.20.5) + مراقب التوصيل (v6.4.0)
    في ملف واحد — كل جزء معزول بنطاقه الخاص لمنع أي تعارض.
  • جديد: فحص تحديثات تلقائي كل 6 ساعات من GitHub — عند صدور
    إصدار أحدث يظهر بانر "تحديث الآن / لاحقاً" داخل صفحة العمل.
  ───────────────────────────────────────────────────────────
*/

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
    return '4.0.1';
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

  var BASE_URL = 'https://alwaseet-iq.net';

  function storeSet(key, val) {
    try { if (typeof GM_setValue !== 'undefined') { GM_setValue(key, val); } } catch (e) {}
    try { localStorage.setItem(key, val); } catch (e) {}
  }
  function storeGet(key) {
    try { if (typeof GM_getValue !== 'undefined') { var v = GM_getValue(key, null); if (v !== null && v !== undefined) { return v; } } } catch (e) {}
    try { return localStorage.getItem(key); } catch (e) { return null; }
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
    showCopyReps:true, showRepRating:true, opacity:100,
    stationName:'المنصور', reportTemplate:DEFAULT_REPORT_TEMPLATE,
    customerTemplateId:'default', customerCustomTemplate:'', delayCheckMode:'auto',
    ratingAutoReport:true, ratingScoreExcellent:3, ratingScoreGood:1, ratingScoreBad:-2,
    walletFee5000:300, walletFee4000:200, walletFee3000:150, walletFee2000:100,
    walletOffDay:5   // 0=أحد 1=اثنين 2=ثلاثاء 3=أربعاء 4=خميس 5=جمعة 6=سبت
  };
  function loadSettings() {
    var raw = storeGet(SETTINGS_KEY);
    if (!raw) { return Object.assign({}, DEFAULT_SETTINGS); }
    try { return Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw)); } catch (e) { return Object.assign({}, DEFAULT_SETTINGS); }
  }
  function saveSettings(s) { storeSet(SETTINGS_KEY, JSON.stringify(s)); }
  var wsSettings = loadSettings();

  var VISIBILITY_MAP = {
    'story':'showStory','fees':'showFees','edit':'showEdit','ws-merchant':'showWsMerchant',
    'ws-customer':'showWsCustomer','sms-customer':'showSms','phone-search':'showPhoneSearch',
    'delay-check':'showDelayCheck','copy-report':'showCopyReport','copy-reps':'showCopyReps','rep-rating':'showRepRating'
  };
  function applyVisibility() {
    var op = (wsSettings.opacity != null ? wsSettings.opacity : 100) / 100;
    Object.keys(VISIBILITY_MAP).forEach(function (btnKey) {
      var visible = !!wsSettings[VISIBILITY_MAP[btnKey]];
      document.querySelectorAll('[data-ws-btn="' + btnKey + '"]').forEach(function (el) {
        el.style.display = visible ? '' : 'none'; el.style.opacity = op;
      });
    });
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
    [{key:'showStory',label:'🔍 زر قصة الطلب'},{key:'showFees',label:'➕ زر أجور التوصيل'},{key:'showEdit',label:'🌐 زر تغيير العنوان'},{key:'showWsMerchant',label:'💬 واتساب التاجر'},{key:'showWsCustomer',label:'📦 واتساب الزبون'},{key:'showSms',label:'📱 رسالة SMS للزبون'},{key:'showPhoneSearch',label:'🔎 بحث عن الزبون برقم الهاتف'},{key:'showDelayCheck',label:'🔎 زر فحص التأخير'},{key:'showCopyReport',label:'📋 زر نسخ التقرير (صفحة الأجور)'},{key:'showCopyReps',label:'📋 زر نسخ قائمة المناديب'},{key:'showRepRating',label:'⭐ زر تقييم المندوب'}].forEach(function(item){
      var row=document.createElement('label');row.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 2px;font-size:13px;color:#333;cursor:pointer;border-bottom:1px solid #eee;';var cb=document.createElement('input');cb.type='checkbox';cb.checked=!!wsSettings[item.key];cb.addEventListener('change',function(){wsSettings[item.key]=cb.checked;saveSettings(wsSettings);applyVisibility();});var span=document.createElement('span');span.textContent=item.label;row.appendChild(cb);row.appendChild(span);panel.appendChild(row);
    });

    var delaySection=document.createElement('div');delaySection.style.cssText='margin-top:14px;padding-top:12px;border-top:1px solid #ddd;';var delayTitle=document.createElement('div');delayTitle.textContent='🔎 وضع فحص الطلبات المتأخرة';delayTitle.style.cssText='font-size:13px;color:#333;margin-bottom:6px;font-weight:bold;';delaySection.appendChild(delayTitle);var modeDesc=document.createElement('div');modeDesc.style.cssText='font-size:11px;color:#666;margin-bottom:8px;line-height:1.5;';modeDesc.textContent='تلقائي: كل 90 ثانية.\nيدوي: عند الضغط فقط.';delaySection.appendChild(modeDesc);
    var currentMode=wsSettings.delayCheckMode||'auto';[{val:'auto',label:'🔄 تلقائي كل 90 ثانية'},{val:'manual',label:'👆 يدوي (عند الضغط فقط)'}].forEach(function(opt){var lbl=document.createElement('label');lbl.style.cssText='display:flex;align-items:center;gap:8px;padding:5px 2px;font-size:13px;color:#333;cursor:pointer;';var rb=document.createElement('input');rb.type='radio';rb.name='ws-delay-mode';rb.value=opt.val;rb.checked=(currentMode===opt.val);rb.addEventListener('change',function(){if(rb.checked){wsSettings.delayCheckMode=opt.val;saveSettings(wsSettings);if(typeof applyDelayMode==='function'){applyDelayMode();}if(typeof updateCheckBtnLabel==='function'){updateCheckBtnLabel();}}});lbl.appendChild(rb);lbl.appendChild(document.createTextNode(opt.label));delaySection.appendChild(lbl);});panel.appendChild(delaySection);

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

    var opacitySection=document.createElement('div');opacitySection.style.cssText='margin-top:14px;padding-top:12px;border-top:1px solid #ddd;';var opacityLabel=document.createElement('div');opacityLabel.textContent='مستوى شفافية الأزرار: '+wsSettings.opacity+'%';opacityLabel.style.cssText='font-size:13px;color:#333;margin-bottom:6px;';var opacitySlider=document.createElement('input');opacitySlider.type='range';opacitySlider.min='20';opacitySlider.max='100';opacitySlider.step='5';opacitySlider.value=wsSettings.opacity;opacitySlider.style.cssText='width:100%;cursor:pointer;';opacitySlider.addEventListener('input',function(){wsSettings.opacity=parseInt(opacitySlider.value,10);opacityLabel.textContent='مستوى شفافية الأزرار: '+wsSettings.opacity+'%';saveSettings(wsSettings);applyVisibility();});opacitySection.appendChild(opacityLabel);opacitySection.appendChild(opacitySlider);panel.appendChild(opacitySection);

    var custSection=document.createElement('div');custSection.style.cssText='margin-top:14px;padding-top:12px;border-top:1px solid #ddd;';var custTitle=document.createElement('div');custTitle.textContent='✉️ قالب رسالة الزبون';custTitle.style.cssText='font-size:13px;color:#333;margin-bottom:6px;font-weight:bold;';custSection.appendChild(custTitle);var custSelect=document.createElement('select');custSelect.style.cssText='width:100%;padding:6px;border:1px solid #ccc;border-radius:5px;font-size:12px;margin-bottom:6px;';Object.keys(PRESET_CUSTOMER_TEMPLATES).forEach(function(id){var opt=document.createElement('option');opt.value=id;opt.textContent=PRESET_CUSTOMER_TEMPLATES[id].label;if(id===(wsSettings.customerTemplateId||'default')){opt.selected=true;}custSelect.appendChild(opt);});var custEditBtn=document.createElement('button');custEditBtn.type='button';custEditBtn.textContent='✏️ تحرير القالب المخصص';custEditBtn.style.cssText='width:100%;background:#e67e22;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;display:'+(custSelect.value==='custom'?'block':'none')+';';custSelect.addEventListener('change',function(){wsSettings.customerTemplateId=custSelect.value;saveSettings(wsSettings);custEditBtn.style.display=(custSelect.value==='custom')?'block':'none';});custEditBtn.addEventListener('click',function(){openTemplateEditor({title:'تحرير قالب رسالة الزبون',help:'المتغيرات:\n{merchant} اسم المتجر\n{price} السعر\n{order} رقم الطلب',value:(wsSettings.customerCustomTemplate&&wsSettings.customerCustomTemplate.trim())?wsSettings.customerCustomTemplate:PRESET_CUSTOMER_TEMPLATES.default.text,defaultValue:PRESET_CUSTOMER_TEMPLATES.default.text,onSave:function(val){wsSettings.customerCustomTemplate=val;saveSettings(wsSettings);}});});custSection.appendChild(custSelect);custSection.appendChild(custEditBtn);panel.appendChild(custSection);

    var repSection=document.createElement('div');repSection.style.cssText='margin-top:14px;padding-top:12px;border-top:1px solid #ddd;';var repTitle=document.createElement('div');repTitle.textContent='📋 قالب تقرير الأجور';repTitle.style.cssText='font-size:13px;color:#333;margin-bottom:6px;font-weight:bold;';repSection.appendChild(repTitle);var stationLabel=document.createElement('div');stationLabel.textContent='اسم المحطة:';stationLabel.style.cssText='font-size:12px;color:#555;margin-bottom:3px;';repSection.appendChild(stationLabel);var stationInput=document.createElement('input');stationInput.type='text';stationInput.value=wsSettings.stationName||'المنصور';stationInput.style.cssText='width:100%;box-sizing:border-box;padding:6px;border:1px solid #ccc;border-radius:5px;font-size:12px;margin-bottom:8px;';stationInput.addEventListener('change',function(){wsSettings.stationName=stationInput.value.trim()||'المنصور';saveSettings(wsSettings);});repSection.appendChild(stationInput);var repEditBtn=document.createElement('button');repEditBtn.type='button';repEditBtn.textContent='✏️ تحرير نص التقرير';repEditBtn.style.cssText='width:100%;background:#e67e22;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;';repEditBtn.addEventListener('click',function(){openTemplateEditor({title:'تحرير قالب تقرير الأجور',help:'المتغيرات:\n{station} {employee} {date} {day}\n{normal5000..2000} {vip5000..2000} {total5000..2000}',value:(wsSettings.reportTemplate&&wsSettings.reportTemplate.trim())?wsSettings.reportTemplate:DEFAULT_REPORT_TEMPLATE,defaultValue:DEFAULT_REPORT_TEMPLATE,onSave:function(val){wsSettings.reportTemplate=val;saveSettings(wsSettings);}});});repSection.appendChild(repEditBtn);panel.appendChild(repSection);

    var resetBtn=document.createElement('button');resetBtn.type='button';resetBtn.textContent='إعادة الكل للوضع الافتراضي';resetBtn.style.cssText='margin-top:14px;width:100%;background:#888;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;';resetBtn.addEventListener('click',function(){wsSettings=Object.assign({},DEFAULT_SETTINGS);saveSettings(wsSettings);applyVisibility();if(typeof applyDelayMode==='function'){applyDelayMode();}if(typeof updateCheckBtnLabel==='function'){updateCheckBtnLabel();}overlay.remove();buildSettingsPanel();});panel.appendChild(resetBtn);
    var closeBtn=document.createElement('button');closeBtn.type='button';closeBtn.textContent='إغلاق';closeBtn.style.cssText='margin-top:8px;width:100%;background:#2e5bff;color:#fff;border:none;border-radius:5px;padding:8px;cursor:pointer;font-size:13px;';closeBtn.addEventListener('click',function(){overlay.remove();});panel.appendChild(closeBtn);
    overlay.appendChild(panel);overlay.addEventListener('click',function(e){if(e.target===overlay){overlay.remove();}});document.body.appendChild(overlay);
  }

  function addSettingsBtn(){
    if(document.getElementById('ws-settings-btn')){return;}
    var btn=document.createElement('button');btn.id='ws-settings-btn';btn.type='button';btn.textContent='⚙️ الإعدادات';btn.style.cssText='position:fixed;top:10px;left:10px;z-index:99999;background:#555;color:#fff;border:none;border-radius:4px;padding:8px 14px;cursor:pointer;font-size:13px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,.3);';
    btn.addEventListener('click',buildSettingsPanel);document.body.appendChild(btn);
  }

  var PAGE = location.href;

  // ══════════════════════════════════════════════════════════════
  //  ① call_center
  // ══════════════════════════════════════════════════════════════
  if(PAGE.indexOf('/cs/call_center')!==-1){
    var RE_ORDER=/^\d{6,}$/,RE_PHONE=/^(0|964)/;
    function directText(el){var s='';el.childNodes.forEach(function(n){if(n.nodeType===3){s+=n.textContent;}});return s.trim();}
    function makeBtn(label,tip,color,fn,key){var b=document.createElement('button');b.textContent=label;b.title=tip;b.type='button';if(key){b.setAttribute('data-ws-btn',key);}b.style.cssText='display:inline-block;margin:2px 2px 0;background:'+color+';color:#fff;border:none;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:13px;line-height:1.5;vertical-align:middle;';b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();fn();});return b;}
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
      document.querySelectorAll('tr').forEach(function(tr){var name=extractRepNameFromHeaderRow(tr);if(name){wsLastRepName=name;}});
      document.querySelectorAll('td.dtr-control').forEach(function(cell){var txt=directText(cell);if(cell.dataset.wsAdded){var row0=cell.closest('tr');if(row0&&txt){addWhatsappBtns(row0,txt);}return;}if(!RE_ORDER.test(txt)||RE_PHONE.test(txt)){return;}cell.dataset.wsAdded='1';var capturedTxt=txt,row=cell.closest('tr');if(row){var repNameNow=findRepNameForRow(row);if(!repNameNow&&wsLastRepName){repNameNow=wsLastRepName;}if(repNameNow){row.setAttribute('data-ws-rep',repNameNow);wsLastRepName=repNameNow;}}var wrap=document.createElement('div');wrap.style.cssText='display:flex;flex-wrap:wrap;justify-content:center;gap:3px;margin-top:4px;';wrap.appendChild(makeBtn('🔍','قصة الطلب: '+capturedTxt,'#2e5bff',function(){openTab(BASE_URL+'/order-story?ws_order='+encodeURIComponent(capturedTxt),'ws_story');},'story'));wrap.appendChild(makeBtn('➕','أجور التوصيل: '+capturedTxt,'#28a745',function(){openTab(BASE_URL+'/cs/delivery-fees-differences?ws_order='+encodeURIComponent(capturedTxt),'ws_fees');},'fees'));wrap.appendChild(makeBtn('🌐','تغيير العنوان: '+capturedTxt,'#e67e22',function(){openTab(BASE_URL+'/cs/editOrder?ws_order='+encodeURIComponent(capturedTxt),'ws_edit');},'edit'));wrap.appendChild(makeBtn('⭐','تقييم المندوب: '+capturedTxt,'#8e44ad',function(){var liveRow=cell.closest('tr'),repName='';if(liveRow){repName=liveRow.getAttribute('data-ws-rep')||'';}if(!repName&&liveRow){repName=findRepNameForRow(liveRow);}if(!repName){repName=wsLastRepName;}openRatingDialog(capturedTxt,repName);},'rep-rating'));cell.appendChild(wrap);if(row){addWhatsappBtns(row,capturedTxt);}});
    }
    onReady(function(){setTimeout(function(){observeAndRun(addIcons,400);renderAndSync(addSettingsBtn);checkWeeklyAutoReport();},800);});
  }

  // ── order-story ──
  if(PAGE.indexOf('/order-story')!==-1){var storyParams=new URLSearchParams(location.search),storyNum=storyParams.get('ws_order');if(storyNum){onReady(function(){setTimeout(function(){var btn=document.querySelector('button[onclick="getOrderStory()"]');if(btn){btn.click();}else if(typeof getOrderStory==='function'){getOrderStory();}waitFor('#swal2-input',function(inp){inp.value=storyNum;inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(function(){var ok=document.querySelector('.swal2-confirm');if(ok){ok.click();}},500);});},800);});}}

  // ══════════════════════════════════════════════════════════════
  //  ③ delivery-fees-differences — مع الحفظ التلقائي للمحفظة
  // ══════════════════════════════════════════════════════════════
  if(PAGE.indexOf('/cs/delivery-fees-differences')!==-1){
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

})();

// ══════════════════════════════════════════════════════════════
//  🚚 الجزء الثاني: مراقب التوصيل الاحترافي (Delivery Monitor Pro)
//  يعمل فقط في صفحة delivering-orders
// ══════════════════════════════════════════════════════════════
(function () {
    'use strict';

    // ✅ الدمج: هذا الجزء خاص بصفحة "قيد التوصيل" فقط
    if (location.href.indexOf('/cs/delivering-orders') === -1) return;

    // ✅ إصلاح: منع ظهور لوحتين عند التحميل المزدوج
    if (document.getElementById('dm-panel')) return;

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

    class DeliveryMonitor {
        constructor() {
            this.thresholdMinutes   = parseInt(gmGet(STORAGE_KEYS.THRESHOLD_MIN, 10)) || 10;
            this.deadlineHour       = parseInt(gmGet(STORAGE_KEYS.DEADLINE_HOUR, 18)) || 18;
            this.autoRefreshOn      = gmGetBool(STORAGE_KEYS.AUTO_REFRESH_ON, false);
            this.autoRefreshMinutes = parseInt(gmGet(STORAGE_KEYS.AUTO_REFRESH_MIN, 5)) || 5;
            this.soundOn            = gmGetBool(STORAGE_KEYS.SOUND_ON, true);
            this.hideDone           = gmGetBool(STORAGE_KEYS.HIDE_DONE, false);
            this.preDeadlineWarn    = gmGetBool(STORAGE_KEYS.PRE_DEADLINE_WARN, true);
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

            this.start();
            if (this.autoRefreshOn) this.scheduleAutoRefresh();
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
                            <span id="dm-sum-delivered" class="dm-sum-num dm-c-green">0</span>
                            <span class="dm-sum-label">مُنجزة</span>
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
            const delivered  = entries.reduce((s, m) => s + Math.max(0, m.first - m.current), 0);

            document.getElementById('dm-sum-total').textContent     = total;
            document.getElementById('dm-sum-stopped').textContent   = stopped;
            document.getElementById('dm-sum-done').textContent      = done;
            document.getElementById('dm-sum-delivered').textContent = delivered;
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
