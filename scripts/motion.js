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
