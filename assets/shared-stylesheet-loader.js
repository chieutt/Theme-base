(() => {
  const sharedStylesheets = new Map();

  const normalizeHref = (link) => {
    const source = link.dataset.href || link.href;
    return source ? new URL(source, document.baseURI).href : '';
  };

  const removeDuplicateSharedStylesheets = (scope = document) => {
    scope.querySelectorAll?.('link[data-spinel-shared-stylesheet]').forEach((link) => {
      const href = normalizeHref(link);
      if (!href) return;

      const key = `${link.dataset.spinelSharedStylesheet}:${href}`;
      const existing = sharedStylesheets.get(key);
      if (existing?.isConnected) {
        link.remove();
      } else {
        sharedStylesheets.set(key, link);
      }
    });
  };

  removeDuplicateSharedStylesheets();
  document.addEventListener('shopify:section:load', (event) => removeDuplicateSharedStylesheets(event.target));
})();
