/* Βίντεο έργων (σελίδα υπηρεσιών): σιωπηλό βίντεο σε επανάληψη που
   παίζει μόνο όσο φαίνεται στην οθόνη, με δικό του κουμπί παύσης.
   - χωρίς JS μένουν τα κανονικά controls του browser
   - prefers-reduced-motion ή εξοικονόμηση δεδομένων: δεν ξεκινά μόνο του,
     ο επισκέπτης πατά αναπαραγωγή
   - αν ο επισκέπτης το σταματήσει, δεν ξαναρχίζει μόνο του
   - τα βίντεο δεν έχουν ήχο (αφαιρέθηκε από τα αρχεία) */
(function () {
  'use strict';

  var videos = document.querySelectorAll('video.vid-auto');
  if (!videos.length) { return; }

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var autoOk = !reduced && !saveData && 'IntersectionObserver' in window;

  Array.prototype.forEach.call(videos, function (video) {
    var btn = video.parentNode.querySelector('.vid-toggle');
    if (!btn) { return; }

    var userPaused = false;
    var inView = false;

    video.removeAttribute('controls');
    video.muted = true;
    btn.hidden = false;

    function sync() {
      var paused = video.paused;
      btn.classList.toggle('is-paused', paused);
      btn.setAttribute('aria-label', btn.getAttribute(paused ? 'data-label-play' : 'data-label-pause'));
    }

    function play() {
      var p = video.play();
      /* το play() επιστρέφει promise: αν ο browser το αρνηθεί, απλώς
         μένει σε παύση με το κουμπί αναπαραγωγής ορατό */
      if (p && typeof p.catch === 'function') { p.catch(sync); }
      watch();
    }

    /* iPhone: το πρώτο play() μπορεί να κολλήσει σε μαύρη οθόνη ενώ το
       βίντεο λέει ότι παίζει (ο επισκέπτης έπρεπε να πατήσει παύση και ξανά
       αναπαραγωγή). Αν σε 2,5 δευτ. δεν έχει δείξει καρέ, κάνουμε εμείς
       αυτό το παύση/αναπαραγωγή, μία φορά. */
    var watchTimer = null;
    function watch() {
      clearTimeout(watchTimer);
      watchTimer = setTimeout(function () {
        if (!video.paused && !userPaused && video.readyState < 3) {
          video.pause();
          var p = video.play();
          if (p && typeof p.catch === 'function') { p.catch(sync); }
        }
      }, 2500);
    }
    video.addEventListener('playing', function () { clearTimeout(watchTimer); });

    /* οι πληροφορίες του βίντεο φορτώνουν λίγο πριν φανεί, όπως στη
       γκαλερί, ώστε το πρώτο play() να βρίσκει έτοιμο αρχείο */
    if (video.preload === 'none' && !saveData) {
      if ('IntersectionObserver' in window) {
        var warmObs = new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting) {
            video.preload = 'metadata';
            warmObs.disconnect();
          }
        }, { rootMargin: '600px 0px' });
        warmObs.observe(video);
      } else {
        video.preload = 'metadata';
      }
    }

    function toggle() {
      if (video.paused) {
        userPaused = false;
        play();
      } else {
        userPaused = true;
        video.pause();
      }
    }

    btn.addEventListener('click', toggle);
    video.addEventListener('click', toggle);
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);

    if (autoOk) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        if (inView && !userPaused) {
          play();
        } else if (!inView && !video.paused) {
          video.pause();
        }
      }, { threshold: 0.5 }).observe(video);
    }

    /* κρυφή καρτέλα: παύση, επιστροφή: συνέχεια αν ήταν στην οθόνη */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (!video.paused) { video.pause(); }
      } else if (autoOk && inView && !userPaused) {
        play();
      }
    });

    sync();
  });
})();

