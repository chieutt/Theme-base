(() => {
  const pending = new WeakSet();
  const loadedSources = new Map();
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

  function shouldReloadRuntime(element, source) {
    const tagName = element.localName;
    if (!tagName?.includes('-')) return false;

    const previousSource = loadedSources.get(tagName);
    loadedSources.set(tagName, source);
    if (!previousSource || previousSource === source) return false;

    const isLocalThemeDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const isEditor = Boolean(window.Shopify?.designMode);
    if (!isEditor && !isLocalThemeDev) return false;

    return Boolean(window.customElements?.get(tagName));
  }

  function load(element) {
    const source = element.dataset.deferredModule;
    if (!source || pending.has(element)) return;

    const moduleUrl = new URL(source, document.baseURI).href;
    if (shouldReloadRuntime(element, moduleUrl)) {
      window.location.reload();
      return;
    }

    if (!loadedSources.has(element.localName)) loadedSources.set(element.localName, moduleUrl);
    pending.add(element);
    element.removeAttribute('data-deferred-module');
    import(moduleUrl);
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
