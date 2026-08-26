(() => {
  if (window.ThemeDetailsAccordion) return;

  const states = new WeakMap();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const duration = 300;
  const easing = 'cubic-bezier(.4, 0, .2, 1)';

  const isEnabled = (details) => {
    const media = details.dataset.accordionMedia;
    return !media || window.matchMedia(media).matches;
  };

  const finish = (details, open, state = {}) => {
    details.open = open;
    state.heightAnimation?.cancel();
    state.contentAnimation?.cancel();
    details.style.removeProperty('height');
    details.style.removeProperty('overflow');
    details.classList.remove('is-closing', 'is-accordion-animating');
    if (states.get(details) === state) states.delete(details);
  };

  const setOpen = (details, open, options = {}) => {
    if (!(details instanceof HTMLDetailsElement)) return;
    const summary = details.querySelector(':scope > summary');
    const content = details.querySelector(':scope > [data-accordion-content]');
    if (!summary || !content || !isEnabled(details)) {
      details.open = open;
      return;
    }

    const previous = states.get(details);
    const targetOpen = previous?.targetOpen ?? details.open;
    if (targetOpen === open && !previous) return;

    previous?.heightAnimation?.cancel();
    previous?.contentAnimation?.cancel();

    const startHeight = details.getBoundingClientRect().height;
    const startOpacity = details.open ? Number.parseFloat(getComputedStyle(content).opacity) || 1 : 0;
    if (open && !details.open) details.open = true;
    const endHeight = open ? details.scrollHeight : summary.offsetHeight;

    if (options.immediate || reducedMotion.matches || !details.animate) {
      finish(details, open);
      return;
    }

    details.classList.toggle('is-closing', !open);
    details.classList.add('is-accordion-animating');
    details.style.height = `${startHeight}px`;
    details.style.overflow = 'hidden';

    const state = { targetOpen: open };
    state.heightAnimation = details.animate(
      { height: [`${startHeight}px`, `${endHeight}px`] },
      { duration, easing, fill: 'forwards' },
    );
    state.contentAnimation = content.animate(
      {
        opacity: [startOpacity, open ? 1 : 0],
        transform: [open ? 'translateY(-6px)' : 'translateY(0)', open ? 'translateY(0)' : 'translateY(-6px)'],
      },
      { duration: duration * 0.8, easing, fill: 'forwards' },
    );
    states.set(details, state);

    state.heightAnimation.onfinish = () => {
      if (states.get(details) === state) finish(details, open, state);
    };
    state.heightAnimation.oncancel = () => {
      if (states.get(details) === state) states.delete(details);
    };
  };

  document.addEventListener('click', (event) => {
    const summary = event.target.closest('[data-animated-details] > summary');
    if (!summary) return;
    const details = summary.parentElement;
    if (!isEnabled(details)) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    const open = !(states.get(details)?.targetOpen ?? details.open);
    setOpen(details, open);
  });

  document.addEventListener('shopify:block:select', (event) => {
    const details = event.target.closest?.('[data-animated-details]');
    if (details) setOpen(details, true, { immediate: true });
  });

  window.ThemeDetailsAccordion = Object.freeze({ setOpen });
})();
