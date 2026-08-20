// scripts/landing.js: behavior for free-consultation.html
//
// Everything here is progressive enhancement. With this file blocked or
// broken the page still renders in full and the form still submits as a
// normal POST to /api/lead, because nothing below is required to read the
// page or to convert.
//
// Loaded with `defer`; the site's CSP allows no inline script.
(function () {
  'use strict';

  // Vercel Web Analytics queue stub. Must exist before /_vercel/insights
  // runs; this file is loaded with `defer` ahead of the insights script,
  // the same arrangement scripts/site.js uses.
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };

  // Funnel events. These are what make a change in conversion rate
  // measurable rather than asserted.
  function track(name, data) {
    try { window.va('event', { name: name, data: data || {} }); } catch (e) { /* never break the form */ }
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onReady(function () {
    var form = document.getElementById('lead-form');
    var msg = document.getElementById('lead-msg');
    var submit = document.getElementById('lead-submit');
    var segmentField = document.getElementById('lead-segment');

    // ── Reveal on scroll ──────────────────────────────────────────────
    // The hiding rule lives behind .js-lp, which is only added here. If
    // this script never runs, nothing is ever hidden.
    var reveals = document.querySelectorAll('.lp-reveal');
    if (reveals.length && 'IntersectionObserver' in window) {
      document.body.classList.add('js-lp');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        });
      }, { threshold: 0.01, rootMargin: '0px 0px -60px 0px' });
      reveals.forEach(function (el) { io.observe(el); });

      // Failsafe. A fast scroll can coalesce past an element before its
      // callback runs, and on a page whose only job is conversion no copy
      // may ever be left permanently invisible. After four seconds
      // everything is shown regardless of what the observer saw.
      window.setTimeout(function () {
        reveals.forEach(function (el) {
          el.classList.add('is-visible');
          io.unobserve(el);
        });
      }, 4000);
    }

    // ── Segment cards feed the form ───────────────────────────────────
    // Choosing "Start here" pre-selects the matching option and moves the
    // visitor to the form with that context already filled in.
    var FORM_TITLES = {
      personal: 'Book a free consultation about the change in your life',
      organization: 'Book a free consultation about the change in your organization',
      training: 'Book a free consultation about training for your group',
    };

    document.querySelectorAll('.lp-segment-cta').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var value = btn.getAttribute('data-segment');
        if (segmentField && value) segmentField.value = value;
        var title = document.getElementById('form-title');
        if (title && FORM_TITLES[value]) title.textContent = FORM_TITLES[value];
        track('lead_segment_pick', { segment: value || 'unknown' });
        scrollToForm(value ? 'lead-name' : null);
      });
    });

    // ── Anchor buttons ────────────────────────────────────────────────
    document.querySelectorAll('[data-scroll-to-form]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        scrollToForm('lead-name');
      });
    });

    function scrollToForm(focusId) {
      var card = document.getElementById('consultation-form');
      if (!card) return;
      var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      card.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      if (!focusId) return;
      // Focus after the scroll settles, so the browser does not jump twice.
      window.setTimeout(function () {
        var field = document.getElementById(focusId);
        if (field) field.focus({ preventScroll: true });
      }, reduced ? 0 : 500);
    }

    // ── Sticky mobile CTA ─────────────────────────────────────────────
    // Shown once the hero form has scrolled out of view, hidden again at
    // the closing CTA so it never covers the button it duplicates.
    var sticky = document.getElementById('sticky-cta');
    var heroCard = document.getElementById('consultation-form');
    var finalCta = document.getElementById('start');
    if (sticky && heroCard && 'IntersectionObserver' in window) {
      var pastHero = false;
      var atFinal = false;
      var sync = function () {
        sticky.setAttribute('data-visible', String(pastHero && !atFinal));
      };
      new IntersectionObserver(function (entries) {
        pastHero = !entries[0].isIntersecting;
        sync();
      }, { threshold: 0 }).observe(heroCard);
      if (finalCta) {
        new IntersectionObserver(function (entries) {
          atFinal = entries[0].isIntersecting;
          sync();
        }, { threshold: 0 }).observe(finalCta);
      }
    }

    // ── Form submission ───────────────────────────────────────────────
    if (!form) return;

    // Fires once, on the first field a visitor touches. Paired with
    // lead_submitted this gives a start-to-finish completion rate, which
    // is where form friction shows up.
    var started = false;
    form.addEventListener('focusin', function () {
      if (started) return;
      started = true;
      track('lead_form_start');
    });

    var MAILTO = 'mailto:services@kennedymusamali.com?subject=Free%20Consultation%20Request';

    function setMessage(state, html) {
      if (!msg) return;
      msg.setAttribute('data-state', state);
      msg.innerHTML = html;
    }

    function firstInvalid() {
      var fields = form.querySelectorAll('input, select, textarea');
      for (var i = 0; i < fields.length; i++) {
        if (!fields[i].checkValidity()) return fields[i];
      }
      return null;
    }

    form.addEventListener('submit', function (e) {
      // Let the browser surface its own validation UI first.
      if (!form.checkValidity()) {
        e.preventDefault();
        var bad = firstInvalid();
        if (bad) { bad.focus(); bad.reportValidity(); }
        return;
      }

      // fetch is what lets us stay on the page; without it the plain POST
      // to /api/lead goes through and the endpoint renders its own reply.
      if (typeof window.fetch !== 'function') return;

      e.preventDefault();
      setMessage('', '');
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Sending…';
      }

      var payload = {};
      new FormData(form).forEach(function (value, key) { payload[key] = value; });

      window.fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          return { ok: res.ok, status: res.status, body: body };
        });
      }).then(function (result) {
        if (result.ok) {
          track('lead_submitted', { segment: payload.segment || 'unknown' });
          form.hidden = true;
          setMessage('ok',
            '<strong>That came through. Here is what happens next.</strong>' +
            '<ol class="lp-next">' +
            '<li>Dr. Musamali replies personally, usually within one business day.</li>' +
            '<li>You pick a time that suits you, evenings and weekends included.</li>' +
            '<li>Twenty minutes on the phone or video, and you leave with a first step.</li>' +
            '</ol>' +
            'If it is urgent, call <a href="tel:+14698448251">469-844-8251</a>.');
          if (msg) msg.focus && msg.focus();
          return;
        }

        var reason = (result.body && result.body.error) || '';
        track('lead_failed', { status: result.status });
        if (result.status === 400 && reason) {
          setMessage('error', reason);
        } else {
          // 503 means the endpoint has no delivery target configured. Either
          // way the visitor should not lose what they wrote.
          setMessage('error',
            'That did not send. Please email <a href="' + MAILTO + '">services@kennedymusamali.com</a> ' +
            'or call <a href="tel:+14698448251">469-844-8251</a>. Both reach Dr. Musamali directly.');
        }
      }).catch(function () {
        track('lead_failed', { status: 0 });
        setMessage('error',
          'That did not send. You may be offline. Please email ' +
          '<a href="' + MAILTO + '">services@kennedymusamali.com</a> or call ' +
          '<a href="tel:+14698448251">469-844-8251</a>.');
      }).then(function () {
        if (submit) {
          submit.disabled = false;
          submit.textContent = 'Get my free 20-minute consultation';
        }
      });
    });
  });
}());
