/* Hero 3D carousel: περιστροφή με σύρσιμο + αδράνεια + αργή αυτόματη
   περιστροφή όταν είναι αδρανές. Κλικ σε φωτογραφία ανοίγει overlay
   πλήρους μεγέθους. Χωρίς JS ο κύλινδρος φαίνεται στατικός.
   - το σύρσιμο τελειώνει αξιόπιστα όπου κι αν αφεθεί το ποντίκι
   - μόνο ένα δάχτυλο/δείκτης οδηγεί την περιστροφή κάθε φορά
   - η κίνηση μετριέται με χρόνο, όχι με καρέ (ίδια ταχύτητα σε 60/120Hz)
   - η αυτόματη περιστροφή σταματά σε hover/focus (WCAG 2.2.2) και
     όταν ο κύλινδρος είναι εκτός οθόνης, το loop κοιμάται όταν δεν κινείται */
(function () {
  'use strict';

  var stage = document.querySelector('.hero-carousel');
  var overlay = document.querySelector('.hc-overlay');
  if (!stage || !overlay) { return; }

  var ring = stage.querySelector('.hc-ring');
  var overlayImg = overlay.querySelector('img');
  var overlayClose = overlay.querySelector('.lb-close');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var AUTO = reduced ? 0 : 0.06;   /* μοίρες ανά 16.7ms όταν είναι αδρανές */
  var DRAG = 0.16;                 /* μοίρες ανά pixel συρσίματος */
  var VEL_MAX = 6;                 /* όριο αδράνειας, μοίρες ανά 16.7ms */
  var FRAME = 16.7;

  var rot = 0;
  var shownRot = null;
  var vel = 0;
  var dragging = false;
  var captured = false;
  var activePointer = null;
  var moved = 0;
  var lastX = 0;
  var lastT = 0;
  var open = false;
  var lastFace = null;
  var hovered = false;
  var focused = false;
  var visible = true;
  var rafId = null;
  var lastTick = 0;

  /* ό,τι μένει πίσω από το overlay γίνεται inert όσο αυτό είναι ανοιχτό */
  var pageChrome = [];
  ['.site-header', 'main > section', '.site-footer'].forEach(function (sel) {
    Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) {
      pageChrome.push(el);
    });
  });

  function setInert(el, on) {
    if (on) {
      el.setAttribute('inert', '');
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.removeAttribute('inert');
      el.removeAttribute('aria-hidden');
    }
  }

  function render() {
    if (rot === shownRot) { return; }
    shownRot = rot;
    ring.style.setProperty('--hc-rot', rot + 'deg');
  }

  function needsLoop() {
    return !open && !dragging &&
      (vel !== 0 || (AUTO !== 0 && !hovered && !focused));
  }

  function tick(now) {
    rafId = null;
    var dt = lastTick ? Math.min(48, now - lastTick) : FRAME;
    lastTick = now;

    if (vel) {
      rot += vel * (dt / FRAME);
      vel *= Math.pow(0.95, dt / FRAME);
      if (Math.abs(vel) < 0.02) { vel = 0; }
    } else if (AUTO && !hovered && !focused) {
      rot += AUTO * (dt / FRAME);
    }
    render();

    if (needsLoop()) {
      rafId = window.requestAnimationFrame(tick);
    } else {
      lastTick = 0;
    }
  }

  function schedule() {
    if (visible && rafId === null && needsLoop()) {
      lastTick = 0;
      rafId = window.requestAnimationFrame(tick);
    }
  }

  function stopLoop() {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
      lastTick = 0;
    }
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (!visible) { stopLoop(); } else { schedule(); }
    }).observe(stage);
  }

  stage.addEventListener('pointerdown', function (e) {
    if (open || dragging) { return; }
    if (e.button !== 0 || !e.isPrimary) { return; }
    dragging = true;
    captured = false;
    activePointer = e.pointerId;
    moved = 0;
    vel = 0;
    lastX = e.clientX;
    lastT = e.timeStamp;
    stopLoop();
  });

  stage.addEventListener('pointermove', function (e) {
    if (!dragging || e.pointerId !== activePointer) { return; }
    if (e.buttons === 0) { endDrag(); return; }  /* αφέθηκε εκτός stage */
    var dx = e.clientX - lastX;
    var dt = e.timeStamp - lastT;
    if (dt < 8) { dt = 8; }  /* όριο και για πολύ πυκνά pointermove */
    moved += Math.abs(dx);
    /* το capture μπαίνει μόνο όταν είναι πραγματικό σύρσιμο, αλλιώς
       χαλάει το click στις φωτογραφίες (το click στοχεύει το stage) */
    if (!captured && moved > 8) {
      try { stage.setPointerCapture(e.pointerId); captured = true; } catch (err) { /* άνευ σημασίας */ }
    }
    rot += dx * DRAG;
    vel = dx * DRAG * (FRAME / dt);
    if (vel > VEL_MAX) { vel = VEL_MAX; } else if (vel < -VEL_MAX) { vel = -VEL_MAX; }
    lastX = e.clientX;
    lastT = e.timeStamp;
    render();
  });

  function endDrag(e) {
    if (!dragging) { return; }
    if (e && e.pointerId !== undefined && e.pointerId !== activePointer) { return; }
    dragging = false;
    captured = false;
    activePointer = null;
    schedule();
  }
  /* στο window, όχι στο stage: το ποντίκι μπορεί να αφεθεί οπουδήποτε */
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  /* η αυτόματη περιστροφή κάνει παύση όσο ο επισκέπτης δείχνει ή
     εστιάζει στον κύλινδρο (WCAG 2.2.2: Pause, Stop, Hide) */
  stage.addEventListener('pointerenter', function (e) {
    if (e.pointerType === 'mouse') { hovered = true; }
  });
  stage.addEventListener('pointerleave', function (e) {
    if (e.pointerType === 'mouse') { hovered = false; schedule(); }
  });
  stage.addEventListener('focusin', function () { focused = true; });
  stage.addEventListener('focusout', function () { focused = false; schedule(); });

  function openOverlay(face) {
    var img = face.querySelector('img');
    overlayImg.src = face.getAttribute('data-full');
    overlayImg.alt = img ? img.alt : '';
    overlay.hidden = false;
    open = true;
    lastFace = face;
    document.documentElement.classList.add('overlay-open');
    pageChrome.forEach(function (el) { setInert(el, true); });
    stopLoop();
    if (overlayClose) { overlayClose.focus(); }
  }

  function closeOverlay() {
    if (!open) { return; }
    overlay.hidden = true;
    open = false;
    overlayImg.removeAttribute('src');  /* να μη φανεί η παλιά φωτογραφία */
    overlayImg.alt = '';
    document.documentElement.classList.remove('overlay-open');
    pageChrome.forEach(function (el) { setInert(el, false); });
    if (lastFace) { lastFace.focus(); }
    schedule();
  }

  Array.prototype.forEach.call(stage.querySelectorAll('.hc-face'), function (face) {
    face.addEventListener('click', function (e) {
      var wasDrag = e.detail !== 0 && moved > 8;  /* detail 0 = πληκτρολόγιο */
      moved = 0;
      if (wasDrag) { e.preventDefault(); return; }
      openOverlay(face);
    });
  });

  overlay.addEventListener('click', closeOverlay);

  document.addEventListener('keydown', function (e) {
    if (!open) { return; }
    if (e.key === 'Escape') {
      closeOverlay();
    } else if (e.key === 'Tab') {
      /* μοναδικό εστιάσιμο στοιχείο του overlay είναι το ✕ */
      e.preventDefault();
      if (overlayClose) { overlayClose.focus(); }
    }
  });

  render();
  schedule();
})();
