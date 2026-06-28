/* ===== Carusel auto-play pentru Pizza Poco Loco ===== */
(function () {
  'use strict';

  var track  = document.getElementById('carousel-track');
  var slides = track ? Array.prototype.slice.call(track.children) : [];
  var prevBtn = document.getElementById('prev');
  var nextBtn = document.getElementById('next');
  var dotsBox = document.getElementById('dots');
  var carousel = document.getElementById('carousel');

  if (!track || slides.length === 0) return;

  var index = 0;
  var INTERVAL = 4500;   // ms între slide-uri
  var timer = null;

  /* --- construiește indicatorii --- */
  slides.forEach(function (_, i) {
    var dot = document.createElement('button');
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', 'Mergi la imaginea ' + (i + 1));
    dot.addEventListener('click', function () { goTo(i); resetTimer(); });
    dotsBox.appendChild(dot);
  });
  var dots = Array.prototype.slice.call(dotsBox.children);

  /* --- afișează slide-ul curent --- */
  function update() {
    track.style.transform = 'translateX(' + (-index * 100) + '%)';
    dots.forEach(function (d, i) {
      d.classList.toggle('is-active', i === index);
    });
  }

  function goTo(i) {
    index = (i + slides.length) % slides.length;
    update();
  }
  function next() { goTo(index + 1); }
  function prev() { goTo(index - 1); }

  /* --- auto-play --- */
  function startTimer() { timer = setInterval(next, INTERVAL); }
  function stopTimer()  { clearInterval(timer); }
  function resetTimer() { stopTimer(); startTimer(); }

  /* --- evenimente --- */
  if (nextBtn) nextBtn.addEventListener('click', function () { next(); resetTimer(); });
  if (prevBtn) prevBtn.addEventListener('click', function () { prev(); resetTimer(); });

  // pauză la hover
  carousel.addEventListener('mouseenter', stopTimer);
  carousel.addEventListener('mouseleave', startTimer);

  // pauză când fila nu e vizibilă
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stopTimer(); } else { startTimer(); }
  });

  // navigare cu tastatura
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { next(); resetTimer(); }
    if (e.key === 'ArrowLeft')  { prev(); resetTimer(); }
  });

  // suport swipe pe mobil
  var startX = 0;
  carousel.addEventListener('touchstart', function (e) {
    startX = e.touches[0].clientX; stopTimer();
  }, { passive: true });
  carousel.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); }
    startTimer();
  }, { passive: true });

  /* --- pornire --- */
  update();
  startTimer();

  /* an curent în footer */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
