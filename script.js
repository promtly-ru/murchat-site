(function () {
  'use strict';

  // ---------- Плавное появление ----------
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  // ---------- Скроллителлинг: схема меняется вместе с шагом ----------
  var diagram = document.getElementById('diagram');
  var steps = document.querySelectorAll('.step');
  function setStep(el) {
    steps.forEach(function (s) { s.classList.toggle('active', s === el); });
    diagram.setAttribute('data-step', el.getAttribute('data-step'));
  }
  if ('IntersectionObserver' in window) {
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) setStep(e.target); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(function (s) { so.observe(s); });
  }
  setStep(steps[0]);

  // ---------- Полоса прогресса чтения ----------
  var bar = document.getElementById('bar');
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, scrollY / max) : 0) + ')';
      ticking = false;
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Звук мурчания (синтез в браузере, без файлов) ----------
  // Низкий гул ~26 Гц: пилообразная волна + шум, «щёлкающий» в такт,
  // через фильтр низких частот. Громкость «дышит»: вдох и выдох.
  var ctx = null, nodes = null;
  var btn = document.getElementById('listen');
  var label = btn.querySelector('.listen-text');

  function start() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { label.textContent = 'Браузер не поддерживает звук'; return; }
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') ctx.resume();
    var t = ctx.currentTime, f = 26;

    var osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f;

    var len = ctx.sampleRate * 2;
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;

    var gate = ctx.createGain();
    gate.gain.value = 0;
    var gateLfo = ctx.createOscillator();
    gateLfo.type = 'square';
    gateLfo.frequency.value = f;
    var gateDepth = ctx.createGain();
    gateDepth.gain.value = 0.18;
    gateLfo.connect(gateDepth).connect(gate.gain);

    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 480;

    var breath = ctx.createGain();
    breath.gain.value = 0.7;
    var breathLfo = ctx.createOscillator();
    breathLfo.frequency.value = 0.6;
    var breathDepth = ctx.createGain();
    breathDepth.gain.value = 0.3;
    breathLfo.connect(breathDepth).connect(breath.gain);

    var master = ctx.createGain();
    master.gain.setValueAtTime(0, t);
    master.gain.linearRampToValueAtTime(0.3, t + 0.5);

    osc.connect(lp);
    noise.connect(gate).connect(lp);
    lp.connect(breath).connect(master).connect(ctx.destination);
    [osc, noise, gateLfo, breathLfo].forEach(function (s) { s.start(t); });
    nodes = { srcs: [osc, noise, gateLfo, breathLfo], master: master };

    btn.setAttribute('aria-pressed', 'true');
    label.textContent = 'Остановить';
  }

  function stop() {
    if (!nodes) return;
    var t = ctx.currentTime, n = nodes;
    nodes = null;
    n.master.gain.cancelScheduledValues(t);
    n.master.gain.setValueAtTime(n.master.gain.value, t);
    n.master.gain.linearRampToValueAtTime(0, t + 0.4);
    n.srcs.forEach(function (s) { s.stop(t + 0.45); });
    btn.setAttribute('aria-pressed', 'false');
    label.textContent = 'Послушать ещё раз';
  }

  btn.addEventListener('click', function () { nodes ? stop() : start(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); });
})();
