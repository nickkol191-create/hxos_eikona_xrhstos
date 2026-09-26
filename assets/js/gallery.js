/* Gallery: μικρές βελτιώσεις πάνω στο :target (δουλεύει και χωρίς JS)
   - κλείδωμα scroll της σελίδας όσο είναι ανοιχτό άλμπουμ ή lightbox
   - το άλμπουμ μένει ορατό πίσω από το lightbox, ώστε να κρατάει το scroll του
   - inert στο φόντο όσο είναι ανοιχτό overlay (δεν φεύγει το Tab από κάτω)
   - Escape: κλείσιμο / επιστροφή στο άλμπουμ
   - βέλη πληκτρολογίου: προηγούμενη / επόμενη φωτογραφία στο lightbox
   - επιστροφή του focus στον φάκελο όταν κλείσει το άλμπουμ */
(function () {
  'use strict';

  var docEl = document.documentElement;
  var chrome = [
    document.querySelector('.site-header'),
    document.querySelector('.page-hero'),
    document.getElementById('albums'),
    document.querySelector('.site-footer')
  ].filter(Boolean);
  var lastOverlay = null;

  function overlayFromHash() {
    var hash = window.location.hash;
    if (!hash || hash.length < 2) { return null; }
    var el = document.getElementById(hash.slice(1));
    if (el && (el.classList.contains('album') || el.classList.contains('lightbox'))) {
      return el;
    }
    return null;
  }

  /* το άλμπουμ στο οποίο ανήκει ένα overlay (μέσω του href του κουμπιού ✕) */
  function albumOf(el) {
    if (!el) { return null; }
    if (el.classList.contains('album')) { return el; }
    var close = el.querySelector('.lb-close');
    var href = close ? close.getAttribute('href') || '' : '';
    return href.charAt(0) === '#' ? document.getElementById(href.slice(1)) : null;
  }

  function setInert(el, on) {
    if (on) {
      el.setAttribute('inert', '');
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.removeAttribute('inert');
      el.removeAttribute('aria-hidden');
    }
  }

  function sync() {
    var el = overlayFromHash();

    docEl.classList.toggle('overlay-open', !!el);
    chrome.forEach(function (c) { setInert(c, !!el); });

    Array.prototype.forEach.call(document.querySelectorAll('.album.album-behind'), function (a) {
      a.classList.remove('album-behind');
      setInert(a, false);
    });
    if (el && el.classList.contains('lightbox')) {
      var behind = albumOf(el);
      if (behind) {
        behind.classList.add('album-behind');
        setInert(behind, true);
      }
    }

    if (el && typeof el.focus === 'function') {
      el.focus({ preventScroll: true });
    } else if (!el && lastOverlay) {
      /* το overlay έκλεισε: focus πίσω στον φάκελο που το είχε ανοίξει */
      var album = albumOf(lastOverlay);
      var folder = album ? document.querySelector('.folder[href="#' + album.id + '"]') : null;
      var target = folder || document.getElementById('albums');
      if (target && typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
    }
    lastOverlay = el;
  }

  function go(el, selector) {
    var link = el.querySelector(selector);
    if (link) { window.location.hash = link.getAttribute('href'); }
  }

  window.addEventListener('hashchange', sync);
  sync();

  document.addEventListener('keydown', function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) { return; }  /* π.χ. Alt+βέλος = Πίσω */
    var el = overlayFromHash();
    if (!el) { return; }

    if (e.key === 'Escape') {
      go(el, '.album-close, .lb-close');
    } else if (el.classList.contains('lightbox') && e.key === 'ArrowRight') {
      go(el, '.lb-next');
    } else if (el.classList.contains('lightbox') && e.key === 'ArrowLeft') {
      go(el, '.lb-prev');
    }
  });
})();
