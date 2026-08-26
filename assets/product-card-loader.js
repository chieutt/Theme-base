let productCardFeatures;
let productCardFeaturesReady = false;
const loaderScript = document.currentScript;
const resolveModuleUrl = (url) => {
  if (!url) return null;
  try {
    return new URL(url, window.location.href).href;
  } catch (_) {
    return null;
  }
};
const productCardModuleUrl = resolveModuleUrl(loaderScript?.dataset.productCardModule);
const cartFeedbackModuleUrl = resolveModuleUrl(loaderScript?.dataset.cartFeedbackModule);
const observedCards = new WeakSet();

const productCardObserver = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries, observer) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    loadProductCardFeatures()
      .then(() => observer.disconnect())
      .catch(() => {});
  }, { rootMargin: '480px 0px' })
  : null;

const loadProductCardFeatures = () => {
  if (!productCardFeatures) {
    if (!productCardModuleUrl || !cartFeedbackModuleUrl) {
      return Promise.reject(new Error('Product card module URLs are unavailable.'));
    }
    productCardFeatures = Promise.all([
      import(productCardModuleUrl),
      import(cartFeedbackModuleUrl),
    ])
      .then(() => {
        productCardFeaturesReady = true;
      })
      .catch((error) => {
        productCardFeatures = null;
        console.error('[Spinel] Product card interactions failed to load.', error);
        throw error;
      });
  }
  return productCardFeatures;
};

const initializeForScope = (scope = document) => {
  const cards = scope.querySelectorAll?.('[data-product-card]') || [];
  if (!cards.length) return;

  if (!productCardObserver) {
    loadProductCardFeatures().catch(() => {});
    return;
  }

  cards.forEach((card) => {
    if (observedCards.has(card)) return;
    observedCards.add(card);
    productCardObserver.observe(card);
  });
};

const interactiveSelector = '[data-product-card-quick-view-open], [data-product-card-quick-add], [data-product-card-variant]';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initializeForScope(), { once: true });
} else {
  initializeForScope();
}

document.addEventListener('click', (event) => {
  const trigger = event.target.closest(interactiveSelector);
  if (!trigger || productCardFeaturesReady) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  loadProductCardFeatures().then(() => trigger.click()).catch(() => {});
}, true);

document.addEventListener('shopify:section:load', (event) => initializeForScope(event.target));
document.addEventListener('collection:products-loaded', (event) => initializeForScope(event.detail?.panel || event.target));
document.addEventListener('featured-collection:products-loaded', (event) => initializeForScope(event.detail?.panel || event.target));
document.addEventListener('product-featured-collection:products-loaded', (event) => initializeForScope(event.detail?.panel || event.target));
document.addEventListener('gift-spinel:products-loaded', (event) => initializeForScope(event.detail?.panel || event.target));
