const deferredStylesheets = document.querySelectorAll('[data-deferred-section-stylesheet]');
const loadedStylesheetUrls = new Set(
  [...document.querySelectorAll('link[rel="stylesheet"][href]')].map((link) => link.href),
);
const isMobileViewport = window.matchMedia('(max-width: 767.98px)').matches;
const deferredStylesheetRootMargin = isMobileViewport ? '800px 0px' : '400px 0px';
const scrollRestoration = window.SpinelScrollRestoration;

const loadStylesheet = (link) => new Promise((resolve) => {
  if (!link.dataset.href) {
    resolve();
    return;
  }

  const href = new URL(link.dataset.href, document.baseURI).href;
  if (loadedStylesheetUrls.has(href)) {
    link.remove();
    resolve();
    return;
  }

  let settled = false;
  const complete = () => {
    if (settled) return;
    settled = true;
    resolve();
  };

  loadedStylesheetUrls.add(href);
  link.addEventListener('load', complete, { once: true });
  link.addEventListener('error', complete, { once: true });
  link.rel = 'stylesheet';
  link.href = link.dataset.href;
  link.removeAttribute('data-href');
});

const loadRemainingStylesheets = () => {
  const load = () => deferredStylesheets.forEach(loadStylesheet);
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(load, { timeout: 1200 });
  } else {
    window.setTimeout(load, 0);
  }
};

const restoreHomepageScroll = () => {
  if (!scrollRestoration?.shouldRestore || !scrollRestoration.position) return;

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: scrollRestoration.position.top,
        left: scrollRestoration.position.left,
        behavior: 'auto'
      });
      window.dispatchEvent(new Event('spinel:scroll-restored'));
    });
  });
};

if (scrollRestoration?.shouldRestore) {
  Promise.all([...deferredStylesheets].map(loadStylesheet)).then(restoreHomepageScroll);
} else if (!('IntersectionObserver' in window)) {
  deferredStylesheets.forEach(loadStylesheet);
} else {
  const sectionLinks = new Map();
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        sectionLinks.get(entry.target)?.forEach(loadStylesheet);
        sectionLinks.delete(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: deferredStylesheetRootMargin },
  );

  deferredStylesheets.forEach((link) => {
    const section = link.closest('.shopify-section');
    if (!section) {
      loadStylesheet(link);
      return;
    }

    const links = sectionLinks.get(section) || [];
    links.push(link);
    sectionLinks.set(section, links);
    observer.observe(section);
  });
}

if (document.readyState === 'complete') {
  loadRemainingStylesheets();
} else {
  window.addEventListener('load', loadRemainingStylesheets, { once: true });
}
