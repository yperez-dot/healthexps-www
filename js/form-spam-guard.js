/**
 * Client-side helpers for lead forms that post through /.netlify/functions/submit-lead
 * Usage:
 *   var guard = FormSpamGuard.attach(formEl);
 *   // on submit:
 *   if (guard.isBot()) { show fake success; return; }
 *   var payload = Object.assign(FormSpamGuard.formToObject(formEl), guard.meta(), { source_key: 'es-contact' });
 *   FormSpamGuard.submit(payload).then(...)
 */
(function (global) {
  'use strict';

  function digitsOnly(v) {
    return String(v || '').replace(/\D/g, '');
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

  function looksLikeBotName(first, last) {
    var f = String(first || '').trim();
    var l = String(last || '').trim();
    if (!f || !l) return true;
    if (f.toLowerCase() === l.toLowerCase() && f.length >= 6) return true;
    var combined = f + l;
    if (/\d/.test(combined) && /[A-Za-z]/.test(combined) && combined.length >= 10) {
      return true;
    }
    return false;
  }

  function ensureHoneypot(form) {
    var existing = form.querySelector('[name="_hp_name"]');
    if (existing) return existing;
    var input = document.createElement('input');
    input.type = 'text';
    input.name = '_hp_name';
    input.id = '_hp_name_' + Math.random().toString(36).slice(2, 8);
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('tabindex', '-1');
    input.setAttribute('aria-hidden', 'true');
    input.style.cssText =
      'position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    input.value = '';
    form.insertBefore(input, form.firstChild);
    return input;
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
        return null;
      },
    };
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

  function submit(payload) {
    return fetch('/.netlify/functions/submit-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (res) {
      return res.json().then(function (body) {
        return { res: res, body: body };
      });
    });
  }

  function fakeSuccess(form, successEl) {
    if (form) form.style.display = 'none';
    if (successEl) successEl.style.display = 'block';
  }

  global.FormSpamGuard = {
    attach: attach,
    formToObject: formToObject,
    submit: submit,
    fakeSuccess: fakeSuccess,
    isValidUsPhone: isValidUsPhone,
    normalizePhone: normalizePhone,
  };
})(typeof window !== 'undefined' ? window : this);
