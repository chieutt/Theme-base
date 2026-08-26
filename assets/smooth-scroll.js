/**
 * Desktop inertial page scrolling.
 * Uses Lenis' own requestAnimationFrame lifecycle; do not add a second wheel
 * listener or animation loop here, as that conflicts with scroll-driven UI.
 */
const root = document.documentElement;
const canUseSmoothScroll = root.dataset.desktopSmoothScroll === 'all'
  && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  && !window.matchMedia('(pointer: coarse)').matches
  && !window.Shopify?.designMode;

if (canUseSmoothScroll) {
  import('https://unpkg.com/lenis@1.3.16/dist/lenis.mjs')
    .then(({ default: Lenis }) => {
      const lenis = new Lenis({
        autoRaf: true,
        lerp: Number(root.dataset.desktopSmoothScrollLerp || '0.08'),
        wheelMultiplier: Number(root.dataset.desktopSmoothScrollSpeed || '0.9'),
        smoothWheel: true,
        syncTouch: false,
        prevent: (node) => node instanceof Element && Boolean(node.closest([
          '[data-lenis-prevent]',
          'dialog',
          '[role="dialog"]',
          '.cart-drawer__body',
          '.quick-view__body',
          '.header__mobile-drawer',
          '.header__localization-sheet',
          'input',
          'textarea',
          'select',
          '[contenteditable="true"]',
        ].join(','))),
      });

      const updateLockState = () => {
        if (root.classList.contains('scroll-locked') || root.hasAttribute('scroll-lock')) lenis.stop();
        else lenis.start();
      };

      new MutationObserver(updateLockState).observe(root, {
        attributes: true,
        attributeFilter: ['class', 'scroll-lock'],
      });
      updateLockState();
      window.SpinelSmoothScroll = lenis;
    })
    .catch(() => {
      // Network failure intentionally falls back to native browser scrolling.
    });
}
