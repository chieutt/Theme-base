import { A11y, Pagination, Swiper, Thumbs } from './swiper-loader.js';
import EffectFade from './swiper-12.2.0-effect-fade.min.mjs';
import './cart-feedback.js';

if (!window.__spinelProductEditorScrollGuard) {
  window.__spinelProductEditorScrollGuard = true;
  const sectionScrollPositions = new Map();
  const pendingScrollRestorations = new Map();
  const restoreScrollPosition = (scrollTop) => {
    const restore = () => window.scrollTo({ top: scrollTop, behavior: 'auto' });
    let frame = 0;
    const restoreAfterLayout = () => {
      restore();
      if (frame++ < 3) window.requestAnimationFrame(restoreAfterLayout);
    };
    restoreAfterLayout();
    window.setTimeout(restore, 100);
    window.setTimeout(restore, 300);
  };
  const scheduleScrollRestoration = (sectionId, scrollTop) => {
    pendingScrollRestorations.set(sectionId, scrollTop);
    restoreScrollPosition(scrollTop);
    window.setTimeout(() => {
      if (pendingScrollRestorations.get(sectionId) === scrollTop) pendingScrollRestorations.delete(sectionId);
    }, 1000);
  };
  const getProductPage = (target, sectionId) => {
    const matchesSection = (productPage) => (
      productPage && (!sectionId || productPage.dataset.sectionId === sectionId)
    );

    if (target instanceof Element) {
      if (target.matches('product-page') && matchesSection(target)) return target;
      const parentProductPage = target.closest('product-page');
      if (matchesSection(parentProductPage)) return parentProductPage;
      const productPage = Array.from(target.querySelectorAll('product-page')).find(matchesSection);
      if (productPage) return productPage;
    }
    return sectionId ? document.querySelector(`product-page[data-section-id="${CSS.escape(sectionId)}"]`) : null;
  };
  const getSectionId = (event, productPage) => event.detail?.sectionId || productPage?.dataset.sectionId;

  document.addEventListener('shopify:section:unload', (event) => {
    if (!window.Shopify?.designMode) return;
    const productPage = getProductPage(event.target, event.detail?.sectionId);
    if (!productPage) return;
    const sectionId = getSectionId(event, productPage);
    if (sectionId) sectionScrollPositions.set(sectionId, window.scrollY);
  }, true);

  document.addEventListener('shopify:section:load', (event) => {
    if (!window.Shopify?.designMode) return;
    const productPage = getProductPage(event.target, event.detail?.sectionId);
    if (!productPage) return;
    const sectionId = getSectionId(event, productPage);
    const scrollTop = sectionId ? sectionScrollPositions.get(sectionId) : undefined;
    if (!Number.isFinite(scrollTop)) return;
    sectionScrollPositions.delete(sectionId);
    scheduleScrollRestoration(sectionId, scrollTop);
  }, true);

  document.addEventListener('shopify:block:select', (event) => {
    if (!window.Shopify?.designMode) return;
    const sectionId = event.detail?.sectionId;
    const scrollTop = sectionId ? pendingScrollRestorations.get(sectionId) : undefined;
    if (!Number.isFinite(scrollTop)) return;
    window.requestAnimationFrame(() => restoreScrollPosition(scrollTop));
  }, true);

}

class ProductPage extends HTMLElement {
  connectedCallback() {
    this.abortController = new AbortController();
    this.signal = this.abortController.signal;
    this.sectionId = this.dataset.sectionId;
    this.form = this.querySelector('[data-product-form]') || this.querySelector('[data-payment-terms-form]');
    this.status = this.querySelector('[data-product-status]');
    this.inventoryWarning = this.querySelector('[data-product-inventory-warning]');
    this.productContext = this.dataset.productContext || 'product-page';
    this.variants = this.readJson('[data-product-variants]');
    this.media = this.readJson('[data-product-media]');
    this.variant = this.variants.find((variant) => String(variant.id) === this.form?.querySelector('input[name="id"]')?.value) || this.variants[0];
    this.bind();
    this.bindSizeChart();
    this.bindStickyCart();
    this.initializeGallery();
    this.initializeShopifyMedia();
    this.bindGalleryInteractions();
    this.bindGalleryResponsiveness();
    this.bindGalleryLifecycle();
    this.initializeExpandableContent();
    if (this.productContext !== 'quick-view') {
      this.initializeRecommendations();
      if (this.productContext === 'product-page') this.initializeRecentlyViewed();
    }
    this.updateOptionLabels();
    this.reconcileSellingPlans();
    this.updatePrice();
    if (this.variant?.featured_media?.id) this.showMedia(String(this.variant.featured_media.id));
    this.loadPickupAvailability();
    this.updateOptionAvailability();
    this.restoreQuantity();
    window.addEventListener('popstate', () => this.resolveFromUrl(), { signal: this.signal });
    this.dispatch('product:variant-change', { variant: this.variant, initial: true });
  }

  disconnectedCallback() {
    if (this.lightbox?.classList.contains('is-open')) this.closeLightbox();
    else document.documentElement.classList.remove('product-lightbox-open');
    this.productPanelDialogs?.forEach(({ dialog, backdropInteraction }) => {
      backdropInteraction?.destroy();
      dialog.remove();
    });
    this.productPanelDialogs = [];
    this.abortController?.abort();
    if (this.galleryMediaQuery?.removeListener && this.galleryMediaChange) this.galleryMediaQuery.removeListener(this.galleryMediaChange);
    if (this.galleryRefreshFrame) cancelAnimationFrame(this.galleryRefreshFrame);
    this.destroyGallery();
    this.lightboxSwiper?.destroy(true, true);
    this.lightboxSwiper = null;
    this.galleryObserver?.disconnect();
    this.galleryResizeObserver?.disconnect();
    this.stickyCartObserver?.disconnect();
    this.stickyCartFooterObserver?.disconnect();
    this.stickyCartResizeObserver?.disconnect();
    this.updateBackToTopClearance?.();
    document.removeEventListener('shopify:section:load', this.onSectionLoad);
  }

  readJson(selector) {
    try { return JSON.parse(this.querySelector(selector)?.textContent || '[]'); } catch { return []; }
  }

  bind() {
    this.querySelectorAll('[data-product-option]').forEach((input) => input.addEventListener('change', () => this.onOptionChange(), { signal: this.signal }));
    this.querySelectorAll('[data-selling-plan-option]').forEach((input) => input.addEventListener('change', () => this.onSellingPlanChange(), { signal: this.signal }));
    this.querySelectorAll('[data-quantity-increase], [data-quantity-decrease]').forEach((button) => button.addEventListener('click', () => this.changeQuantity(button.hasAttribute('data-quantity-increase') ? 1 : -1), { signal: this.signal }));
    this.querySelector('[data-quantity-input]')?.addEventListener('change', () => this.normalizeQuantity(), { signal: this.signal });
    this.form?.addEventListener('submit', (event) => this.addToCart(event), { signal: this.signal });
    this.bindGiftCardRecipientForm();
  }

  bindGiftCardRecipientForm() {
    this.recipientForm = this.querySelector('[data-gift-card-recipient-form]');
    if (!this.recipientForm) return;
    this.recipientToggle = this.recipientForm.querySelector('[data-gift-card-recipient-toggle]');
    this.recipientFields = this.recipientForm.querySelector('[data-gift-card-recipient-fields]');
    this.recipientEmail = this.recipientForm.querySelector('[data-gift-card-recipient-email]');
    this.recipientOffset = this.recipientForm.querySelector('[data-gift-card-recipient-offset]');
    this.recipientError = this.recipientForm.querySelector('[data-gift-card-recipient-error]');
    this.recipientToggle?.addEventListener('change', () => this.syncGiftCardRecipientForm(), { signal: this.signal });
    this.recipientForm.querySelectorAll('[data-gift-card-recipient-field]').forEach((field) => {
      field.addEventListener('input', () => this.setGiftCardRecipientError(''), { signal: this.signal });
    });
    this.syncGiftCardRecipientForm();
  }

  syncGiftCardRecipientForm() {
    if (!this.recipientForm || !this.recipientToggle) return;
    const enabled = this.recipientToggle.checked;
    this.recipientFields.hidden = !enabled;
    this.recipientForm.querySelectorAll('[data-gift-card-recipient-field]').forEach((field) => {
      field.disabled = !enabled;
    });
    if (this.recipientEmail) this.recipientEmail.required = enabled;
    if (this.recipientOffset) {
      this.recipientOffset.disabled = !enabled;
      this.recipientOffset.value = enabled ? String(new Date().getTimezoneOffset()) : '';
    }
    if (!enabled) this.setGiftCardRecipientError('');
  }

