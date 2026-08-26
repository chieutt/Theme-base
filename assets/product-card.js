const variantImagePreloads = new Map();

const preloadVariantImage = (src, srcset = '', sizes = '') => {
  if (!src) return Promise.resolve();
  const cacheKey = `${src}|${srcset}|${sizes}`;
  if (variantImagePreloads.has(cacheKey)) return variantImagePreloads.get(cacheKey);

  const preload = new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (typeof image.decode === 'function') image.decode().catch(() => {}).finally(resolve);
      else resolve();
    };

    image.onload = finish;
    image.onerror = finish;
    if (srcset) image.srcset = srcset;
    if (sizes) image.sizes = sizes;
    image.src = src;
    if (image.complete) finish();
  });

  variantImagePreloads.set(cacheKey, preload);
  return preload;
};

const addVariantToCart = async (variantId, source, image, form) => {
  if (!variantId || !source || source.disabled) return null;
  source.disabled = true;
  source.classList.add('is-loading');
  source.setAttribute('aria-busy', 'true');
  try {
    const formData = form ? new FormData(form) : new FormData();
    formData.set('id', variantId);
    if (!formData.has('quantity')) formData.set('quantity', '1');
    const response = await fetch(window.routes?.cart_add_url || '/cart/add.js', {
      method: 'POST',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: formData
    });
    const item = await response.json();
    if (!response.ok) {
      const error = new Error(item.description || item.message || window.theme?.strings?.addToCartError || 'Unable to add this item to your cart.');
      error.payload = item;
      error.status = response.status;
      error.url = response.url;
      throw error;
    }
    let cart = null;
    try {
      const cartResponse = await fetch('/cart.js', { headers: { Accept: 'application/json' } });
      if (cartResponse.ok) cart = await cartResponse.json();
    } catch (_) {}
    document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true, detail: { item, cart } }));
    document.dispatchEvent(new CustomEvent('cart:add:success', { bubbles: true, detail: { item, cart, button: source, image, imageUrl: image?.currentSrc || image?.src } }));
    source.classList.add('is-added');
    window.setTimeout(() => source.classList.remove('is-added'), 1400);
    return item;
  } catch (error) {
    console.error('[Spinel] Product card add to cart failed', {
      error,
      variantId,
      productHandle: source.closest('[data-product-card]')?.dataset.productHandle || null,
    });
    throw error;
  } finally {
    source.classList.remove('is-loading');
    source.removeAttribute('aria-busy');
    source.disabled = false;
  }
};

