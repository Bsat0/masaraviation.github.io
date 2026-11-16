/* MASAR site script: menu, email drafts, journey planner, budget calculator.
   Nothing here sends data anywhere. Email actions open the visitor's own mail app. */
(function () {
  'use strict';
  var M = window.MASAR || {};
  var T = M.js || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fill = function (s, o) { return s.replace(/\{(\w+)\}/g, function (_, k) { return o[k]; }); };

  /* ---------- Mobile menu ---------- */
  var menuBtn = $('.menu-btn');
  var nav = $('#site-nav');
  if (menuBtn && nav) {
    var label = $('.visually-hidden', menuBtn);
    var setMenu = function (open, restoreFocus) {
      nav.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      label.textContent = open ? T.menuClose : T.menuOpen;
      if (!open && restoreFocus) menuBtn.focus();
    };
    menuBtn.addEventListener('click', function () { setMenu(nav.className.indexOf('open') === -1); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) setMenu(false, true); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  /* ---------- Language callout ----------
     A small note under the language switch, shown on every new visit (each new
     tab or browser session). Closing it, or switching language, hides it until
     the next visit, so it doesn't reappear on every page within one visit. */
  var tip = $('.lang-tip');
  if (tip) {
    var KEY = 'masar-lang-hint-closed';
    var seen = null;
    try { seen = sessionStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
    var closeTip = function (refocus) {
      try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* ignore */ }
      tip.hidden = true;
      root.classList.remove('tip-on');
      if (refocus) { var sw = $('.site-header .lang'); if (sw) sw.focus(); }
    };
    if (!seen) {
      setTimeout(function () { tip.hidden = false; root.classList.add('tip-on'); }, reduceMotion ? 0 : 700);
    }
    $('[data-hint-close]', tip).addEventListener('click', function () { closeTip(true); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !tip.hidden) closeTip(true); });
    $$('a[hreflang]').forEach(function (a) { a.addEventListener('click', function () { closeTip(false); }); });
  }

  /* ---------- Header: tighten after scrolling ---------- */
  var header = $('.site-header');
  if (header) {
    var onScroll = function () { header.classList.toggle('scrolled', window.scrollY > 24); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Scroll reveal ----------
     Content is visible without JS; with JS, blocks fade up as they enter the view.
     Cards in a row are staggered. Skipped entirely for reduced-motion visitors. */
  var revealSel = ['.section .eyebrow', '.section .h2', '.section .lead', '.section-foot', '.card', '.stage', '.photo-pair figure',
    '.link-card', '.choice-card', '.table-wrap', '.panel', '.short-answer', '.prose > h2', '.glossary', '.band-pink .wrap > *',
    '.reach-map', '.questions a', '.steps li', '.email-box'].join(',');
  var watchers = $$('.steps, .reach-map');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    $$(revealSel).forEach(function (el) {
      if (el.closest('.hero, .page-hero')) return;
      var sibs = el.parentElement ? Array.prototype.filter.call(el.parentElement.children, function (c) { return c.matches(revealSel); }) : [];
      var i = sibs.indexOf(el);
      if (i > 0) el.style.setProperty('--d', Math.min(i, 5) * 0.08 + 's');
      el.classList.add('reveal');
      io.observe(el);
    });
    watchers.forEach(function (el) { io.observe(el); });
  } else {
    watchers.forEach(function (el) { el.classList.add('in'); });
  }
  // Animated SVG planes: stop them entirely for reduced-motion visitors
  if (reduceMotion) $$('.reach-map svg').forEach(function (s) { if (s.pauseAnimations) s.pauseAnimations(); });

  /* ---------- Helpers ---------- */
  function openMail(subject, body) {
    window.location.href = 'mailto:' + M.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
  function copyText(text, statusEl) {
    var done = function () { statusEl.textContent = T.copied; };
    var fail = function () { statusEl.textContent = T.copyFailed; };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fail);
    else {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? done() : fail(); } catch (e) { fail(); }
      document.body.removeChild(ta);
    }
  }
  function setErr(input, msg) {
    var err = document.getElementById(input.id + '-err');
    if (err) err.textContent = msg || '';
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  }
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* ---------- Student / business email drafts ---------- */
  $$('.draft-form').forEach(function (form) {
    var kind = form.getAttribute('data-kind');
    var status = $('.status', form);
    function validate() {
      var first = null;
      $$('input, textarea, select', form).forEach(function (el) {
        var v = el.value.trim();
        var msg = '';
        if (el.required && !v) msg = T.required;
        else if (el.type === 'email' && v && !EMAIL_RE.test(v)) msg = T.invalidEmail;
        setErr(el, msg);
        if (msg && !first) first = el;
      });
      if (first) first.focus();
      return !first;
    }
    function body() {
      var m = T.mail;
      return $$('input, textarea, select', form).filter(function (el) { return el.value.trim(); })
        .map(function (el) { return (m[el.name] || el.name) + ': ' + el.value.trim(); }).join('\n\n');
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate()) return;
      openMail(T.mail[kind], body());
      status.textContent = T.opened + M.email + '.';
    });
    $('[data-copy]', form).addEventListener('click', function () {
      if (!validate()) return;
      copyText(T.mail[kind] + '\n\n' + body(), status);
    });
    $$('input, textarea, select', form).forEach(function (el) { el.addEventListener('input', function () { if (el.getAttribute('aria-invalid')) setErr(el, ''); }); });
  });

  /* ---------- Booking demonstration (no live scheduler yet) ---------- */
  var booking = $('.booking-demo');
  if (booking) {
    booking.addEventListener('submit', function (e) {
      e.preventDefault();
      var picked = $('input[name="callLang"]:checked', booking);
      var status = $('.status', booking);
      if (!picked) { status.style.color = '#b3123e'; status.textContent = T.choose; return; }
      status.style.color = '';
      status.textContent = T.bookingDemo;
    });
  }

  /* ---------- Journey planner ---------- */
  var planner = $('.planner');
  if (planner) {
    var P = T.planner;
    var result = $('#route-result');
    var progress = $('.progress', planner);
    var perr = $('.planner-err', planner);
    var backBtn = $('[data-back]', planner);
    var nextBtn = $('button[type="submit"]', planner);
    var steps = $$('fieldset', planner);
    var names = ['stage', 'region', 'timing'];
    var step = 0;
    planner.hidden = false;

    function show(n) {
      step = n;
      steps.forEach(function (fs, i) { fs.hidden = i !== n; });
      progress.textContent = fill(P.step, { n: n + 1 });
      var bar = $('.progress-bar', planner); if (bar) bar.style.setProperty('--p', ((n + 1) / 3 * 100) + '%');
      backBtn.hidden = n === 0;
      nextBtn.firstChild.textContent = (n === 2 ? P.finish : P.next) + ' ';
      perr.textContent = '';
    }
    function val(name) { var c = $('input[name="' + name + '"]:checked', planner); return c ? c.value : null; }
    function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function strip(html) { var d = document.createElement('div'); d.innerHTML = html; return d.textContent; }

    function render() {
      var s = P.stages[val('stage')], r = P.regions[val('region')], t = P.timings[val('timing')];
      var base = location.pathname.replace(/plan\/?$/, '');
      var summary = [P.summaryIntro, '',
        P.labels.stage + ': ' + s.name, P.labels.region + ': ' + r.name, P.labels.timing + ': ' + t.name, '',
        P.summaryAsk, P.summaryPlaceholder].join('\n');
      result.innerHTML =
        '<h3 tabindex="-1">' + P.resultH + '</h3>' +
        '<p>' + s.summary + '</p>' +
        '<h4>' + P.questionsH + '</h4><ul>' + s.qs.map(function (q) { return '<li>' + q + '</li>'; }).join('') + '</ul>' +
        '<h4>' + P.regionH + ': ' + r.name + '</h4><p>' + r.text + '</p>' +
        '<h4>' + P.prepH + ' (' + t.name + ')</h4><ul>' + t.items.map(function (q) { return '<li>' + q + '</li>'; }).join('') + '</ul>' +
        '<p><strong>' + P.beforeCall + '</strong></p>' +
        '<p><a class="text-link" href="' + base + 'pilot-training/">' + P.compareLink + ' →</a> &nbsp; <a class="text-link" href="#budget">' + P.budgetLink + ' →</a></p>' +
        '<p style="font-size:14px;color:var(--sub)">' + P.disclaimer + '</p>' +
        '<div class="tool-actions"><button class="btn btn-line" type="button" data-edit>' + P.edit + '</button><button class="btn btn-line" type="button" data-reset>' + P.reset + '</button></div>' +
        '<hr style="border:0;border-top:1px solid var(--line);margin:28px 0">' +
        '<div class="field"><label for="plan-summary">' + P.summaryH + '<span class="hint">' + P.summaryHint + '</span></label>' +
        '<textarea id="plan-summary">' + esc(summary) + '</textarea></div>' +
        '<div class="tool-actions"><button class="btn btn-pink" type="button" data-mail>' + P.emailBtn + '</button>' +
        '<button class="btn btn-line" type="button" data-copy>' + P.copy + '</button>' +
        '<a class="btn btn-ink" href="' + base + 'consultation/">' + P.discussBtn + '</a></div>' +
        '<p class="status" role="status" aria-live="polite"></p>';
      planner.hidden = true;
      result.hidden = false;
      $('h3', result).focus();
      var st = $('.status', result);
      $('[data-edit]', result).onclick = function () { result.hidden = true; planner.hidden = false; show(0); steps[0].querySelector('input:checked, input').focus(); };
      $('[data-reset]', result).onclick = function () { planner.reset(); result.hidden = true; planner.hidden = false; show(0); steps[0].querySelector('input').focus(); };
      $('[data-mail]', result).onclick = function () { openMail(P.subject, $('#plan-summary').value); st.textContent = T.opened + M.email + '.'; };
      $('[data-copy]', result).onclick = function () { copyText($('#plan-summary').value, st); };
      void strip;
    }

    planner.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!val(names[step])) { perr.textContent = T.choose; steps[step].querySelector('input').focus(); return; }
      if (step < 2) { show(step + 1); steps[step].querySelector('input:checked, input').focus(); }
      else render();
    });
    backBtn.addEventListener('click', function () { show(step - 1); steps[step].querySelector('input:checked, input').focus(); });
    planner.addEventListener('change', function () { perr.textContent = ''; });
    show(0);
  }

  /* ---------- Budget calculator ---------- */
  var bform = $('.budget-form');
  if (bform) {
    var B = T.budget;
    var box = bform.parentNode;
    var ok = $('.budget-ok', box), bad = $('.budget-invalid', box);
    var saveBtn = $('[data-save]', box), clearBtn = $('[data-clear]', box);
    var cmp = $('[data-compare]', box);
    var bstatus = $('.status', box);
    var mailLink = $('[data-budget-mail]', box);
    var saved = null; // page memory only — gone when the visitor leaves
    var last = null;
    var FIELDS = ['months', 'tuition', 'rent', 'living', 'extras', 'contingency', 'deposit'];

    function normalise(s) {
      return s.replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
        .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06f0); })
        .replace(/٫/g, '.').replace(/[,٬\s]/g, '');
    }
    function read(id) {
      var el = document.getElementById(id);
      var raw = normalise(el.value);
      var msg = '';
      if (raw === '') msg = B.errBlank;
      else if (/^-/.test(raw)) msg = B.errNeg;
      else if (!/^\d+(\.\d+)?$/.test(raw)) msg = B.errNumber;
      else if (id === 'months' && Number(raw) <= 0) msg = B.errMonths;
      setErr(el, msg);
      return msg ? null : Number(raw);
    }
    var r2 = function (x) { return Math.round(x * 100) / 100; };
    function fmt(n, cur) {
      return '<bdi>' + new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur, maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(r2(n)) + '</bdi>';
    }
    function fmtPlain(n, cur) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur, maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(r2(n)); }

    // The guide's formula (p.9), kept exactly.
    function compute(v) {
      var rent = v.months * v.rent;
      var living = v.months * 30 * v.living;
      var base = v.tuition + rent + living + v.extras;
      var budget = base * (1 + v.contingency / 100);
      var extra = 3 * (v.rent + 30 * v.living);
      return { rent: rent, living: living, base: base, contingencyAmt: budget - base, budget: budget, cash: budget + v.deposit,
        extraBefore: extra, extraAfter: extra * (1 + v.contingency / 100) };
    }

    function units(cur) {
      $$('[data-unit]', bform).forEach(function (u) { u.textContent = B.units[cur][u.getAttribute('data-unit')]; });
    }

    function update() {
      var cur = $('#currency').value;
      units(cur);
      var v = { currency: cur }, valid = true;
      FIELDS.forEach(function (f) { var n = read(f); if (n === null) valid = false; v[f] = n; });
      ok.hidden = !valid; bad.hidden = valid; saveBtn.disabled = !valid;
      if (!valid) { last = null; mailLink.setAttribute('aria-disabled', 'true'); return; }
      mailLink.removeAttribute('aria-disabled');
      var c = compute(v);
      last = { v: v, c: c };
      var out = { tuition: v.tuition, rent: c.rent, living: c.living, extras: v.extras, base: c.base, contingencyAmt: c.contingencyAmt, budget: c.budget, deposit: v.deposit, cash: c.cash };
      Object.keys(out).forEach(function (k) {
        var dd = $('[data-out="' + k + '"]', box), html = fmt(out[k], cur);
        if (dd.innerHTML && dd.innerHTML !== html && !reduceMotion) { dd.classList.add('flash'); clearTimeout(dd._t); dd._t = setTimeout(function () { dd.classList.remove('flash'); }, 600); }
        dd.innerHTML = html;
      });
      $('[data-out="whatif"]', box).innerHTML = fill(B.whatIf, { before: fmt(c.extraBefore, cur), after: fmt(c.extraAfter, cur), total: fmt(c.budget + c.extraAfter, cur) });
      renderCompare();
      mailLink.href = 'mailto:' + M.email + '?subject=' + encodeURIComponent(B.mailSubject) + '&body=' + encodeURIComponent(mailBody());
    }

    function renderCompare() {
      if (!saved || !last) { cmp.hidden = true; return; }
      cmp.hidden = false;
      var a = saved, b = last;
      if (a.v.currency !== b.v.currency) {
        cmp.innerHTML = '<p class="warn" style="margin:0">' + fill(B.currencyWarn, { a: a.v.currency, b: b.v.currency }) + '</p>';
        return;
      }
      var cur = b.v.currency;
      var row = function (label, x, y, money) {
        var d = y - x;
        var sign = d > 0 ? '+' : d < 0 ? '−' : '';
        return '<tr><td>' + label + '</td><td>' + (money ? fmt(x, cur) : '<bdi>' + x + '</bdi>') + '</td><td>' + (money ? fmt(y, cur) : '<bdi>' + y + '</bdi>') + '</td><td><bdi>' + sign + (money ? fmtPlain(Math.abs(d), cur) : Math.abs(d)) + '</bdi></td></tr>';
      };
      cmp.innerHTML = '<p style="margin:0 0 8px"><strong>' + B.compareH + '</strong></p><table><thead><tr><th></th><th>' + B.colA + '</th><th>' + B.colB + '</th><th>' + B.colDiff + '</th></tr></thead><tbody>' +
        row(B.rowMonths, a.v.months, b.v.months, false) + row(B.rowBudget, a.c.budget, b.c.budget, true) + row(B.rowCash, a.c.cash, b.c.cash, true) + '</tbody></table>';
    }

    function mailBody() {
      var v = last.v, c = last.c, cur = v.currency, rows = $$('.totals dt', box);
      var lines = [B.mailIntro, ''];
      lines.push($('label[for="months"]').childNodes[0].textContent.trim() + ': ' + v.months);
      ['tuition', 'rent', 'living', 'extras', 'base', 'contingencyAmt', 'budget', 'deposit', 'cash'].forEach(function (k, i) {
        var val = k in c ? c[k] : v[k];
        lines.push(rows[i].textContent + ': ' + fmtPlain(val, cur));
      });
      lines.push('', B.mailAsk, '');
      return lines.join('\n');
    }

    bform.addEventListener('input', update);
    bform.addEventListener('change', update);
    saveBtn.addEventListener('click', function () {
      if (!last) return;
      saved = JSON.parse(JSON.stringify(last));
      clearBtn.hidden = false;
      bstatus.textContent = B.saved;
      renderCompare();
    });
    clearBtn.addEventListener('click', function () { saved = null; clearBtn.hidden = true; bstatus.textContent = B.cleared; renderCompare(); });
    $('[data-print]', box).addEventListener('click', function () {
      var d = $('[data-print-date]', box);
      if (d) d.textContent = new Date().toLocaleDateString(M.locale === 'ar' ? 'ar' : 'en-GB');
      window.print();
    });
    mailLink.addEventListener('click', function (e) { if (!last) e.preventDefault(); });
    update();
  }
})();