  validateGiftCardRecipientForm() {
    if (!this.recipientToggle?.checked || !this.recipientEmail) return true;
    if (this.recipientEmail.checkValidity()) return true;
    this.setGiftCardRecipientError(this.recipientEmail.validationMessage || this.dataset.addToCartError, true);
    this.recipientEmail.focus({ preventScroll: false });
    return false;
  }

  setGiftCardRecipientError(message, emailInvalid = false) {
    if (!this.recipientError) return;
    this.recipientError.textContent = message || '';
    this.recipientError.hidden = !message;
    this.recipientEmail?.toggleAttribute('aria-invalid', Boolean(message) && emailInvalid);
  }

  resetGiftCardRecipientForm() {
    if (!this.recipientForm) return;
    if (this.recipientToggle) this.recipientToggle.checked = false;
    this.recipientForm.querySelectorAll('[data-gift-card-recipient-field]').forEach((field) => {
      field.value = '';
    });
    this.recipientForm.removeAttribute('open');
    this.syncGiftCardRecipientForm();
  }

  bindSizeChart() {
    this.productPanelDialogs = [];
    this.querySelectorAll('[data-product-panel-dialog]').forEach((dialog) => this.bindProductPanelDialog(dialog));
  }

  bindProductPanelDialog(dialog) {
    document.body.append(dialog);
    const panel = dialog.querySelector('.product-size-chart__panel');
    const closeButton = dialog.querySelector('.product-size-chart__close');
    const handle = dialog.querySelector('[data-size-chart-handle]');
    const backdropPointer = dialog.querySelector('.product-size-chart__backdrop-pointer');
    const backdropInteraction = new window.SpinelModalBackdropPointer({
      root: dialog,
      panel,
      pointer: backdropPointer,
      isOpen: () => dialog.classList.contains('is-open'),
    });
    this.productPanelDialogs.push({ dialog, backdropInteraction });
    const mobileSizeChart = window.matchMedia('(max-width: 1149.98px)');
    let handleDrag = null;
    let handleDragTimer = null;
    let restoreTarget = null;
    const resetHandleDrag = () => {
      window.clearTimeout(handleDragTimer);
      handleDragTimer = null;
      if (handleDrag) {
        try { handle?.releasePointerCapture(handleDrag.pointerId); } catch (_) {}
      }
      handleDrag = null;
      panel?.classList.remove('is-handle-dragging', 'is-handle-settling', 'is-handle-closing');
      panel?.style.removeProperty('transform');
      panel?.style.removeProperty('opacity');
      panel?.style.removeProperty('transition');
    };
    const completeClose = () => {
      dialog.classList.remove('is-open', 'is-closing');
      dialog.setAttribute('aria-hidden', 'true');
      dialog.removeAttribute('scroll-lock');
      if (dialog.open) dialog.close();
      backdropInteraction.hide();
      resetHandleDrag();
      restoreTarget?.focus?.({ preventScroll: true });
    };
    const closeDialog = () => {
      if (!dialog.classList.contains('is-open') || dialog.classList.contains('is-closing')) return;
      resetHandleDrag();
      dialog.classList.add('is-closing');
      panel?.addEventListener('animationend', completeClose, { once: true, signal: this.signal });
    };
    const closeFromHandle = () => {
      if (!dialog.classList.contains('is-open') || dialog.classList.contains('is-closing')) return;
      dialog.classList.add('is-closing');
      panel?.classList.add('is-handle-closing');
      if (!panel) return;
      panel.style.opacity = '1';
      requestAnimationFrame(() => {
        panel.style.transform = `translate3d(0, ${Math.max(window.innerHeight, panel.offsetHeight + 60)}px, 0)`;
        panel.style.opacity = '0';
      });
      window.setTimeout(completeClose, 240);
    };
    const startHandleDrag = (event) => {
      if (!panel || !handle || !dialog.classList.contains('is-open') || !mobileSizeChart.matches || !event.isPrimary || event.button > 0 || dialog.classList.contains('is-closing')) return;
      window.clearTimeout(handleDragTimer);
      handleDrag = {
        pointerId: event.pointerId,
        startY: event.clientY,
        lastY: event.clientY,
        lastTime: performance.now(),
        velocity: 0,
        distance: 0
      };
      panel.classList.remove('is-handle-settling', 'is-handle-closing');
      panel.style.transform = 'translate3d(0, 0, 0)';
      panel.style.opacity = '1';
      panel.classList.add('is-handle-dragging');
      panel.style.removeProperty('transition');
      panel.style.removeProperty('opacity');
      try { handle.setPointerCapture(event.pointerId); } catch (_) {}
      event.preventDefault();
    };
    const moveHandleDrag = (event) => {
      if (!handleDrag || event.pointerId !== handleDrag.pointerId || !panel) return;
      const now = performance.now();
      const elapsed = Math.max(now - handleDrag.lastTime, 1);
      const movement = event.clientY - handleDrag.lastY;
      handleDrag.velocity = movement / elapsed;
      handleDrag.lastY = event.clientY;
      handleDrag.lastTime = now;
      handleDrag.distance = Math.max(0, event.clientY - handleDrag.startY);
      panel.style.transform = `translate3d(0, ${handleDrag.distance}px, 0)`;
      event.preventDefault();
    };
    const endHandleDrag = (event, cancelled = false) => {
      if (!handleDrag || event.pointerId !== handleDrag.pointerId || !panel) return;
      try { handle?.releasePointerCapture(event.pointerId); } catch (_) {}
      const closeDistance = Math.min(140, panel.getBoundingClientRect().height * 0.2);
      const shouldClose = !cancelled && (handleDrag.distance >= closeDistance || (handleDrag.distance >= 32 && handleDrag.velocity > 0.55));
      handleDrag = null;
      panel.classList.remove('is-handle-dragging');
      if (shouldClose) {
        closeFromHandle();
        return;
      }
      panel.classList.add('is-handle-settling');
      requestAnimationFrame(() => {
        panel.style.transform = 'translate3d(0, 0, 0)';
        panel.style.opacity = '1';
      });
    };
    if ('PointerEvent' in window) {
      handle?.addEventListener('pointerdown', startHandleDrag, { signal: this.signal });
      handle?.addEventListener('pointermove', moveHandleDrag, { signal: this.signal });
      handle?.addEventListener('pointerup', endHandleDrag, { signal: this.signal });
      handle?.addEventListener('pointercancel', (event) => endHandleDrag(event, true), { signal: this.signal });
    } else {
      const touchEvent = (event, callback) => {
        const touch = Array.from(event.changedTouches).find((candidate) => candidate.identifier === handleDrag?.pointerId) || event.changedTouches[0];
        if (!touch) return;
        callback({
          isPrimary: true,
          button: 0,
          pointerId: touch.identifier,
          clientY: touch.clientY,
          preventDefault: () => event.preventDefault()
        });
      };
      handle?.addEventListener('touchstart', (event) => touchEvent(event, startHandleDrag), { passive: false, signal: this.signal });
      handle?.addEventListener('touchmove', (event) => touchEvent(event, moveHandleDrag), { passive: false, signal: this.signal });
      handle?.addEventListener('touchend', (event) => touchEvent(event, endHandleDrag), { signal: this.signal });
      handle?.addEventListener('touchcancel', (event) => touchEvent(event, (touch) => endHandleDrag(touch, true)), { signal: this.signal });
    }
    this.querySelectorAll('[data-product-panel-open]').forEach((button) => {
      if (button.getAttribute('aria-controls') !== dialog.id) return;
      button.addEventListener('click', () => {
        if (!dialog.classList.contains('is-open')) {
          restoreTarget = button;
          resetHandleDrag();
          dialog.classList.remove('is-closing');
          if (!dialog.open) dialog.showModal();
          dialog.classList.add('is-open');
          dialog.setAttribute('aria-hidden', 'false');
          dialog.setAttribute('scroll-lock', '');
          closeButton?.focus({ preventScroll: true });
        }
      }, { signal: this.signal });
    });
    dialog.querySelectorAll('[data-product-panel-close]').forEach((button) => {
      button.addEventListener('click', closeDialog, { signal: this.signal });
    });
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDialog();
    }, { signal: this.signal });
    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog();
      }
      if (event.key === 'Tab') {
        const focusable = [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
          .filter((element) => element.getClientRects().length);
        if (!focusable.length) {
          event.preventDefault();
          dialog.focus({ preventScroll: true });
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (event.target === first || !dialog.contains(event.target))) {
          event.preventDefault();
          last.focus({ preventScroll: true });
        } else if (!event.shiftKey && (event.target === last || !dialog.contains(event.target))) {
          event.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    }, { signal: this.signal });
  }

  bindStickyCart() {
    const sticky = this.querySelector('[data-sticky-cart]');
    const buyButtons = this.querySelector('[data-product-buy-buttons]');
    if (!sticky || !buyButtons) return;
    const stickyButton = sticky.querySelector('[data-sticky-cart-add]');
    stickyButton?.addEventListener('click', (event) => {
      event.preventDefault();
      if (stickyButton.disabled) return;
      this.addToCart(event, stickyButton);
    }, { signal: this.signal });
    this.stickyCartPassedBuyButtons = false;
    this.stickyCartFooterVisible = false;
    this.updateBackToTopClearance = () => {
      const visibleStickyCart = document.querySelector('[data-sticky-cart].is-visible');
      if (!visibleStickyCart) {
        document.documentElement.style.removeProperty('--sticky-cart-clearance');
        return;
      }
      const clearance = Math.ceil(visibleStickyCart.getBoundingClientRect().height) + 16;
      document.documentElement.style.setProperty('--sticky-cart-clearance', `${clearance}px`);
    };
    const updateStickyCartVisibility = () => {
      const shouldShow = this.stickyCartPassedBuyButtons && !this.stickyCartFooterVisible;
      sticky.classList.toggle('is-visible', shouldShow);
      sticky.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
      this.updateBackToTopClearance();
    };
    this.stickyCartResizeObserver = new ResizeObserver(this.updateBackToTopClearance);
    this.stickyCartResizeObserver.observe(sticky);
    this.stickyCartObserver = new IntersectionObserver(([entry]) => {
      this.stickyCartPassedBuyButtons = !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
      updateStickyCartVisibility();
    }, { threshold: 0.01 });
    this.stickyCartObserver.observe(buyButtons);
    const footer = document.querySelector('footer.footer');
    if (footer) {
      this.stickyCartFooterObserver = new IntersectionObserver(([entry]) => {
        this.stickyCartFooterVisible = entry.isIntersecting;
        updateStickyCartVisibility();
      }, { threshold: 0.01 });
      this.stickyCartFooterObserver.observe(footer);
    }
  }

  getGalleryMode() {
    const gallery = this.querySelector('[data-product-gallery]');
    if (!gallery) return null;
    if (this.galleryMediaQuery?.matches ?? window.matchMedia('(max-width: 1149.98px)').matches) return 'mobile';
    return gallery.classList.contains('product-gallery--carousel') ? 'desktop' : null;
  }

  getActiveMediaId() {
    return this.mainGallery?.slides[this.mainGallery.activeIndex]?.dataset.mediaId || null;
  }

  destroyGallery() {
    this.mainGallery?.destroy(true, true);
    this.thumbnailGallery?.destroy(true, true);
    this.mainGallery = null;
    this.thumbnailGallery = null;
    this.galleryMode = null;
  }

  updateQuickViewGalleryPagination() {
    if (!this.classList.contains('quick-view-product') || !this.mainGallery) return;
    const current = this.querySelector('[data-quick-view-gallery-current]');
    const total = this.querySelector('[data-quick-view-gallery-total]');
    if (!current || !total) return;

    const slideCount = this.mainGallery.slides.length;
    current.textContent = String(this.mainGallery.realIndex + 1).padStart(2, '0');
    total.textContent = String(slideCount).padStart(2, '0');
  }

  initializeShopifyMedia() {
    const modelViewers = this.querySelectorAll('model-viewer');
    const modelData = this.querySelector('[data-shopify-models]');
    if (!modelViewers.length || !window.Shopify?.loadFeatures) return;
    const setupShopifyXr = () => {
      if (!modelData?.textContent) return;
      if (!window.ShopifyXR?.addModels) {
        document.addEventListener('shopify_xr_initialized', setupShopifyXr, { once: true });
        return;
      }
      try {
        window.ShopifyXR.addModels(JSON.parse(modelData.textContent));
        window.ShopifyXR.setupXRElements?.();
      } catch (parseError) {
        console.warn('[Spinel] Unable to initialize Shopify XR models.', parseError);
      }
    };

    window.Shopify.loadFeatures([
      {
        name: 'model-viewer-ui',
        version: '1.0',
        onLoad: (error) => {
          if (error || !window.Shopify?.ModelViewerUI) return;
          modelViewers.forEach((modelViewer) => {
            if (modelViewer.dataset.modelViewerUiInitialized === 'true') return;
            new window.Shopify.ModelViewerUI(modelViewer);
            modelViewer.dataset.modelViewerUiInitialized = 'true';
          });
        }
      },
      {
        name: 'shopify-xr',
        version: '1.0',
        onLoad: (error) => {
          if (!error) setupShopifyXr();
        }
      }
    ]);
  }

  initializeGallery(preferredMediaId = null) {
    const mode = this.getGalleryMode();
    const isMobile = mode === 'mobile';
    const gallery = this.querySelector('[data-product-gallery]');
    const main = this.querySelector('[data-product-main-gallery]');
    if (!main || !mode) return;
    if (this.mainGallery && this.galleryMode === mode) {
      this.thumbnailGallery?.update();
      this.mainGallery.update();
      return;
    }

    this.destroyGallery();
    this.galleryMode = mode;
    const thumbnail = this.querySelector('[data-product-thumbnail-gallery]');
    const thumbnailGap = Number.parseInt(getComputedStyle(this).getPropertyValue('--gallery-thumbnail-gap'), 10) || 8;
    const shouldLoop = main.querySelectorAll('.swiper-slide').length > 1;
    const showPagination = isMobile || gallery.classList.contains('product-gallery--quick-view');

    // Follow Swiper's Thumbs Gallery pattern: create the thumbnail instance first,
    // then pass that live instance into the main gallery.
    if (thumbnail) {
      this.thumbnailGallery = new Swiper(thumbnail, {
        modules: [A11y],
        slidesPerView: 'auto',
        spaceBetween: thumbnailGap,
        direction: !isMobile && gallery.classList.contains('product-gallery--thumbs-left') ? 'vertical' : 'horizontal',
        loop: false,
        watchSlidesProgress: true,
        slideToClickedSlide: true,
        a11y: { enabled: true },
      });
    }

    this.mainGallery = new Swiper(main, {
      modules: showPagination ? [A11y, Pagination, Thumbs] : [A11y, Thumbs],
      slidesPerView: 1,
      speed: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300,
      simulateTouch: true,
      allowTouchMove: true,
      loop: shouldLoop,
      ...(showPagination ? { pagination: { el: this.querySelector('[data-product-gallery-pagination]'), clickable: true } } : {}),
      ...(this.thumbnailGallery ? { thumbs: { swiper: this.thumbnailGallery, autoScrollOffset: 1 } } : {}),
      a11y: { enabled: true },
    });
    this.mainGallery.on('slideChange', () => {
      const slide = this.mainGallery.slides[this.mainGallery.activeIndex];
      const mediaId = slide?.dataset.mediaId;
      this.dispatch('product:media-change', { mediaId });
      this.updateQuickViewGalleryPagination();
    });
    this.updateQuickViewGalleryPagination();
    if (preferredMediaId) this.showMedia(preferredMediaId, true);
  }

