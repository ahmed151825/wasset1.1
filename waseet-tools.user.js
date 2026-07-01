// ==UserScript==
// @name          4احمد محمد كريم
// @namespace    waseet-tools
// @version      3.20.5
// @description  أدوات مركز خدمة العملاء - الوسيط للنقل العام
// @match        https://alwaseet-iq.net/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/ahmed151825/wasset1.1/main/waseet-tools.user.js
// @downloadURL  https://raw.githubusercontent.com/ahmed151825/wasset1.1/main/waseet-tools.user.js
// ==/UserScript==

/*
  سجل التحديثات (v3.20.5):
  ───────────────────────────────────────────────────────────
  • تحسين بسيط: عند نسخ قائمة المناديب، يظهر ❌ باللون الأحمر
    بجانب عبارة "القيد عالي" لتمييز المناديب أصحاب القيد المرتفع
    بشكل أوضح بصرياً عند لصق النص.
  ───────────────────────────────────────────────────────────
  سجل التحديثات (v3.20.4):
  ───────────────────────────────────────────────────────────
  • إصلاح حاسم: المحفظة تقرأ طلبات اليوم الحالي فقط
    - استخراج التاريخ الفعلي من جداول الصفحة
    - تمرير التاريخ إلى buildCounts() لفلترة صحيحة
    - لا تجمع بين أمس واليوم بعد الآن
  ───────────────────────────────────────────────────────────
  سجل التحديثات (v3.20.3):
  ───────────────────────────────────────────────────────────
  • إصلاح جوهري: المحفظة تعرض وتحفظ أجور اليوم المحدد فقط
    - buildCountsForDate() تفلتر الصفوف بتاريخها الفعلي من عمود تاريخ الإنشاء
    - لم تعد تجمع طلبات أمس + اليوم معاً
    - زر المحفظة يعرض مبلغ اليوم الحالي فقط
    - كل يوم يُحفظ بإحصائياته الصحيحة المنفصلة
  ───────────────────────────────────────────────────────────
*/

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

  // ══════════════════════════════════════════════════════════════
  //  [إصلاح ١] openTab — منع تكرار النوافذ عند الضغط المتكرر
  // ══════════════════════════════════════════════════════════════
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

  // ══════════════════════════════════════════════════════════════
  //  إعدادات القوالب والإعدادات العامة
  // ══════════════════════════════════════════════════════════════
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
  //  💰 نظام المحفظة الشهرية — v3.20.4
  //  مفتاح التخزين: waseet_wallet_v1_{اسم الموظف}_{YYYY-MM}
  //  كل سجل يوم: { date:'2025-06-15', day:0, totals:{5000:n,...}, amount:n }
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

  // ══════════════════════════════════════════════════════════════
  //  [إصلاح ٢] استخراج التاريخ الفعلي من خلايا الجداول
  //  يحل مشكلة التسجيل في اليوم الخاطئ عند فتح الصفحة بعد منتصف الليل
  // ══════════════════════════════════════════════════════════════
  function getDataDateFromTable() {
    var latestDate = null;
    document.querySelectorAll('td, th').forEach(function (cell) {
      var text = cell.textContent.trim();
      // نمط: 2026-06-24 أو 2026-06-24 11:02:35
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

  // حفظ يوم — يُستدعى تلقائياً عند فتح صفحة الأجور
  function saveWalletDay(empName, totals, overrideDate) {
    // [إصلاح ٢] استخدم التاريخ المُمرر أو التاريخ من الجداول أو اليوم الحالي
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
    var currentMode=wsSettings.delayCheckMode||'auto';[{val:'auto',label:'🔄 تلقائي كل 90 ثانية'},{val:'manual',label:'👆 يدوي (عند الضغط فقط)'}].forEach(function(opt){var lbl=document.createElement('label');lbl.style.cssText='display:flex;align-items:center;gap:8px;padding:5px 2px;font-size:13px;color:#333;cursor:pointer;';var rb=document.createElement('input');rb.type='radio';rb.name='ws-delay-mode';rb.value=opt.val;rb.checked=(currentMode===opt.val);rb.addEventListener('change',function(){if(rb.checked){wsSettings.delayCheckMode=opt.val;saveSettings(wsSettings);applyDelayMode();updateCheckBtnLabel();}});lbl.appendChild(rb);lbl.appendChild(document.createTextNode(opt.label));delaySection.appendChild(lbl);});panel.appendChild(delaySection);

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

    var resetBtn=document.createElement('button');resetBtn.type='button';resetBtn.textContent='إعادة الكل للوضع الافتراضي';resetBtn.style.cssText='margin-top:14px;width:100%;background:#888;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;';resetBtn.addEventListener('click',function(){wsSettings=Object.assign({},DEFAULT_SETTINGS);saveSettings(wsSettings);applyVisibility();applyDelayMode();updateCheckBtnLabel();overlay.remove();buildSettingsPanel();});panel.appendChild(resetBtn);
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

    // استخراج رقم عمود تاريخ الإنشاء من الجدول
    function dateColumn(table){
      var headers=table.querySelectorAll('thead th,thead td');
      for(var i=0;i<headers.length;i++){
        var t=headers[i].textContent;
        if(t.indexOf('تاريخ')!==-1||t.indexOf('الإنشاء')!==-1||t.indexOf('date')!==-1){return i;}
      }
      return -1;
    }

    // استخراج تاريخ YYYY-MM-DD من نص الخلية
    function extractDateStr(cellText){
      var m=cellText.trim().match(/(\d{4}-\d{2}-\d{2})/);
      return m?m[1]:null;
    }

    // ✅ [إصلاح ٣] بناء الإحصاء لتاريخ محدد فقط (targetDateStr مثل "2026-06-24")
    // إذا لم يُمرر targetDateStr يحسب كل الجداول (للتقرير العام)
    function buildCounts(targetDateStr){
      var c={};FEE_LIST.forEach(function(v){c[v]={vip:0,normal:0};});
      document.querySelectorAll('table').forEach(function(tbl){
        var ci=repColumn(tbl);if(ci<0){return;}
        var di=dateColumn(tbl); // عمود التاريخ (-1 إذا لم يوجد)
        var fee=null;
        tbl.querySelectorAll('tbody tr').forEach(function(row){
          var m=row.textContent.match(/قيمة الفرق:\s*([\d,]+)/);
          if(m){var n=parseInt(m[1].replace(/,/g,''),10);fee=FEE_LIST.indexOf(n)!==-1?n:null;return;}
          if(!fee){return;}
          var cells=row.querySelectorAll('td');
          if(cells.length<=ci){return;}
          // ✅ فلترة بالتاريخ إذا طُلب ذلك وعمود التاريخ موجود
          if(targetDateStr && di>=0 && cells.length>di){
            var rowDate=extractDateStr(cells[di].textContent);
            if(rowDate && rowDate!==targetDateStr){return;} // تجاهل هذا الصف
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

      // ✅ استخراج التاريخ الفعلي من الجداول
      var actualDate = getDataDateFromTable() || new Date();
      var todayStr = actualDate.getFullYear() + '-' + pad2(actualDate.getMonth() + 1) + '-' + pad2(actualDate.getDate());

      // ✅ تمرير التاريخ إلى buildCounts لفلترة صحيحة
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
    function collectPage(){var data={};document.querySelectorAll('td[colspan]').forEach(function(cell){var m=cell.textContent.trim().match(/^(.*?)\((\d+)\)\s*$/);if(!m){return;}var name=m[1].trim();data[name]=(data[name]||0)+parseInt(m[2],10);});return data;}
    function lastPage2(){var max=1;document.querySelectorAll('.pagination a,.pagination button,.page-item a,.page-link').forEach(function(el){var n=parseInt(el.textContent.trim(),10);if(!isNaN(n)&&n>max){max=n;}});return max;}
    function currentPage2(){var active=document.querySelector('.pagination .active a,.pagination .active button,.page-item.active .page-link');if(active){return parseInt(active.textContent.trim(),10)||1;}var cur=Array.from(document.querySelectorAll('.pagination a,.pagination button')).find(function(el){return el.getAttribute('aria-current')==='page';});return cur?parseInt(cur.textContent.trim(),10)||1:1;}
    function nextBtn2(){return Array.from(document.querySelectorAll('a,button')).find(function(el){return el.textContent.trim()==='التالي'&&!el.disabled&&!el.classList.contains('disabled')&&!el.parentElement.classList.contains('disabled');});}
    // ✅ تعديل بسيط: إضافة ❌ أحمر بجانب "القيد عالي" عند نسخ قائمة المناديب لتمييزها بصرياً
    function formatReps(data){return Object.keys(data).map(function(name){var n=data[name];return name+' ('+n+')'+(n>10?' - ❌ القيد عالي':'');}).join('\n');}
    async function collectAll(btn){var orig=btn.textContent;btn.textContent='⏳ جاري الجمع...';btn.disabled=true;var all={};function merge(d){Object.keys(d).forEach(function(k){all[k]=(all[k]||0)+d[k];});}merge(collectPage());var last=lastPage2(),cur=currentPage2(),safe=0;while(safe++<100){if(cur>=last){break;}var nb=nextBtn2();if(!nb){break;}nb.click();await new Promise(function(resolve){var tries=0,prev=cur,check=setInterval(function(){tries++;var now=currentPage2();if(now!==prev&&document.querySelector('td[colspan]')){clearInterval(check);cur=now;resolve();}if(tries>40){clearInterval(check);resolve();}},300);});merge(collectPage());btn.textContent='⏳ صفحة '+cur+' / '+last;}copyText(formatReps(all));btn.textContent='✅ تم النسخ ('+Object.keys(all).length+' مندوب)';btn.disabled=false;setTimeout(function(){btn.textContent=orig;},3000);}
    function addRepsBtn(){if(document.getElementById('ws-reps-btn')){return;}if(!document.querySelector('td[colspan]')){return;}var btn=document.createElement('button');btn.id='ws-reps-btn';btn.type='button';btn.textContent='📋 نسخ قائمة المناديب';btn.setAttribute('data-ws-btn','copy-reps');btn.style.cssText='background:#2e5bff;color:#fff;border:none;border-radius:4px;padding:6px 12px;cursor:pointer;font-size:13px;margin:0 6px;white-space:nowrap;';btn.addEventListener('click',function(){collectAll(btn);});var inp=Array.from(document.querySelectorAll('input')).find(function(i){var p=i.parentElement,d=0;while(p&&d<3){if(p.textContent.indexOf('بحث')!==-1){return true;}p=p.parentElement;d++;}});if(inp&&inp.parentElement){inp.parentElement.insertBefore(btn,inp);}else{btn.style.cssText+='position:fixed;top:10px;left:10px;z-index:99999;';document.body.appendChild(btn);}}
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
