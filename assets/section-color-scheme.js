(() => {
  const colorSchemeClass = (element) => Array.from(element.classList).find((className) => className.startsWith('color-scheme-'));

  function syncSection(section) {
    if (!(section instanceof Element) || !section.classList.contains('shopify-section')) return;

    const root = Array.from(section.children).find((child) => child.classList?.contains('color-scheme'));
    const previousClass = section.dataset.colorSchemeClass;

    if (previousClass) section.classList.remove('color-scheme', previousClass);

    const nextClass = root ? colorSchemeClass(root) : null;
    if (nextClass) {
      section.classList.add('color-scheme', nextClass);
      section.dataset.colorSchemeClass = nextClass;
    } else {
      delete section.dataset.colorSchemeClass;
    }
  }

  function syncSections(scope = document) {
    if (scope instanceof Element && scope.classList.contains('shopify-section')) syncSection(scope);
    scope.querySelectorAll?.('.shopify-section').forEach(syncSection);
  }

  function observeSections() {
    const observer = new MutationObserver((records) => {
      const sections = new Set();

      records.forEach((record) => {
        if (record.type === 'attributes') {
          if (!record.target.classList.contains('shopify-section')) {
            const section = record.target.closest('.shopify-section');
            if (section) sections.add(section);
          }
          return;
        }

        record.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.classList.contains('shopify-section')) sections.add(node);
          node.querySelectorAll('.shopify-section').forEach((section) => sections.add(section));
          const section = node.closest('.shopify-section');
          if (section) sections.add(section);
        });
      });

      sections.forEach(syncSection);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true,
    });
  }

  syncSections();
  observeSections();
  document.addEventListener('shopify:section:load', (event) => syncSections(event.target));
})();
