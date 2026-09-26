/* Cursor spotlight for the liquid-glass background + a simple global error toast. */
(function () {
  var root = document.documentElement;
  var raf = null;
  var x = 0;
  var y = 0;

  function apply() {
    root.style.setProperty('--mx', x + 'px');
    root.style.setProperty('--my', y + 'px');
    raf = null;
  }

  window.addEventListener('pointermove', function (e) {
    x = e.clientX;
    y = e.clientY;
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });
})();

/* Homepage service cards: folded on phones, always open otherwise.
   Without JS the `open` attribute in the HTML keeps every card expanded. */
(function () {
  var cards = document.querySelectorAll('.svc-card');
  if (!cards.length) return;
  var mq = window.matchMedia('(max-width: 639.98px)');
  var last = null;

  function sync() {
    var mobile = mq.matches;
    if (mobile === last) return; /* only act when crossing the breakpoint */
    last = mobile;
    for (var i = 0; i < cards.length; i++) {
      if (mobile) cards[i].removeAttribute('open');
      else cards[i].setAttribute('open', '');
    }
  }

  sync();
  if (mq.addEventListener) mq.addEventListener('change', sync);
  window.addEventListener('resize', sync);
})();

/* Error toast - deliberately picky so it never cries wolf:
   - ignores everything once the user is navigating away (cancelled loads
     fire bogus "error" events on every page change)
   - ignores errors coming from browser extensions or third-party scripts
   - only reacts when one of the site's own files (css/js/images) fails */
(function () {
  var shown = false;
  var leaving = false;
  var rearm = null;

  window.addEventListener('pagehide', function () { leaving = true; });
  window.addEventListener('beforeunload', function () {
    leaving = true;
    /* αν η πλοήγηση ακυρωθεί (π.χ. tel:/mailto:) η σελίδα μένει ζωντανή */
    clearTimeout(rearm);
    rearm = setTimeout(function () { leaving = false; }, 3000);
  });
  /* το pageshow πιάνει και την επιστροφή από το back/forward cache */
  window.addEventListener('pageshow', function () { leaving = false; });

  function toast() {
    if (shown || !document.body) return;
    shown = true;
    var gr = (document.documentElement.lang || 'el').indexOf('el') === 0;
    var el = document.createElement('div');
    el.className = 'error-toast';
    el.setAttribute('role', 'status');
    var span = document.createElement('span');
    span.textContent = gr
      ? 'Κάτι δεν φορτώθηκε σωστά. Δοκιμάστε να ανανεώσετε τη σελίδα.'
      : "Something didn't load properly. Try refreshing the page.";
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', gr ? 'Κλείσιμο' : 'Close');
    btn.textContent = '✕';
    btn.onclick = function () { el.remove(); };
    el.appendChild(span);
    el.appendChild(btn);
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 8000);
  }

  function isOwnResource(el) {
    if (!el || !el.tagName) return false;
    var url = el.src || el.href || '';
    if (!url) return false;
    if (url.indexOf('chrome-extension:') === 0 || url.indexOf('moz-extension:') === 0) return false;
    if (/^https?:/i.test(url)) {
      try {
        if (new URL(url).origin !== location.origin) return false;
      } catch (err) {
        return false;
      }
    }
    return /\.(css|js|png|jpe?g|svg|webp)(\?|$)/i.test(url);
  }

  window.addEventListener('error', function (e) {
    if (leaving || shown) return;
    var target = e.target;
    var isResource = target && target !== window && target.tagName;
    if (isResource) {
      if (!isOwnResource(target)) return;
      console.warn('[site] resource failed to load:', target.tagName, target.src || target.href);
    } else {
      var f = e.filename || '';
      if (!f || f.indexOf('extension://') !== -1) return;
      if (!/assets[\/\\]js[\/\\]/.test(f)) return; /* only our own scripts */
      console.warn('[site] script error:', e.message, f, e.lineno);
    }
    toast();
  }, true);

  /* The site's own code uses no promises, so any unhandled rejection is
     third-party noise: log it, never bother the visitor. */
  window.addEventListener('unhandledrejection', function (e) {
    console.warn('[site] unhandled rejection (ignored):', e.reason);
  });
})();
