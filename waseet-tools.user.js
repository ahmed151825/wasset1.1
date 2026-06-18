// ==UserScript==
// @name          3احمد محمد كريم
// @namespace    waseet-tools
// @version      3.4
// @description  أدوات مركز خدمة العملاء - الوسيط للنقل العام (فحص تأخير تلقائي + تحكم بالشفافية + قوالب رسائل قابلة للتحرير + علامة استخدام)
// @match        https://alwaseet-iq.net/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/ahmed151825/wasset1.1/main/waseet-tools.user.js
// @downloadURL  https://raw.githubusercontent.com/ahmed151825/wasset1.1/main/waseet-tools.user.js
// ==/UserScript==

/*
  سجل التحديثات (v3.3):
  ───────────────────────────────────────────────────────────
  • FIX A: getPrice كانت قد تختار رقم الطلب نفسه كـ"سعر" بالخطأ
           (لأن رقم الطلب رقم ضمن نفس المجال 500-5,000,000).
           تم استثناء خلية رقم الطلب وأي خلية تحتوي رابط (هاتف).
  • FIX B: فحص التأخير كان يعتمد معيارين مختلفين لطول رقم الطلب
           (5 أرقام أو 6 أرقام) في دالتين مختلفتين، وقد يكرر
           نفس الصف مرتين. تم توحيدها بمعيار واحد + منع التكرار.
  • FIX C: طلبات فحص التأخير (fetch) لم تكن ترسل رمز الحماية
           CSRF الذي تتطلبه أغلب تطبيقات Laravel، فكانت تفشل
           بصمت على بعض الصفحات. تمت إضافة الرمز تلقائياً من
           meta[name=csrf-token] أو من كوكي XSRF-TOKEN إن وُجد.
  • FIX D: الطلبات التي لا تحمل حالة "قيد التوصيل" كانت تُعاد
           محاولة فحصها كل 2 ثانية إلى الأبد (استهلاك شبكة غير
           ضروري). الآن تُخزَّن نتيجة "غير معروف" مؤقتاً ولا
           يُعاد فحصها إلا كل 3 دقائق.
  • NEW:   قالب تقرير الأجور الآن قابل للتحرير بالكامل من
           الإعدادات (مع اسم المحطة)، مع إمكانية الاستعادة
           للوضع الافتراضي.
  • NEW:   قوالب جاهزة لرسالة الزبون (واتساب/SMS) يمكن اختيارها
           من الإعدادات، بالإضافة لخيار "مخصص" لتحرير نص حر.
  ───────────────────────────────────────────────────────────
  سجل التحديثات (v3.4):
  ───────────────────────────────────────────────────────────
  • FIX E: السبب الحقيقي لعدم عمل أي قالب لرسالة الزبون: كانت
           الرسالة تُبنى وتُحفظ داخل رابط الزر مرة واحدة فقط لحظة
           ظهور الصف على الشاشة — أي قبل أن يفتح المستخدم الإعدادات
           ويختار قالباً، فلا يظهر أي أثر للتغيير على الطلبات
           المعروضة فعلاً. الآن تُبنى الرسالة (واتساب التاجر، واتساب
           الزبون، SMS الزبون) من جديد في لحظة الضغط على الزر، فتعكس
           القالب الحالي المختار فوراً.
  • NEW:   عند الضغط على أي من أزرار (💬 واتساب التاجر / 📦 واتساب
           الزبون / 📱 SMS الزبون) تظهر علامة ✅ صغيرة بشكل دائم
           بجانب الزر لتعرف بسهولة أنك استخدمته لهذا الطلب.
  ───────────────────────────────────────────────────────────
*/

