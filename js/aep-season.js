/**
 * AEP 2027 capture helpers.
 * Sep 1–Dec 7: homepage primary CTA + nav chip point at the AEP landing.
 * Always: stamp UTM/source onto #aepForm / #aepForm hidden fields.
 */
(function () {
  'use strict';

  var AEP_EN = '/medicare-annual-enrollment-2027';
  var AEP_ES = '/es/inscripcion-anual-medicare-2027';
  var isEs = location.pathname.indexOf('/es/') === 0;
  var aepHref = isEs ? AEP_ES : AEP_EN;

  function inAepWindow(d) {
    d = d || new Date();
    var start = new Date(d.getFullYear(), 8, 1);
    var end = new Date(d.getFullYear(), 11, 7, 23, 59, 59);
    return d >= start && d <= end;
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
    var form = document.getElementById('aepForm') || document.getElementById('aepForm');
    if (!form) return;
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
    if (!inAepWindow()) return;
    var wrap = document.getElementById('hero-btns') || document.getElementById('hero-btns');
    if (!wrap) return;
    var primary = wrap.querySelector('a');
    if (!primary) return;
    primary.setAttribute('href', aepHref);
    primary.textContent = isEs
      ? 'Revisar mi plan Medicare 2027 →'
      : 'Review your 2027 Medicare plan →';
  }

  function injectNavChip() {
    if (!inAepWindow()) return;
    if (document.getElementById('aep-nav-chip')) return;
    var desktop = document.querySelector('.v4-nav-desktop');
    if (!desktop) return;
    var chip = document.createElement('a');
    chip.id = 'aep-nav-chip';
    chip.href = aepHref;
    chip.textContent = isEs ? 'AEP 2027' : 'AEP 2027';
    chip.style.cssText =
      'background:#ff1090;color:#fff;padding:8px 14px;border-radius:999px;font-weight:700;font-size:15px;white-space:nowrap;text-decoration:none';
    desktop.insertBefore(chip, desktop.firstChild);
  }

  stampForm();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      rewriteHero();
      injectNavChip();
      stampForm();
    });
  } else {
    rewriteHero();
    injectNavChip();
  }
})();
