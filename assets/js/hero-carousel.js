/* Hero 3D carousel: περιστροφή με σύρσιμο + αδράνεια + αργή αυτόματη
   περιστροφή όταν είναι αδρανές. Κλικ σε φωτογραφία ανοίγει overlay
   πλήρους μεγέθους. Χωρίς JS ο κύλινδρος φαίνεται στατικός.
   - το σύρσιμο τελειώνει αξιόπιστα όπου κι αν αφεθεί το ποντίκι
   - μόνο ένα δάχτυλο/δείκτης οδηγεί την περιστροφή κάθε φορά
   - η κίνηση μετριέται με χρόνο, όχι με καρέ (ίδια ταχύτητα σε 60/120Hz)
   - η αυτόματη περιστροφή σταματά σε hover/focus (WCAG 2.2.2) και
     όταν ο κύλινδρος είναι εκτός οθόνης, το loop κοιμάται όταν δεν κινείται
   - μέσα στο overlay: προηγούμενη/επόμενη φωτογραφία με τα κουμπιά, τα
     βέλη του πληκτρολογίου ή swipe, κυκλικά και στις 10 όψεις
   - το Πίσω του browser ή του κινητού κλείνει το overlay και μένει στη
     σελίδα, όπως στη γκαλερί (μία εγγραφή ιστορικού ανά άνοιγμα) */
