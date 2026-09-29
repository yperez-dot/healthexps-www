/**
 * AEP 2027 homepage countdown — exact dates/copy from the Sep 29 2026 brief.
 * Put the number in <span id="aep-countdown"></span> and wrap the message in id="aep-message".
 */
(function () {
  var el = document.getElementById('aep-countdown');
  var msg = document.getElementById('aep-message');
  if (!el || !msg) return;
  var es = document.documentElement.lang === 'es';
  var start = new Date('2026-10-15T00:00:00-04:00');
  var end = new Date('2026-12-07T23:59:59-05:00');
  var now = new Date();
  var day = 86400000;
  function unit(n) { return es ? (n === 1 ? ' día' : ' días') : (n === 1 ? ' day' : ' days'); }
  if (now < start) {
    var n = Math.ceil((start - now) / day);
    el.textContent = (es ? 'Empieza en ' : 'Starts in ') + n + unit(n);
  } else if (now <= end) {
    var m = Math.ceil((end - now) / day);
    el.textContent = (es ? 'Termina en ' : 'Ends in ') + m + unit(m);
  } else {
    msg.hidden = true;
  }

  var tile = document.getElementById('plan-tile-medicare');
  if (tile && now <= end) tile.classList.add('is-aep');
})();