class QuickViewModal {
  constructor() {
    this.dialog = document.querySelector('[data-quick-view-modal]');
    this.content = this.dialog?.querySelector('[data-quick-view-modal-content]');
    this.backdropPointer = this.dialog?.querySelector('.quick-view-modal__backdrop-pointer');
    this.closeTimer = null;
    this.requestController = null;
    this.handleDrag = null;
    this.handleDragTimer = null;
    this.mobileQuickView = window.matchMedia('(max-width: 767.98px)');
    if (!this.dialog || !this.content) return;
    this.hideBackdropCursor = () => {
      document.documentElement.classList.remove('quick-view-backdrop-cursor');
      this.backdropPointer?.classList.remove('is-visible');
    };
    this.handleViewportMouseOut = (event) => {
      if (!event.relatedTarget) this.hideBackdropCursor();
    };
    this.handleBackdropCursor = (event) => {
      if (!this.dialog.open) return;
      const rect = this.dialog.getBoundingClientRect();
      const insidePanel = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      document.documentElement.classList.toggle('quick-view-backdrop-cursor', !insidePanel);
      if (this.backdropPointer) {
        this.backdropPointer.style.setProperty('--quick-view-pointer-x', (event.clientX - rect.left) + 'px');
        this.backdropPointer.style.setProperty('--quick-view-pointer-y', (event.clientY - rect.top) + 'px');
        this.backdropPointer.classList.toggle('is-visible', !insidePanel);
      }
    };
    document.addEventListener('mousemove', this.handleBackdropCursor, { passive: true });
    document.addEventListener('mouseleave', this.hideBackdropCursor);
    window.addEventListener('mouseout', this.handleViewportMouseOut);
    window.addEventListener('blur', this.hideBackdropCursor);

    this.dialog.addEventListener('click', (event) => {
      if (event.target === this.dialog || event.target.closest('[data-quick-view-close]')) this.close();
      const retry = event.target.closest('[data-quick-view-retry]');
      if (retry && this.currentUrl) this.open(this.currentUrl, this.returnFocus);
    });
    this.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.close();
    });
    this.dialog.addEventListener('close', () => {
      this.resetHandleDrag();
      this.dialog.classList.remove('is-loading', 'is-closing');
      this.dialog.removeAttribute('aria-busy');
      this.hideBackdropCursor();
      this.content.replaceChildren();
      this.returnFocus?.focus({ preventScroll: true });
      this.returnFocus = null;
    });
    this.content.addEventListener('product:add:success', () => {
      window.setTimeout(() => this.close(), 500);
    });
    if ('PointerEvent' in window) {
      this.content.addEventListener('pointerdown', (event) => this.startHandleDrag(event));
      this.content.addEventListener('pointermove', (event) => this.moveHandleDrag(event));
      this.content.addEventListener('pointerup', (event) => this.endHandleDrag(event));
      this.content.addEventListener('pointercancel', (event) => this.endHandleDrag(event, true));
    } else {
      this.content.addEventListener('touchstart', (event) => this.startTouchHandleDrag(event), { passive: false });
      this.content.addEventListener('touchmove', (event) => this.moveTouchHandleDrag(event), { passive: false });
      this.content.addEventListener('touchend', (event) => this.endTouchHandleDrag(event));
      this.content.addEventListener('touchcancel', (event) => this.endTouchHandleDrag(event, true));
    }
  }

  startTouchHandleDrag(event) {
    const touch = event.changedTouches[0];
    if (!touch) return;
    this.startHandleDrag({
      target: event.target,
      isPrimary: true,
      button: 0,
      pointerId: touch.identifier,
      clientY: touch.clientY,
      preventDefault: () => event.preventDefault()
    });
  }

  moveTouchHandleDrag(event) {
    const drag = this.handleDrag;
    if (!drag) return;
    const touch = Array.from(event.changedTouches).find((candidate) => candidate.identifier === drag.pointerId);
    if (!touch) return;
    this.moveHandleDrag({
      pointerId: touch.identifier,
      clientY: touch.clientY,
      preventDefault: () => event.preventDefault()
    });
  }

  endTouchHandleDrag(event, cancelled = false) {
    const drag = this.handleDrag;
    if (!drag) return;
    const touch = Array.from(event.changedTouches).find((candidate) => candidate.identifier === drag.pointerId);
    if (!touch) return;
    this.endHandleDrag({ pointerId: touch.identifier }, cancelled);
  }

  startHandleDrag(event) {
    const handle = event.target instanceof Element ? event.target.closest('[data-quick-view-handle]') : null;
    if (!handle || !this.mobileQuickView.matches || !event.isPrimary || event.button > 0 || this.dialog.classList.contains('is-closing')) return;

    clearTimeout(this.handleDragTimer);
    this.handleDrag = {
      pointerId: event.pointerId,
      handle,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: performance.now(),
      velocity: 0,
      distance: 0
    };
    this.dialog.classList.remove('is-handle-settling', 'is-handle-closing');
    this.dialog.style.transform = 'translate3d(0, 0, 0)';
    this.dialog.style.opacity = '1';
    this.dialog.classList.add('is-handle-dragging');
    this.dialog.style.removeProperty('transition');
    this.dialog.style.removeProperty('opacity');
    try { handle.setPointerCapture(event.pointerId); } catch (_) {}
    event.preventDefault();
  }

  moveHandleDrag(event) {
    const drag = this.handleDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const now = performance.now();
    const elapsed = Math.max(now - drag.lastTime, 1);
    const movement = event.clientY - drag.lastY;
    drag.velocity = movement / elapsed;
    drag.lastY = event.clientY;
    drag.lastTime = now;
    drag.distance = Math.max(0, event.clientY - drag.startY);
    this.dialog.style.transform = `translate3d(0, ${drag.distance}px, 0)`;
    event.preventDefault();
  }

  endHandleDrag(event, cancelled = false) {
    const drag = this.handleDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    try { drag.handle.releasePointerCapture(event.pointerId); } catch (_) {}
    const closeDistance = Math.min(140, this.dialog.getBoundingClientRect().height * 0.2);
    const shouldClose = !cancelled && (drag.distance >= closeDistance || (drag.distance >= 32 && drag.velocity > 0.55));
    this.handleDrag = null;
    this.dialog.classList.remove('is-handle-dragging');

    if (shouldClose) {
      this.requestController?.abort();
      this.dialog.classList.add('is-closing', 'is-handle-closing');
      this.dialog.style.opacity = '1';
      requestAnimationFrame(() => {
        this.dialog.style.transform = `translate3d(0, ${Math.max(window.innerHeight, this.dialog.offsetHeight + 60)}px, 0)`;
        this.dialog.style.opacity = '0';
      });
      clearTimeout(this.closeTimer);
      this.closeTimer = window.setTimeout(() => {
        if (this.dialog.open) this.dialog.close();
      }, 240);
      return;
    }

    this.dialog.classList.add('is-handle-settling');
    requestAnimationFrame(() => {
      this.dialog.style.transform = 'translate3d(0, 0, 0)';
      this.dialog.style.opacity = '1';
    });
  }

  resetHandleDrag() {
    clearTimeout(this.handleDragTimer);
    this.handleDragTimer = null;
    if (this.handleDrag) {
      try { this.handleDrag.handle.releasePointerCapture(this.handleDrag.pointerId); } catch (_) {}
    }
    this.handleDrag = null;
    this.dialog?.classList.remove('is-handle-dragging', 'is-handle-settling', 'is-handle-closing');
    this.dialog?.style.removeProperty('transform');
    this.dialog?.style.removeProperty('opacity');
    this.dialog?.style.removeProperty('transition');
  }

  async open(quickViewUrl, trigger) {
    if (!this.dialog || !this.content || !quickViewUrl) return;
    this.requestController?.abort();
    this.requestController = new AbortController();
    this.currentUrl = quickViewUrl;
    this.returnFocus = trigger || document.activeElement;
    clearTimeout(this.closeTimer);
    this.resetHandleDrag();
    this.dialog.classList.remove('is-closing');
    this.dialog.classList.add('is-loading');
    this.dialog.setAttribute('aria-busy', 'true');
    this.content.replaceChildren();
    if (!this.dialog.open) this.dialog.showModal();

    const url = new URL(quickViewUrl, window.location.origin);
    url.searchParams.set('view', 'quick-view');

    try {
      const quickViewSection = await this.fetchQuickViewSection(url, this.requestController.signal);
      this.removeEditorMetadata(quickViewSection);
      this.content.replaceChildren(quickViewSection.cloneNode(true));
      this.dialog.classList.remove('is-loading');
      this.dialog.removeAttribute('aria-busy');
      this.content.querySelector('[data-quick-view-close]')?.focus({ preventScroll: true });
      try {
        await this.loadProductPage();
      } catch (moduleError) {
        console.error('[Quick view] Product module failed to initialize.', moduleError);
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
      this.dialog.classList.remove('is-loading', 'is-closing');
      this.dialog.removeAttribute('aria-busy');
      this.content.innerHTML = `
        <div class="quick-view__error" role="alert">
          <p>${window.theme?.strings?.quickViewError || 'We could not load this product right now.'}</p>
          <button type="button" class="btn-secondary" data-quick-view-retry>${window.theme?.strings?.quickViewRetry || 'Try again'}</button>
        </div>`;
      this.content.querySelector('[data-quick-view-retry]')?.focus({ preventScroll: true });
    }
  }

  async fetchQuickViewSection(url, signal) {
    const requestUrl = new URL(url);
    const response = await fetch(requestUrl.href, {
      headers: { Accept: 'text/html', 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'same-origin',
      cache: 'no-store',
      signal
    });
    if (!response.ok) throw new Error(`Unable to load quick view (${response.status}).`);

    const quickViewSection = this.parseQuickViewSection(await response.text());
    if (!quickViewSection) throw new Error('Quick view template was not returned.');
    return quickViewSection;
  }

  parseQuickViewSection(html) {
    const responseTemplate = document.createElement('template');
    responseTemplate.innerHTML = html;
    const quickView = responseTemplate.content.querySelector('[data-quick-view]');
    return quickView?.closest('.shopify-section') || quickView || null;
  }

  removeEditorMetadata(section) {
    if (!window.Shopify?.designMode || !section) return;
    section.querySelectorAll('[data-shopify-editor-section], [data-shopify-editor-block]').forEach((element) => {
      element.removeAttribute('data-shopify-editor-section');
      element.removeAttribute('data-shopify-editor-block');
    });
    section.removeAttribute('data-shopify-editor-section');
    section.removeAttribute('data-shopify-editor-block');
  }

  loadProductPage() {
    const moduleUrl = this.dialog?.dataset.productPageModule;
    if (!moduleUrl) return Promise.resolve();
    const resolvedUrl = new URL(moduleUrl, document.baseURI || window.location.href).href;
    return import(resolvedUrl);
  }

  close() {
    if (!this.dialog?.open || this.dialog.classList.contains('is-closing')) return;
    this.resetHandleDrag();
    this.requestController?.abort();
    this.dialog.classList.remove('is-loading');
    this.dialog.removeAttribute('aria-busy');
    this.dialog.classList.add('is-closing');
    this.closeTimer = window.setTimeout(() => {
      if (this.dialog.open) this.dialog.close();
    }, 260);
  }
}

class ProductCardVariants {
  constructor(card) {
    this.card = card;
    this.abortController = new AbortController();
    const { signal } = this.abortController;
    this.buttons = [...card.querySelectorAll('[data-product-card-variant]')];
    this.price = card.querySelector('[data-product-card-price]');
    this.currentPrice = card.querySelector('[data-product-card-current-price]');
    this.comparePrice = card.querySelector('[data-product-card-compare-price]');
    this.unitPrice = card.querySelector('[data-product-card-unit-price]');
    this.image = card.querySelector('.product-card__image');
    this.mediaLink = card.querySelector('.product-card__media-link');
    this.secondaryImage = card.querySelector('[data-product-card-secondary-image]');
    this.hoverMedia = window.matchMedia('(hover: hover) and (pointer: fine)');
    this.quickAdd = card.querySelector('[data-product-card-quick-add]');
    this.quickViewTriggers = [...card.querySelectorAll('[data-product-card-quick-view-open]')];
    this.quickViewPrimary = card.querySelector('[data-product-card-quick-view-primary]');
    this.updateQuickViewUrls(card.dataset.selectedVariantId);
    this.buttons.forEach((button) => button.addEventListener('click', () => this.select(button), { signal }));
    this.buttons.forEach((button) => {
      button.addEventListener('pointerenter', () => this.preload(button), { passive: true, signal });
      button.addEventListener('focus', () => this.preload(button), { signal });
      button.addEventListener('pointerdown', () => this.preload(button), { passive: true, signal });
    });
    this.mediaLink?.addEventListener('pointerenter', () => this.loadSecondaryImage(), { passive: true, signal });
    this.mediaLink?.addEventListener('focusin', () => this.loadSecondaryImage(), { signal });
    this.quickAdd?.addEventListener('click', (event) => {
      event.preventDefault();
      this.addSelectedVariant();
    }, { signal });
    this.preloadPrimaryAlternateWhenIdle();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.preloadObserver?.disconnect();
    this.preloadObserver = null;
    this.cancelIdlePreload?.();
    this.cancelIdlePreload = null;
    this.abortController?.abort();
    if (this.card?.productCardVariants === this) delete this.card.productCardVariants;
  }

  loadSecondaryImage() {
    const image = this.secondaryImage;
    if (!image || !this.hoverMedia.matches || image.dataset.secondaryLoaded === 'true') return;

    const src = image.dataset.secondarySrc;
    if (!src) return;

    if (image.dataset.secondarySrcset) image.srcset = image.dataset.secondarySrcset;
    if (image.dataset.secondarySizes) image.sizes = image.dataset.secondarySizes;
    image.src = src;
    image.dataset.secondaryLoaded = 'true';
  }

  preload(button) {
    return preloadVariantImage(
      button.dataset.variantImage,
      button.dataset.variantImageSrcset,
      button.dataset.variantImageSizes
    );
  }

  preloadPrimaryAlternateWhenIdle() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType)) return;

    const alternate = this.buttons.find((button) => !button.classList.contains('is-active'));
    if (!alternate) return;

    const preloadAlternate = () => {
      if (this.destroyed) return;
      if (window.requestIdleCallback) {
        const idleId = window.requestIdleCallback(() => {
          this.cancelIdlePreload = null;
          if (!this.destroyed && this.card.isConnected) this.preload(alternate);
        }, { timeout: 1600 });
        this.cancelIdlePreload = () => window.cancelIdleCallback(idleId);
      } else {
        const timeoutId = window.setTimeout(() => {
          this.cancelIdlePreload = null;
          if (!this.destroyed && this.card.isConnected) this.preload(alternate);
        }, 250);
        this.cancelIdlePreload = () => window.clearTimeout(timeoutId);
      }
    };

    if (!('IntersectionObserver' in window)) {
      if (document.readyState === 'complete') preloadAlternate();
      else window.addEventListener('load', preloadAlternate, { once: true, signal: this.abortController.signal });
      return;
    }

    this.preloadObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      this.preloadObserver.disconnect();
      this.preloadObserver = null;
      if (document.readyState === 'complete') preloadAlternate();
      else window.addEventListener('load', preloadAlternate, { once: true, signal: this.abortController.signal });
    });
    this.preloadObserver.observe(this.card);
  }

  select(button) {
    this.buttons.forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle('is-active', active);
      candidate.setAttribute('aria-pressed', String(active));
    });
    this.card.dataset.selectedVariantId = button.dataset.variantId || '';
    const purchaseAvailable = button.dataset.variantPurchaseAvailable === 'true';
    this.updateQuickViewUrls(button.dataset.variantId);
    const isOnSale = button.dataset.variantOnSale === 'true';
    if (this.currentPrice) this.currentPrice.textContent = button.dataset.variantPrice || '';
    if (this.unitPrice) {
      this.unitPrice.textContent = button.dataset.variantUnitPrice || '';
      this.unitPrice.hidden = !button.dataset.variantUnitPrice;
    }
    if (this.price) this.price.classList.toggle('product-card__price--sale', isOnSale);
    if (this.comparePrice) {
      this.comparePrice.textContent = button.dataset.variantComparePrice || '';
      this.comparePrice.hidden = !isOnSale;
    }
    if (this.image && button.dataset.variantImage) {
      const selectedVariantId = button.dataset.variantId;
      this.preload(button).then(() => {
        if (this.card.dataset.selectedVariantId !== selectedVariantId) return;
        this.image.srcset = button.dataset.variantImageSrcset || button.dataset.variantImage;
        this.image.sizes = button.dataset.variantImageSizes || this.image.sizes;
        this.image.src = button.dataset.variantImage;
        this.image.alt = button.dataset.variantImageAlt || this.image.alt;
        this.card.querySelector('.product-card__image--secondary')?.classList.add('is-hidden');
      });
    }
    if (this.quickAdd) this.quickAdd.disabled = button.dataset.variantId === '' || !purchaseAvailable;
    if (this.quickViewPrimary) this.quickViewPrimary.disabled = !purchaseAvailable;
  }

  updateQuickViewUrls(variantId) {
    if (!variantId || !this.card.dataset.productCardUrl || !this.quickViewTriggers.length) return;
    const variantUrl = new URL(this.card.dataset.productCardUrl, window.location.origin);
    variantUrl.searchParams.set('variant', variantId);
    const quickViewUrl = `${variantUrl.pathname}${variantUrl.search}${variantUrl.hash}`;
    this.quickViewTriggers.forEach((trigger) => {
      trigger.dataset.productCardQuickViewUrl = quickViewUrl;
    });
  }

  addSelectedVariant() {
    addVariantToCart(this.card.dataset.selectedVariantId, this.quickAdd, this.image).catch(() => {});
  }
}