(function () {
  'use strict';

  // ─────────────────────────────────────────
  // تخزين عام — يدعم GM وlocalStorage معاً
  // ─────────────────────────────────────────
  function storeSet(key, val) {
    try { if (typeof GM_setValue !== 'undefined') { GM_setValue(key, val); } } catch (e) {}
    try { localStorage.setItem(key, val); } catch (e) {}
  }

  function storeGet(key) {
    try {
      if (typeof GM_getValue !== 'undefined') {
        var v = GM_getValue(key, null);
        if (v !== null && v !== undefined) { return v; }
      }
    } catch (e) {}
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  // ─────────────────────────────────────────
  // دوال مساعدة عامة
  // ─────────────────────────────────────────
  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function waitFor(selector, cb, timeout) {
    var limit = timeout || 10000;
    var start = Date.now();
    var timer = setInterval(function () {
      var el = document.querySelector(selector);
      if (el) { clearInterval(timer); cb(el); }
      else if (Date.now() - start > limit) {
        clearInterval(timer);
        console.warn('[أدوات الوسيط] تعذر العثور على العنصر: ' + selector);
      }
    }, 200);
  }

  function openTab(url, name) {
    var w = window.open(url, name || '_blank');
    if (!w) { alert('المتصفح منع فتح النافذة.\nيرجى السماح بالنوافذ المنبثقة لهذا الموقع.'); }
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); }
    catch (e) { alert('فشل النسخ. يرجى النسخ يدوياً:\n\n' + text); }
    document.body.removeChild(ta);
  }

  // استبدال {placeholder} بقيم فعلية ضمن نص القالب
  function renderTemplate(tpl, vars) {
    return String(tpl || '').replace(/\{(\w+)\}/g, function (m, key) {
      return (vars[key] !== undefined && vars[key] !== null) ? String(vars[key]) : '';
    });
  }

  // ─────────────────────────────────────────
  // NEW: علامة "✅ تم الاستخدام" تظهر بشكل دائم فوق الزر بعد أول ضغطة
  // ─────────────────────────────────────────
  function makeUsedBadgeWrapper(innerEl) {
    var wrap = document.createElement('span');
    wrap.style.cssText = 'position:relative;display:inline-block;vertical-align:middle;';

    var badge = document.createElement('span');
    badge.textContent = '✅';
    badge.style.cssText = 'position:absolute;top:-6px;right:-6px;font-size:10px;line-height:1;display:none;pointer-events:none;filter:drop-shadow(0 0 1px #fff);';

    wrap.appendChild(innerEl);
    wrap.appendChild(badge);

    return {
      el: wrap,
      markUsed: function () {
        badge.style.display = 'inline';
        if (innerEl.title && innerEl.title.indexOf('✓ تم الإرسال') === -1) {
          innerEl.title += '  —  ✓ تم الإرسال';
        }
      }
    };
  }

  // ─────────────────────────────────────────
  // FIX #1: إرسال SMS بدون تغيير الصفحة
  // ─────────────────────────────────────────
  function openSmsLink(phone, body) {
    try {
      var smsUrl = 'sms:' + phone + '?body=' + encodeURIComponent(body);
      var iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;border:none;';
      iframe.src = smsUrl;
      document.body.appendChild(iframe);
      setTimeout(function () {
        if (iframe.parentNode) { iframe.parentNode.removeChild(iframe); }
      }, 1000);
    } catch (e) {
      console.warn('[أدوات الوسيط] SMS fallback:', e);
      var link = document.createElement('a');
      link.href = 'sms:' + phone + '?body=' + encodeURIComponent(body);
      link.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(link);
      link.click();
      setTimeout(function () {
        if (link.parentNode) { link.parentNode.removeChild(link); }
      }, 500);
    }
  }

  // ─────────────────────────────────────────
  // MutationObserver مع حماية من التكرار
  // ─────────────────────────────────────────
  function observeAndRun(fn, delay) {
    var pending = false;
    function run() {
      fn();
      applyVisibility();
      pending = false;
    }
    run();
    var obs = new MutationObserver(function () {
      if (pending) { return; }
      pending = true;
      setTimeout(run, delay || 400);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return obs;
  }

  function renderAndSync(fn) {
    fn();
    applyVisibility();
  }

  // ─────────────────────────────────────────
  // القوالب الجاهزة لرسالة الزبون (واتساب/SMS)
  // ─────────────────────────────────────────
  var PRESET_CUSTOMER_TEMPLATES = {
    default: {
      label: 'الرسالة الافتراضية',
      text: 'معك مركز خدمة العملاء "لشركة الوسيط للنقل العام"\n' +
            'لديكم طلب من بيج/ {merchant}\n' +
            'سعر الطلب/ {price}\n' +
            'رقم الطلب/ {order}\n' +
            'يرجى التواصل معنا لإيصاله إليكم..'
    },
    short: {
      label: 'رسالة مختصرة',
      text: 'خدمة عملاء الوسيط: طلبكم رقم {order} من {merchant} بسعر {price}.\n' +
            'يرجى التواصل معنا لإيصاله.'
    },
    friendly: {
      label: 'رسالة ودية',
      text: 'السلام عليكم 🌹\n' +
            'معك مركز خدمة العملاء لشركة الوسيط للنقل العام\n' +
            'لديكم طلب من: {merchant}\n' +
            'السعر: {price}\n' +
            'رقم الطلب: {order}\n' +
            'نرجو التواصل معنا بأقرب وقت لتسليم طلبكم 🙏'
    },
    formal: {
      label: 'رسالة رسمية',
      text: 'تحية طيبة،\n' +
            'نحيطكم علماً بوجود طلب باسم {merchant} برقم {order} وبسعر {price} لدى شركة الوسيط للنقل العام.\n' +
            'يرجى التواصل مع مركز خدمة العملاء في أقرب وقت ممكن لتنسيق التسليم.'
    },
    custom: {
      label: '✏️ مخصص (تحرير يدوي)',
      text: null
    }
  };

  function getCustomerMessageTemplate() {
    var id = wsSettings.customerTemplateId || 'default';
    if (id === 'custom') {
      return (wsSettings.customerCustomTemplate && wsSettings.customerCustomTemplate.trim())
        ? wsSettings.customerCustomTemplate
        : PRESET_CUSTOMER_TEMPLATES.default.text;
    }
    var preset = PRESET_CUSTOMER_TEMPLATES[id];
    return preset && preset.text ? preset.text : PRESET_CUSTOMER_TEMPLATES.default.text;
  }

  // ─────────────────────────────────────────
  // قالب تقرير الأجور (قابل للتحرير)
  // ─────────────────────────────────────────
  var DEFAULT_REPORT_TEMPLATE =
    'التقرير ✅\n' +
    'اسم المحطة: {station}\n' +
    'اسم المؤظف : {employee}\n' +
    'التاريخ : {date}\n' +
    'اليوم :  {day}\n' +
    'العادي \n' +
    'عدد اجور 5000  ={normal5000}\n' +
    'عدد اجور 4000={normal4000}\n' +
    'عدد اجور 3000={normal3000}\n' +
    'عدد اجور 2000={normal2000}\n' +
    '————————-\n' +
    'Vip\n' +
    'عدد اجور 5000  ={vip5000}\n' +
    'عدد اجور 4000={vip4000}\n' +
    'عدد اجور 3000={vip3000}\n' +
    'عدد اجور 2000={vip2000}\n' +
    '——————————-\n' +
    'المجموع \n' +
    'عدد اجور 5000  ={total5000}\n' +
    'عدد اجور 4000={total4000}\n' +
    'عدد اجور 3000={total3000}\n' +
    'عدد اجور 2000={total2000}\n' +
    '——————————————-';

  // ─────────────────────────────────────────
  // إعدادات إظهار/إخفاء الأزرار + القوالب
  // ─────────────────────────────────────────
  var SETTINGS_KEY = 'waseet_ws_settings';

  var DEFAULT_SETTINGS = {
    showStory:       true,
    showFees:        true,
    showEdit:        true,
    showWsMerchant:  true,
    showWsCustomer:  true,
    showSms:         true,
    showDelayCheck:  true,
    showCopyReport:  true,
    showCopyReps:    true,
    opacity:         100,
    stationName:           'المنصور',
    reportTemplate:         DEFAULT_REPORT_TEMPLATE,
    customerTemplateId:     'default',
    customerCustomTemplate: ''
  };

  function loadSettings() {
    var raw = storeGet(SETTINGS_KEY);
    if (!raw) { return Object.assign({}, DEFAULT_SETTINGS); }
    try {
      var parsed = JSON.parse(raw);
      return Object.assign({}, DEFAULT_SETTINGS, parsed);
    } catch (e) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }
  }

  function saveSettings(s) {
    storeSet(SETTINGS_KEY, JSON.stringify(s));
  }

  var wsSettings = loadSettings();

  var VISIBILITY_MAP = {
    'story':         'showStory',
    'fees':          'showFees',
    'edit':          'showEdit',
    'ws-merchant':   'showWsMerchant',
    'ws-customer':   'showWsCustomer',
    'sms-customer':  'showSms',
    'delay-check':   'showDelayCheck',
    'copy-report':   'showCopyReport',
    'copy-reps':     'showCopyReps'
  };

  function applyVisibility() {
    var op = (wsSettings.opacity != null ? wsSettings.opacity : 100) / 100;
    Object.keys(VISIBILITY_MAP).forEach(function (btnKey) {
      var visible = !!wsSettings[VISIBILITY_MAP[btnKey]];
      document.querySelectorAll('[data-ws-btn="' + btnKey + '"]').forEach(function (el) {
        el.style.display  = visible ? '' : 'none';
        el.style.opacity  = op;
      });
    });
  }

  // ─────────────────────────────────────────
  // محرر قوالب عام
  // ─────────────────────────────────────────
  function openTemplateEditor(opts) {
    if (document.getElementById('ws-tpl-overlay')) { return; }

    var overlay = document.createElement('div');
    overlay.id = 'ws-tpl-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000000;display:flex;align-items:center;justify-content:center;direction:rtl;';

    var panel = document.createElement('div');
    panel.style.cssText = 'background:#fff;border-radius:8px;padding:16px 18px;width:360px;max-height:85vh;overflow:auto;box-shadow:0 4px 20px rgba(0,0,0,.35);font-family:Tahoma,Arial,sans-serif;';

    var title = document.createElement('h3');
    title.textContent = opts.title;
    title.style.cssText = 'margin:0 0 8px;font-size:14px;color:#222;';
    panel.appendChild(title);

    if (opts.help) {
      var help = document.createElement('div');
      help.textContent = opts.help;
      help.style.cssText = 'font-size:11px;color:#666;background:#f5f5f5;border-radius:5px;padding:6px 8px;margin-bottom:8px;white-space:pre-line;line-height:1.6;';
      panel.appendChild(help);
    }

    var textarea = document.createElement('textarea');
    textarea.value = opts.value || '';
    textarea.rows = 10;
    textarea.style.cssText = 'width:100%;box-sizing:border-box;font-family:monospace;font-size:12px;direction:rtl;padding:6px;border:1px solid #ccc;border-radius:5px;resize:vertical;';
    panel.appendChild(textarea);

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:6px;margin-top:10px;';

    if (opts.defaultValue) {
      var resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.textContent = 'استعادة الافتراضي';
      resetBtn.style.cssText = 'flex:1;background:#888;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;';
      resetBtn.addEventListener('click', function () { textarea.value = opts.defaultValue; });
      btnRow.appendChild(resetBtn);
    }

    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = '💾 حفظ';
    saveBtn.style.cssText = 'flex:1;background:#28a745;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;';
    saveBtn.addEventListener('click', function () {
      opts.onSave(textarea.value);
      overlay.remove();
    });
    btnRow.appendChild(saveBtn);

    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'إلغاء';
    cancelBtn.style.cssText = 'flex:1;background:#2e5bff;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;';
    cancelBtn.addEventListener('click', function () { overlay.remove(); });
    btnRow.appendChild(cancelBtn);

    panel.appendChild(btnRow);
    overlay.appendChild(panel);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { overlay.remove(); } });
    document.body.appendChild(overlay);
  }

  // ─────────────────────────────────────────
  // لوحة الإعدادات
  // ─────────────────────────────────────────
  function buildSettingsPanel() {
    if (document.getElementById('ws-settings-overlay')) { return; }

    var overlay = document.createElement('div');
    overlay.id = 'ws-settings-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:999999;display:flex;align-items:center;justify-content:center;direction:rtl;';

    var panel = document.createElement('div');
    panel.style.cssText = 'background:#fff;border-radius:8px;padding:18px 20px;width:320px;max-height:80vh;overflow:auto;box-shadow:0 4px 20px rgba(0,0,0,.3);font-family:Tahoma,Arial,sans-serif;';

    var title = document.createElement('h3');
    title.textContent = '⚙️ إظهار/إخفاء الأزرار والأيقونات';
    title.style.cssText = 'margin:0 0 12px;font-size:15px;color:#222;';
    panel.appendChild(title);

    var items = [
      { key: 'showStory',      label: '🔍 زر قصة الطلب' },
      { key: 'showFees',       label: '➕ زر أجور التوصيل' },
      { key: 'showEdit',       label: '🌐 زر تغيير العنوان' },
      { key: 'showWsMerchant', label: '💬 واتساب التاجر' },
      { key: 'showWsCustomer', label: '📦 واتساب الزبون' },
      { key: 'showSms',        label: '📱 رسالة SMS للزبون' },
      { key: 'showDelayCheck', label: '🔎 زر فحص التأخير' },
      { key: 'showCopyReport', label: '📋 زر نسخ التقرير (صفحة الأجور)' },
      { key: 'showCopyReps',   label: '📋 زر نسخ قائمة المناديب' }
    ];

    items.forEach(function (item) {
      var row = document.createElement('label');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 2px;font-size:13px;color:#333;cursor:pointer;border-bottom:1px solid #eee;';

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!wsSettings[item.key];
      cb.addEventListener('change', function () {
        wsSettings[item.key] = cb.checked;
        saveSettings(wsSettings);
        applyVisibility();
      });

      var span = document.createElement('span');
      span.textContent = item.label;

      row.appendChild(cb);
      row.appendChild(span);
      panel.appendChild(row);
    });

    var opacitySection = document.createElement('div');
    opacitySection.style.cssText = 'margin-top:14px;padding-top:12px;border-top:1px solid #ddd;';

    var opacityLabel = document.createElement('div');
    opacityLabel.textContent = 'مستوى شفافية الأزرار: ' + wsSettings.opacity + '%';
    opacityLabel.style.cssText = 'font-size:13px;color:#333;margin-bottom:6px;';

    var opacitySlider = document.createElement('input');
    opacitySlider.type = 'range';
    opacitySlider.min = '20';
    opacitySlider.max = '100';
    opacitySlider.step = '5';
    opacitySlider.value = wsSettings.opacity;
    opacitySlider.style.cssText = 'width:100%;cursor:pointer;';
    opacitySlider.addEventListener('input', function () {
      wsSettings.opacity = parseInt(opacitySlider.value, 10);
      opacityLabel.textContent = 'مستوى شفافية الأزرار: ' + wsSettings.opacity + '%';
      saveSettings(wsSettings);
      applyVisibility();
    });

    opacitySection.appendChild(opacityLabel);
    opacitySection.appendChild(opacitySlider);
    panel.appendChild(opacitySection);

    var custSection = document.createElement('div');
    custSection.style.cssText = 'margin-top:14px;padding-top:12px;border-top:1px solid #ddd;';

    var custTitle = document.createElement('div');
    custTitle.textContent = '✉️ قالب رسالة الزبون (واتساب/SMS)';
    custTitle.style.cssText = 'font-size:13px;color:#333;margin-bottom:6px;font-weight:bold;';
    custSection.appendChild(custTitle);

    var custSelect = document.createElement('select');
    custSelect.style.cssText = 'width:100%;padding:6px;border:1px solid #ccc;border-radius:5px;font-size:12px;margin-bottom:6px;';
    Object.keys(PRESET_CUSTOMER_TEMPLATES).forEach(function (id) {
      var opt = document.createElement('option');
      opt.value = id;
      opt.textContent = PRESET_CUSTOMER_TEMPLATES[id].label;
      if (id === (wsSettings.customerTemplateId || 'default')) { opt.selected = true; }
      custSelect.appendChild(opt);
    });

    var custEditBtn = document.createElement('button');
    custEditBtn.type = 'button';
    custEditBtn.textContent = '✏️ تحرير القالب المخصص';
    custEditBtn.style.cssText = 'width:100%;background:#e67e22;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;display:' +
      (custSelect.value === 'custom' ? 'block' : 'none') + ';';

    custSelect.addEventListener('change', function () {
      wsSettings.customerTemplateId = custSelect.value;
      saveSettings(wsSettings);
      custEditBtn.style.display = (custSelect.value === 'custom') ? 'block' : 'none';
    });

    custEditBtn.addEventListener('click', function () {
      openTemplateEditor({
        title: 'تحرير قالب رسالة الزبون',
        help: 'المتغيرات المتاحة:\n{merchant} = اسم المتجر/البيج\n{price} = سعر الطلب\n{order} = رقم الطلب',
        value: (wsSettings.customerCustomTemplate && wsSettings.customerCustomTemplate.trim())
          ? wsSettings.customerCustomTemplate
          : PRESET_CUSTOMER_TEMPLATES.default.text,
        defaultValue: PRESET_CUSTOMER_TEMPLATES.default.text,
        onSave: function (val) {
          wsSettings.customerCustomTemplate = val;
          saveSettings(wsSettings);
        }
      });
    });

    custSection.appendChild(custSelect);
    custSection.appendChild(custEditBtn);
    panel.appendChild(custSection);

    var repSection = document.createElement('div');
    repSection.style.cssText = 'margin-top:14px;padding-top:12px;border-top:1px solid #ddd;';

    var repTitle = document.createElement('div');
    repTitle.textContent = '📋 قالب تقرير الأجور';
    repTitle.style.cssText = 'font-size:13px;color:#333;margin-bottom:6px;font-weight:bold;';
    repSection.appendChild(repTitle);

    var stationLabel = document.createElement('div');
    stationLabel.textContent = 'اسم المحطة:';
    stationLabel.style.cssText = 'font-size:12px;color:#555;margin-bottom:3px;';
    repSection.appendChild(stationLabel);

    var stationInput = document.createElement('input');
    stationInput.type = 'text';
    stationInput.value = wsSettings.stationName || 'المنصور';
    stationInput.style.cssText = 'width:100%;box-sizing:border-box;padding:6px;border:1px solid #ccc;border-radius:5px;font-size:12px;margin-bottom:8px;';
    stationInput.addEventListener('change', function () {
      wsSettings.stationName = stationInput.value.trim() || 'المنصور';
      saveSettings(wsSettings);
    });
    repSection.appendChild(stationInput);

    var repEditBtn = document.createElement('button');
    repEditBtn.type = 'button';
    repEditBtn.textContent = '✏️ تحرير نص التقرير';
    repEditBtn.style.cssText = 'width:100%;background:#e67e22;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;';
    repEditBtn.addEventListener('click', function () {
      openTemplateEditor({
        title: 'تحرير قالب تقرير الأجور',
        help: 'المتغيرات المتاحة:\n{station} {employee} {date} {day}\n{normal5000} {normal4000} {normal3000} {normal2000}\n{vip5000} {vip4000} {vip3000} {vip2000}\n{total5000} {total4000} {total3000} {total2000}',
        value: (wsSettings.reportTemplate && wsSettings.reportTemplate.trim()) ? wsSettings.reportTemplate : DEFAULT_REPORT_TEMPLATE,
        defaultValue: DEFAULT_REPORT_TEMPLATE,
        onSave: function (val) {
          wsSettings.reportTemplate = val;
          saveSettings(wsSettings);
        }
      });
    });
    repSection.appendChild(repEditBtn);
    panel.appendChild(repSection);

    var resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.textContent = 'إعادة الكل للوضع الافتراضي';
    resetBtn.style.cssText = 'margin-top:14px;width:100%;background:#888;color:#fff;border:none;border-radius:5px;padding:7px;cursor:pointer;font-size:12px;';
    resetBtn.addEventListener('click', function () {
      wsSettings = Object.assign({}, DEFAULT_SETTINGS);
      saveSettings(wsSettings);
      applyVisibility();
      overlay.remove();
      buildSettingsPanel();
    });
    panel.appendChild(resetBtn);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'إغلاق';
    closeBtn.style.cssText = 'margin-top:8px;width:100%;background:#2e5bff;color:#fff;border:none;border-radius:5px;padding:8px;cursor:pointer;font-size:13px;';
    closeBtn.addEventListener('click', function () { overlay.remove(); });
    panel.appendChild(closeBtn);

    overlay.appendChild(panel);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) { overlay.remove(); } });
    document.body.appendChild(overlay);
  }

  function addSettingsBtn() {
    if (document.getElementById('ws-settings-btn')) { return; }
    var btn = document.createElement('button');
    btn.id = 'ws-settings-btn';
    btn.type = 'button';
    btn.textContent = '⚙️ الإعدادات';
    btn.style.cssText = [
      'position:fixed', 'top:10px', 'left:10px', 'z-index:99999',
      'background:#555', 'color:#fff', 'border:none', 'border-radius:4px',
      'padding:8px 14px', 'cursor:pointer', 'font-size:13px', 'font-weight:bold',
      'box-shadow:0 2px 6px rgba(0,0,0,.3)'
    ].join(';');
    btn.addEventListener('click', buildSettingsPanel);
    document.body.appendChild(btn);
  }

  // ─────────────────────────────────────────
  // الصفحة الحالية
  // ─────────────────────────────────────────
  var PAGE = location.href;

  // ═════════════════════════════════════════════════════════════
  //  ① call_center
  // ═════════════════════════════════════════════════════════════
  if (PAGE.indexOf('/cs/call_center') !== -1) {

    var RE_ORDER = /^\d{6,}$/;
    var RE_PHONE = /^(0|964)/;

    function directText(el) {
      var s = '';
      el.childNodes.forEach(function (n) {
        if (n.nodeType === 3) { s += n.textContent; }
      });
      return s.trim();
    }

    function makeBtn(label, tip, color, fn, key) {
      var b = document.createElement('button');
      b.textContent = label;
      b.title = tip;
      b.type = 'button';
      if (key) { b.setAttribute('data-ws-btn', key); }
      b.style.cssText = [
        'display:inline-block',
        'margin:2px 2px 0',
        'background:' + color,
        'color:#fff',
        'border:none',
        'border-radius:4px',
        'padding:2px 6px',
        'cursor:pointer',
        'font-size:13px',
        'line-height:1.5',
        'vertical-align:middle'
      ].join(';');
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        fn();
      });
      return b;
    }

    function getMerchantCell(row) {
      var cells = row.querySelectorAll('td');
      for (var i = 0; i < cells.length; i++) {
        var td = cells[i];
        if (td.style.display === 'none') { continue; }
        if (!td.querySelector('a.phone-number')) { continue; }
        if (td.querySelector('div')) { continue; }
        return td;
      }
      return null;
    }

    function getCustomerCell(row) {
      var cells = row.querySelectorAll('td');
      for (var i = 0; i < cells.length; i++) {
        var td = cells[i];
        if (td.style.display === 'none') { continue; }
        if (!td.querySelector('a.phone-number')) { continue; }
        if (!td.querySelector('div')) { continue; }
        return td;
      }
      return null;
    }

    function extractPhone(cell) {
      var link = cell.querySelector('a.phone-number');
      if (!link) { return ''; }
      return (link.href || '')
        .replace('https://wa.me/', '')
        .replace(/\+/g, '')
        .trim();
    }

    function getMerchantName(row) {
      var el = row.querySelector('[id^="merchant_name-"]');
      return el ? el.textContent.trim() : '';
    }

    function getPrice(row, orderNum) {
      var orderDigits = (orderNum || '').replace(/\D/g, '');
      var cells = row.querySelectorAll('td');
      for (var i = 0; i < cells.length; i++) {
        var td = cells[i];
        if (td.style.display === 'none') { continue; }
        if (td.classList.contains('dtr-control')) { continue; }
        if (td.querySelector('a')) { continue; }
        var raw = td.textContent.trim().replace(/,/g, '');
        if (!/^\d+$/.test(raw)) { continue; }
        if (raw === orderDigits) { continue; }
        var n = parseInt(raw, 10);
        if (n >= 500 && n <= 5000000) { return td.textContent.trim(); }
      }
      return '';
    }

    function addWhatsappBtns(row, orderNum) {

      if (!row.dataset.wsMerchant) {
        var mCell = getMerchantCell(row);
        if (mCell && !mCell.querySelector('[data-ws-merchant]')) {
          var mPhone = extractPhone(mCell);
          if (mPhone && mPhone.length >= 7) {
            row.dataset.wsMerchant = '1';

            var mBtn = document.createElement('button');
            mBtn.type = 'button';
            mBtn.textContent = '💬';
            mBtn.title = 'واتساب التاجر';
            mBtn.setAttribute('data-ws-merchant', '1');
            mBtn.style.cssText = 'display:block;margin:4px auto 0;font-size:20px;background:none;border:none;cursor:pointer;line-height:1.3;padding:0;';

            var mWrap = makeUsedBadgeWrapper(mBtn);
            mWrap.el.setAttribute('data-ws-btn', 'ws-merchant');
            mWrap.el.style.display = 'block';
            mWrap.el.style.textAlign = 'center';
            mWrap.el.style.margin = '4px auto 0';

            mBtn.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();

              var notesEl = row.querySelector('[id^="deliver_notes-"]');
              var notes = notesEl ? notesEl.textContent.trim() : '';
              notes = notes
                .replace(/تبليغ المندوب:[^)]*\)?/gi, '')
                .replace(/واتس لايرد\s*/gi, '')
                .replace(/لا توجد ملاحظة من قبل المندوب\s*/gi, '')
                .replace(/\(\s*\)/g, '')
                .replace(/^\(|\)$/g, '')
                .trim();

              var mMsg = 'السلام عليكم\nمعك قسم التبليغات\nلديك طلب فيه تغيير سعر\n\n';
              if (notes) { mMsg += '( ' + notes + ' )\n'; }
              mMsg += '( ' + orderNum + ' )\n\nشاكرين تعاونكم';

              openTab('https://wa.me/' + mPhone + '?text=' + encodeURIComponent(mMsg), 'ws_wa_m_' + orderNum);
              mWrap.markUsed();
            });

            mCell.appendChild(mWrap.el);
          }
        }
      }

      if (!row.dataset.wsCustomer) {
        var cCell = getCustomerCell(row);
        if (cCell && !cCell.querySelector('[data-ws-customer]')) {
          var cPhone = extractPhone(cCell);
          if (cPhone && cPhone.length >= 7) {
            row.dataset.wsCustomer = '1';

            var localPhone = cPhone;
            if (localPhone.indexOf('964') === 0) {
              localPhone = '0' + localPhone.slice(3);
            }

            function buildCustomerMessage() {
              var pageName   = getMerchantName(row);
              var price      = getPrice(row, orderNum);
              var cleanOrder = orderNum.replace(/\D/g, '');
              return renderTemplate(getCustomerMessageTemplate(), {
                merchant: pageName || '...',
                price:    price    || '...',
                order:    cleanOrder
              });
            }

            var cBtn = document.createElement('button');
            cBtn.type = 'button';
            cBtn.textContent = '📦';
            cBtn.title = 'واتساب الزبون';
            cBtn.setAttribute('data-ws-customer', '1');
            cBtn.style.cssText = 'display:inline-block;font-size:20px;background:none;border:none;cursor:pointer;line-height:1.3;padding:0;';

            var cWrap = makeUsedBadgeWrapper(cBtn);
            cWrap.el.setAttribute('data-ws-btn', 'ws-customer');
            cWrap.el.style.marginTop = '4px';
            cWrap.el.style.marginLeft = '4px';

            cBtn.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              var msg = buildCustomerMessage();
              openTab('https://wa.me/' + cPhone + '?text=' + encodeURIComponent(msg), 'ws_wa_c_' + orderNum);
              cWrap.markUsed();
            });

            cCell.appendChild(cWrap.el);

            var smsBtn = document.createElement('button');
            smsBtn.type = 'button';
            smsBtn.textContent = '📱';
            smsBtn.title = 'رسالة خط (شريحة) للزبون';
            smsBtn.setAttribute('data-sms-customer', '1');
            smsBtn.style.cssText = 'display:inline-block;font-size:20px;background:none;border:none;cursor:pointer;line-height:1.3;padding:0;';

            var smsWrap = makeUsedBadgeWrapper(smsBtn);
            smsWrap.el.setAttribute('data-ws-btn', 'sms-customer');
            smsWrap.el.style.marginTop = '4px';
            smsWrap.el.style.marginLeft = '4px';

            smsBtn.addEventListener('click', function (e) {
              e.preventDefault();
              e.stopPropagation();
              var msg = buildCustomerMessage();
              openSmsLink(localPhone, msg);
              smsWrap.markUsed();
            });
            cCell.appendChild(smsWrap.el);
          }
        }
      }
    }

    function addIcons() {
      document.querySelectorAll('td.dtr-control').forEach(function (cell) {
        var txt = directText(cell);

        if (cell.dataset.wsAdded) {
          var row0 = cell.closest('tr');
          if (row0 && txt) { addWhatsappBtns(row0, txt); }
          return;
        }

        if (!RE_ORDER.test(txt) || RE_PHONE.test(txt)) { return; }
        cell.dataset.wsAdded = '1';

        var capturedTxt = txt;

        var wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;gap:3px;margin-top:4px;';

        wrap.appendChild(makeBtn('🔍', 'قصة الطلب: ' + capturedTxt, '#2e5bff', function () {
          openTab('https://alwaseet-iq.net/order-story?ws_order=' + encodeURIComponent(capturedTxt), 'ws_story');
        }, 'story'));
        wrap.appendChild(makeBtn('➕', 'أجور التوصيل: ' + capturedTxt, '#28a745', function () {
          openTab('https://alwaseet-iq.net/cs/delivery-fees-differences?ws_order=' + encodeURIComponent(capturedTxt), 'ws_fees');
        }, 'fees'));
        wrap.appendChild(makeBtn('🌐', 'تغيير العنوان: ' + capturedTxt, '#e67e22', function () {
          openTab('https://alwaseet-iq.net/cs/editOrder?ws_order=' + encodeURIComponent(capturedTxt), 'ws_edit');
        }, 'edit'));

        cell.appendChild(wrap);

        var row1 = cell.closest('tr');
        if (row1) { addWhatsappBtns(row1, capturedTxt); }
      });
    }

    onReady(function () {
      setTimeout(function () {
        observeAndRun(addIcons, 400);
        renderAndSync(addSettingsBtn);
      }, 800);
    });
  }

  // ═════════════════════════════════════════════════════════════
  //  ② order-story
  // ═════════════════════════════════════════════════════════════
  if (PAGE.indexOf('/order-story') !== -1) {
    var storyParams = new URLSearchParams(location.search);
    var storyNum = storyParams.get('ws_order');
    if (storyNum) {
      onReady(function () {
        setTimeout(function () {
          var btn = document.querySelector('button[onclick="getOrderStory()"]');
          if (btn) { btn.click(); }
          else if (typeof getOrderStory === 'function') { getOrderStory(); }
          else { console.warn('[أدوات الوسيط] لم يتم العثور على زر فتح قصة الطلب.'); }

          waitFor('#swal2-input', function (inp) {
            inp.value = storyNum;
            inp.dispatchEvent(new Event('input',  { bubbles: true }));
            inp.dispatchEvent(new Event('change', { bubbles: true }));
            setTimeout(function () {
              var ok = document.querySelector('.swal2-confirm');
              if (ok) { ok.click(); }
              else { console.warn('[أدوات الوسيط] لم يتم العثور على زر التأكيد.'); }
            }, 500);
          });
        }, 800);
      });
    }
  }

  // ═════════════════════════════════════════════════════════════
  //  ③ delivery-fees-differences
  // ═════════════════════════════════════════════════════════════
  if (PAGE.indexOf('/cs/delivery-fees-differences') !== -1) {

    var feesParams = new URLSearchParams(location.search);
    var feesNum = feesParams.get('ws_order');
    if (feesNum) {
      onReady(function () {
        waitFor('input[name="orderQrId"]', function (inp) {
          inp.value = feesNum;
          inp.dispatchEvent(new Event('input',  { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          inp.focus();
        });
      });
    }

    var FEE_LIST = [5000, 4000, 3000, 2000];
    var DAYS     = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    function repColumn(table) {
      var headers = table.querySelectorAll('thead th, thead td');
      for (var i = 0; i < headers.length; i++) {
        if (headers[i].textContent.indexOf('مندوب') !== -1) { return i; }
      }
      return -1;
    }

    function buildCounts() {
      var c = {};
      FEE_LIST.forEach(function (v) { c[v] = { vip: 0, normal: 0 }; });

      document.querySelectorAll('table').forEach(function (tbl) {
        var ci = repColumn(tbl);
        if (ci < 0) { return; }
        var fee = null;

        tbl.querySelectorAll('tbody tr').forEach(function (row) {
          var m = row.textContent.match(/قيمة الفرق:\s*([\d,]+)/);
          if (m) {
            var n = parseInt(m[1].replace(/,/g, ''), 10);
            fee = FEE_LIST.indexOf(n) !== -1 ? n : null;
            return;
          }
          if (!fee) { return; }
          var cells = row.querySelectorAll('td');
          if (cells.length <= ci) { return; }
          var name = cells[ci].textContent.trim();
          if (!name) { return; }
          /[a-zA-Z]/.test(name) ? c[fee].vip++ : c[fee].normal++;
        });
      });
      return c;
    }

    function buildReport() {
      var c   = buildCounts();
      var now = new Date();
      var d   = pad2(now.getDate()) + '/' + pad2(now.getMonth() + 1) + '/' + now.getFullYear();
      var day = DAYS[now.getDay()];
      var f   = function (n) { return n > 0 ? n : ''; };
      var ov  = {};
      FEE_LIST.forEach(function (v) { ov[v] = c[v].vip + c[v].normal; });

      var empEl = document.querySelector('span.user-name');
      var empName = empEl ? empEl.textContent.trim() : 'غير معروف';

      var tpl = (wsSettings.reportTemplate && wsSettings.reportTemplate.trim())
        ? wsSettings.reportTemplate
        : DEFAULT_REPORT_TEMPLATE;

      return renderTemplate(tpl, {
        station:  wsSettings.stationName || 'المنصور',
        employee: empName,
        date:     d,
        day:      day,
        normal5000: f(c[5000].normal), normal4000: f(c[4000].normal),
        normal3000: f(c[3000].normal), normal2000: f(c[2000].normal),
        vip5000:    f(c[5000].vip),    vip4000:    f(c[4000].vip),
        vip3000:    f(c[3000].vip),    vip2000:    f(c[2000].vip),
        total5000:  f(ov[5000]),       total4000:  f(ov[4000]),
        total3000:  f(ov[3000]),       total2000:  f(ov[2000])
      });
    }

    function addReportBtn() {
      if (document.getElementById('ws-report-btn')) { return; }
      var btn = document.createElement('button');
      btn.id = 'ws-report-btn';
      btn.type = 'button';
      btn.textContent = '📋 نسخ التقرير';
      btn.setAttribute('data-ws-btn', 'copy-report');
      btn.style.cssText = 'background:#28a745;color:#fff;border:none;border-radius:4px;padding:6px 12px;cursor:pointer;font-size:13px;margin:0 6px;white-space:nowrap;';
      btn.addEventListener('click', function () {
        copyText(buildReport());
        var orig = btn.textContent;
        btn.textContent = '✅ تم النسخ';
        setTimeout(function () { btn.textContent = orig; }, 1200);
      });

      var inp = document.querySelector('input[placeholder*="بحث"], input[placeholder*="ابحث"]')
        || Array.from(document.querySelectorAll('input')).find(function (i) {
          var p = i.parentElement, depth = 0;
          while (p && depth < 3) {
            if (p.textContent.indexOf('بحث') !== -1) { return true; }
            p = p.parentElement;
            depth++;
          }
        });

      if (inp && inp.parentElement) {
        inp.parentElement.insertBefore(btn, inp);
      } else {
        btn.style.cssText += 'position:fixed;top:10px;left:10px;z-index:99999;';
        document.body.appendChild(btn);
      }
    }

    onReady(function () {
      setTimeout(function () { observeAndRun(addReportBtn, 400); }, 900);
    });
  }

  // ═════════════════════════════════════════════════════════════
  //  ④ editOrder
  // ═════════════════════════════════════════════════════════════
  if (PAGE.indexOf('/cs/editOrder') !== -1) {
    var editParams = new URLSearchParams(location.search);
    var editNum = editParams.get('ws_order');
    if (editNum) {
      onReady(function () {
        waitFor('#search', function (inp) {
          inp.value = editNum;
          inp.dispatchEvent(new Event('input',  { bubbles: true }));
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          inp.focus();
          setTimeout(function () {
            var searchBtn =
              document.querySelector('#btn-text') ||
              document.querySelector('button[type="submit"]') ||
              document.querySelector('form button') ||
              document.querySelector('input[type="submit"]');
            if (searchBtn) { searchBtn.click(); }
          }, 500);
        });
      });
    }
  }

  // ═════════════════════════════════════════════════════════════
  //  ⑤ delivering-orders
  // ═════════════════════════════════════════════════════════════
  if (PAGE.indexOf('/cs/delivering-orders') !== -1) {

    function collectPage() {
      var data = {};
      document.querySelectorAll('td[colspan]').forEach(function (cell) {
        var m = cell.textContent.trim().match(/^(.*?)\((\d+)\)\s*$/);
        if (!m) { return; }
        var name = m[1].trim();
        data[name] = (data[name] || 0) + parseInt(m[2], 10);
      });
      return data;
    }

    function lastPage() {
      var max = 1;
      document.querySelectorAll('.pagination a,.pagination button,.page-item a,.page-link').forEach(function (el) {
        var n = parseInt(el.textContent.trim(), 10);
        if (!isNaN(n) && n > max) { max = n; }
      });
      return max;
    }

    function currentPage() {
      var active = document.querySelector('.pagination .active a,.pagination .active button,.page-item.active .page-link');
      if (active) { return parseInt(active.textContent.trim(), 10) || 1; }
      var cur = Array.from(document.querySelectorAll('.pagination a,.pagination button')).find(function (el) {
        return el.getAttribute('aria-current') === 'page';
      });
      return cur ? parseInt(cur.textContent.trim(), 10) || 1 : 1;
    }

    function nextBtn() {
      return Array.from(document.querySelectorAll('a,button')).find(function (el) {
        return el.textContent.trim() === 'التالي'
          && !el.disabled
          && !el.classList.contains('disabled')
          && !el.parentElement.classList.contains('disabled');
      });
    }

    function formatReps(data) {
      return Object.keys(data).map(function (name) {
        var n = data[name];
        return name + ' (' + n + ')' + (n > 10 ? ' - القيد عالي' : '');
      }).join('\n');
    }

    async function collectAll(btn) {
      var orig = btn.textContent;
      btn.textContent = '⏳ جاري الجمع...';
      btn.disabled = true;

      var all = {};
      function merge(d) {
        Object.keys(d).forEach(function (k) { all[k] = (all[k] || 0) + d[k]; });
      }

      merge(collectPage());
      var last = lastPage();
      var cur  = currentPage();
      var safe = 0;

      while (safe++ < 100) {
        if (cur >= last) { break; }
        var nb = nextBtn();
        if (!nb) { break; }
        nb.click();

        await new Promise(function (resolve) {
          var tries = 0;
          var prev  = cur;
          var check = setInterval(function () {
            tries++;
            var now = currentPage();
            if (now !== prev && document.querySelector('td[colspan]')) {
              clearInterval(check);
              cur = now;
              resolve();
            }
            if (tries > 40) { clearInterval(check); resolve(); }
          }, 300);
        });

        merge(collectPage());
        btn.textContent = '⏳ صفحة ' + cur + ' / ' + last;
      }

      copyText(formatReps(all));
      btn.textContent = '✅ تم النسخ (' + Object.keys(all).length + ' مندوب)';
      btn.disabled = false;
      setTimeout(function () { btn.textContent = orig; }, 3000);
    }

    function addRepsBtn() {
      if (document.getElementById('ws-reps-btn')) { return; }
      if (!document.querySelector('td[colspan]')) { return; }

      var btn = document.createElement('button');
      btn.id = 'ws-reps-btn';
      btn.type = 'button';
      btn.textContent = '📋 نسخ قائمة المناديب';
      btn.setAttribute('data-ws-btn', 'copy-reps');
      btn.style.cssText = 'background:#2e5bff;color:#fff;border:none;border-radius:4px;padding:6px 12px;cursor:pointer;font-size:13px;margin:0 6px;white-space:nowrap;';
      btn.addEventListener('click', function () { collectAll(btn); });

      var inp = Array.from(document.querySelectorAll('input')).find(function (i) {
        var p = i.parentElement, d = 0;
        while (p && d < 3) {
          if (p.textContent.indexOf('بحث') !== -1) { return true; }
          p = p.parentElement; d++;
        }
      });

      if (inp && inp.parentElement) {
        inp.parentElement.insertBefore(btn, inp);
      } else {
        btn.style.cssText += 'position:fixed;top:10px;left:10px;z-index:99999;';
        document.body.appendChild(btn);
      }
    }

    onReady(function () {
      setTimeout(function () { observeAndRun(addRepsBtn, 400); }, 900);
    });
  }

  // ═════════════════════════════════════════════════════════════
  //  ⑥ فحص التأخير
  // ═════════════════════════════════════════════════════════════
  if (PAGE.indexOf('/cs/call_center') !== -1 || PAGE.indexOf('/cs/delivering-orders') !== -1) {

    var STATUS_DELIVERING = '3';
    var ONE_DAY = 24 * 60 * 60 * 1000;
    var UNKNOWN_RECHECK_MS = 3 * 60 * 1000;

    function parseDate(str) {
      if (!str) { return null; }
      var d = new Date(str.replace(' ', 'T'));
      return isNaN(d.getTime()) ? null : d;
    }

    function getCsrfToken() {
      var meta = document.querySelector('meta[name="csrf-token"]');
      if (meta && meta.content) { return meta.content; }
      var input = document.querySelector('input[name="_token"]');
      if (input && input.value) { return input.value; }
      return null;
    }

    function getCookie(name) {
      var match = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
      return match ? decodeURIComponent(match[1]) : null;
    }

    function fetchStory(orderId) {
      var headers = {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      };
      var token = getCsrfToken();
      if (token) { headers['X-CSRF-TOKEN'] = token; }
      var xsrfCookie = getCookie('XSRF-TOKEN');
      if (xsrfCookie) { headers['X-XSRF-TOKEN'] = xsrfCookie; }

      return fetch('https://alwaseet-iq.net/order-story/get-order-story', {
        method: 'POST',
        headers: headers,
        credentials: 'same-origin',
        body: 'order_id=' + encodeURIComponent(orderId)
      })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        try { return JSON.parse(t); } catch (e) { return null; }
      })
      .catch(function () { return null; });
    }

    function firstDeliveryDate(json) {
      if (!json || !json.data || !Array.isArray(json.data.story)) { return null; }
      var dates = json.data.story
        .filter(function (item) { return item.status_id === STATUS_DELIVERING; })
        .map(function (item) { return parseDate(item.log_created_at); })
        .filter(function (d) { return d !== null; });
      return dates.length ? new Date(Math.min.apply(null, dates.map(function (d) { return d.getTime(); }))) : null;
    }

    function getRows() {
      var rows = [];
      var seen = new Set();
      document.querySelectorAll('td').forEach(function (cell) {
        var txt = cell.textContent.trim();
        if (!/^\d{6,}$/.test(txt)) { return; }
        if (/^(0|964)/.test(txt)) { return; }
        var tr = cell.closest('tr');
        if (!tr || seen.has(tr)) { return; }
        seen.add(tr);
        rows.push({ id: txt, row: tr });
      });
      return rows;
    }

    var wsDelayResults = new Map();
    var wsDelayPending = new Set();
    var wsDelayIntervalId = null;
    var wsDelayRunning    = false;

    function resetRowStyle(row) {
      row.style.backgroundColor = '';
      row.style.color = '';
      row.removeAttribute('title');
    }

    function applyDelayResult(row, result) {
      if (result.late) {
        row.style.backgroundColor = '#ffd6d6';
        row.style.color = '#8a0000';
        row.title = 'قيد التوصيل منذ ' + result.hours.toFixed(1) + ' ساعة';
      }
    }

    function updateDelayBadge() {
      var badge = document.getElementById('ws-check-btn');
      if (!badge) { return; }
      var late = 0;
      wsDelayResults.forEach(function (r) { if (r.late) { late++; } });
      badge.textContent = '🔎 متأخر: ' + late;
      badge.style.background = late > 0 ? '#c0392b' : '#1a8a3a';
    }

    async function checkNewRows() {
      if (!wsSettings.showDelayCheck) { return; }
      if (wsDelayRunning) { return; }
      wsDelayRunning = true;

      try {
        var rows = getRows();
        var now  = new Date();
        var toFetch = [];

        rows.forEach(function (item) {
          var cached = wsDelayResults.get(item.id);
          if (cached) {
            if (cached.unknown) {
              if (now.getTime() - cached.checkedAt > UNKNOWN_RECHECK_MS && !wsDelayPending.has(item.id)) {
                toFetch.push(item);
              }
            } else {
              applyDelayResult(item.row, cached);
            }
          } else if (!wsDelayPending.has(item.id)) {
            toFetch.push(item);
          }
        });

        if (toFetch.length) {
          toFetch.forEach(function (item) { wsDelayPending.add(item.id); });

          var idx = 0;
          var CONCURRENCY = 4;

          function worker() {
            if (idx >= toFetch.length) { return Promise.resolve(); }
            var item = toFetch[idx++];
            return fetchStory(item.id).then(function (json) {
              var date = firstDeliveryDate(json);
              if (date) {
                var hours = (now - date) / 3600000;
                var result = { late: (now - date) >= ONE_DAY, hours: hours };
                wsDelayResults.set(item.id, result);
                applyDelayResult(item.row, result);
              } else {
                wsDelayResults.set(item.id, { unknown: true, checkedAt: Date.now() });
              }
            }).catch(function () {
              wsDelayResults.set(item.id, { unknown: true, checkedAt: Date.now() });
            }).then(function () {
              wsDelayPending.delete(item.id);
              return worker();
            });
          }

          var pool = [];
          for (var i = 0; i < CONCURRENCY; i++) { pool.push(worker()); }
          await Promise.all(pool);
        }

        updateDelayBadge();
      } finally {
        wsDelayRunning = false;
      }
    }

    function addCheckBtn() {
      if (document.getElementById('ws-check-btn')) { return; }
      var btn = document.createElement('button');
      btn.id = 'ws-check-btn';
      btn.type = 'button';
      btn.title = 'فحص تلقائي كل 2 ثانية للطلبات الجديدة فقط — اضغط لإعادة فحص جميع الطلبات من جديد';
      btn.textContent = '🔎 متأخر: 0';
      btn.setAttribute('data-ws-btn', 'delay-check');
      btn.style.cssText = [
        'position:fixed', 'top:10px', 'right:10px', 'z-index:99999',
        'background:#1a8a3a', 'color:#fff', 'border:none', 'border-radius:4px',
        'padding:8px 14px', 'cursor:pointer', 'font-size:13px', 'font-weight:bold',
        'box-shadow:0 2px 6px rgba(0,0,0,.3)'
      ].join(';');
      btn.addEventListener('click', function () {
        getRows().forEach(function (item) { resetRowStyle(item.row); });
        wsDelayResults.clear();
        wsDelayPending.clear();
        checkNewRows();
      });
      document.body.appendChild(btn);
    }

    onReady(function () {
      setTimeout(function () {
        renderAndSync(addCheckBtn);
        checkNewRows();
        if (wsDelayIntervalId !== null) { clearInterval(wsDelayIntervalId); }
        wsDelayIntervalId = setInterval(checkNewRows, 2000);
      }, 1000);
    });
  }

})();
