/**
 * Sitewide lead-form spam guard.
 *
 * 1) Auto-intercepts fetch() calls to GoHighLevel webhook URLs and reroutes
 *    them through /.netlify/functions/submit-lead (server-side spam filter).
 * 2) Intercepts native <form action="...leadconnectorhq..."> submits the same way.
 * 3) Exports FormSpamGuard for pages that post to the proxy explicitly.
 */
(function (global) {
  'use strict';

  if (global.__THEI_FORM_SPAM_GUARD__) return;
  global.__THEI_FORM_SPAM_GUARD__ = true;

  var PAGE_LOADED_AT = Date.now();
  var GHL_RE =
    /leadconnectorhq\.com\/hooks\/[^/]+\/webhook-trigger\/([^/?#]+)/i;
  var PROXY = '/.netlify/functions/submit-lead';
  var LOOKING_FOR_KEYS = [
    'coverage_type',
    'looking_for',
    'contact_reason',
    'interest',
    'reason',
    'private_reason',
    'aca_reason',
    'help_with',
    'aep_plan_type',
  ];

  function digitsOnly(v) {
    return String(v || '').replace(/\D/g, '');
  }

  function extractLookingFor(fields) {
    for (var i = 0; i < LOOKING_FOR_KEYS.length; i++) {
      var key = LOOKING_FOR_KEYS[i];
      var value = String((fields && fields[key]) || '').trim();
      if (value) return value;
    }
    return '';
  }

  function formHasLookingForField(fields) {
    if (!fields) return false;
    for (var i = 0; i < LOOKING_FOR_KEYS.length; i++) {
      if (Object.prototype.hasOwnProperty.call(fields, LOOKING_FOR_KEYS[i])) {
        return true;
      }
    }
    return false;
  }

  function normalizePhone(phone) {
    var d = digitsOnly(phone);
    if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
    return d;
  }

  function isValidUsPhone(phone) {
    var d = normalizePhone(phone);
    return (
      d.length === 10 &&
      d.charAt(0) >= '2' &&
      d.charAt(0) <= '9' &&
      d.charAt(3) >= '2' &&
      d.charAt(3) <= '9'
    );
  }

  function looksLikeGibberish(text) {
    var s = String(text || '').trim();
    if (!s || s.length < 20) return false;
    var letters = s.replace(/[^a-zA-Z]/g, '');
    if (letters.length < 16) return false;
    var vowels = (letters.match(/[aeiouAEIOU]/g) || []).length;
    return vowels / letters.length < 0.18;
  }

  function containsPromoSpam(text) {
    var s = String(text || '');
    if (!s) return false;
    if (/https?:\/\//i.test(s)) return true;
    if (/\bwww\./i.test(s)) return true;
    if (/\bgraph\.org\b/i.test(s)) return true;
    if (/\bt\.me\//i.test(s)) return true;
    if (/\b(?:bit\.ly|tinyurl\.com|goo\.gl)\b/i.test(s)) return true;
    if (/\.[a-z]{2,}\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/.test(s)) return true;
    if (/\b(?:\d+[.,]\d+\s*)?BTC\b/i.test(s) && /(?:GET\s*->|mining|wallet|graph\.org)/i.test(s)) {
      return true;
    }
    if (
      /\b(?:bitcoin|ethereum|usdt|crypto)\b/i.test(s) &&
      /(?:https?:|www\.|wallet|mining)/i.test(s)
    ) {
      return true;
    }
    return false;
  }

  function looksLikeBotName(first, last) {
    var f = String(first || '').trim();
    var l = String(last || '').trim();
    if (!f || !l) return true;
    if (f.length > 48 || l.length > 48) return true;
    if (f.toLowerCase() === l.toLowerCase() && f.length >= 6) return true;
    var combined = f + l;
    if (containsPromoSpam(combined)) return true;
    if (/\d/.test(combined) && /[A-Za-z]/.test(combined) && combined.length >= 10) {
      return true;
    }
    return false;
  }

  function getHpValue() {
    var el = document.querySelector('input[name="_hp_name"]');
    return el ? String(el.value || '') : '';
  }

  function ensureHoneypot(form) {
    var existing = form.querySelector('[name="_hp_name"]');
    if (existing) return existing;
    var input = document.createElement('input');
    input.type = 'text';
    input.name = '_hp_name';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('tabindex', '-1');
    input.setAttribute('aria-hidden', 'true');
    input.style.cssText =
      'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    input.value = '';
    form.insertBefore(input, form.firstChild);
    return input;
  }

  function formToObject(form) {
    var fd = new FormData(form);
    var obj = {};
    fd.forEach(function (value, key) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
        obj[key].push(value);
      } else {
        obj[key] = value;
      }
    });
    return obj;
  }

  function bodyToObject(body) {
    if (!body) return Promise.resolve({});
    if (typeof body === 'string') {
      try {
        return Promise.resolve(JSON.parse(body));
      } catch (e) {
        return Promise.resolve({});
      }
    }
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      var obj = {};
      body.forEach(function (value, key) {
        obj[key] = value;
      });
      return Promise.resolve(obj);
    }
    if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
      var o = {};
      body.forEach(function (value, key) {
        o[key] = value;
      });
      return Promise.resolve(o);
    }
    if (typeof Blob !== 'undefined' && body instanceof Blob) {
      return body.text().then(function (t) {
        try {
          return JSON.parse(t);
        } catch (e) {
          return {};
        }
      });
    }
    return Promise.resolve({});
  }

  function pageAttribution() {
    var href = '';
    var path = '/';
    try {
      href = String(window.location.href || '');
      path = String(window.location.pathname || '/') || '/';
    } catch (e) {
      href = '';
      path = '/';
    }
    return { page: href, page_url: href, page_path: path, form_page: path };
  }

  function isHomepagePath(path) {
    return path === '/' || path === '/index.html' || path === '/es' || path === '/es/' || path === '/es/index.html';
  }

  function withMeta(data) {
    var out = Object.assign({}, data);
    var attr = pageAttribution();
    if (!out._form_loaded_at) out._form_loaded_at = PAGE_LOADED_AT;
    if (!out._hp_name) out._hp_name = getHpValue();
    if (!out.page) out.page = attr.page;
    if (!out.page_url) out.page_url = attr.page_url || out.page;
    out.page_path = out.page_path || attr.page_path;
    out.form_page = out.form_page || attr.form_page;
    // Many copied scripts hardcode "Homepage Form" on non-home pages — fix the label
    var src = String(out.source || '').trim();
    if (/^Homepage Form$/i.test(src) && !isHomepagePath(out.page_path || attr.page_path)) {
      out.source = 'Form: ' + (out.page_path || attr.page_path);
    }
    if (!out.submitted_at) out.submitted_at = new Date().toISOString();
    return out;
  }

  function postToProxy(payload) {
    return originalFetch(PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  function attach(form) {
    if (!form) return null;
    var loadedAt = Date.now();
    var hp = ensureHoneypot(form);
    return {
      loadedAt: loadedAt,
      isBot: function () {
        if ((hp && hp.value) || '') return true;
        if (Date.now() - loadedAt < 3000) return true;
        return false;
      },
      meta: function () {
        return {
          _hp_name: (hp && hp.value) || '',
          _form_loaded_at: loadedAt,
        };
      },
      clientSpam: function (fields) {
        var first = (fields.first_name || '').trim();
        var last = (fields.last_name || '').trim();
        var phone = (fields.phone || '').trim();
        var notes = (fields.additional_notes || fields.notes || '').trim();
        if (!isValidUsPhone(phone)) return 'bad_phone';
        if (looksLikeBotName(first, last)) return 'bot_name';
        if (looksLikeGibberish(notes)) return 'gibberish_notes';
        if (
          containsPromoSpam(first) ||
          containsPromoSpam(last) ||
          containsPromoSpam(notes) ||
          containsPromoSpam(fields.name) ||
          containsPromoSpam(fields.email)
        ) {
          return 'promo_spam';
        }
        return null;
      },
    };
  }

  function submit(payload) {
    return postToProxy(withMeta(payload)).then(function (res) {
      return res.json().then(function (body) {
        return { res: res, body: body };
      });
    });
  }

  function fakeSuccess(form, successEl) {
    if (form) form.style.display = 'none';
    if (successEl) successEl.style.display = 'block';
  }

  // ── fetch interceptor: reroute GHL webhook posts through the proxy ──
  var originalFetch = global.fetch ? global.fetch.bind(global) : null;
  if (originalFetch) {
    global.fetch = function (input, init) {
      init = init || {};
      var url =
        typeof input === 'string'
          ? input
          : input && typeof input.url === 'string'
            ? input.url
            : String(input || '');

      // Already going to our proxy — leave alone
      if (url.indexOf('/.netlify/functions/submit-lead') !== -1) {
        return originalFetch(input, init);
      }

      var match = url.match(GHL_RE);
      if (!match) return originalFetch(input, init);

      var method = String(init.method || 'GET').toUpperCase();
      if (method !== 'POST') return originalFetch(input, init);

      var webhookId = match[1];
      return bodyToObject(init.body).then(function (data) {
        var payload = withMeta(data);
        payload.webhook_id = webhookId;
        return postToProxy(payload);
      });
    };
  }

  // ── native form posts to GHL action URLs ──
  function interceptNativeGhlForms() {
    document.addEventListener(
      'submit',
      function (e) {
        var form = e.target;
        if (!form || form.tagName !== 'FORM') return;
        var action = form.getAttribute('action') || '';
        var match = action.match(GHL_RE);
        if (!match) return;

        // Page already uses FormSpamGuard explicitly (action removed / proxy) — skip
        if (form.getAttribute('data-spam-guard') === 'proxy') return;

        e.preventDefault();
        e.stopImmediatePropagation();

        var webhookId = match[1];
        var fields = formToObject(form);

        // If the form has a “what are you looking for?” select, block empty submits
        if (formHasLookingForField(fields) && !extractLookingFor(fields)) {
          var lookingErr =
            form.querySelector('.ff-error, [id$="Error"], [id$="-error"]') ||
            null;
          if (lookingErr) {
            lookingErr.style.display = 'block';
            lookingErr.textContent = /\/es\//.test(window.location.pathname)
              ? 'Por favor seleccione en qué podemos ayudarle.'
              : 'Please select what you need help with.';
          } else {
            alert(
              /\/es\//.test(window.location.pathname)
                ? 'Por favor seleccione en qué podemos ayudarle.'
                : 'Please select what you need help with.'
            );
          }
          var lookingSelect = form.querySelector(
            'select[name="coverage_type"],select[name="looking_for"],select[name="contact_reason"],select[name="interest"],select[name="reason"],select[name="private_reason"],select[name="aca_reason"],select[name="help_with"],select[name="aep_plan_type"]'
          );
          if (lookingSelect) {
            lookingSelect.style.border = '2px solid #c40074';
            lookingSelect.focus();
          }
          return;
        }

        var payload = withMeta(fields);
        payload.webhook_id = webhookId;
        var looking = extractLookingFor(fields);
        if (looking) {
          payload.coverage_type = looking;
          payload.looking_for = looking;
        }

        var btn = form.querySelector('button[type="submit"],input[type="submit"]');
        if (btn) {
          btn.disabled = true;
        }

        postToProxy(payload)
          .then(function (res) {
            return res.json().catch(function () {
              return { ok: res.ok };
            });
          })
          .then(function (body) {
            if (body && body.ok) {
              form.style.display = 'none';
              var success =
                document.getElementById(form.id + '-success') ||
                form.parentNode.querySelector('[id$="-success"],[id$="Success"],.ff-success');
              if (success) success.style.display = 'block';
              return;
            }
            throw new Error('submit failed');
          })
          .catch(function () {
            if (btn) btn.disabled = false;
            alert(
              /\/es\//.test(window.location.pathname)
                ? 'Algo salió mal. Llame al 1-800-380-6821.'
                : 'Something went wrong. Please call 1-800-380-6821.'
            );
          });
      },
      true
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', interceptNativeGhlForms);
  } else {
    interceptNativeGhlForms();
  }

  // Mark explicit proxy forms so native interceptor does not double-handle
  function markProxyForms() {
    ['esContactForm', 'enContactForm', 'cobraForm', 'acaFormEs', 'esSeguroForm', 'privForm'].forEach(
      function (id) {
        var el = document.getElementById(id);
        if (el) el.setAttribute('data-spam-guard', 'proxy');
      }
    );
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markProxyForms);
  } else {
    markProxyForms();
  }

  global.FormSpamGuard = {
    attach: attach,
    formToObject: formToObject,
    submit: submit,
    fakeSuccess: fakeSuccess,
    isValidUsPhone: isValidUsPhone,
    normalizePhone: normalizePhone,
    extractLookingFor: extractLookingFor,
  };
})(typeof window !== 'undefined' ? window : this);