bindGalleryInteractions() {
  if (this.galleryInteractionsBound) return;
  this.galleryInteractionsBound = true;

  this.addEventListener('click', (event) => {
    const close = event.target.closest('[data-lightbox-close]');
    if (close) {
      this.closeLightbox();
      return;
    }


    const lightboxSlide = event.target.closest('[data-lightbox-slide]');
    if (lightboxSlide?.classList.contains('is-active')) {
      if (this.lightboxSuppressClick) {
        this.lightboxSuppressClick = false;
        return;
      }
      this.toggleLightboxZoom(lightboxSlide);
      return;
    }

    const media = event.target.closest('[data-product-media][data-zoom-mode]');
    if (!media || !this.contains(media)) return;
    const mode = media.dataset.zoomMode;
    if (mode === 'open_lightbox') this.openLightbox(media.dataset.mediaId, media);
    if (mode === 'click_hover') media.classList.toggle('is-zoomed');
  }, { signal: this.signal });

this.addEventListener('pointerdown', (event) => {
  const slide = event.target.closest('[data-lightbox-slide].is-active.is-zoomed');
  if (!slide || event.button !== 0) return;
  const panX = Number(slide.dataset.panX || 0);
  const panY = Number(slide.dataset.panY || 0);
  this.lightboxDrag = {
    slide,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    panX,
    panY,
    moved: false,
  };
  slide.classList.add('is-dragging');
  slide.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}, { signal: this.signal });

  this.addEventListener('pointermove', (event) => {
    if (this.lightboxDrag?.pointerId === event.pointerId) {
      const drag = this.lightboxDrag;
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      const { minX, maxX, minY, maxY } = this.getLightboxPanBounds(drag.slide);
      const resist = (value, min, max) => {
        if (value > max) return max + (value - max) * 0.25;
        if (value < min) return min + (value - min) * 0.25;
        return value;
      };
      const panX = resist(drag.panX + deltaX, minX, maxX);
      const panY = resist(drag.panY + deltaY, minY, maxY);
      this.setLightboxPan(drag.slide, panX, panY);
      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) drag.moved = true;
      event.preventDefault();
      return;
    }

    const media = event.target.closest('[data-product-media][data-zoom-mode="click_hover"]');
    if (!media || !media.classList.contains('is-zoomed')) return;
    const bounds = media.getBoundingClientRect();
    media.style.setProperty('--zoom-x', String(Math.round(((event.clientX - bounds.left) / bounds.width) * 100)) + '%');
    media.style.setProperty('--zoom-y', String(Math.round(((event.clientY - bounds.top) / bounds.height) * 100)) + '%');
  }, { signal: this.signal });

