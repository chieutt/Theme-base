(() => {
  const pending = new WeakSet();
  const isMobileViewport = window.matchMedia('(max-width: 767.98px)').matches;
  const deferredModuleRootMargin = isMobileViewport ? '800px 0px' : '480px 0px';
  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          load(entry.target);
        });
      }, { rootMargin: deferredModuleRootMargin })
    : null;

  function load(element) {
    const source = element.dataset.deferredModule;
    if (!source || pending.has(element)) return;
    pending.add(element);
    element.removeAttribute('data-deferred-module');
    import(new URL(source, document.baseURI).href);
  }

  function loadAfterWindowLoad(element) {
    if (document.readyState === 'complete') {
      load(element);
      return;
    }

    window.addEventListener(
      'load',
      () => {
        if (element.isConnected) load(element);
      },
      { once: true },
    );
  }

  function observe(scope = document) {
    scope.querySelectorAll?.('[data-deferred-module]').forEach((element) => {
      if (window.Shopify?.designMode) load(element);
      else if (element.hasAttribute('data-deferred-module-after-load')) loadAfterWindowLoad(element);
      else if (!observer) load(element);
      else observer.observe(element);
    });
  }

  observe();
  document.addEventListener('shopify:section:load', (event) => observe(event.target));
})();
