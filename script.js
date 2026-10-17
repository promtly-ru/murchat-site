(function () {
  // Плавное появление секций
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  // Погладить кота
  var cat = document.getElementById('cat');
  var counter = document.getElementById('counter');
  var n = 0, timer;
  document.getElementById('pet').addEventListener('click', function () {
    n += 1;
    counter.textContent = n;
    cat.classList.add('purr');
    clearTimeout(timer);
    timer = setTimeout(function () { cat.classList.remove('purr'); }, 1500);
  });

  // Мини-тест
  var questions = [
    { q: 'На что похоже мурчание?', a: ['На маленький моторчик', 'На свист чайника', 'На стук в дверь'], r: 0 },
    { q: 'Мурчат ли кошки, когда им страшно?', a: ['Нет, только от счастья', 'Да, так они успокаивают себя'], r: 1 },
    { q: 'Когда котята начинают мурчать?', a: ['В первые дни жизни', 'Только во взрослом возрасте'], r: 0 }
  ];
  var quiz = document.getElementById('quiz');
  var score = 0, answered = 0;
  var result = document.createElement('p');
  result.className = 'result';
  result.setAttribute('aria-live', 'polite');

  questions.forEach(function (item) {
    var box = document.createElement('div');
    box.className = 'q';
    var p = document.createElement('p');
    p.textContent = item.q;
    box.appendChild(p);
    item.a.forEach(function (text, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt';
      b.textContent = text;
      b.addEventListener('click', function () {
        var opts = box.querySelectorAll('.opt');
        opts.forEach(function (o) { o.disabled = true; });
        opts[item.r].classList.add('ok');
        if (i === item.r) { score += 1; } else { b.classList.add('bad'); }
        answered += 1;
        if (answered === questions.length) {
          result.textContent = 'Твой результат: ' + score + ' из ' + questions.length + (score === questions.length ? ' — отлично!' : '.');
        }
      });
      box.appendChild(b);
    });
    quiz.appendChild(box);
  });
  quiz.appendChild(result);
})();