this.addEventListener('pointerup', (event) => this.finishLightboxDrag(event), { signal: this.signal });
this.addEventListener('pointercancel', (event) => this.finishLightboxDrag(event), { signal: this.signal });

  this.addEventListener('keydown', (event) => {
    const lightboxSlide = event.target.closest('[data-lightbox-slide]');
    if (lightboxSlide?.classList.contains('is-active') && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      this.toggleLightboxZoom(lightboxSlide);
      return;
    }

    const media = event.target.closest('[data-product-media][data-zoom-mode]');
    if (media && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      const mode = media.dataset.zoomMode;
      if (mode === 'open_lightbox') this.openLightbox(media.dataset.mediaId, media);
      if (mode === 'click_hover') media.classList.toggle('is-zoomed');
      return;
    }

    if (!this.lightbox?.classList.contains('is-open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeLightbox();
      return;
    }
    if (event.key === 'ArrowLeft') this.changeLightboxSlide(-1);
    if (event.key === 'ArrowRight') this.changeLightboxSlide(1);
    if (event.key === 'Tab') {
      const focusable = [...this.lightbox.querySelectorAll('button:not([disabled]), [tabindex="0"]')]
        .filter((element) => element.getClientRects().length);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (event.target === first || !this.lightbox.contains(event.target))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (event.target === last || !this.lightbox.contains(event.target))) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }
  }, { signal: this.signal });
}

getLightboxPanBounds(slide) {
  const zoomWidth = Number(slide?.dataset.zoomWidth || 0);
  const zoomHeight = Number(slide?.dataset.zoomHeight || 0);
  const viewportWidth = slide?.clientWidth || 0;
  const viewportHeight = slide?.clientHeight || 0;
  return {
    minX: Math.min(0, viewportWidth - zoomWidth),
    maxX: 0,
    minY: Math.min(0, viewportHeight - zoomHeight),
    maxY: 0,
  };
}

setLightboxPan(slide, x, y) {
  if (!slide) return;
  slide.dataset.panX = String(x);
  slide.dataset.panY = String(y);
  const image = slide.querySelector('img');
  if (image) image.style.transform = `translate3d(${x}px, ${y}px, 0px) scale3d(1, 1, 1)`;
}

prepareLightboxZoom(slide) {
  const image = slide?.querySelector('img');
  if (!slide || !image) return;
  image.loading = 'eager';
  const viewportWidth = slide.clientWidth || window.innerWidth;
  const viewportHeight = slide.clientHeight || window.innerHeight;
  const sourceWidth = image.naturalWidth || Number(image.getAttribute('width')) || viewportWidth;
  const sourceHeight = image.naturalHeight || Number(image.getAttribute('height')) || viewportHeight;
  const minimumScale = Math.max(viewportWidth / sourceWidth, viewportHeight / sourceHeight, 1);
  const zoomWidth = Math.round(sourceWidth * minimumScale);
  const zoomHeight = Math.round(sourceHeight * minimumScale);
  slide.dataset.zoomWidth = String(zoomWidth);
  slide.dataset.zoomHeight = String(zoomHeight);
  slide.style.setProperty('--lightbox-zoom-width', String(zoomWidth) + 'px');
  slide.style.setProperty('--lightbox-zoom-height', String(zoomHeight) + 'px');
  image.style.transformOrigin = '0px 0px';
  const { minX, maxX, minY, maxY } = this.getLightboxPanBounds(slide);
  this.setLightboxPan(slide, (minX + maxX) / 2, (minY + maxY) / 2);
  if (!image.complete) {
    image.addEventListener('load', () => {
      if (slide.classList.contains('is-zoomed')) this.prepareLightboxZoom(slide);
    }, { once: true, signal: this.signal });
  }
}

clampLightboxPan(slide) {
  if (!slide) return;
  const { minX, maxX, minY, maxY } = this.getLightboxPanBounds(slide);
  const panX = Math.max(minX, Math.min(maxX, Number(slide.dataset.panX || 0)));
  const panY = Math.max(minY, Math.min(maxY, Number(slide.dataset.panY || 0)));
  this.setLightboxPan(slide, panX, panY);
}

finishLightboxDrag(event) {
  const drag = this.lightboxDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  drag.slide.classList.remove('is-dragging');
  drag.slide.querySelector('img')?.getBoundingClientRect();
  this.clampLightboxPan(drag.slide);
  drag.slide.releasePointerCapture?.(event.pointerId);
  this.lightboxSuppressClick = drag.moved && event.type === 'pointerup';
  if (this.lightboxSuppressClick) {
    window.setTimeout(() => { this.lightboxSuppressClick = false; }, 0);
  }
  this.lightboxDrag = null;
}

resetLightboxPan(slide) {
  this.setLightboxPan(slide, 0, 0);
}

clearLightboxZoom(slide) {
  if (!slide) return;
  slide.classList.remove('is-zoomed', 'is-dragging');
  slide.removeAttribute('data-zoom-width');
  slide.removeAttribute('data-zoom-height');
  slide.style.removeProperty('--lightbox-zoom-width');
  slide.style.removeProperty('--lightbox-zoom-height');
  this.resetLightboxPan(slide);
  const image = slide.querySelector('img');
  image?.style.removeProperty('transform');
  image?.style.removeProperty('transform-origin');
}

toggleLightboxZoom(slide) {
  const zoomed = slide.classList.toggle('is-zoomed');
  if (zoomed) this.prepareLightboxZoom(slide);
  else this.clearLightboxZoom(slide);
  if (this.lightboxSwiper) this.lightboxSwiper.allowTouchMove = !zoomed;
}

initializeLightboxSwiper() {
  const lightbox = this.getLightbox();
  const viewport = lightbox?.querySelector('[data-lightbox-swiper]');
  if (!viewport) return null;
  if (this.lightboxSwiper?.el === viewport && !this.lightboxSwiper.destroyed) {
    this.lightboxSwiper.update();
    return this.lightboxSwiper;
  }
  this.lightboxSwiper?.destroy(true, true);
  const slideCount = viewport.querySelectorAll("[data-lightbox-slide]").length;
  this.lightboxSwiper = new Swiper(viewport, {
    modules: [A11y, EffectFade],
    effect: 'fade',
    fadeEffect: { crossFade: true },
    slidesPerView: 1,
    initialSlide: this.lightboxIndex || 0,
    speed: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280,
    rewind: slideCount > 1,
    allowTouchMove: true,
    simulateTouch: true,
    observer: true,
    observeParents: true,
    a11y: { enabled: true },
  });
  const bindNavigationButton = (selector, direction) => {
    const button = lightbox.querySelector(selector);
    if (!button) return;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const swiper = this.lightboxSwiper;
      if (!swiper || swiper.destroyed) return;
      const targetIndex = (swiper.realIndex + direction + slideCount) % slideCount;
      if (swiper.params.loop) swiper.slideToLoop(targetIndex, swiper.params.speed, true);
      else swiper.slideTo(targetIndex, swiper.params.speed, true);
    }, { signal: this.signal });
  };
  bindNavigationButton('[data-lightbox-next]', 1);
  bindNavigationButton('[data-lightbox-previous]', -1);
  this.lightboxSwiper.on('slideChange', () => {
    this.lightboxIndex = this.lightboxSwiper.realIndex;
    this.updateLightbox();
  });
  return this.lightboxSwiper;
}

getLightbox() {
  if (!this.lightbox || !this.contains(this.lightbox)) this.lightbox = this.querySelector('[data-product-lightbox]');
  return this.lightbox;
}

