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