(function () {
  'use strict';

  var stage = document.querySelector('.hero-carousel');
  var overlay = document.querySelector('.hc-overlay');
  if (!stage || !overlay) { return; }

  var ring = stage.querySelector('.hc-ring');
  var overlayImg = overlay.querySelector('img');
  var overlayClose = overlay.querySelector('.lb-close');
  var overlayPrev = overlay.querySelector('.lb-prev');
  var overlayNext = overlay.querySelector('.lb-next');
  var overlayPin = overlay.querySelector('.geo-pin');
  var overlayPinText = overlayPin ? overlayPin.querySelector('span') : null;
  var overlayLive = overlay.querySelector('[aria-live]');
  var faces = stage.querySelectorAll('.hc-face');
  var STEP = 360 / (faces.length || 10);  /* μοίρες ανά όψη */
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
  var keyboardUse = false;  /* η τελευταία ενέργεια ήταν πλήκτρο πλοήγησης */
  var hoverHold = null;     /* θέση δείκτη τη στιγμή που έκλεισε το overlay */
  var resumeHold = false;   /* σύντομη ανάσα μετά το κλείσιμο */
  var resumeTimer = null;
  var RESUME_MS = 1000;
  var visible = true;
  var rafId = null;
  var lastTick = 0;
  var moveRaf = null;

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
      (vel !== 0 || (AUTO !== 0 && !hovered && !focused && !resumeHold));
  }

  function tick(now) {
    rafId = null;
    var dt = lastTick ? Math.min(48, now - lastTick) : FRAME;
    lastTick = now;

    if (vel) {
      rot += vel * (dt / FRAME);
      vel *= Math.pow(0.95, dt / FRAME);
      if (Math.abs(vel) < 0.02) { vel = 0; }
    } else if (AUTO && !hovered && !focused && !resumeHold) {
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
    /* μία εγγραφή στυλ ανά καρέ, όσο πυκνά κι αν έρχονται τα pointermove */
    if (moveRaf === null) {
      moveRaf = window.requestAnimationFrame(function () {
        moveRaf = null;
        render();
      });
    }
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
     εστιάζει με πληκτρολόγιο στον κύλινδρο (WCAG 2.2.2: Pause, Stop, Hide).
     Focus από ποντίκι/αφή (ή η επιστροφή του focus στην όψη όταν κλείνει
     το overlay) δεν παγώνει την κίνηση. Το Esc δεν μετρά ως πλοήγηση:
     ο Chromium δείχνει τότε :focus-visible, γι' αυτό η απόφαση είναι δική μας. */
  var NAV_KEYS = ['Tab', 'Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
  document.addEventListener('keydown', function (e) {
    if (NAV_KEYS.indexOf(e.key) !== -1) { keyboardUse = true; }
  }, true);
  document.addEventListener('pointerdown', function () { keyboardUse = false; }, true);

  stage.addEventListener('pointerenter', function (e) {
    if (e.pointerType === 'mouse' && !hoverHold) { hovered = true; }
  });
  /* μετά το κλείσιμο, παύση μόνο αν ο δείκτης κινηθεί πραγματικά πάνω
     στον κύλινδρο (ο Firefox δεν στέλνει pointerleave όσο το overlay
     τον καλύπτει, ο Chromium στέλνει pointerenter χωρίς κίνηση) */
  stage.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || hovered) { return; }
    if (hoverHold && Math.abs(e.clientX - hoverHold.x) < 3 && Math.abs(e.clientY - hoverHold.y) < 3) { return; }
    hoverHold = null;
    hovered = true;
  });
  stage.addEventListener('pointerleave', function (e) {
    if (e.pointerType === 'mouse') { hovered = false; hoverHold = null; schedule(); }
  });
  var pointerX = -1;
  var pointerY = -1;
  document.addEventListener('pointermove', function (e) {
    pointerX = e.clientX;
    pointerY = e.clientY;
  }, { capture: true, passive: true });

  stage.addEventListener('focusin', function () { focused = keyboardUse; });
  stage.addEventListener('focusout', function () { focused = false; schedule(); });

  var openedFace = null;  /* η όψη που άνοιξε το overlay */

  /* η ετικέτα τοποθεσίας εμφανίζεται μόλις φορτώσει η φωτογραφία, όχι
     μόνη της πάνω στο σκούρο φόντο */
  function showPinWhenLoaded() {
    if (!overlayPin || !overlayPinText.textContent) { return; }
    if (overlayImg.complete && overlayImg.naturalWidth) {
      overlayPin.hidden = false;
    }
  }
  overlayImg.addEventListener('load', function () {
    overlay.classList.remove('is-loading');
    showPinWhenLoaded();
  });
  overlayImg.addEventListener('error', function () {
    overlay.classList.remove('is-loading');
  });

  /* οι δύο γειτονικές φωτογραφίες φορτώνουν από πριν, ώστε το επόμενο
     βήμα να είναι άμεσο και σε αργή σύνδεση */
  var preloaded = [];
  function preloadAround(face) {
    var n = faces.length;
    var i = Array.prototype.indexOf.call(faces, face);
    preloaded = [faces[(i + 1) % n], faces[(i - 1 + n) % n]].map(function (f) {
      var im = new Image();
      im.src = f.getAttribute('data-full');
      return im;
    });
  }

  /* βάζει στο overlay τη φωτογραφία μιας όψης (άνοιγμα ή αλλαγή).
     announce: μόνο στα βήματα, ο αναγνώστης οθόνης ακούει τη νέα φωτογραφία */
  function showFace(face, announce) {
    var img = face.querySelector('img');
    if (overlayPin) {
      overlayPin.hidden = true;  /* ποτέ η ετικέτα της προηγούμενης */
      overlayPinText.textContent = face.getAttribute('data-place') || '';
    }
    overlayImg.src = face.getAttribute('data-full');
    overlayImg.alt = img ? img.alt : '';
    /* όσο φορτώνει η νέα, η παλιά φαίνεται αχνή (όχι σαν να μην άλλαξε) */
    overlay.classList.toggle('is-loading', !(overlayImg.complete && overlayImg.naturalWidth));
    showPinWhenLoaded();  /* ήδη στην cache: αμέσως */
    if (announce && overlayLive) { overlayLive.textContent = overlayImg.alt; }
    lastFace = face;
    preloadAround(face);
  }

  /* dir 1 = επόμενη, -1 = προηγούμενη, κυκλικά */
  function stepOverlay(dir) {
    if (!open || !lastFace) { return; }
    var i = Array.prototype.indexOf.call(faces, lastFace);
    var n = faces.length;
    showFace(faces[(i + dir + n) % n], true);
    /* η εγγραφή δείχνει πάντα τη φωτογραφία που βλέπει (χωρίς νέα εγγραφή),
       ώστε μια ανανέωση να ανοίγει αυτήν και όχι την πρώτη */
    if (historyOn && photoState() !== -1) {
      try {
        window.history.replaceState({ hcPhoto: Array.prototype.indexOf.call(faces, lastFace) }, '');
      } catch (err) { /* χωρίς ιστορικό: τίποτα */ }
    }
  }

  /* Πίσω (κουμπί του browser ή χειρονομία του κινητού) κλείνει τη
     φωτογραφία και μένει στη σελίδα, όπως στη γκαλερί. Κάθε άνοιγμα
     προσθέτει ΜΙΑ εγγραφή στο ιστορικό (ίδιο URL, μόνο state), τα βήματα
     μέσα στο overlay καμία. Το κλείσιμο με ✕, Esc ή κλικ στο φόντο βγάζει
     την εγγραφή με history.back(), ώστε το επόμενο Πίσω να φεύγει κανονικά
     από τη σελίδα. Αν ο browser αρνηθεί το pushState, μένει η παλιά
     συμπεριφορά χωρίς ιστορικό. */
  var historyOn = false;    /* η τρέχουσα εγγραφή του ιστορικού είναι της φωτογραφίας */
  var backPending = false;  /* ζητήθηκε history.back() και περιμένουμε το popstate του */

  function photoState() {
    var s = window.history.state;
    return s && typeof s.hcPhoto === 'number' ? s.hcPhoto : -1;
  }

  function pushPhoto() {
    /* backPending: η εγγραφή μπαίνει μόλις έρθει το popstate του κλεισίματος */
    if (historyOn || backPending) { return; }
    try {
      window.history.pushState({ hcPhoto: Array.prototype.indexOf.call(faces, lastFace) }, '');
      historyOn = true;
    } catch (err) { /* π.χ. file:// σε κάποιους browsers: χωρίς ιστορικό */ }
  }

  function dropPhoto() {
    if (!historyOn) { return; }
    historyOn = false;
    if (photoState() === -1) { return; }  /* ποτέ back() έξω από τη δική μας εγγραφή */
    backPending = true;
    try { window.history.back(); } catch (err) { backPending = false; }
  }

  function openOverlay(face, fromHistory) {
    if (overlayLive) { overlayLive.textContent = ''; }  /* στο άνοιγμα μιλά ήδη ο διάλογος */
    showFace(face);
    /* από το ιστορικό ο κύλινδρος μπορεί να έχει μηδενιστεί (ανανέωση):
       στο κλείσιμο ευθυγραμμίζεται πάντα με τη φωτογραφία που είδε */
    openedFace = fromHistory ? null : face;
    overlay.hidden = false;
    open = true;
    document.documentElement.classList.add('overlay-open');
    pageChrome.forEach(function (el) { setInert(el, true); });
    stopLoop();
    clearTimeout(resumeTimer);
    hovered = false;  /* το overlay καλύπτει τον κύλινδρο */
    if (overlayClose) { overlayClose.focus(); }
    if (!fromHistory) { pushPhoto(); }
  }

  function closeOverlay(fromHistory) {
    if (!open) { return; }
    overlay.hidden = true;
    open = false;
    overlayImg.removeAttribute('src');  /* να μη φανεί η παλιά φωτογραφία */
    overlayImg.alt = '';
    overlay.classList.remove('is-loading');
    if (overlayLive) { overlayLive.textContent = ''; }
    preloaded = [];
    if (overlayPin) {
      overlayPin.hidden = true;
      overlayPinText.textContent = '';
    }
    /* αν ο επισκέπτης άλλαξε φωτογραφία, ο κύλινδρος σταματά με αυτήν
       μπροστά (η όψη i είναι μπροστά όταν rot = -i * STEP). Γίνεται
       όσο το overlay καλύπτει ακόμα τη σελίδα, άρα δεν φαίνεται πήδημα. */
    if (lastFace && lastFace !== openedFace) {
      var target = -Array.prototype.indexOf.call(faces, lastFace) * STEP;
      rot = target + Math.round((rot - target) / 360) * 360;
      vel = 0;
      render();
    }
    openedFace = null;
    document.documentElement.classList.remove('overlay-open');
    pageChrome.forEach(function (el) { setInert(el, false); });
    hovered = false;
    hoverHold = { x: pointerX, y: pointerY };
    if (lastFace) { lastFace.focus(); }  /* focusin: παύση μόνο για πληκτρολόγιο */
    /* η περιστροφή ξαναρχίζει μόνη της σε 1s, με την όψη που είδε μπροστά */
    resumeHold = true;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(function () { resumeHold = false; schedule(); }, RESUME_MS);
    schedule();
    /* ✕, Esc ή φόντο: βγαίνει και η εγγραφή (με το Πίσω έχει ήδη βγει) */
    if (!fromHistory) { dropPhoto(); }
  }

  /* η σελίδα ακολουθεί το ιστορικό: Πίσω κλείνει, Μπροστά ξανανοίγει (όπως
     το #hash της γκαλερί). Τρέχει και στη φόρτωση (ανανέωση πάνω σε εγγραφή
     φωτογραφίας) και στην επιστροφή από το back/forward cache, ώστε overlay
     και ιστορικό να συμφωνούν πάντα: ποτέ ανοιχτό χωρίς εγγραφή, ποτέ
     εγγραφή που χρειάζεται ένα νεκρό Πίσω. */
  function syncHistory() {
    var i = photoState();
    historyOn = i !== -1;
    if (!historyOn) {
      closeOverlay(true);
    } else if (!open) {
      openOverlay(lastFace || faces[i] || faces[0], true);
    }
  }

  window.addEventListener('popstate', function () {
    if (backPending) {
      /* το popstate του δικού μας history.back(): αν στο μεταξύ άνοιξε
         ξανά φωτογραφία, τώρα παίρνει την εγγραφή της */
      backPending = false;
      if (open) { pushPhoto(); }
      return;
    }
    syncHistory();
  });

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) { backPending = false; syncHistory(); }
  });

  Array.prototype.forEach.call(faces, function (face) {
    face.addEventListener('click', function (e) {
      var wasDrag = e.detail !== 0 && moved > 8;  /* detail 0 = πληκτρολόγιο */
      moved = 0;
      if (wasDrag) { e.preventDefault(); return; }
      openOverlay(face);
    });
  });

  /* το ✕ κλείνει πάντα, και αμέσως μετά από swipe (δεν περνά από τον
     φύλακα του swipe στο κλικ του φόντου) */
  if (overlayClose) {
    overlayClose.addEventListener('click', function (e) { e.stopPropagation(); closeOverlay(); });
  }

  /* τα κουμπιά προηγούμενης/επόμενης δεν κλείνουν το overlay */
  if (overlayPrev) {
    overlayPrev.addEventListener('click', function (e) { e.stopPropagation(); stepOverlay(-1); });
  }
  if (overlayNext) {
    overlayNext.addEventListener('click', function (e) { e.stopPropagation(); stepOverlay(1); });
  }

  /* swipe αριστερά/δεξιά στην οθόνη αφής */
  var swipeX = null;
  var swipeY = 0;
  var swiped = false;
  var swipeTimer = null;
  overlay.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { swipeX = null; return; }
    swipeX = e.touches[0].clientX;
    swipeY = e.touches[0].clientY;
  }, { passive: true });
  overlay.addEventListener('touchend', function (e) {
    if (swipeX === null || !e.changedTouches.length) { return; }
    var dx = e.changedTouches[0].clientX - swipeX;
    var dy = e.changedTouches[0].clientY - swipeY;
    swipeX = null;
    /* με ζουμ (pinch) το σύρσιμο μετακινεί τη φωτογραφία, δεν την αλλάζει */
    if (window.visualViewport && window.visualViewport.scale > 1.01) { return; }
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped = true;  /* το click που ίσως ακολουθεί δεν κλείνει το overlay */
      clearTimeout(swipeTimer);
      swipeTimer = setTimeout(function () { swiped = false; }, 400);
      stepOverlay(dx < 0 ? 1 : -1);
    }
  }, { passive: true });

  /* κλείνει με ✕, κλικ στο σκούρο φόντο ή Esc. Όχι με κλικ πάνω στη
     φωτογραφία: στο κινητό τα βέλη κάθονται πάνω της και ένα άστοχο
     άγγιγμα δεν πρέπει να την κλείνει (όπως και στη γκαλερί) */
  overlay.addEventListener('click', function (e) {
    if (swiped) { return; }
    if (e.target.closest && e.target.closest('.hc-photo')) { return; }
    closeOverlay();
  });

  document.addEventListener('keydown', function (e) {
    if (!open) { return; }
    if (e.key === 'Escape') {
      closeOverlay();
    } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
               !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      stepOverlay(e.key === 'ArrowRight' ? 1 : -1);
    } else if (e.key === 'Tab') {
      /* το focus κυκλοφορεί μόνο ανάμεσα στα κουμπιά του overlay */
      e.preventDefault();
      var ctrls = [overlayClose, overlayPrev, overlayNext].filter(Boolean);
      if (!ctrls.length) { return; }
      var at = ctrls.indexOf(document.activeElement);
      var next = at === -1 ? 0 : (at + (e.shiftKey ? -1 : 1) + ctrls.length) % ctrls.length;
      ctrls[next].focus();
    }
  });

  render();
  syncHistory();
  schedule();
})();
