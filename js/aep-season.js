/**
 * Medicare season capture helpers.
 * Sep 1–Sep 30: homepage primary CTA + nav chip + banner → ANOC landing.
 * Oct 1–Dec 7: same surfaces → AEP landing.
 * Always: stamp UTM/source onto #aepForm hidden fields (not ANOC forms).
 */
(function () {
  'use strict';

  var ANOC_EN = '/medicare-anoc-2027';
  var ANOC_ES = '/es/aviso-anual-cambios-medicare-2027';
  var AEP_EN = '/medicare-annual-enrollment-2027';
  var AEP_ES = '/es/inscripcion-anual-medicare-2027';
  var isEs = location.pathname.indexOf('/es/') === 0;

  function inAnocWindow(d) {
    d = d || new Date();
    var start = new Date(d.getFullYear(), 8, 1);
    var end = new Date(d.getFullYear(), 8, 30, 23, 59, 59);
    return d >= start && d <= end;
  }

  function inAepWindow(d) {
    d = d || new Date();
    var start = new Date(d.getFullYear(), 9, 1);
    var end = new Date(d.getFullYear(), 11, 7, 23, 59, 59);
    return d >= start && d <= end;
  }

  function inMedicareSeason(d) {
    return inAnocWindow(d) || inAepWindow(d);
  }

  function seasonHref() {
    if (inAnocWindow()) return isEs ? ANOC_ES : ANOC_EN;
    return isEs ? AEP_ES : AEP_EN;
  }

  function params() {
    var q = new URLSearchParams(location.search);
    return {
      utm_source: q.get('utm_source') || '',
      utm_medium: q.get('utm_medium') || '',
      utm_campaign: q.get('utm_campaign') || '',
      utm_content: q.get('utm_content') || '',
    };
  }

  function leadChannel(utm) {
    var s = (utm.utm_source || '').toLowerCase();
    if (s === 'facebook' || s === 'fb' || s === 'instagram' || s === 'ig' || s === 'meta') {
      return 'facebook';
    }
    if (s) return 'paid';
    return 'organic';
  }

  function stampForm() {
    var form = document.getElementById('aepForm');
    if (!form) return;
    var existing = form.querySelector('[name="source_key"]');
    if (existing && String(existing.value || '').indexOf('anoc') === 0) return;
    var utm = params();
    var channel = leadChannel(utm);
    var lang = isEs ? 'spanish' : 'english';
    function setHidden(name, value) {
      var el = form.querySelector('[name="' + name + '"]');
      if (!el) {
        el = document.createElement('input');
        el.type = 'hidden';
        el.name = name;
        form.appendChild(el);
      }
      el.value = value;
    }
    setHidden('source_key', 'aep-2027');
    setHidden('source', channel === 'facebook' ? 'facebook' : 'organic');
    setHidden('language', lang);
    setHidden('channel', channel);
    setHidden('tags', 'aep-2027,' + channel + ',' + lang);
    setHidden('utm_source', utm.utm_source);
    setHidden('utm_medium', utm.utm_medium);
    setHidden('utm_campaign', utm.utm_campaign);
    setHidden('utm_content', utm.utm_content);
  }

  function rewriteHero() {
    if (!inMedicareSeason()) return;
    var wrap = document.getElementById('hero-btns');
    if (!wrap) return;
    var primary = wrap.querySelector('a');
    if (!primary) return;
    primary.setAttribute('href', seasonHref());
    if (inAnocWindow()) {
      primary.textContent = isEs
        ? 'Revisar mi carta ANOC 2027 →'
        : 'Review your 2027 ANOC letter →';
    } else {
      primary.textContent = isEs
        ? 'Revisar mi plan Medicare 2027 →'
        : 'Review your 2027 Medicare plan →';
    }
  }

  function injectNavChip() {
    if (!inMedicareSeason()) return;
    if (document.getElementById('aep-nav-chip')) return;
    var desktop = document.querySelector('.v4-nav-desktop');
    if (!desktop) return;
    var chip = document.createElement('a');
    chip.id = 'aep-nav-chip';
    chip.href = seasonHref();
    chip.textContent = inAnocWindow() ? 'ANOC 2027' : 'AEP 2027';
    chip.style.cssText =
      'background:#ff1090;color:#fff;padding:8px 14px;border-radius:999px;font-weight:700;font-size:15px;white-space:nowrap;text-decoration:none';
    desktop.insertBefore(chip, desktop.firstChild);
  }

  function rewriteBanner() {
    if (!inMedicareSeason()) return;
    var el = document.getElementById('aep-home-banner');
    if (!el) return;
    var href = seasonHref();
    var p = el.querySelector('p') || el;
    if (inAnocWindow()) {
      p.innerHTML = isEs
        ? '¿Llegó su Aviso Anual de Cambios 2027? <a href="' + href + '" style="color:#c40074;font-weight:700">Revisión gratis de su carta ANOC →</a>'
        : 'Got your 2027 Annual Notice of Change? <a href="' + href + '" style="color:#c40074;font-weight:700">Free ANOC letter review before AEP →</a>';
    } else {
      p.innerHTML = isEs
        ? 'Periodo de inscripción anual Medicare 2027 en Miami: 15 oct–7 dic. <a href="' + href + '" style="color:#c40074;font-weight:700">Fechas del AEP y revisión gratis para cambiar plan Medicare →</a>'
        : 'Medicare Annual Enrollment 2027 in Miami is Oct 15–Dec 7. <a href="' + href + '" style="color:#c40074;font-weight:700">Medicare open enrollment dates and free 2027 plan review →</a>';
    }
  }

  function run() {
    stampForm();
    rewriteHero();
    injectNavChip();
    rewriteBanner();
  }

  stampForm();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
