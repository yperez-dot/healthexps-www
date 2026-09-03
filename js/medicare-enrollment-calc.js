/* Shared Medicare enrollment window calculator (EN + ES).
   IDs are the same on both pages. Language comes from <html lang> or
   window.ENROLL_LANG. CMS rules used here (2023+):
   - IEP is 7 months around the 65th birthday month
   - Coverage always starts the 1st of a month
   - Enroll in birthday month or later in IEP → coverage starts 1st of next month
   - GEP is Jan 1–Mar 31; coverage starts 1st of the month after you enroll
   - Leaving employer coverage: 60-day SEP (COBRA does not extend it)
   - Moving: typically 2 months for Advantage / Part D
*/
(function (global) {
  var lang = (global.ENROLL_LANG || (document.documentElement.lang || 'en')).slice(0, 2);
  var sepTrigger = 'employer';

  var MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  var T = {
    en: {
      hero_tag: 'Free Tool · 2026',
      hero_title: 'Medicare Enrollment Window Calculator',
      hero_sub: 'Enter your birthday or coverage end date to see exactly when you can enroll — and what happens if you wait.',
      tab_iep: 'Turning 65 (IEP)',
      tab_sep: 'Lost Coverage (SEP)',
      iep_card: 'YOUR BIRTHDAY',
      lbl_month: 'Birth Month',
      lbl_year: 'Birth Year',
      iep_note: 'Your IEP is a 7-month window — 3 months before your 65th birthday month, that month, and 3 months after. If your birthday is on the 1st, the window and coverage can start a month earlier.',
      iep_btn: 'Calculate My Enrollment Window →',
      sep_card: 'YOUR SITUATION',
      lbl_trigger: 'What happened?',
      trig_employer_t: 'Employer coverage ending',
      trig_employer_d: 'Retiring or losing job-based health insurance',
      trig_move_t: 'Moving to a new area',
      trig_move_d: 'Relocating to a different county or state',
      trig_newmedicare_t: 'Missed enrollment (GEP)',
      trig_newmedicare_d: "Didn't enroll at 65, need to sign up now",
      lbl_sepdate: 'When does/did your coverage end?',
      lbl_movedate: 'When did you move (or will you)?',
      sep_note: 'We will calculate your Special Enrollment Period from this date.',
      sep_note_gep: 'GEP does not use a coverage-end date. It is the same every year: January 1 – March 31.',
      sep_btn: 'Calculate My SEP Window →',
      sep_btn_gep: 'See the General Enrollment Period →',
      months: MONTHS_EN,
      month_placeholder: 'Select month...',
      year_placeholder: 'Select year...',
      err_select: 'Please select both month and year.',
      iep_result_label: 'YOUR 7-MONTH IEP WINDOW',
      iep_window_sub: 'Your 7-month window to enroll in Medicare',
      iep_best_badge: 'Ideal — no delay',
      iep_good: 'Coverage starts next month',
      iep_bday_badge: 'Birthday month',
      iep_warn: 'Coverage delayed 1 month',
      iep_late_badge: 'After IEP',
      key_fact: 'Key fact:',
      key_fact_body: 'Medicare coverage always starts on the <strong>1st of the month</strong> — not on your birthday. Enrolling in the 3 months before your birthday month is the only way to have coverage the month you turn 65.',
      timeline_iep: 'Enrollment window — month by month',
      cov_starts: 'Coverage starts ',
      first_of: ' 1, ',
      penalty_title: 'Miss your window? Penalties are permanent.',
      penalty_desc: 'Part B: +10% added to your premium for each 12-month period you delayed. Part D: +1% per month of delay. Both last as long as you have Medicare.',
      cta_title: 'Not sure which plan to pick during your IEP?',
      cta_desc: "Our bilingual brokers compare carriers in Florida for you — at no cost. We'll make sure you enroll on time.",
      cta_call: 'Free consultation →',
      cta_wa: 'WhatsApp us',
      more_title: 'Next: compare plan types',
      more_medigap: 'Compare Plan G vs N vs HD G →',
      more_adv: 'Advantage vs Supplement costs →',
      share_know: 'Know someone who needs to see this?',
      share_title: 'Share this free calculator',
      share_wa_msg: 'Calculate your Medicare enrollment window free: ',
      share_wa: 'Share via WhatsApp',
      share_copy: 'Copy link',
      share_copied: 'Copied!',
      sep_result_label: 'YOUR SEP WINDOW',
      sep_window_employer: '60-day Special Enrollment Period',
      sep_window_move: '2-month Special Enrollment Period (MA / Part D)',
      sep_window_newmedicare: 'General Enrollment Period (GEP)',
      sep_starts: 'SEP starts',
      sep_ends: 'SEP ends',
      sep_deadline: 'Deadline',
      sep_begin: 'Your enrollment window begins',
      sep_close: 'Your window closes. After this, you may have to wait for the next enrollment period to join or switch plans.',
      start_date: 'Start date',
      deadline: 'Deadline',
      days_left: function (n) { return 'You have ' + n + ' days remaining'; },
      days_soon: function (n) { return 'Only ' + n + ' days left — act soon'; },
      days_urgent: function (n) { return 'Urgent — only ' + n + ' days remaining'; },
      window_closed: 'This window may have closed — call now',
      sep_warning_employer: 'When employer or group coverage ends, you have <strong>60 days</strong> to enroll in or switch Medicare plans. Count 60 days from the day coverage actually ends. <strong>COBRA does not extend this clock</strong> — it starts when active group coverage ends, not when COBRA later ends.',
      sep_warning_move: 'Moving to a new county or state usually opens a <strong>2-month SEP</strong> to join or switch a Medicare Advantage or Part D plan. Your new address must be in the plan’s service area. This does not by itself enroll you in Part A or B.',
      sep_warning_newmedicare: 'If you missed your IEP and do not have another SEP, you can sign up during the General Enrollment Period: <strong>January 1 – March 31</strong> each year. Since 2023, coverage starts the <strong>first day of the month after you enroll</strong>. You may still owe a late-enrollment penalty. Call us — we can check whether a Special Enrollment Period applies instead.',
      gep_label: 'GENERAL ENROLLMENT PERIOD (GEP)',
      gep_win: 'January 1 – March 31 each year',
      gep_cov: 'Coverage starts the 1st of the month after you enroll',
      cta_sep_title: 'Need help enrolling before your deadline?',
      cta_sep_desc: 'Our licensed brokers can walk you through your options and make sure you enroll in the right plan before the window closes.',
      aep_title: 'Already on Medicare? Other windows',
      aep_body: '<strong>AEP (Annual Enrollment):</strong> October 15 – December 7 each year. Change Advantage, Part D, or go back to Original Medicare. New coverage starts January 1. <strong>OEP:</strong> January 1 – March 31 if you are already in Medicare Advantage — one switch to another Advantage plan or back to Original Medicare. Medigap after OEP usually needs underwriting, except Florida’s birthday rule.'
    },
    es: {
      hero_tag: 'HERRAMIENTA GRATUITA · 2026',
      hero_title: 'Calculadora de Ventana de<br><em>Inscripción Medicare</em>',
      hero_sub: 'Ingresa tu fecha de nacimiento o cuándo termina tu cobertura para ver exactamente cuándo puedes inscribirte en Medicare — y qué pasa si esperas.',
      tab_iep: 'Cumpliendo 65 (IEP)',
      tab_sep: 'Perdí cobertura (SEP)',
      iep_card: 'TU FECHA DE NACIMIENTO',
      lbl_month: 'Mes de nacimiento',
      lbl_year: 'Año de nacimiento',
      iep_note: 'Tu IEP es una ventana de 7 meses — 3 meses antes de tu mes de cumpleaños número 65, ese mes, y 3 meses después. Si tu cumpleaños es el día 1, la ventana y la cobertura pueden empezar un mes antes.',
      iep_btn: 'Calcular mi ventana de inscripción →',
      sep_card: 'TU SITUACIÓN',
      lbl_trigger: '¿Qué pasó?',
      trig_employer_t: 'Termina la cobertura del empleador',
      trig_employer_d: 'Jubilación o pérdida del seguro del trabajo',
      trig_move_t: 'Mudanza a otra área',
      trig_move_d: 'Cambio de condado o de estado',
      trig_newmedicare_t: 'Perdí la inscripción (GEP)',
      trig_newmedicare_d: 'No me inscribí a los 65 y necesito hacerlo ahora',
      lbl_sepdate: '¿Cuándo termina o terminó su cobertura?',
      lbl_movedate: '¿Cuándo se mudó (o se muda)?',
      sep_note: 'Calcularemos su Período de Inscripción Especial con esta fecha.',
      sep_note_gep: 'El GEP no usa una fecha de fin de cobertura. Es igual cada año: del 1 de enero al 31 de marzo.',
      sep_btn: 'Calcular mi ventana SEP →',
      sep_btn_gep: 'Ver el Período de Inscripción General →',
      months: MONTHS_ES,
      month_placeholder: 'Selecciona mes...',
      year_placeholder: 'Selecciona año...',
      err_select: 'Por favor selecciona mes y año.',
      iep_result_label: 'TU VENTANA IEP DE 7 MESES',
      iep_window_sub: 'Tu ventana de 7 meses para inscribirte en Medicare',
      iep_best_badge: 'Ideal — sin retraso',
      iep_good: 'La cobertura empieza el mes siguiente',
      iep_bday_badge: 'Mes de cumpleaños',
      iep_warn: 'Cobertura se retrasa 1 mes',
      iep_late_badge: 'Después del IEP',
      key_fact: 'Dato importante:',
      key_fact_body: 'La cobertura de Medicare siempre empieza el <strong>1° del mes</strong> — no el día de tu cumpleaños. Inscribirte en los 3 meses anteriores es la única forma de tener cobertura el mes en que cumples 65.',
      timeline_iep: 'Ventana de inscripción — mes por mes',
      cov_starts: 'Cobertura empieza el ',
      first_of: ' 1 de ',
      penalty_title: '¿Pierde su ventana? Las penalidades son permanentes.',
      penalty_desc: 'Parte B: +10% a su prima por cada período de 12 meses que retrasó. Parte D: +1% por mes de retraso. Ambas duran mientras tenga Medicare.',
      cta_title: '¿No sabe qué plan elegir durante su IEP?',
      cta_desc: 'Nuestros corredores bilingües comparan aseguradoras en Florida para usted — sin costo. Nos aseguramos de que se inscriba a tiempo.',
      cta_call: 'Consulta gratuita →',
      cta_wa: 'WhatsApp',
      more_title: 'Siguiente: comparar tipos de plan',
      more_medigap: 'Comparar Plan G vs N vs HD G →',
      more_adv: 'Costos Advantage vs Suplementario →',
      share_know: '¿Conoce a alguien que necesita saber esto?',
      share_title: 'Comparta esta calculadora gratuita',
      share_wa_msg: 'Calcula tu ventana de inscripción Medicare gratis: ',
      share_wa: 'Enviar por WhatsApp',
      share_copy: 'Copiar enlace',
      share_copied: '¡Copiado!',
      sep_result_label: 'TU VENTANA SEP',
      sep_window_employer: 'SEP de 60 días',
      sep_window_move: 'SEP de 2 meses (Advantage / Parte D)',
      sep_window_newmedicare: 'Período de Inscripción General (GEP)',
      sep_starts: 'El SEP comienza',
      sep_ends: 'El SEP termina',
      sep_deadline: 'Fecha límite',
      sep_begin: 'Su ventana de inscripción comienza',
      sep_close: 'Su ventana cierra. Después de esto, puede que tenga que esperar al próximo período de inscripción para unirse o cambiar de plan.',
      start_date: 'Fecha de inicio',
      deadline: 'Fecha límite',
      days_left: function (n) { return 'Le quedan ' + n + ' días'; },
      days_soon: function (n) { return 'Solo ' + n + ' días — actúe pronto'; },
      days_urgent: function (n) { return 'Urgente — solo ' + n + ' días'; },
      window_closed: 'Esta ventana puede haber cerrado — llame ahora',
      sep_warning_employer: 'Cuando termina la cobertura del empleador o del grupo, tiene <strong>60 días</strong> para inscribirse o cambiar planes de Medicare. Cuente 60 días desde el día en que realmente termina la cobertura. <strong>COBRA no extiende este reloj</strong> — empieza cuando termina la cobertura grupal activa, no cuando después termina COBRA.',
      sep_warning_move: 'Mudarse a otro condado o estado suele abrir un <strong>SEP de 2 meses</strong> para unirse o cambiar un plan Advantage o Parte D. La nueva dirección debe estar en el área de servicio del plan. Esto no lo inscribe por sí solo en Parte A o B.',
      sep_warning_newmedicare: 'Si perdió su IEP y no tiene otro SEP, puede inscribirse en el Período de Inscripción General: del <strong>1 de enero al 31 de marzo</strong> de cada año. Desde 2023, la cobertura empieza el <strong>primer día del mes siguiente a su inscripción</strong>. Puede haber penalidad por inscripción tardía. Llámenos — podemos ver si califica para un SEP.',
      gep_label: 'PERÍODO DE INSCRIPCIÓN GENERAL (GEP)',
      gep_win: 'Del 1 de enero al 31 de marzo de cada año',
      gep_cov: 'La cobertura empieza el 1° del mes siguiente a su inscripción',
      cta_sep_title: '¿Necesita ayuda antes de su fecha límite?',
      cta_sep_desc: 'Nuestros corredores con licencia pueden guiarle y asegurarse de que se inscriba en el plan correcto antes de que cierre la ventana.',
      aep_title: '¿Ya tiene Medicare? Otras ventanas',
      aep_body: '<strong>AEP (Inscripción Anual):</strong> del 15 de octubre al 7 de diciembre de cada año. Cambie Advantage, Parte D, o vuelva a Medicare Original. La nueva cobertura empieza el 1 de enero. <strong>OEP:</strong> del 1 de enero al 31 de marzo si ya está en Medicare Advantage — un cambio a otro Advantage o de regreso a Original. Medigap después del OEP casi siempre requiere underwriting, salvo la regla de cumpleaños de Florida.'
    }
  };

  function g(id) { return document.getElementById(id); }

  function t() { return T[lang] || T.en; }

  function setText(id, value, html) {
    var el = g(id);
    if (!el || value == null) return;
    if (html) el.innerHTML = value;
    else el.textContent = value;
  }

  function setLang(l) {
    lang = (l === 'es') ? 'es' : 'en';
    var copy = t();
    var lbs = document.querySelectorAll('.lb');
    for (var i = 0; i < lbs.length; i++) {
      lbs[i].classList.toggle('active', lbs[i].textContent === lang.toUpperCase());
    }
    setText('hero-tag', copy.hero_tag);
    setText('hero-title', copy.hero_title, true);
    setText('hero-sub', copy.hero_sub);
    setText('tab-iep', copy.tab_iep);
    setText('tab-sep', copy.tab_sep);
    setText('iep-card-title', copy.iep_card);
    setText('lbl-month', copy.lbl_month);
    setText('lbl-year', copy.lbl_year);
    setText('iep-note', copy.iep_note);
    setText('iep-btn', copy.iep_btn);
    setText('sep-card-title', copy.sep_card);
    setText('lbl-trigger', copy.lbl_trigger);
    setText('trig-employer-title', copy.trig_employer_t);
    setText('trig-employer-desc', copy.trig_employer_d);
    setText('trig-move-title', copy.trig_move_t);
    setText('trig-move-desc', copy.trig_move_d);
    setText('trig-newmedicare-title', copy.trig_newmedicare_t);
    setText('trig-newmedicare-desc', copy.trig_newmedicare_d);
    setText('sep-btn', copy.sep_btn);
    setText('aep-title', copy.aep_title);
    setText('aep-body', copy.aep_body, true);
    updateSepDateCopy();

    var selects = ['iep-month', 'sep-month'];
    for (var s = 0; s < selects.length; s++) {
      var sel = g(selects[s]);
      if (!sel || sel.options.length < 13) continue;
      var val = sel.value;
      sel.options[0].text = copy.month_placeholder;
      for (var m = 0; m < 12; m++) sel.options[m + 1].text = copy.months[m];
      sel.value = val;
    }
    var yearSels = ['iep-year', 'sep-year'];
    for (var y = 0; y < yearSels.length; y++) {
      var ys = g(yearSels[y]);
      if (ys && ys.options[0] && !ys.options[0].value) ys.options[0].text = copy.year_placeholder;
    }

    hideResult('iep-result');
    hideResult('sep-result');
    clearError('iep-error');
    clearError('sep-error');
  }

  function updateSepDateCopy() {
    var copy = t();
    var lbl = g('lbl-sepdate');
    var note = g('sep-note');
    var btn = g('sep-btn');
    var dateWrap = g('sep-date-wrap');
    if (sepTrigger === 'newmedicare') {
      if (lbl) lbl.textContent = copy.lbl_sepdate;
      if (note) note.textContent = copy.sep_note_gep;
      if (btn) btn.textContent = copy.sep_btn_gep;
      if (dateWrap) dateWrap.style.display = 'none';
    } else {
      if (lbl) lbl.textContent = sepTrigger === 'move' ? copy.lbl_movedate : copy.lbl_sepdate;
      if (note) note.textContent = copy.sep_note;
      if (btn) btn.textContent = copy.sep_btn;
      if (dateWrap) dateWrap.style.display = '';
    }
  }

  function switchTab(tab) {
    var iep = g('tool-iep');
    var sep = g('tool-sep');
    if (iep) iep.style.display = tab === 'iep' ? 'block' : 'none';
    if (sep) sep.style.display = tab === 'sep' ? 'block' : 'none';
    if (g('tab-iep')) g('tab-iep').classList.toggle('active', tab === 'iep');
    if (g('tab-sep')) g('tab-sep').classList.toggle('active', tab === 'sep');
  }

  function selectTrigger(kind) {
    sepTrigger = kind;
    var btns = ['employer', 'move', 'newmedicare'];
    for (var i = 0; i < btns.length; i++) {
      var el = g('trig-' + btns[i]);
      if (el) el.classList.toggle('active', btns[i] === kind);
    }
    updateSepDateCopy();
    hideResult('sep-result');
    clearError('sep-error');
  }

  function addMonth(y, m, n) {
    var d = new Date(y, m - 1 + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  }

  function addDays(y, m, day, n) {
    var d = new Date(y, m - 1, day);
    d.setDate(d.getDate() + n);
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
  }

  function monthName(m, y) {
    return t().months[m - 1] + ' ' + y;
  }

  function formatDay(p) {
    if (lang === 'es') return p.d + ' de ' + t().months[p.m - 1] + ' ' + p.y;
    return t().months[p.m - 1] + ' ' + p.d + ', ' + p.y;
  }

  function formatStart(cs) {
    var copy = t();
    if (lang === 'es') return copy.cov_starts + '1 de ' + copy.months[cs.m - 1] + ' ' + cs.y + '.';
    return copy.cov_starts + copy.months[cs.m - 1] + copy.first_of + cs.y + '.';
  }

  function showError(id, msg) {
    var el = g(id);
    if (!el) {
      window.alert(msg);
      return;
    }
    el.textContent = msg;
    el.style.display = 'block';
    el.hidden = false;
  }

  function clearError(id) {
    var el = g(id);
    if (!el) return;
    el.textContent = '';
    el.style.display = 'none';
    el.hidden = true;
  }

  function hideResult(id) {
    var el = g(id);
    if (!el) return;
    el.style.display = 'none';
    el.innerHTML = '';
  }

  function medigapHref() {
    return lang === 'es' ? '/es/calculadora-medigap/' : '/medigap-plan-calculator/';
  }

  function advHref() {
    return lang === 'es' ? '/es/calculadora-advantage-vs-suplemento/' : '/medicare-advantage-vs-supplement-calculator/';
  }

  function moreLinks() {
    var copy = t();
    return '<div class="enroll-more">' +
      '<div class="enroll-more-title">' + copy.more_title + '</div>' +
      '<a href="' + medigapHref() + '">' + copy.more_medigap + '</a>' +
      '<a href="' + advHref() + '">' + copy.more_adv + '</a>' +
      '</div>';
  }

  function ctaBox(title, desc) {
    var copy = t();
    return '<div class="cta-box cta-full-box">' +
      '<div class="cta-box-title">' + title + '</div>' +
      '<p class="cta-box-desc">' + desc + '</p>' +
      '<div class="cta-btns cta-full-btns">' +
      '<a href="'+(lang==='es'?'/es/reservar':'/book')+'" class="cta-btn-pink result-cta-btn-pink">' + copy.cta_call + '</a>' +
      '<a href="https://wa.me/13054646888" target="_blank" rel="noopener" class="cta-btn-wa" onclick="gtag(\'event\',\'whatsapp_click\',{\'page\':location.pathname})">' + copy.cta_wa + '</a>' +
      '</div></div>';
  }

  function attachShare(placeholderId) {
    var copy = t();
    var ph = g(placeholderId);
    if (!ph) return;
    var shareDiv = document.createElement('div');
    shareDiv.className = 'enroll-share';
    var shareLabel = document.createElement('div');
    shareLabel.className = 'enroll-share-label';
    shareLabel.textContent = copy.share_know;
    var shareTitle = document.createElement('div');
    shareTitle.className = 'enroll-share-title';
    shareTitle.textContent = copy.share_title;
    var shareBtns = document.createElement('div');
    shareBtns.className = 'enroll-share-btns';
    var waBtn = document.createElement('a');
    waBtn.href = 'https://wa.me/?text=' + encodeURIComponent(copy.share_wa_msg + window.location.href);
    waBtn.target = '_blank';
    waBtn.rel = 'noopener';
    waBtn.className = 'cta-btn-wa';
    waBtn.textContent = copy.share_wa;
    var cpBtn = document.createElement('button');
    cpBtn.type = 'button';
    cpBtn.className = 'enroll-copy-btn';
    cpBtn.textContent = copy.share_copy;
    cpBtn.onclick = function () {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(window.location.href).then(function () {
        cpBtn.textContent = copy.share_copied;
        setTimeout(function () { cpBtn.textContent = copy.share_copy; }, 2000);
      });
    };
    shareBtns.appendChild(waBtn);
    shareBtns.appendChild(cpBtn);
    shareDiv.appendChild(shareLabel);
    shareDiv.appendChild(shareTitle);
    shareDiv.appendChild(shareBtns);
    ph.parentNode.replaceChild(shareDiv, ph);
  }

  function showWrap(id, html) {
    var wrap = g(id);
    if (!wrap) return;
    wrap.innerHTML = html;
    wrap.style.display = 'block';
    try { wrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    catch (e) { wrap.scrollIntoView(true); }
  }

  function calcIEP() {
    var copy = t();
    clearError('iep-error');
    var bm = parseInt(g('iep-month') && g('iep-month').value, 10);
    var by = parseInt(g('iep-year') && g('iep-year').value, 10);
    if (!bm || !by) { showError('iep-error', copy.err_select); return; }

    var bday65y = by + 65;
    var bday65m = bm;
    var months = [];
    for (var i = -3; i <= 3; i++) months.push(addMonth(bday65y, bday65m, i));

    /* 2023+ CMS: months 1–3 (before birthday month) start 1st of birthday month.
       Birthday month and the 3 months after: coverage starts 1st of the month after you enroll. */
    var rows = [];
    for (var r = 0; r < 7; r++) {
      var w = months[r];
      var cs = (r < 3) ? { y: bday65y, m: bday65m } : addMonth(w.y, w.m, 1);
      var label = monthName(w.m, w.y);
      var dot = 'best';
      var badge = copy.iep_best_badge;
      if (r === 3) {
        label += ' (' + copy.iep_bday_badge + ')';
        dot = 'good';
        badge = copy.iep_good;
      } else if (r > 3) {
        dot = 'warn';
        badge = copy.iep_warn;
      }
      rows.push({ dot: dot, month: label, desc: formatStart(cs), badge: badge });
    }

    var w1 = months[0];
    var w7 = months[6];
    var h = '';
    h += '<div class="result-hero" style="background:linear-gradient(135deg,#f4eefa,#fff0f8);border:2px solid #452068;">';
    h += '<div class="result-label" style="color:#452068;">' + copy.iep_result_label + '</div>';
    h += '<div class="result-main" style="color:#452068;">' + monthName(w1.m, w1.y) + ' – ' + monthName(w7.m, w7.y) + '</div>';
    h += '<div class="result-sub" style="color:#452068;">' + copy.iep_window_sub + '</div></div>';
    h += '<div class="key-fact-box"><strong>' + copy.key_fact + '</strong> ' + copy.key_fact_body + '</div>';
    h += '<div class="timeline tl-timeline"><div class="timeline-title tl-title">' + copy.timeline_iep + '</div>';
    for (var j = 0; j < rows.length; j++) {
      var row = rows[j];
      h += '<div class="tl-row"><div class="tl-dot ' + row.dot + '">' + (j + 1) + '</div><div class="tl-content">';
      h += '<div class="tl-month">' + row.month + '</div><div class="tl-desc">' + row.desc + '</div>';
      h += '<span class="tl-badge ' + row.dot + '">' + row.badge + '</span></div></div>';
    }
    h += '</div>';
    h += '<div class="warning-box penalty-box"><strong>' + copy.penalty_title + '</strong><br>' + copy.penalty_desc + '</div>';
    h += '<div id="iep-share-ph"></div>';
    h += ctaBox(copy.cta_title, copy.cta_desc);
    h += moreLinks();

    showWrap('iep-result', h);
    attachShare('iep-share-ph');
  }

  function calcSEP() {
    var copy = t();
    clearError('sep-error');

    if (sepTrigger === 'newmedicare') {
      var h2 = '';
      h2 += '<div class="result-hero" style="background:#fff8e7;border:2px solid #d97706;">';
      h2 += '<div class="result-label" style="color:#d97706;">' + copy.gep_label + '</div>';
      h2 += '<div class="result-main" style="color:#92400e;">' + copy.gep_win + '</div>';
      h2 += '<div class="result-sub" style="color:#92400e;">' + copy.gep_cov + '</div></div>';
      h2 += '<div class="warning-box penalty-box">' + copy.sep_warning_newmedicare + '</div>';
      h2 += '<div id="sep-share-ph"></div>';
      h2 += ctaBox(copy.cta_sep_title, copy.cta_sep_desc);
      h2 += moreLinks();
      showWrap('sep-result', h2);
      attachShare('sep-share-ph');
      return;
    }

    var sm = parseInt(g('sep-month') && g('sep-month').value, 10);
    var sy = parseInt(g('sep-year') && g('sep-year').value, 10);
    if (!sm || !sy) { showError('sep-error', copy.err_select); return; }

    var startLabel;
    var endLabel;
    var endDate;
    if (sepTrigger === 'employer') {
      var start = { y: sy, m: sm, d: 1 };
      var end = addDays(sy, sm, 1, 60);
      startLabel = formatDay(start);
      endLabel = formatDay(end);
      endDate = new Date(end.y, end.m - 1, end.d);
    } else {
      var startM = { y: sy, m: sm };
      var endM = addMonth(sy, sm, 2);
      startLabel = monthName(startM.m, startM.y);
      endLabel = monthName(endM.m, endM.y);
      endDate = new Date(endM.y, endM.m - 1, 1);
    }
    var warningText = copy['sep_warning_' + sepTrigger];
    var windowLabel = copy['sep_window_' + sepTrigger];

    var now = new Date();
    var diffDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    var urgencyColor = diffDays > 60 ? '#16a34a' : diffDays > 30 ? '#d97706' : '#dc2626';
    var urgencyBg = diffDays > 60 ? '#f0fdf4' : diffDays > 30 ? '#fffbeb' : '#fff5f5';
    var urgencyMsg = diffDays > 60 ? copy.days_left(diffDays)
      : diffDays > 30 ? copy.days_soon(diffDays)
      : copy.days_urgent(diffDays);
    if (diffDays <= 0) {
      urgencyMsg = copy.window_closed;
      urgencyColor = '#dc2626';
      urgencyBg = '#fff5f5';
    }

    var h = '';
    h += '<div class="result-hero" style="background:' + urgencyBg + ';border:2px solid ' + urgencyColor + ';">';
    h += '<div class="result-label" style="color:' + urgencyColor + ';">' + copy.sep_result_label + '</div>';
    h += '<div class="result-main" style="color:' + urgencyColor + ';">' + startLabel + ' – ' + endLabel + '</div>';
    h += '<div class="result-sub" style="color:' + urgencyColor + ';">' + windowLabel + '</div></div>';
    if (diffDays > 0) {
      h += '<div class="urgency-box" style="background:' + urgencyBg + ';border:2px solid ' + urgencyColor + ';color:' + urgencyColor + ';">' + urgencyMsg + '</div>';
    } else {
      h += '<div class="urgency-box" style="background:' + urgencyBg + ';border:2px solid ' + urgencyColor + ';color:' + urgencyColor + ';">' + urgencyMsg + '</div>';
    }
    h += '<div class="warning-box penalty-box">' + warningText + '</div>';
    h += '<div class="timeline tl-timeline"><div class="timeline-title tl-title">' + copy.sep_result_label + '</div>';
    h += '<div class="tl-row"><div class="tl-dot best">1</div><div class="tl-content"><div class="tl-month">' + copy.sep_starts + ': ' + startLabel + '</div><div class="tl-desc">' + copy.sep_begin + '</div><span class="tl-badge best">' + copy.start_date + '</span></div></div>';
    h += '<div class="tl-row"><div class="tl-dot warn">!</div><div class="tl-content"><div class="tl-month">' + copy.sep_deadline + ': ' + endLabel + '</div><div class="tl-desc">' + copy.sep_close + '</div><span class="tl-badge warn">' + copy.deadline + '</span></div></div>';
    h += '</div>';
    h += '<div id="sep-share-ph"></div>';
    h += ctaBox(copy.cta_sep_title, copy.cta_sep_desc);
    h += moreLinks();

    showWrap('sep-result', h);
    attachShare('sep-share-ph');
  }

  function populateYears() {
    var now = new Date().getFullYear();
    var iepYr = g('iep-year');
    var sepYr = g('sep-year');
    var copy = t();
    if (iepYr) {
      iepYr.innerHTML = '';
      var iepBlank = document.createElement('option');
      iepBlank.value = '';
      iepBlank.text = copy.year_placeholder;
      iepYr.appendChild(iepBlank);
      for (var y = now - 90; y <= now - 60; y++) {
        var o = document.createElement('option');
        o.value = y;
        o.text = y;
        iepYr.appendChild(o);
      }
    }
    if (sepYr) {
      sepYr.innerHTML = '';
      var sepBlank = document.createElement('option');
      sepBlank.value = '';
      sepBlank.text = copy.year_placeholder;
      sepYr.appendChild(sepBlank);
      for (var sy = now - 8; sy <= now + 2; sy++) {
        var o2 = document.createElement('option');
        o2.value = sy;
        o2.text = sy;
        sepYr.appendChild(o2);
      }
    }
  }

  function fillAepBox() {
    var copy = t();
    setText('aep-title', copy.aep_title);
    setText('aep-body', copy.aep_body, true);
  }

  global.switchTab = switchTab;
  global.selectTrigger = selectTrigger;
  global.calcIEP = calcIEP;
  global.calcSEP = calcSEP;
  global.setLang = setLang;
  global.ENROLL_CALC = { setLang: setLang, populateYears: populateYears };

  populateYears();
  fillAepBox();
  updateSepDateCopy();
})(window);
