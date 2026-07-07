// Purely cosmetic scroll-reveal — adds .in-view to [data-reveal] elements as they
// enter the viewport (styles/main.css handles the actual fade/slide transition).
// Entirely additive: doesn't read or touch any game data, filter state, or chart
// instance, and if this script fails to load, [data-reveal] elements just stay at
// their default (visible, per the no-JS fallback below) rather than break anything.
(function initScrollReveal() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;

  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('in-view'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  targets.forEach((el) => observer.observe(el));
})();

// Wraps a horizontally-scrolling strip (.news-strip / .game-strip) with prev/next
// arrow buttons the first time it's called for a given element, so callers (news.js,
// home.js) can just call this right after they populate the strip's contents —
// the native scrollbar is hidden in CSS, so without this there'd be no visible
// affordance that the strip scrolls at all.
function enhanceScrollStrip(strip) {
  if (!strip || strip.dataset.stripEnhanced) return;
  strip.dataset.stripEnhanced = 'true';

  const wrap = document.createElement('div');
  wrap.className = 'strip-w';
  strip.parentNode.insertBefore(wrap, strip);
  wrap.appendChild(strip);

  const scrollByAmount = () => Math.round(strip.clientWidth * 0.8);

  const makeArrow = (dir) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `strip-arrow strip-arrow--${dir}`;
    btn.setAttribute('aria-label', dir === 'prev' ? 'Scroll left' : 'Scroll right');
    btn.textContent = dir === 'prev' ? '←' : '→';
    btn.addEventListener('click', () => {
      strip.scrollBy({ left: dir === 'prev' ? -scrollByAmount() : scrollByAmount(), behavior: 'smooth' });
    });
    return btn;
  };

  const prevBtn = makeArrow('prev');
  const nextBtn = makeArrow('next');
  wrap.append(prevBtn, nextBtn);

  const updateArrows = () => {
    const maxScroll = strip.scrollWidth - strip.clientWidth;
    prevBtn.classList.toggle('is-hidden', strip.scrollLeft <= 4);
    nextBtn.classList.toggle('is-hidden', maxScroll <= 4 || strip.scrollLeft >= maxScroll - 4);
  };

  strip.addEventListener('scroll', updateArrows, { passive: true });
  window.addEventListener('resize', updateArrows);
  updateArrows();
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Smooth inertia scrolling for the whole page, via Lenis (loaded from a CDN <script>
// before this file, same pattern as Chart.js). Fully optional: if the CDN script
// failed to load, or the visitor has reduced-motion set, this just no-ops and the
// page scrolls natively — nothing else on the page depends on Lenis being present.
// Elements with their own internal scroll (chart modal body, the scrollable genre/tag
// popover, the news/game strips) carry data-lenis-prevent so Lenis doesn't hijack them.
(function initSmoothScroll() {
  if (!window.Lenis || prefersReducedMotion) return;

  const lenis = new Lenis();
  if (window.gsap && window.ScrollTrigger) {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    requestAnimationFrame(function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    });
  }
})();

// Staggered cascade reveal for grid/list groups (stat tiles, chart pairs, game cards,
// news items) — layered on TOP of the existing [data-reveal] section fade-up above,
// not a replacement for it. Purely additive: these containers render at their normal
// (visible) state by default, so if GSAP/ScrollTrigger failed to load, or reduced-motion
// is set, this just no-ops and everything looks exactly as it would without it.
// A single MutationObserver (rather than calling a helper from every render function in
// cards.js/filters.js/insights.js/news.js) keeps this self-contained here in motion.js.
(function initGsapStagger() {
  if (!window.gsap || !window.ScrollTrigger || prefersReducedMotion) return;
  gsap.registerPlugin(ScrollTrigger);

  const STAGGER_SELECTOR = '.stat-tiles, .tier-breakdown, .chart-pair, .game-grid, .news-strip, .news-list, .game-strip';

  function stagger(container) {
    if (!container.children.length || container.dataset.staggered) return;
    if (container.querySelector('.empty-state')) return;
    container.dataset.staggered = 'true';
    gsap.from([...container.children], {
      opacity: 0,
      y: 16,
      duration: 0.45,
      stagger: 0.06,
      ease: 'power2.out',
      scrollTrigger: { trigger: container, start: 'top 90%' },
    });
  }

  const scan = () => document.querySelectorAll(STAGGER_SELECTOR).forEach(stagger);
  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
})();
