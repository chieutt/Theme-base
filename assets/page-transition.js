(() => {
  const transition = document.querySelector('[data-page-transition]');
  const root = document.documentElement;

  if (!transition || window.Shopify?.designMode || !root.classList.contains('page-transitions-enabled')) {
    return;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const transitionDuration = Number.parseInt(transition.dataset.pageTransitionDuration, 10) || 0;
  let safetyTimeout;

  const hide = () => {
    window.clearTimeout(safetyTimeout);
    transition.classList.add('is-hidden');
  };

  const scheduleSafetyFallback = () => {
    safetyTimeout = window.setTimeout(hide, transitionDuration + 150);
  };

  const reveal = () => {
    if (reducedMotion.matches) {
      hide();
      return;
    }

    scheduleSafetyFallback();
  };

  transition.addEventListener('transitionend', (event) => {
    if (event.target === transition && event.propertyName === 'opacity') hide();
  });

  window.addEventListener('spinel:page-transition-reveal', reveal, { once: true });

  if (root.classList.contains('page-transition-dom-ready')) reveal();

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) hide();
  });
})();
