// Shared site behavior for all pages. Each block guards on the elements it
// needs, so one file serves every page under a strict CSP (no inline scripts).
(function () {
  'use strict';

  // Vercel Web Analytics queue stub (must exist before /_vercel/insights runs;
  // this file is loaded with `defer` ahead of the insights script).
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onReady(function () {
    // Nav shrink on scroll
    const nav = document.getElementById('main-nav');
    if (nav) {
      window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 50);
      });
    }

    // Scroll reveal
    const reveals = document.querySelectorAll('.reveal');
    if (reveals.length) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      reveals.forEach(el => observer.observe(el));

      // Hero-area elements appear immediately rather than waiting for scroll
      document.querySelectorAll(
        '.hero .reveal, .courses-hero .reveal, .hero-eyebrow, .courses-hero h1, .courses-hero-sub, .hero-strip'
      ).forEach(el => {
        setTimeout(() => el.classList.add('visible'), 100);
      });
    }

    // Custom cursor (index and courses pages)
    const cursor = document.getElementById('cursor');
    if (cursor) {
      document.body.classList.add('js-loaded');
      document.body.classList.add('js-cursor');
      document.body.style.cursor = 'none';

      let mx = -100, my = -100, cx = -100, cy = -100;
      document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; cursor.classList.add('visible'); });
      document.addEventListener('mouseleave', () => cursor.classList.remove('visible'));
      document.addEventListener('mousedown', () => cursor.classList.add('clicking'));
      document.addEventListener('mouseup', () => cursor.classList.remove('clicking'));
      document.querySelectorAll('a, button, .service-card, .kit-panel, .course-card, .hook-q, .level-card').forEach(el => {
        el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
        el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
      });
      (function animateCursor() {
        cx += (mx - cx) * 0.18;
        cy += (my - cy) * 0.18;
        cursor.style.left = cx + 'px';
        cursor.style.top = cy + 'px';
        requestAnimationFrame(animateCursor);
      }());
    } else {
      document.body.classList.add('js-loaded');
    }

    // KIT panel keyboard/click support (index)
    document.querySelectorAll('.kit-panel').forEach(panel => {
      panel.addEventListener('focus', () => panel.classList.add('active'));
      panel.addEventListener('blur', () => panel.classList.remove('active'));
    });

    // Footer year (media page)
    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
  });
}());
