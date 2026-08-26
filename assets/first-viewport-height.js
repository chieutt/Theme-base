const sectionSelector = '.shopify-section';

function getViewportHeight() {
  return window.visualViewport?.height || window.innerHeight;
}

function hasOnlyAnnouncementBarsBefore(section) {
  let previousSection = section.previousElementSibling;

  while (previousSection) {
    if (
      previousSection.matches(sectionSelector)
      && !previousSection.querySelector('announcement-bar')
    ) {
      return false;
    }

    previousSection = previousSection.previousElementSibling;
  }

  return true;
}

/**
 * Makes a full-screen slideshow fill only the remaining first viewport.
 * The element's document position naturally includes every in-flow bar above
 * it, including any number of announcement bars and the site header.
 */
export function setupFirstViewportHeight(element, { mobileBreakpoint = 749 } = {}) {
  let animationFrame;
  const abortController = new AbortController();
  const { signal } = abortController;
  const mobileQuery = window.matchMedia(`(max-width: ${mobileBreakpoint}px)`);
  const section = element.closest(sectionSelector);
  const coarsePointerQuery = window.matchMedia('(hover: none) and (pointer: coarse)');
  let viewportWidth = window.innerWidth;
  let stableViewportHeight = getViewportHeight();

  // Mobile Safari changes visualViewport.height while its browser chrome
  // expands/collapses during scroll. Preserve the first-viewport layout only
  // on touch mobile viewports; desktop resizes must always use the new height.
  const getStableViewportHeight = () => {
    const nextViewportWidth = window.innerWidth;
    const shouldStabilizeMobileViewport = mobileQuery.matches && coarsePointerQuery.matches;
    if (!shouldStabilizeMobileViewport || nextViewportWidth !== viewportWidth) {
      viewportWidth = nextViewportWidth;
      stableViewportHeight = getViewportHeight();
    }

    return stableViewportHeight;
  };

  const update = () => {
    animationFrame = undefined;

    const fullScreenClass = mobileQuery.matches
      ? 'mobile-full'
      : 'desktop-full';
    const isFullScreen = element.classList.contains(`slideshow--height-${fullScreenClass}`)
      || element.classList.contains(`editorial-slideshow--height-${fullScreenClass}`);
    const viewportHeight = getStableViewportHeight();
    const top = element.getBoundingClientRect().top + window.scrollY;
    const startsInFirstViewport = top >= 0 && top < viewportHeight;
    const canFillFirstViewport = isFullScreen
      && startsInFirstViewport
      && (!section || hasOnlyAnnouncementBarsBefore(section));
    const remainingViewportHeight = viewportHeight - top;

    element.classList.toggle('slideshow--fills-first-viewport', canFillFirstViewport);

    if (canFillFirstViewport) {
      element.style.setProperty('--slideshow-first-viewport-height', `${Math.max(0, Math.round(remainingViewportHeight * 100) / 100)}px`);
    } else {
      element.style.removeProperty('--slideshow-first-viewport-height');
    }
  };

  const scheduleUpdate = () => {
    if (animationFrame) return;
    animationFrame = window.requestAnimationFrame(update);
  };

  const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(scheduleUpdate) : null;
  document.querySelectorAll(sectionSelector).forEach((candidate) => {
    if (!section || candidate === section || candidate.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING) {
      resizeObserver?.observe(candidate);
    }
  });
  window.addEventListener('resize', scheduleUpdate, { signal });
  window.visualViewport?.addEventListener('resize', scheduleUpdate, { signal });
  mobileQuery.addEventListener?.('change', scheduleUpdate, { signal });
  document.addEventListener('shopify:section:load', scheduleUpdate, { signal });
  document.addEventListener('shopify:section:unload', scheduleUpdate, { signal });
  document.addEventListener('shopify:section:reorder', scheduleUpdate, { signal });
  document.fonts?.ready.then(scheduleUpdate);
  scheduleUpdate();

  return () => {
    abortController.abort();
    resizeObserver?.disconnect();
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    element.classList.remove('slideshow--fills-first-viewport');
    element.style.removeProperty('--slideshow-first-viewport-height');
  };
}
