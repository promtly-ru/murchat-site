(function () {
  'use strict';

  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  // ---------- Плавное появление ----------
  var reveals = document.querySelectorAll('.reveal');
  if (hasIO) {
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
  if (hasIO) {
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) setStep(e.target); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(function (s) { so.observe(s); });
  }
  setStep(steps[0]);

  // ---------- Оглавление сбоку ----------
  var toc = document.getElementById('toc');
  var tocLinks = toc.querySelectorAll('a');
  if (hasIO) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = '#' + e.target.id;
        tocLinks.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === id); });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    ['ch1', 'ch2', 'ch3', 'end'].forEach(function (id) { co.observe(document.getElementById(id)); });
  }

  // ---------- Прогресс чтения + показ оглавления ----------
  var bar = document.getElementById('bar');
  var cover = document.querySelector('.cover');
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, scrollY / max) : 0) + ')';
      toc.classList.toggle('show', scrollY > cover.offsetHeight * 0.8);
      ticking = false;
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Счётчик вибраций ----------
  var ticks = document.getElementById('ticks');
  var ticksWord = document.getElementById('ticksWord');
  var t0 = performance.now();
  var fmt = window.Intl ? new Intl.NumberFormat('ru-RU') : { format: String };
  function plural(n) {
    var a = n % 10, b = n % 100;
    return (a >= 2 && a <= 4 && (b < 12 || b > 14)) ? 'раза' : 'раз';
  }
  setInterval(function () {
    var n = Math.floor((performance.now() - t0) / 1000 * 26);
    ticks.textContent = fmt.format(n);
    ticksWord.textContent = plural(n);
  }, 120);

  // ---------- Звуковой движок мурчания (синтез, без файлов) ----------
  // Гул ~26 Гц: пилообразная волна + шум, «щёлкающий» в такт, через
  // фильтр низких частот. Громкость «дышит»: вдох и выдох.
  var ctx = null, master = null;
  function ensureAudio() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!ctx) {
      ctx = new AC();
      var f = 26;
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

      master = ctx.createGain();
      master.gain.value = 0;

      osc.connect(lp);
      noise.connect(gate).connect(lp);
      lp.connect(breath).connect(master).connect(ctx.destination);
      [osc, noise, gateLfo, breathLfo].forEach(function (s) { s.start(); });
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  var lastGain = -1;
  function setVolume(v) {
    if (!master) return;
    v = Math.round(v * 100) / 100;
    if (v === lastGain) return;
    lastGain = v;
    master.gain.setTargetAtTime(v * 0.32, ctx.currentTime, 0.08);
  }

  // ---------- Кнопка «Послушать» ----------
  var listenOn = false;
  var btn = document.getElementById('listen');
  var label = btn.querySelector('.listen-text');
  btn.addEventListener('click', function () {
    if (!ensureAudio()) { label.textContent = 'Браузер не поддерживает звук'; return; }
    listenOn = !listenOn;
    btn.setAttribute('aria-pressed', String(listenOn));
    label.textContent = listenOn ? 'Остановить' : 'Послушать ещё раз';
  });

  // ---------- Погладь кота ----------
  var area = document.getElementById('petArea');
  var img = area.querySelector('img');
  var canvas = document.getElementById('trail');
  var g = canvas.getContext('2d');
  var meter = document.getElementById('meter');
  var status = document.getElementById('petStatus');
  var hint = document.getElementById('petHint');
  var level = 0, last = null, trail = [], lastVibe = 0, petted = false;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = area.clientWidth * dpr;
    canvas.height = area.clientHeight * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize);
  resize();

  function pos(e) {
    var r = area.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  area.addEventListener('pointerdown', function (e) {
    ensureAudio();
    area.classList.add('down');
    last = pos(e);
  });
  area.addEventListener('pointerup', function () { ensureAudio(); area.classList.remove('down'); });
  area.addEventListener('pointerleave', function () { area.classList.remove('down'); last = null; });
  area.addEventListener('pointercancel', function () { area.classList.remove('down'); last = null; });
  area.addEventListener('pointermove', function (e) {
    var p = pos(e);
    if (last) {
      var dist = Math.hypot(p.x - last.x, p.y - last.y);
      var boost = area.classList.contains('down') || e.pointerType !== 'mouse' ? 1 : 0.45;
      level = Math.min(1, level + dist / (area.clientWidth * 1.4) * boost);
      if (!petted && level > 0.15) { petted = true; hint.textContent = 'Так держать! Чем активнее гладишь, тем громче мурчание.'; }
    }
    last = p;
    trail.push({ x: p.x, y: p.y, t: performance.now() });
    if (trail.length > 80) trail.shift();
    if (e.pointerType !== 'mouse' && level > 0.3 && navigator.vibrate && performance.now() - lastVibe > 140) {
      navigator.vibrate(40);
      lastVibe = performance.now();
    }
  });

  function statusText(l) {
    if (l < 0.05) return 'Кот дремлет';
    if (l < 0.3) return 'Ушко дёрнулось…';
    if (l < 0.7) return 'Заработал моторчик';
    return 'Полный мур!';
  }

  var shown = '';
  function frame(now) {
    // затухание
    level *= 0.988;
    if (level < 0.001) level = 0;

    meter.style.transform = 'scaleX(' + level.toFixed(3) + ')';
    var s = statusText(level);
    if (s !== shown) { status.textContent = s; shown = s; }

    if (!reduceMotion) {
      var a = level * 2.4;
      img.style.transform = a > 0.05
        ? 'scale(1.03) translate(' + ((Math.random() - 0.5) * a).toFixed(2) + 'px,' + ((Math.random() - 0.5) * a).toFixed(2) + 'px)'
        : 'scale(1.03)';
    }

    // тёплый след за пальцем
    g.clearRect(0, 0, area.clientWidth, area.clientHeight);
    while (trail.length && now - trail[0].t > 700) trail.shift();
    for (var i = 0; i < trail.length; i++) {
      var k = 1 - (now - trail[i].t) / 700;
      var r = 26 + (1 - k) * 22;
      var grd = g.createRadialGradient(trail[i].x, trail[i].y, 0, trail[i].x, trail[i].y, r);
      grd.addColorStop(0, 'rgba(255,190,130,' + (0.22 * k).toFixed(3) + ')');
      grd.addColorStop(1, 'rgba(255,190,130,0)');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(trail[i].x, trail[i].y, r, 0, Math.PI * 2);
      g.fill();
    }

    setVolume(Math.max(listenOn ? 1 : 0, Math.min(1, level * 1.3)));
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) return;
    level = 0;
    if (listenOn) btn.click();
  });
})();