updateLightbox() {
  const lightbox = this.getLightbox();
  if (!lightbox) return;
  const slides = [...lightbox.querySelectorAll('[data-lightbox-slide]')];
  if (!slides.length) return;
  const swiper = this.lightboxSwiper && !this.lightboxSwiper.destroyed ? this.lightboxSwiper : null;
  const totalSlides = new Set(slides.map((slide) => slide.dataset.mediaId)).size;
  const activeSlide = swiper?.slides?.[swiper.activeIndex] || slides[this.lightboxIndex || 0];
  const activeIndex = swiper?.realIndex ?? this.lightboxIndex ?? 0;
  this.lightboxIndex = (activeIndex + totalSlides) % totalSlides;
  slides.forEach((slide) => {
    const active = slide === activeSlide;
    slide.classList.toggle('is-active', active);
    slide.tabIndex = active ? 0 : -1;
    if (!active) {
      this.clearLightboxZoom(slide);
    }
  });
  const current = lightbox.querySelector('[data-lightbox-current]');
  const total = lightbox.querySelector('[data-lightbox-total]');
  if (current) current.textContent = String(this.lightboxIndex + 1);
  if (total) total.textContent = String(totalSlides);
  if (swiper) swiper.allowTouchMove = !activeSlide?.classList.contains('is-zoomed');
}

openLightbox(mediaId, restoreTarget = null) {
  const lightbox = this.getLightbox();
  if (!lightbox) return;
  const slides = [...lightbox.querySelectorAll('[data-lightbox-slide]')];
  const matchingSlide = slides.find((slide) => String(slide.dataset.mediaId) === String(mediaId));
  const mediaIndex = Number(matchingSlide?.dataset.lightboxIndex);
  this.lightboxIndex = Number.isFinite(mediaIndex) ? mediaIndex : 0;
  this.lightboxRestoreTarget = restoreTarget || document.activeElement;
  slides.forEach((slide) => this.clearLightboxZoom(slide));
  lightbox.classList.add('is-open');
  lightbox.setAttribute('scroll-lock', '');
  lightbox.setAttribute('aria-hidden', 'false');
  lightbox.removeAttribute('inert');
  document.documentElement.classList.add('product-lightbox-open');
  const swiper = this.initializeLightboxSwiper();
  swiper?.update();
  const targetIndex = swiper?.params.loop ? swiper.getSlideIndexByData(this.lightboxIndex) : this.lightboxIndex;
  if (swiper && Number.isFinite(targetIndex)) swiper.slideTo(targetIndex, 0, false);
  this.updateLightbox();
  lightbox.querySelector('.product-lightbox__close')?.focus({ preventScroll: true });
}

closeLightbox() {
  const lightbox = this.getLightbox();
  if (!lightbox?.classList.contains('is-open')) return;
  lightbox.classList.remove('is-open');
  lightbox.removeAttribute('scroll-lock');
  lightbox.querySelectorAll('[data-lightbox-slide]').forEach((slide) => {
    this.clearLightboxZoom(slide);
  });
  lightbox.setAttribute('aria-hidden', 'true');
  lightbox.setAttribute('inert', '');
  document.documentElement.classList.remove('product-lightbox-open');
  this.lightboxRestoreTarget?.focus?.({ preventScroll: true });
}

