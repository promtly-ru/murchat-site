(function () {
  'use strict';

  // ---------- Появление секций ----------
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  // ---------- Синтез мурчания (Web Audio) ----------
  // Низкий «гул» из пилообразной волны + шум, пропущенные через фильтр.
  // Громкость медленно «дышит», как вдох и выдох у кошки.
  var ctx = null;
  function audio() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function Purr() { this.nodes = null; }
  Purr.prototype.start = function (freq) {
    var ac = audio();
    if (!ac || this.nodes) return;
    var now = ac.currentTime;

    var osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;

    // Шум для «шершавости»
    var len = ac.sampleRate * 2;
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    var noise = ac.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    var noiseGain = ac.createGain();
    noiseGain.gain.value = 0.25;

    // Шум «щёлкает» в такт моторчику
    var pulse = ac.createGain();
    pulse.gain.value = 0;
    var pulseLfo = ac.createOscillator();
    pulseLfo.type = 'square';
    pulseLfo.frequency.value = freq;
    var pulseDepth = ac.createGain();
    pulseDepth.gain.value = 0.5;
    pulseLfo.connect(pulseDepth).connect(pulse.gain);

    var filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.8;

    // Дыхание: громкость плавает раз в ~1,6 секунды
    var breath = ac.createGain();
    breath.gain.value = 0.7;
    var breathLfo = ac.createOscillator();
    breathLfo.frequency.value = 0.62;
    var breathDepth = ac.createGain();
    breathDepth.gain.value = 0.3;
    breathLfo.connect(breathDepth).connect(breath.gain);

    var master = ac.createGain();
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.32, now + 0.35);

    osc.connect(filter);
    noise.connect(noiseGain).connect(pulse).connect(filter);
    filter.connect(breath).connect(master).connect(ac.destination);

    osc.start(now); noise.start(now); pulseLfo.start(now); breathLfo.start(now);
    this.nodes = { osc: osc, noise: noise, pulseLfo: pulseLfo, breathLfo: breathLfo, master: master };
  };
  Purr.prototype.setFreq = function (freq) {
    if (!this.nodes) return;
    var t = ctx.currentTime;
    this.nodes.osc.frequency.setTargetAtTime(freq, t, 0.05);
    this.nodes.pulseLfo.frequency.setTargetAtTime(freq, t, 0.05);
  };
  Purr.prototype.stop = function () {
    if (!this.nodes) return;
    var n = this.nodes, t = ctx.currentTime;
    this.nodes = null;
    n.master.gain.cancelScheduledValues(t);
    n.master.gain.setValueAtTime(n.master.gain.value, t);
    n.master.gain.linearRampToValueAtTime(0, t + 0.3);
    [n.osc, n.noise, n.pulseLfo, n.breathLfo].forEach(function (s) { s.stop(t + 0.35); });
  };

  // ---------- Кот в шапке ----------
  var cat = document.getElementById('cat');
  var stage = cat.parentNode;
  var hint = document.getElementById('hint');
  var catPurr = new Purr();
  var vibeTimer = null;

  function catOn(e) {
    if (e) e.preventDefault();
    if (cat.classList.contains('purring')) return;
    cat.classList.add('purring');
    stage.classList.add('purring');
    cat.setAttribute('aria-pressed', 'true');
    if (hint) hint.style.visibility = 'hidden';
    catPurr.start(26);
    if (navigator.vibrate) {
      navigator.vibrate(1000);
      vibeTimer = setInterval(function () { navigator.vibrate(1000); }, 900);
    }
  }
  function catOff() {
    if (!cat.classList.contains('purring')) return;
    cat.classList.remove('purring');
    stage.classList.remove('purring');
    cat.setAttribute('aria-pressed', 'false');
    catPurr.stop();
    clearInterval(vibeTimer);
    if (navigator.vibrate) navigator.vibrate(0);
  }
  cat.addEventListener('pointerdown', function (e) {
    catOn(e);
    if (cat.setPointerCapture) cat.setPointerCapture(e.pointerId);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { cat.addEventListener(ev, catOff); });
  cat.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  // С клавиатуры: пробел/Enter держишь, кот мурчит
  cat.addEventListener('keydown', function (e) {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) catOn(e);
  });
  cat.addEventListener('keyup', function (e) {
    if (e.key === ' ' || e.key === 'Enter') catOff();
  });
  cat.addEventListener('blur', catOff);
  document.addEventListener('visibilitychange', function () { if (document.hidden) { catOff(); labStop(); } });

  // ---------- Лаборатория частоты ----------
  var freq = document.getElementById('freq');
  var freqOut = document.getElementById('freqOut');
  var freqNote = document.getElementById('freqNote');
  var playBtn = document.getElementById('labPlay');
  var canvas = document.getElementById('wave');
  var g = canvas.getContext('2d');
  var labPurr = new Purr();
  var labPlaying = false;
  var phase = 0;

  function note(f) {
    if (f < 25) return '— на границе слуха, скорее чувствуешь, чем слышишь';
    if (f <= 50) return '— уютное мурчание';
    if (f <= 100) return '— бодрое мурчание';
    return '— уже похоже на низкий голос';
  }
  function updateFreq() {
    var f = +freq.value;
    freqOut.textContent = f;
    freqNote.textContent = note(f);
    labPurr.setFreq(f);
  }
  freq.addEventListener('input', updateFreq);

  function labStop() {
    if (!labPlaying) return;
    labPlaying = false;
    labPurr.stop();
    playBtn.textContent = '▶ Слушать';
    playBtn.setAttribute('aria-pressed', 'false');
  }
  playBtn.addEventListener('click', function () {
    if (labPlaying) { labStop(); return; }
    labPlaying = true;
    labPurr.start(+freq.value);
    playBtn.textContent = '■ Стоп';
    playBtn.setAttribute('aria-pressed', 'true');
  });

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  function draw() {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    var f = +freq.value;
    var cycles = f / 6;               // сколько «горбиков» видно на экране
    var amp = labPlaying ? h * 0.32 : h * 0.12;
    if (!reduceMotion) phase += labPlaying ? 0.12 : 0.03;

    g.lineWidth = 3;
    g.strokeStyle = cssVar('--accent');
    g.beginPath();
    for (var x = 0; x <= w; x += 2) {
      var t = x / w;
      var y = h / 2 + Math.sin(t * cycles * Math.PI * 2 - phase * 6) * amp * (0.85 + 0.15 * Math.sin(phase));
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  // ---------- Тест ----------
  var questions = [
    { q: 'Где рождается мурчание?', a: ['В животе', 'В гортани, рядом с голосовыми складками', 'В носу'], r: 1,
      e: 'Да, «моторчик» сидит в горле, там же, где у нас голос.' },
    { q: 'Кошка мурчит у ветеринара. Это значит…', a: ['Ей точно хорошо', 'Она может так себя успокаивать'], r: 1,
      e: 'Мурчание бывает и от стресса, и от боли. Это способ себя успокоить.' },
    { q: 'Почему мурчание проще почувствовать рукой, чем услышать?', a: ['Оно очень тихое и низкое, как вибрация телефона', 'Кошки мурчат только ночью'], r: 0,
      e: 'Частота всего 25–150 вибраций в секунду, это очень низкий звук.' },
    { q: 'Кто из этих кошек НЕ мурчит ровно, как домашняя?', a: ['Гепард', 'Пума', 'Лев'], r: 2,
      e: 'Львы рычат. Ровно мурчать у них не получается.' },
    { q: 'Когда котята начинают мурчать?', a: ['В первые дни жизни', 'Когда вырастут', 'Только если их научит мама'], r: 0,
      e: 'Это врождённое умение, учить не нужно.' }
  ];
  var box = document.getElementById('quizBox');
  var idx = 0, score = 0;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function renderQ() {
    box.innerHTML = '';
    var item = questions[idx];
    var bar = el('div', 'progress'); var fill = el('i');
    fill.style.width = (idx / questions.length * 100) + '%';
    bar.appendChild(fill); box.appendChild(bar);
    box.appendChild(el('p', 'q-num', 'Вопрос ' + (idx + 1) + ' из ' + questions.length));
    box.appendChild(el('p', 'q-text', item.q));
    var opts = item.a.map(function (text, i) {
      var b = el('button', 'opt', text);
      b.type = 'button';
      b.addEventListener('click', function () { answer(i, opts); });
      box.appendChild(b);
      return b;
    });
  }
  function answer(i, opts) {
    var item = questions[idx];
    opts.forEach(function (o) { o.disabled = true; });
    opts[item.r].classList.add('ok');
    if (i === item.r) score++; else opts[i].classList.add('bad');
    box.appendChild(el('p', 'explain', (i === item.r ? 'Верно! ' : 'Не совсем. ') + item.e));
    var next = el('button', 'btn', idx + 1 < questions.length ? 'Дальше →' : 'Результат');
    next.type = 'button';
    next.addEventListener('click', function () { idx++; idx < questions.length ? renderQ() : renderEnd(); });
    box.appendChild(next);
    next.focus();
  }
  function renderEnd() {
    box.innerHTML = '';
    var bar = el('div', 'progress'); var fill = el('i'); fill.style.width = '100%';
    bar.appendChild(fill); box.appendChild(bar);
    box.appendChild(el('p', 'score', score + ' / ' + questions.length));
    var msg = score === questions.length ? 'Ты настоящий кошачий эксперт 🐈'
      : score >= 3 ? 'Хорошо! Пара деталей ускользнула, загляни ещё раз в статью.'
      : 'Не беда, перечитай разделы выше и попробуй снова.';
    box.appendChild(el('p', 'explain', msg));
    var again = el('button', 'btn', 'Пройти ещё раз');
    again.type = 'button';
    again.addEventListener('click', function () { idx = 0; score = 0; renderQ(); });
    box.appendChild(again);
  }
  renderQ();

  // ---------- Флип-карточки ----------
  document.querySelectorAll('.flip').forEach(function (f) {
    f.setAttribute('aria-pressed', 'false');
    f.addEventListener('click', function () {
      var on = f.classList.toggle('on');
      f.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  });
})();
