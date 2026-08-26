(() => {
  // A Theme Editor section re-render can execute this loader again after the
  // custom element has already been registered. The new cart-drawer element
  // connects itself automatically, so registering another document-level
  // loader would duplicate product-add and click listeners.
  if (customElements.get('cart-drawer')) return;

  const loaderScript = document.currentScript;
  const source = loaderScript?.dataset.cartDrawerModule;
  const triggerSelector = '[data-cart-drawer-open]';
  let modulePromise;

  const getDrawer = () => document.querySelector('cart-drawer');

  const cleanup = () => {
    document.removeEventListener('pointerover', handleIntent);
    document.removeEventListener('focusin', handleIntent);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('product:add:success', handleProductAdd);
    document.removeEventListener('cart:add:success', handleProductAdd);
  };

  const load = () => {
    if (customElements.get('cart-drawer')) return Promise.resolve(getDrawer());
    if (!source) return Promise.reject(new Error('Cart drawer module URL is unavailable.'));

    if (!modulePromise) {
      modulePromise = import(new URL(source, document.baseURI).href)
        .then(() => customElements.whenDefined('cart-drawer'))
        .then(() => {
          cleanup();
          return getDrawer();
        })
        .catch((error) => {
          modulePromise = null;
          console.error('[Spinel] Cart drawer failed to load.', error);
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
    if (!trigger || customElements.get('cart-drawer')) return;

    event.preventDefault();
    load()
      .then((drawer) => drawer?.open(trigger))
      .catch(() => {
        if (trigger.href) window.location.assign(trigger.href);
      });
  }

  function handleProductAdd(event) {
    if (!event.detail?.item || customElements.get('cart-drawer') || loaderScript?.dataset.cartDrawerAutoOpen === 'false') return;
    const sourceButton = event.detail.sourceButton || event.detail.button || null;
    const quickViewModal = sourceButton?.closest?.('[data-quick-view]')
      ? document.querySelector('[data-quick-view-modal]')
      : null;
    const waitForQuickViewClose = quickViewModal?.open
      ? new Promise((resolve) => {
          quickViewModal.addEventListener('close', resolve, { once: true });
          if (!quickViewModal.classList.contains('is-closing')) window.SpinelQuickView?.close();
        })
      : Promise.resolve();

    waitForQuickViewClose
      .then(() => load())
      .then((drawer) => drawer?.open(sourceButton))
      .catch(() => {});
  }

  document.addEventListener('pointerover', handleIntent, { passive: true });
  document.addEventListener('focusin', handleIntent);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('product:add:success', handleProductAdd);
  document.addEventListener('cart:add:success', handleProductAdd);

  if (window.Shopify?.designMode) load().catch(() => {});
})();