changeLightboxSlide(delta) {
  const lightbox = this.getLightbox();
  if (!lightbox?.classList.contains('is-open')) return;
  if (this.lightboxSwiper && !this.lightboxSwiper.destroyed) {
    if (delta > 0) this.lightboxSwiper.slideNext();
    else this.lightboxSwiper.slidePrev();
    return;
  }
  this.lightboxIndex += delta;
  this.updateLightbox();
}

  bindGalleryResponsiveness() {
    this.galleryMediaQuery = window.matchMedia('(max-width: 1149.98px)');
    this.galleryMediaChange = () => this.refreshGallery(true);
    if (this.galleryMediaQuery.addEventListener) this.galleryMediaQuery.addEventListener('change', this.galleryMediaChange, { signal: this.signal });
    else this.galleryMediaQuery.addListener(this.galleryMediaChange);
  }

  bindGalleryLifecycle() {
    this.galleryNode = this.querySelector('[data-product-gallery]');
    this.gallerySignature = this.galleryNode?.className || '';
    this.refreshGallery = this.refreshGallery.bind(this);
    this.onSectionLoad = (event) => {
      if (event.target === this || event.target?.contains(this)) this.refreshGallery(true);
    };
    document.addEventListener('shopify:section:load', this.onSectionLoad);
    this.galleryObserver = new MutationObserver(() => this.refreshGallery());
    this.galleryObserver.observe(this, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    if ('ResizeObserver' in window && this.galleryNode) {
      this.galleryResizeObserver = new ResizeObserver(() => {
        if (this.getGalleryMode() !== this.galleryMode) this.refreshGallery(true);
        else {
          this.thumbnailGallery?.update();
          this.mainGallery?.update();
        }
      });
      this.galleryResizeObserver.observe(this.galleryNode);
    }
  }

  refreshGallery(force = false) {
    const gallery = this.querySelector('[data-product-gallery]');
    const signature = gallery?.className || '';
    if (!force && gallery === this.galleryNode && signature === this.gallerySignature) return;
    if (this.galleryRefreshFrame) cancelAnimationFrame(this.galleryRefreshFrame);
    // Theme Editor changes markup and preview dimensions in separate frames. Waiting
    // for two paints ensures Swiper measures the active breakpoint, not the previous one.
    this.galleryRefreshFrame = requestAnimationFrame(() => {
      this.galleryRefreshFrame = requestAnimationFrame(() => {
        this.galleryRefreshFrame = null;
        const nextGallery = this.querySelector('[data-product-gallery]');
        const nextSignature = nextGallery?.className || '';
        if (!force && nextGallery === this.galleryNode && nextSignature === this.gallerySignature) return;
        const activeMediaId = this.getActiveMediaId();
        this.destroyGallery();
        this.galleryResizeObserver?.disconnect();
        this.galleryNode = nextGallery;
        this.gallerySignature = nextSignature;
        if ('ResizeObserver' in window && nextGallery) {
          this.galleryResizeObserver = new ResizeObserver(() => {
            if (this.getGalleryMode() !== this.galleryMode) this.refreshGallery(true);
            else {
              this.thumbnailGallery?.update();
              this.mainGallery?.update();
            }
          });
          this.galleryResizeObserver.observe(nextGallery);
        }
        this.initializeGallery(activeMediaId || this.variant?.featured_media?.id ? String(activeMediaId || this.variant?.featured_media?.id) : null);
      });
    });
  }

  initializeExpandableContent() {
    this.querySelectorAll('[data-expandable-content]').forEach((content) => {
      const expandable = content.closest('[data-expandable]');
      const toggle = expandable?.querySelector('[data-expandable-toggle]');
      const update = () => {
        const maxHeight = Number(content.dataset.maxHeight || 240);
        const isOverflowing = content.scrollHeight > maxHeight + 1;
        expandable?.classList.toggle('is-overflowing', isOverflowing);
        if (toggle) {
          toggle.hidden = !isOverflowing;
          if (!isOverflowing) {
            content.classList.remove('is-expanded');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.textContent = toggle.dataset.viewMoreLabel;
          }
        }
      };
      toggle?.addEventListener('click', () => {
        const expanded = content.classList.toggle('is-expanded');
        toggle.setAttribute('aria-expanded', String(expanded));
        toggle.textContent = expanded ? toggle.dataset.viewLessLabel : toggle.dataset.viewMoreLabel;
      }, { signal: this.signal });
      if (expandable?.matches('details')) expandable.addEventListener('toggle', update, { signal: this.signal });
      requestAnimationFrame(update);
    });
  }

  async initializeRecommendations() {
    const targets = this.querySelectorAll('[data-product-recommendations][data-url], [data-complementary-recommendations][data-url]');
    for (const target of targets) {
      const isDesignMode = target.dataset.designMode === 'true' || Boolean(window.Shopify?.designMode);
      try {
        const response = await fetch(target.dataset.url, { signal: this.signal, headers: { Accept: 'text/html' } });
        if (!response.ok) throw new Error('Recommendations unavailable');
        const template = document.createElement('template');
        template.innerHTML = await response.text();
        const source = template.content.querySelector('[data-recommendation-source]');
        const list = source?.querySelector('ul');
        if (list?.querySelector('li')) {
          target.querySelector('[data-recommendation-list]')?.replaceWith(list);
          target.hidden = false;
          target.removeAttribute('aria-busy');
          window.ThemeAnimations?.refresh(target);
        }
        else if (isDesignMode) {
          target.hidden = false;
          target.removeAttribute('aria-busy');
        } else {
          target.remove();
        }
      } catch (error) {
        if (error.name === 'AbortError') continue;
        if (isDesignMode) {
          target.hidden = false;
          target.removeAttribute('aria-busy');
        } else {
          target.remove();
        }
      }
    }
  }

  async initializeRecentlyViewed() {
    const section = document.querySelector('[data-recently-viewed]');
    const handle = this.dataset.productHandle;
    if (!handle) return;
    const storageKey = 'spinel:recently-viewed';
    let handles = [];
    try {
      const storedHandles = JSON.parse(localStorage.getItem(storageKey) || '[]');
      handles = Array.isArray(storedHandles) ? storedHandles : [];
    } catch { handles = []; }
    handles = [handle, ...handles.filter((item) => item !== handle)].slice(0, 6);
    try { localStorage.setItem(storageKey, JSON.stringify(handles)); } catch { return; }
    if (!section) return;
    const routeRoot = window.Shopify?.routes?.root || '/';
    const normalizedRoot = routeRoot.endsWith('/') ? routeRoot : `${routeRoot}/`;
    const products = await Promise.all(handles.slice(1, Number(section.dataset.limit || 4) + 1).map(async (item) => {
      try {
        const response = await fetch(`${normalizedRoot}products/${encodeURIComponent(item)}.js`, { headers: { Accept: 'application/json' }, signal: this.signal });
        return response.ok ? response.json() : null;
      } catch { return null; }
    }));
    const visible = products.filter(Boolean);
    if (!visible.length) return;
    const list = section.querySelector('[data-recently-viewed-list]');
    if (!list) return;
    list.replaceChildren(...visible.map((product) => {
      const item = document.createElement('article');
      item.className = 'recently-viewed-products__item';
      const reveal = document.createElement('div');
      reveal.className = 'recently-viewed-products__item-reveal';
      reveal.dataset.revealItem = '';
      reveal.style.setProperty('--reveal-order', String(visible.indexOf(product)));
      const imageLink = document.createElement('a');
      imageLink.className = 'recently-viewed-products__image';
      imageLink.href = product.url;
      const image = document.createElement('img');
      image.src = product.featured_image || '';
      image.alt = product.title;
      image.loading = 'lazy';
      imageLink.append(image);
      const heading = document.createElement('h3');
      heading.className = 'heading-h3 heading-text';
      const titleLink = document.createElement('a');
      titleLink.href = product.url;
      titleLink.textContent = product.title;
      const price = document.createElement('span');
      price.textContent = this.formatPrice(product.price);
      heading.append(titleLink, price);
      reveal.append(imageLink, heading);
      item.append(reveal);
      return item;
    }));
    section.hidden = false;
    window.ThemeAnimations?.refresh(section);
  }

  onOptionChange() {
    const options = this.selectedOptions();
    const variant = this.variants.find((item) => item.options.every((value, index) => value === options[index]));
    this.updateOptionLabels();
    this.dispatch('product:option-change', { options, variant });
    this.updateOptionAvailability();
    if (variant) this.applyVariant(variant);
    else {
      this.variant = null;
      this.updateVariantState();
    }
  }

  selectedOptions() {
    return [...this.querySelectorAll('fieldset[data-option-position]')].map((group) => {
      const select = group.querySelector('select[data-product-option]');
      return select?.value || group.querySelector('input[data-product-option]:checked')?.value || '';
    });
  }

  updateOptionLabels() {
    this.querySelectorAll('fieldset[data-option-position]').forEach((group) => {
      const label = group.querySelector('[data-option-label]');
      const select = group.querySelector('select[data-product-option]');
      const selected = select || group.querySelector('input[data-product-option]:checked');
      if (label && selected) label.textContent = selected.value;
    });
  }

  updateOptionAvailability() {
    const selected = this.selectedOptions();
    this.querySelectorAll('fieldset[data-option-position]').forEach((group) => {
      const position = Number(group.dataset.optionPosition) - 1;
      const isPossible = (optionValue) => this.variants.some((variant) => variant.available && variant.options[position] === optionValue && variant.options.every((value, index) => index === position || !selected[index] || value === selected[index]));
      const select = group.querySelector('select[data-product-option]');
      if (select) {
        [...select.options].forEach((option) => { option.disabled = !isPossible(option.value) && !option.selected; });
        return;
      }
      group.querySelectorAll('input[data-product-option]').forEach((input) => {
        input.disabled = !isPossible(input.value) && !input.checked;
      });
    });
  }

  sellingPlanIdForAllocation(allocation) {
    return String(allocation?.selling_plan_id || allocation?.selling_plan?.id || '');
  }

  sellingPlanAllocations() {
    return Array.isArray(this.variant?.selling_plan_allocations) ? this.variant.selling_plan_allocations : [];
  }

  selectedSellingPlanId() {
    return this.querySelector('[data-selling-plan-option]:checked')?.value || '';
  }

  selectedSellingPlanAllocation() {
    const sellingPlanId = this.selectedSellingPlanId();
    if (!sellingPlanId) return null;
    return this.sellingPlanAllocations().find((allocation) => this.sellingPlanIdForAllocation(allocation) === String(sellingPlanId)) || null;
  }

  reconcileSellingPlans(preferredPlanId) {
    const picker = this.querySelector('[data-selling-plan-picker]');
    if (!picker) return null;
    const allocations = this.sellingPlanAllocations();
    const availablePlanIds = new Set(allocations.map((allocation) => this.sellingPlanIdForAllocation(allocation)).filter(Boolean));
    const inputs = [...picker.querySelectorAll('[data-selling-plan-option]')];
    const requiresSellingPlan = Boolean(this.variant?.requires_selling_plan);

    inputs.forEach((input) => {
      const available = input.hasAttribute('data-selling-plan-one-time')
        ? !requiresSellingPlan
        : availablePlanIds.has(input.value);
      input.disabled = !available;
      const row = input.closest('[data-selling-plan-option-row]');
      if (row) row.hidden = !available;
    });

    let nextPlanId = preferredPlanId === undefined ? this.selectedSellingPlanId() : String(preferredPlanId || '');
    if (nextPlanId && !availablePlanIds.has(nextPlanId)) nextPlanId = '';
    if (!nextPlanId && requiresSellingPlan) nextPlanId = this.sellingPlanIdForAllocation(allocations[0]);

    const nextInput = inputs.find((input) => !input.disabled && input.value === nextPlanId);
    inputs.forEach((input) => { input.checked = input === nextInput; });
    return this.selectedSellingPlanAllocation();
  }

  isPurchaseAvailable() {
    if (!this.variant?.available) return false;
    const sellingPlanId = this.selectedSellingPlanId();
    if (!sellingPlanId) return !this.variant.requires_selling_plan;
    return Boolean(this.selectedSellingPlanAllocation());
  }

  onSellingPlanChange() {
    this.reconcileSellingPlans();
    this.updateVariantState();
    this.updatePrice();
    if (this.dataset.updateUrl !== 'false') {
      const url = new URL(window.location.href);
      const sellingPlanId = this.selectedSellingPlanId();
      if (sellingPlanId) url.searchParams.set('selling_plan', sellingPlanId);
      else url.searchParams.delete('selling_plan');
      window.history.replaceState({}, '', url);
    }
    this.dispatch('product:selling-plan-change', {
      variant: this.variant,
      sellingPlanAllocation: this.selectedSellingPlanAllocation(),
    });
  }

  updateVariantState() {
    this.clearInventoryWarning();
    const available = Boolean(this.variant?.available);
    const purchaseAvailable = this.isPurchaseAvailable();
    const variantId = this.variant?.id ? String(this.variant.id) : '';
    this.querySelectorAll('input[data-variant-id], input[data-payment-terms-variant-id]').forEach((input) => {
      if (input.value === variantId) return;
      input.value = variantId;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const button = this.querySelector('[data-add-to-cart]');
    const label = this.querySelector('[data-add-to-cart-label]');
    if (button) button.disabled = !purchaseAvailable;
    if (label) label.textContent = this.variant ? (available ? (purchaseAvailable ? this.dataset.addToCartLabel : this.dataset.unavailableLabel) : this.dataset.soldOutLabel) : this.dataset.unavailableLabel;
    const stickyButton = this.querySelector('[data-sticky-cart-add]');
    const stickyLabel = this.querySelector('[data-sticky-cart-label]');
    const stickyVariant = this.querySelector('[data-sticky-cart-variant]');
    const stickyImage = this.querySelector('[data-sticky-cart-image]');
    const dynamicCheckout = this.querySelector('[data-dynamic-checkout]');
    if (stickyButton) stickyButton.disabled = !purchaseAvailable;
    if (stickyLabel) stickyLabel.textContent = this.variant ? (available ? (purchaseAvailable ? this.dataset.addToCartLabel : this.dataset.unavailableLabel) : this.dataset.soldOutLabel) : this.dataset.unavailableLabel;
    if (dynamicCheckout) dynamicCheckout.hidden = !purchaseAvailable;
    if (stickyVariant) {
      const variantTitle = this.variant?.title || '';
      stickyVariant.textContent = variantTitle;
      stickyVariant.hidden = !variantTitle || variantTitle === 'Default Title';
    }
    if (stickyImage) {
      const variantImage = this.variant?.featured_image?.src || this.variant?.featured_media?.preview_image?.src;
      stickyImage.src = variantImage || stickyImage.dataset.fallbackSrc || stickyImage.src;
    }
    const inventory = this.querySelector('[data-inventory-message]');
    if (inventory) inventory.textContent = !this.variant
      ? this.dataset.unavailableLabel
      : available
        ? (this.variant.inventory_management && this.variant.inventory_policy !== 'continue' && this.variant.inventory_quantity > 0 && this.variant.inventory_quantity <= 10
          ? this.dataset.onlyItemsLeftLabel.replace('[count]', this.variant.inventory_quantity)
          : this.dataset.inStockLabel)
        : this.dataset.soldOutLabel;
    const allocation = this.selectedSellingPlanAllocation();
    const currentPrice = allocation?.price ?? this.variant?.price;
    const currentCompareAtPrice = allocation?.compare_at_price ?? this.variant?.compare_at_price;
    const onSale = Number(currentCompareAtPrice) > Number(currentPrice);
    this.querySelector('[data-product-badge-sale]')?.toggleAttribute('hidden', !onSale);
    this.querySelector('[data-product-badge-sold-out]')?.toggleAttribute('hidden', available);
    this.dispatch('product:variant-change', { variant: this.variant });
  }

  applyVariant(variant, preferredPlanId) {
    this.variant = variant;
    this.reconcileSellingPlans(preferredPlanId);
    this.updateVariantState();
    this.updatePrice();
    this.updateSku();
    this.updateQuantityRules();
    if (variant.featured_media?.id) this.showMedia(String(variant.featured_media.id));
    this.loadPickupAvailability();
    if (this.dataset.updateUrl !== 'false') {
      const url = new URL(this.dataset.productUrl, window.location.origin);
      url.searchParams.set('variant', variant.id);
      const sellingPlanId = this.selectedSellingPlanId();
      if (sellingPlanId) url.searchParams.set('selling_plan', sellingPlanId);
      window.history.replaceState({}, '', url);
    }
  }

  updatePrice() {
    if (!this.variant) return;
    const allocation = this.selectedSellingPlanAllocation();
    const allocationValue = (key, fallback) => allocation && Object.prototype.hasOwnProperty.call(allocation, key) ? allocation[key] : fallback;
    const currentPrice = allocationValue('price', this.variant.price);
    const currentCompareAtPrice = allocationValue('compare_at_price', this.variant.compare_at_price);
    const currentUnitPrice = allocationValue('unit_price', this.variant.unit_price);
    const price = this.querySelector("[data-price]");
    const comparePrice = this.querySelector("[data-compare-price]");
    const saleBadge = this.querySelector("[data-sale-badge]");
    const saleBadgeValue = this.querySelector("[data-sale-badge-value]");
    if (price) price.textContent = this.formatPrice(currentPrice);
    const unitPrice = this.querySelector('[data-unit-price]');
    if (unitPrice) {
      const measurement = this.variant.unit_price_measurement;
      unitPrice.hidden = !measurement || currentUnitPrice == null;
      unitPrice.textContent = measurement && currentUnitPrice != null ? `${this.formatPrice(currentUnitPrice)} / ${measurement.reference_value}${measurement.reference_unit}` : '';
    }
    const stickyPrice = this.querySelector('[data-sticky-cart-price]');
    const stickyComparePrice = this.querySelector('[data-sticky-cart-compare-price]');
    const stickyPrices = this.querySelector('[data-sticky-cart-prices]');
    if (stickyPrice) stickyPrice.textContent = this.formatPrice(currentPrice);
    const onSale = Number(currentCompareAtPrice) > Number(currentPrice);
    stickyPrices?.classList.toggle('is-sale', onSale);
    if (stickyComparePrice) {
      stickyComparePrice.textContent = onSale ? this.formatPrice(currentCompareAtPrice) : '';
      stickyComparePrice.hidden = !onSale;
    }
    this.querySelector("[data-product-price]")?.classList.toggle("product-price--sale", onSale);
    if (saleBadge) {
      saleBadge.hidden = !onSale;
      if (onSale && saleBadgeValue) {
        const discountAmount = Number(currentCompareAtPrice) - Number(currentPrice);
        const showPercentage = saleBadge.dataset.discountMode === "true";
        saleBadgeValue.textContent = showPercentage
          ? `${Math.round((discountAmount * 100) / Number(currentCompareAtPrice))}% OFF`
          : `${this.formatPrice(discountAmount)} OFF`;
      }
    }
    if (comparePrice) {
      comparePrice.textContent = onSale ? this.formatPrice(currentCompareAtPrice) : "";
      comparePrice.classList.toggle("is-hidden", !onSale);
    }
  }

  updateSku() {
    const sku = this.querySelector('[data-product-sku]');
    if (!sku) return;
    sku.textContent = this.variant?.sku || '';
    sku.hidden = !this.variant?.sku;
  }

  updateQuantityRules() {
    const input = this.querySelector('[data-quantity-input]');
    if (!input || !this.variant) return;
    const rules = this.variant.quantity_rule || {};
    input.min = rules.min || 1;
    input.step = rules.increment || 1;
    if (rules.max) input.max = rules.max;
    else input.removeAttribute('max');
    this.normalizeQuantity();
  }

  formatMoney(amount) {
    return window.SpinelMoney?.format(amount, {
      currency: this.dataset.currency || 'USD',
      showCurrencyCode: false,
    }) || String(amount || 0);
  }

  formatPrice(amount) {
    return window.SpinelMoney?.format(amount, {
      currency: this.dataset.currency || 'USD',
      showCurrencyCode: this.dataset.showCurrencyCode === 'true',
    }) || this.formatMoney(amount);
  }

  resolveFromUrl() {
    const url = new URL(window.location.href);
    const variantId = url.searchParams.get('variant');
    const sellingPlanId = url.searchParams.get('selling_plan') || '';
    const variant = this.variants.find((item) => String(item.id) === String(variantId));
    if (!variant) return;
    if (String(variant.id) !== String(this.variant?.id)) this.applyVariant(variant, sellingPlanId);
    else {
      this.reconcileSellingPlans(sellingPlanId);
      this.updateVariantState();
      this.updatePrice();
    }
  }

  showMedia(mediaId, instant = false) {
    if (!this.mainGallery) return;
    const slide = Array.from(this.mainGallery.slides || []).find((candidate) => String(candidate.dataset.mediaId) === String(mediaId));
    const realIndex = Number.parseInt(slide?.dataset.swiperSlideIndex, 10);
    if (Number.isFinite(realIndex) && typeof this.mainGallery.slideToLoop === 'function') {
      this.mainGallery.slideToLoop(realIndex, instant ? 0 : undefined);
      return;
    }
    const index = Array.from(this.mainGallery.slides || []).findIndex((candidate) => String(candidate.dataset.mediaId) === String(mediaId));
    if (index >= 0) this.mainGallery.slideTo(index, instant ? 0 : undefined);
  }

  async loadPickupAvailability() {
    const container = this.querySelector('[data-pickup-availability]');
    if (!container || !this.variant?.id) return;
    container.dataset.variantId = this.variant.id;
    try {
      const url = new URL(`/variants/${this.variant.id}`, window.location.origin);
      url.searchParams.set('section_id', 'pickup-availability');
      const response = await fetch(url, { signal: this.signal });
      if (!response.ok) return;
      container.innerHTML = await response.text();
    } catch (error) { if (error.name !== 'AbortError') container.replaceChildren(); }
  }

  changeQuantity(delta) {
    const input = this.querySelector('[data-quantity-input]');
    if (!input) return;
    input.value = Number(input.value || input.min || 1) + delta * Number(input.step || 1);
    this.normalizeQuantity();
  }

  normalizeQuantity() {
    const input = this.querySelector('[data-quantity-input]');
    if (!input) return;
    const min = Number(input.min || 1), max = input.max ? Number(input.max) : Infinity, increment = Number(input.step || 1);
    const raw = Math.max(min, Math.min(max, Number(input.value) || min));
    input.value = min + Math.round((raw - min) / increment) * increment;
    this.clearInventoryWarning();
    this.dispatch('product:quantity-change', { quantity: Number(input.value) });
  }

  restoreQuantity() {
    if (!this.dataset.restoreQuantity) return;
    const input = this.querySelector('[data-quantity-input]');
    if (!input) return;
    input.value = this.dataset.restoreQuantity;
    this.normalizeQuantity();
    delete this.dataset.restoreQuantity;
  }

  async addToCart(event, sourceButton = null) {
    event?.preventDefault();
    if (!this.isPurchaseAvailable() || !this.form) return;
    this.normalizeQuantity();
    if (!this.validateGiftCardRecipientForm()) return;
    this.setGiftCardRecipientError('');
    const primaryButton = this.querySelector('[data-add-to-cart]');
    const buttons = [...new Set([primaryButton, sourceButton].filter(Boolean))];
    if (!buttons.length) return;
    buttons.forEach((button) => {
      button.disabled = true;
      button.classList.add('is-loading');
      button.setAttribute('aria-busy', 'true');
    });
    this.clearInventoryWarning();
    this.setStatus(this.dataset.addingToCartLabel);
    this.dispatch('product:add:start', { variant: this.variant });
    try {
      const formData = new FormData(this.form);
      const quantityInput = this.querySelector('[data-quantity-input]');
      if (quantityInput && !formData.has('quantity')) formData.set('quantity', quantityInput.value);
      const response = await fetch(window.routes?.cart_add_url || '/cart/add.js', { method: 'POST', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: formData, signal: this.signal });
      const item = await response.json();
      if (!response.ok) {
        const error = new Error(item.description || item.message || this.dataset.addToCartError);
        error.payload = item;
        error.status = response.status;
        error.url = response.url;
        throw error;
      }
      this.setStatus('');
      this.resetGiftCardRecipientForm();
      buttons.forEach((button) => this.showAddedState(button));
      let cart = null;
      try { cart = await this.refreshCartCount(); } catch { /* Cart count refresh is non-blocking after a successful add. */ }
      document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true, detail: { item, cart } }));
      const featuredImage = [...this.querySelectorAll('[data-media-id] img')].find((candidate) => candidate.closest('[data-media-id]')?.dataset.mediaId === String(this.variant?.featured_media?.id) && candidate.getBoundingClientRect().width > 0)
        || [...this.querySelectorAll('.product-gallery__main img, .product-gallery__desktop img, .product-gallery__desktop-main img')].find((candidate) => candidate.getBoundingClientRect().width > 0);
      this.dispatch('product:add:success', { item, cart, button: sourceButton || primaryButton, image: featuredImage, imageUrl: featuredImage?.currentSrc || featuredImage?.src });
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('[Spinel] Add to cart failed', {
        error,
        variantId: this.variant?.id,
        payload: error.payload || null,
      });
      const availableQuantity = await this.resolveAvailableStock(error.payload);
      if (availableQuantity !== null) this.showInventoryWarning(availableQuantity);
      const recipientErrorText = [
        error.message,
        error.payload?.description,
        error.payload?.message,
        ...Object.keys(error.payload?.errors || {}),
      ].filter(Boolean).join(' ');
      if (this.recipientToggle?.checked && /recipient|send on|delivery date|__shopify_(?:send_gift_card|offset)/i.test(recipientErrorText)) {
        this.setGiftCardRecipientError(
          error.message || this.dataset.addToCartError,
          /recipient[ _-]*email|\bemail\b/i.test(recipientErrorText),
        );
      }
      this.setStatus(error.message, true);
      this.dispatch('product:add:error', { error, availableQuantity });
    } finally {
      buttons.forEach((button) => {
        button.classList.remove('is-loading');
        button.removeAttribute('aria-busy');
        if (this.isConnected) button.disabled = button.classList.contains('is-added') || !this.isPurchaseAvailable();
      });
    }
  }

  showAddedState(button) {
    const label = button?.querySelector('[data-add-to-cart-label]');
    if (!button) return;
    button.disabled = true;
    if (label) {
      label.dataset.defaultText ||= label.textContent;
      label.textContent = label.dataset.addToCartAddedLabel || 'Added';
    }
    button.classList.add('is-added');
    clearTimeout(this.addedStateTimer);
    this.addedStateTimer = setTimeout(() => {
      button.classList.remove('is-added');
      if (label?.dataset.defaultText) label.textContent = label.dataset.defaultText;
      if (this.isConnected) button.disabled = !this.isPurchaseAvailable();
    }, 1800);
  }

  async refreshCartCount() {
    const response = await fetch('/cart.js', { headers: { Accept: 'application/json' }, signal: this.signal });
    if (!response.ok) throw new Error('Cart count unavailable');
    const cart = await response.json();
    document.querySelectorAll('.header__cart').forEach((cartLink) => {
      const previousCount = Number(cartLink.dataset.cartCurrentCount);
      const count = cartLink.querySelector('.header__cart-count');
      if (cart.item_count > 0) {
        const nextCount = count || document.createElement('span');
        nextCount.className = 'header__cart-count';
        const countTemplate = cart.item_count === 1 ? cartLink.dataset.cartCountOneLabel : cartLink.dataset.cartCountLabel;
        const countLabel = countTemplate?.replace('__count__', String(cart.item_count));
        if (countLabel) cartLink.setAttribute('aria-label', countLabel);
        nextCount.setAttribute('aria-hidden', 'true');
        nextCount.textContent = cart.item_count > 99 ? '99+' : cart.item_count;
        if (!count) cartLink.append(nextCount);
        nextCount.classList.remove('is-updated');
        requestAnimationFrame(() => nextCount.classList.add('is-updated'));
      } else {
        count?.remove();
        cartLink.setAttribute('aria-label', cartLink.dataset.cartEmptyLabel || 'Cart');
      }
      const status = cartLink.closest('[data-header]')?.querySelector('[data-cart-count-status]');
      if (status && previousCount !== cart.item_count) status.textContent = cartLink.getAttribute('aria-label') || '';
      cartLink.dataset.cartCurrentCount = String(cart.item_count);
    });
    return cart;
  }

  async resolveAvailableStock(payload = {}) {
    const message = [payload.description, payload.message].filter(Boolean).join(' ');
    const inventoryError = /stock|inventory|only\s+(?:add\s+)?\d+|can't add more|cannot add more/i.test(message);
    if (!inventoryError) return null;

    const match = message.match(/only\s+(?:add\s+)?(\d+)/i)
      || message.match(/(\d+)\s+(?:items?\s+)?available/i);
    if (match) return Number(match[1]);

    const inventoryQuantity = Number(this.variant?.inventory_quantity);
    const tracksInventory = Boolean(this.variant?.inventory_management)
      && this.variant?.inventory_policy !== 'continue'
      && Number.isFinite(inventoryQuantity);
    if (!tracksInventory) return null;

    try {
      const response = await fetch('/cart.js', { headers: { Accept: 'application/json' }, signal: this.signal });
      if (!response.ok) return Math.max(0, inventoryQuantity);
      const cart = await response.json();
      const quantityInCart = cart.items
        .filter((item) => String(item.variant_id || item.id) === String(this.variant.id))
        .reduce((total, item) => total + Number(item.quantity || 0), 0);
      return Math.max(0, inventoryQuantity - quantityInCart);
    } catch (error) {
      if (error.name === 'AbortError') return null;
      return Math.max(0, inventoryQuantity);
    }
  }

  showInventoryWarning(count) {
    if (!this.inventoryWarning || !Number.isFinite(Number(count))) return;
    const quantity = Math.max(0, Number(count));
    const template = quantity === 1
      ? this.inventoryWarning.dataset.messageOne
      : this.inventoryWarning.dataset.messageOther;
    this.inventoryWarning.textContent = (template || 'Only [count] items available in stock').replace('[count]', quantity);
    this.inventoryWarning.hidden = false;
  }

  clearInventoryWarning() {
    if (!this.inventoryWarning) return;
    this.inventoryWarning.textContent = '';
    this.inventoryWarning.hidden = true;
  }

  setStatus(message, error = false) { if (this.status) { this.status.textContent = message; this.status.dataset.error = error; } }
  dispatch(name, detail) { this.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: { productId: this.dataset.productId, sectionId: this.sectionId, ...detail } })); }
}

if (!customElements.get('product-page')) customElements.define('product-page', ProductPage);
