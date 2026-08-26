(() => {
  // Theme Editor section re-renders execute this loader again. Once the
  // custom element is registered, newly rendered instances upgrade on their
  // own and must not receive another set of document-level intent listeners.
  if (customElements.get('search-drawer')) return;

  const loaderScript = document.currentScript;
  const source = loaderScript?.dataset.searchDrawerModule;
  const triggerSelector = '[data-search-drawer-open]';
  let modulePromise;

  const getDrawer = () => document.querySelector('search-drawer');

  const cleanup = () => {
    document.removeEventListener('pointerover', handleIntent);
    document.removeEventListener('focusin', handleIntent);
    document.removeEventListener('click', handleClick, true);
  };

  const load = () => {
    if (customElements.get('search-drawer')) return Promise.resolve(getDrawer());
    if (!source) return Promise.reject(new Error('Search drawer module URL is unavailable.'));

    if (!modulePromise) {
      modulePromise = import(new URL(source, document.baseURI).href)
        .then(() => customElements.whenDefined('search-drawer'))
        .then(() => {
          cleanup();
          return getDrawer();
        })
        .catch((error) => {
          modulePromise = null;
          console.error('[Spinel] Search drawer failed to load.', error);
          throw error;
        });
    }

    return modulePromise;
  };

  function handleIntent(event) {
    if (!event.target.closest?.(triggerSelector)) return;
    load().catch(() => {});
  }

  function handleClick(event) {
    const trigger = event.target.closest?.(triggerSelector);
    if (!trigger || customElements.get('search-drawer')) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    load()
      .then((drawer) => {
        if (drawer) drawer.open(trigger);
        else if (trigger.href) window.location.assign(trigger.href);
      })
      .catch(() => {
        if (trigger.href) window.location.assign(trigger.href);
      });
  }

  document.addEventListener('pointerover', handleIntent, { passive: true });
  document.addEventListener('focusin', handleIntent);
  document.addEventListener('click', handleClick, true);

  if (window.Shopify?.designMode || loaderScript?.dataset.searchDrawerEager === 'true') load().catch(() => {});
})();
