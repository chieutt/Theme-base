(() => {
  if (window.ThemeAnimations) return;

  const script = document.currentScript;
  const motionEnabled = script?.dataset.motionEnabled !== 'false';
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const initialized = new WeakSet();
  const pending = new Set();
  const variants = new Set(['fade', 'fade-up', 'fade-down', 'fade-left', 'fade-right', 'zoom']);
  const defaultVariant = 'fade-up';
  const revealSelector = '[data-reveal], [data-reveal-group]';
  const maximumTiming = 3000;

  const parseTiming = (value, fallback) => {
    const normalized = String(value ?? '').trim();
    if (!/^\d{1,4}$/.test(normalized)) return fallback;
    return Math.min(Number(normalized), maximumTiming);
  };

  let observer;

  const show = (element) => {
    pending.delete(element);
    if (!element?.isConnected) return;
    element.dataset.revealState = 'visible';
    observer?.unobserve(element);
  };

  const showAll = () => {
    pending.forEach(show);
  };

  const createObserver = () => {
    if (!motionEnabled || reducedMotion.matches || !('IntersectionObserver' in window)) return null;
    return new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.intersectionRatio >= 0.15) show(entry.target);
        });
      }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });
  };

  observer = createObserver();

  const prepare = (element) => {
    if (initialized.has(element)) return;
    initialized.add(element);

    if (element.hasAttribute('data-reveal')) {
      element.dataset.reveal = variants.has(element.dataset.reveal) ? element.dataset.reveal : defaultVariant;
    }
    const duration = parseTiming(element.dataset.revealDuration, 800);
    const delay = parseTiming(element.dataset.revealDelay, 120);

    element.style.setProperty('--reveal-duration', `${duration}ms`);
    element.style.setProperty('--reveal-delay', `${delay}ms`);

    if (!observer) {
      element.dataset.revealState = 'visible';
      return;
    }

    element.dataset.revealState = 'pending';
    pending.add(element);
    observer.observe(element);
  };

  const init = (scope = document) => {
    const elements = [];
    if (scope instanceof Element && scope.matches(revealSelector)) elements.push(scope);
    scope.querySelectorAll?.(revealSelector).forEach((element) => elements.push(element));
    elements.forEach(prepare);

    if (observer && elements.length) root.classList.add('theme-animations-enabled');
    return elements.length;
  };

  const refresh = (scope = document) => {
    const elements = [];
    if (scope instanceof Element && scope.matches(revealSelector)) elements.push(scope);
    scope.querySelectorAll?.(revealSelector).forEach((element) => elements.push(element));
    elements.forEach((element) => {
      observer?.unobserve(element);
      pending.delete(element);
      initialized.delete(element);
    });
    return init(scope);
  };

  const revealSelectedBlock = (event) => {
    const selected = event.target.closest?.(revealSelector)
      || event.target.querySelector?.(revealSelector);
    if (selected) show(selected);
  };

  const unload = (scope) => {
    const elements = [];
    if (scope instanceof Element && scope.matches(revealSelector)) elements.push(scope);
    scope.querySelectorAll?.(revealSelector).forEach((element) => elements.push(element));
    elements.forEach((element) => {
      observer?.unobserve(element);
      pending.delete(element);
      initialized.delete(element);
    });
  };

  window.ThemeAnimations = Object.freeze({ init, refresh });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init(), { once: true });
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', (event) => init(event.target));
  document.addEventListener('shopify:section:reorder', (event) => init(event.target));
  document.addEventListener('shopify:section:unload', (event) => unload(event.target));
  document.addEventListener('shopify:block:select', revealSelectedBlock);

  reducedMotion.addEventListener?.('change', (event) => {
    if (event.matches) {
      observer?.disconnect();
      observer = null;
      showAll();
      root.classList.remove('theme-animations-enabled');
      return;
    }

    observer = createObserver();
    init();
  });
})();