/* Γκαλερί, άλμπουμ «Βίντεο έργων»: στο iPhone τα κανονικά controls του
   browser μέσα στο άλμπουμ (overlay με δικό του scroll) δεν δέχονταν το
   πάτημα, ούτε η αναπαραγωγή ούτε η πλήρης οθόνη. Δικά μας κουμπιά, όπως
   στο βίντεο των υπηρεσιών: αναπαραγωγή / παύση και πλήρης οθόνη.
   - χωρίς JS μένουν τα κανονικά controls
   - τα βίντεο φορτώνουν πληροφορίες μόνο όταν ανοίξει το άλμπουμ */
(function () {
  'use strict';

  var videos = document.querySelectorAll('.video-grid video');
  if (!videos.length) { return; }

  var gr = (document.documentElement.lang || 'el').indexOf('el') === 0;
  var L = gr
    ? { play: 'Αναπαραγωγή βίντεο', pause: 'Παύση βίντεο', full: 'Πλήρης οθόνη' }
    : { play: 'Play video', pause: 'Pause video', full: 'Full screen' };

  var SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" ';
  var ICON_PAUSE = SVG + 'class="i-pause" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>';
  var ICON_PLAY = SVG + 'class="i-play" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg>';
  var ICON_FULL = SVG + 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/></svg>';

  function makeButton(cls, label, icons) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.setAttribute('aria-label', label);
    b.innerHTML = icons;
    return b;
  }

  /* πληροφορίες βίντεο (διάρκεια, διαστάσεις) μόνο όταν ανοίξει το άλμπουμ:
     η πλήρης οθόνη στο iPhone τις χρειάζεται ήδη φορτωμένες */
  function warm() {
    Array.prototype.forEach.call(videos, function (v) {
      var album = v.closest ? v.closest('.album') : null;
      if (album && window.location.hash === '#' + album.id && v.preload === 'none') {
        v.preload = 'metadata';
      }
    });
  }
  window.addEventListener('hashchange', warm);
  warm();

  Array.prototype.forEach.call(videos, function (video) {
    var frame = video.parentNode;
    var btn = makeButton('vid-toggle is-paused', L.play, ICON_PAUSE + ICON_PLAY);
    var full = makeButton('vid-toggle vid-full', L.full, ICON_FULL);

    video.removeAttribute('controls');
    frame.appendChild(btn);
    frame.appendChild(full);

    function sync() {
      var paused = video.paused;
      btn.classList.toggle('is-paused', paused);
      btn.setAttribute('aria-label', paused ? L.play : L.pause);
    }

    function play() {
      var p = video.play();
      if (p && typeof p.catch === 'function') { p.catch(sync); }
    }

    function toggle() {
      if (video.paused) { play(); } else { video.pause(); }
    }

    function fullscreen() {
      /* iPhone: μόνο webkitEnterFullscreen (ανοίγει τον player του κινητού).
         Αν οι πληροφορίες δεν έχουν φορτώσει ακόμη, παίζει στη θέση του. */
      play();
      try {
        if (video.requestFullscreen) {
          var p = video.requestFullscreen();
          if (p && typeof p.catch === 'function') { p.catch(function () {}); }
        } else if (video.webkitRequestFullscreen) {
          video.webkitRequestFullscreen();
        } else if (video.webkitEnterFullscreen) {
          video.webkitEnterFullscreen();
        }
      } catch (err) { /* μένει να παίζει στη σελίδα */ }
    }

    btn.addEventListener('click', toggle);
    full.addEventListener('click', fullscreen);
    /* με τα controls ανοιχτά (πλήρης οθόνη) το πάτημα το χειρίζεται ο browser */
    video.addEventListener('click', function () { if (!video.controls) { toggle(); } });
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    video.addEventListener('ended', sync);
    sync();
  });

  /* στην πλήρη οθόνη του υπολογιστή χρειάζονται τα κανονικά controls */
  function fsChange() {
    var fs = document.fullscreenElement || document.webkitFullscreenElement;
    Array.prototype.forEach.call(videos, function (v) { v.controls = (v === fs); });
  }
  document.addEventListener('fullscreenchange', fsChange);
  document.addEventListener('webkitfullscreenchange', fsChange);
})();