const initializeProductCardVariants = (root = document) => {
  root.querySelectorAll('[data-product-card]').forEach((card) => {
    if (!card.productCardVariants) card.productCardVariants = new ProductCardVariants(card);
  });
};

const destroyProductCardVariants = (root) => {
  if (!(root instanceof Element)) return;
  const cards = root.matches('[data-product-card]')
    ? [root, ...root.querySelectorAll('[data-product-card]')]
    : [...root.querySelectorAll('[data-product-card]')];
  cards.forEach((card) => card.productCardVariants?.destroy());
};

const removedProductCardRoots = new Set();
let removalCleanupScheduled = false;
const productCardRemovalObserver = new MutationObserver((records) => {
  records.forEach((record) => record.removedNodes.forEach((node) => {
    if (node instanceof Element) removedProductCardRoots.add(node);
  }));
  if (removalCleanupScheduled || !removedProductCardRoots.size) return;
  removalCleanupScheduled = true;
  queueMicrotask(() => {
    removedProductCardRoots.forEach((root) => {
      if (!root.isConnected) destroyProductCardVariants(root);
    });
    removedProductCardRoots.clear();
    removalCleanupScheduled = false;
  });
});
productCardRemovalObserver.observe(document.documentElement, { childList: true, subtree: true });

const initializeProductCards = () => {
  window.SpinelQuickView ||= new QuickViewModal();
  initializeProductCardVariants();
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeProductCards, { once: true });
else initializeProductCards();

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-product-card-quick-view-open]');
  if (!trigger) return;
  event.preventDefault();
  window.SpinelQuickView ||= new QuickViewModal();
  window.SpinelQuickView.open(trigger.dataset.productCardQuickViewUrl, trigger);
});
document.addEventListener('shopify:section:load', (event) => initializeProductCardVariants(event.target));
document.addEventListener('shopify:section:unload', (event) => destroyProductCardVariants(event.target));
document.addEventListener('collection:products-loaded', (event) => {
  initializeProductCardVariants(event.target);
});
document.addEventListener('featured-collection:products-loaded', (event) => {
  initializeProductCardVariants(event.detail?.panel || event.target);
});
document.addEventListener('product-featured-collection:products-loaded', (event) => {
  initializeProductCardVariants(event.detail?.panel || event.target);
});
document.addEventListener('gift-spinel:products-loaded', (event) => {
  const panel = event.detail?.panel || event.target;
  initializeProductCardVariants(panel);
  panel.querySelectorAll('[data-product-card]').forEach((card) => {
    card.productCardVariants?.loadSecondaryImage();
  });
});
