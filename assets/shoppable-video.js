import { A11y, Navigation, Swiper } from './swiper-loader.js';
import { initializeWhenVisible } from './initialize-when-visible.js';

class ShoppableVideoSection extends HTMLElement {
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.mobileModal = window.matchMedia('(max-width: 767.98px)');
    this.slides = Array.from(this.querySelectorAll('[data-shoppable-video-slide]'));
    this.dialogStates = new Map();
    this.returnFocus = null;
    this.onClick = this.handleClick.bind(this);
    this.onDialogClose = this.handleDialogClose.bind(this);
    this.onDialogCancel = this.handleDialogCancel.bind(this);
    this.onBlockSelect = this.handleBlockSelect.bind(this);
    this.addEventListener('click', this.onClick);
    this.querySelectorAll('[data-shoppable-video-dialog]').forEach((dialog) => {
      dialog.addEventListener('close', this.onDialogClose);
      dialog.addEventListener('cancel', this.onDialogCancel);
      this.initializeDialogInteraction(dialog);
    });
    document.addEventListener('shopify:block:select', this.onBlockSelect);
    this.cancelDeferredInitialization = initializeWhenVisible(this, () => this.initializeCarousel());
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.onClick);
    this.querySelectorAll('[data-shoppable-video-dialog]').forEach((dialog) => {
      dialog.removeEventListener('close', this.onDialogClose);
      dialog.removeEventListener('cancel', this.onDialogCancel);
      this.destroyDialogInteraction(dialog);
    });
    document.removeEventListener('shopify:block:select', this.onBlockSelect);
    this.cancelDeferredInitialization?.();
    window.clearTimeout(this.closeTimer);
    this.querySelectorAll('[data-shoppable-video-dialog][open]').forEach((dialog) => dialog.close());
    this.pauseOtherVideos();
    this.swiper?.destroy(true, true);
    this.swiper = null;
    this.initialized = false;
  }

  initializeDialogInteraction(dialog) {
    const state = {
      handle: dialog.querySelector('[data-shoppable-video-handle]'),
      drag: null,
      settleTimer: null,
    };
    const panel = dialog.querySelector('.shoppable-video-dialog__panel');
    const pointer = dialog.querySelector('.quick-view-modal__backdrop-pointer');
    if (window.SpinelModalBackdropPointer && panel) {
      state.backdropInteraction = new window.SpinelModalBackdropPointer({
        root: dialog,
        panel,
        pointer,
        isOpen: () => dialog.open,
        cursorClass: 'quick-view-backdrop-cursor',
        pointerX: '--quick-view-pointer-x',
        pointerY: '--quick-view-pointer-y',
        relativeToRoot: true,
        isDisabled: () => this.mobileModal.matches,
      });
    }

    state.onPointerDown = (event) => this.startHandleDrag(dialog, event);
    state.onPointerMove = (event) => this.moveHandleDrag(dialog, event);
    state.onPointerUp = (event) => this.endHandleDrag(dialog, event);
    state.onPointerCancel = (event) => this.endHandleDrag(dialog, event, true);
    state.onTouchStart = (event) => this.startTouchHandleDrag(dialog, event);
    state.onTouchMove = (event) => this.moveTouchHandleDrag(dialog, event);
    state.onTouchEnd = (event) => this.endTouchHandleDrag(dialog, event);
    state.onTouchCancel = (event) => this.endTouchHandleDrag(dialog, event, true);

    if ('PointerEvent' in window) {
      state.handle?.addEventListener('pointerdown', state.onPointerDown);
      dialog.addEventListener('pointermove', state.onPointerMove);
      dialog.addEventListener('pointerup', state.onPointerUp);
      dialog.addEventListener('pointercancel', state.onPointerCancel);
    } else {
      state.handle?.addEventListener('touchstart', state.onTouchStart, { passive: false });
      dialog.addEventListener('touchmove', state.onTouchMove, { passive: false });
      dialog.addEventListener('touchend', state.onTouchEnd);
      dialog.addEventListener('touchcancel', state.onTouchCancel);
    }
    this.dialogStates.set(dialog, state);
  }

  destroyDialogInteraction(dialog) {
    const state = this.dialogStates.get(dialog);
    if (!state) return;
    state.backdropInteraction?.destroy();
    state.handle?.removeEventListener('pointerdown', state.onPointerDown);
    dialog.removeEventListener('pointermove', state.onPointerMove);
    dialog.removeEventListener('pointerup', state.onPointerUp);
    dialog.removeEventListener('pointercancel', state.onPointerCancel);
    state.handle?.removeEventListener('touchstart', state.onTouchStart);
    dialog.removeEventListener('touchmove', state.onTouchMove);
    dialog.removeEventListener('touchend', state.onTouchEnd);
    dialog.removeEventListener('touchcancel', state.onTouchCancel);
    this.resetHandleDrag(dialog);
    this.dialogStates.delete(dialog);
  }

  startTouchHandleDrag(dialog, event) {
    const touch = event.changedTouches[0];
    if (!touch) return;
    this.startHandleDrag(dialog, {
      isPrimary: true,
      button: 0,
      pointerId: touch.identifier,
      clientY: touch.clientY,
      preventDefault: () => event.preventDefault(),
    });
  }

  moveTouchHandleDrag(dialog, event) {
    const state = this.dialogStates.get(dialog);
    if (!state?.drag) return;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === state.drag.pointerId);
    if (!touch) return;
    this.moveHandleDrag(dialog, {
      pointerId: touch.identifier,
      clientY: touch.clientY,
      preventDefault: () => event.preventDefault(),
    });
  }

  endTouchHandleDrag(dialog, event, cancelled = false) {
    const state = this.dialogStates.get(dialog);
    if (!state?.drag) return;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === state.drag.pointerId);
    if (!touch) return;
    this.endHandleDrag(dialog, { pointerId: touch.identifier }, cancelled);
  }

  startHandleDrag(dialog, event) {
    const state = this.dialogStates.get(dialog);
    const isMobileLayout = this.mobileModal.matches || getComputedStyle(state?.handle).display !== 'none';
    if (!state?.handle || !isMobileLayout || !event.isPrimary || event.button > 0 || dialog.classList.contains('is-closing')) return;
    window.clearTimeout(state.settleTimer);
    state.drag = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: performance.now(),
      velocity: 0,
      distance: 0,
    };
    dialog.classList.remove('is-handle-settling', 'is-handle-closing');
    dialog.classList.add('is-handle-dragging');
    dialog.style.transform = 'translate3d(0, 0, 0)';
    dialog.style.opacity = '1';
    try { state.handle.setPointerCapture(event.pointerId); } catch (_) {}
    event.preventDefault();
  }

  moveHandleDrag(dialog, event) {
    const state = this.dialogStates.get(dialog);
    const drag = state?.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const now = performance.now();
    const elapsed = Math.max(now - drag.lastTime, 1);
    drag.velocity = (event.clientY - drag.lastY) / elapsed;
    drag.lastY = event.clientY;
    drag.lastTime = now;
    drag.distance = Math.max(0, event.clientY - drag.startY);
    dialog.style.transform = `translate3d(0, ${drag.distance}px, 0)`;
    event.preventDefault();
  }

  endHandleDrag(dialog, event, cancelled = false) {
    const state = this.dialogStates.get(dialog);
    const drag = state?.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    try { state.handle.releasePointerCapture(event.pointerId); } catch (_) {}
    const closeDistance = Math.min(140, dialog.getBoundingClientRect().height * 0.2);
    const shouldClose = !cancelled && (drag.distance >= closeDistance || (drag.distance >= 32 && drag.velocity > 0.55));
    state.drag = null;
    dialog.classList.remove('is-handle-dragging');

    if (shouldClose) {
      dialog.classList.add('is-closing', 'is-handle-closing');
      window.requestAnimationFrame(() => {
        dialog.style.transform = `translate3d(0, ${Math.max(window.innerHeight, dialog.offsetHeight + 60)}px, 0)`;
        dialog.style.opacity = '0';
      });
      state.settleTimer = window.setTimeout(() => dialog.open && dialog.close(), 240);
      return;
    }

    dialog.classList.add('is-handle-settling');
    window.requestAnimationFrame(() => {
      dialog.style.transform = 'translate3d(0, 0, 0)';
      dialog.style.opacity = '1';
    });
    state.settleTimer = window.setTimeout(() => this.resetHandleDrag(dialog), 240);
  }

  resetHandleDrag(dialog) {
    const state = this.dialogStates.get(dialog);
    if (!state) return;
    window.clearTimeout(state.settleTimer);
    try { state.handle?.releasePointerCapture(state.drag?.pointerId); } catch (_) {}
    state.drag = null;
    state.settleTimer = null;
    dialog.classList.remove('is-handle-dragging', 'is-handle-settling', 'is-handle-closing');
    dialog.style.removeProperty('transform');
    dialog.style.removeProperty('opacity');
  }

  initializeCarousel() {
    if (this.swiper || !this.slides.length) return;
    const carousel = this.querySelector('[data-shoppable-video-carousel]');
    if (!carousel) return;

    const desktopColumns = Number.parseInt(this.dataset.desktopColumns, 10) || 3;
    const mobileColumns = Number.parseFloat(this.dataset.mobileColumns) || 1;
    const tabletColumns = Math.min(desktopColumns, 2);
    const productCount = this.slides.length;
    const slidesWithPreview = (columns, preview = true) => columns + (preview && productCount > columns ? 0.15 : 0);

    this.swiper = new Swiper(carousel, {
      modules: [A11y, Navigation],
      slidesPerView: slidesWithPreview(mobileColumns),
      spaceBetween: this.cssNumber('--shoppable-video-mobile-gap'),
      speed: this.reduceMotion ? 0 : 420,
      watchOverflow: true,
      navigation: {
        prevEl: this.querySelector('[data-shoppable-video-previous]'),
        nextEl: this.querySelector('[data-shoppable-video-next]'),
      },
      a11y: { enabled: true, slideRole: 'listitem' },
      breakpoints: {
        768: {
          slidesPerView: slidesWithPreview(tabletColumns),
          spaceBetween: this.cssNumber('--shoppable-video-gap'),
        },
        990: {
          slidesPerView: desktopColumns,
          spaceBetween: this.cssNumber('--shoppable-video-gap'),
        },
      },
      on: {
        init: (swiper) => this.updateNavigation(swiper),
        slideChange: (swiper) => {
          this.pauseOtherVideos();
          this.updateNavigation(swiper);
        },
        resize: (swiper) => this.updateNavigation(swiper),
        breakpoint: (swiper) => this.updateNavigation(swiper),
      },
    });
  }

  cssNumber(name) {
    return Number.parseFloat(getComputedStyle(this).getPropertyValue(name)) || 0;
  }

  updateProgress(swiper) {
    const total = this.slides.length;
    if (!total) return;
    const visible = Math.min(Math.max(swiper.slidesPerViewDynamic(), Number(swiper.params.slidesPerView) || 1), total);
    const endIndex = Math.min(total, swiper.activeIndex + Math.ceil(visible));
    const count = this.querySelector('[data-shoppable-video-showing]');
    const progress = this.querySelector('[data-shoppable-video-progress]');
    const pageLabel = this.querySelector('[data-shoppable-video-page-label]');
    const footer = this.querySelector('.shoppable-video-section__footer');
    if (count) count.textContent = `Showing ${endIndex} of ${total}`;
    footer?.removeAttribute('hidden');
    if (progress) {
      const thumbSize = Math.min(1, visible / total);
      const value = total <= Math.ceil(visible) ? 1 : thumbSize + (swiper.progress * (1 - thumbSize));
      progress.style.setProperty('--shoppable-video-progress', value);
    }
    if (pageLabel) {
      const prefix = pageLabel.textContent.split('/')[0].trim();
      const page = String(swiper.activeIndex + 1).padStart(2, '0');
      pageLabel.textContent = `${prefix} / Page ${page}`;
    }
  }

  updateNavigation(swiper) {
    if (!swiper?.slides?.length) return;
    const visible = Math.min(Math.max(swiper.slidesPerViewDynamic(), Number(swiper.params.slidesPerView) || 1), swiper.slides.length);
    const hasOverflow = swiper.slides.length > Math.ceil(visible);
    this.classList.toggle('shoppable-video-section--static', !hasOverflow);
    this.querySelector('.shoppable-video-section__panel')?.classList.toggle('is-carousel-scrollable', hasOverflow);
    this.querySelectorAll('[data-shoppable-video-previous], [data-shoppable-video-next]').forEach((button) => {
      button.disabled = !hasOverflow;
    });
    if (hasOverflow) swiper.navigation.update();
    this.updateProgress(swiper);
  }

  handleClick(event) {
    const playButton = event.target.closest('[data-shoppable-video-play]');
    if (playButton && this.contains(playButton)) {
      this.toggleVideo(playButton);
      return;
    }

    const openButton = event.target.closest('[data-shoppable-video-open]');
    if (openButton && this.contains(openButton)) {
      const dialogId = openButton.getAttribute('aria-controls');
      const dialog = dialogId ? this.querySelector(`#${CSS.escape(dialogId)}`) : null;
      if (dialog) this.openDialog(dialog, openButton);
      return;
    }

    const closeButton = event.target.closest('[data-shoppable-video-close]');
    if (closeButton) {
      this.closeDialog(closeButton.closest('[data-shoppable-video-dialog]'));
      return;
    }

    const dialog = event.target.closest('[data-shoppable-video-dialog]');
    if (dialog && event.target === dialog) this.closeDialog(dialog);
  }

  toggleVideo(button) {
    const video = button.closest('[data-shoppable-video-slide]')?.querySelector('video');
    if (!video) return;
    if (video.paused) {
      this.pauseOtherVideos(video);
      video.play().catch(() => {});
      button.classList.add('is-playing');
      button.setAttribute('aria-label', button.dataset.pauseLabel || 'Pause video');
    } else {
      video.pause();
      button.classList.remove('is-playing');
      button.setAttribute('aria-label', button.dataset.playLabel || 'Play video');
    }
  }

  pauseOtherVideos(activeVideo = null) {
    this.querySelectorAll('video').forEach((video) => {
      if (video === activeVideo) return;
      video.pause();
      const button = video.closest('[data-shoppable-video-slide]')?.querySelector('[data-shoppable-video-play]');
      button?.classList.remove('is-playing');
      if (button) button.setAttribute('aria-label', button.dataset.playLabel || 'Play video');
    });
  }

  openDialog(dialog, trigger) {
    if (dialog.open) return;
    this.pauseOtherVideos();
    this.returnFocus = trigger;
    this.resetHandleDrag(dialog);
    dialog.classList.remove('is-closing');
    dialog.showModal();
    const closeButton = dialog.querySelector('[data-shoppable-video-close]');
    const focusTarget = closeButton && getComputedStyle(closeButton).display !== 'none' ? closeButton : dialog;
    focusTarget.focus({ preventScroll: true });
  }

  closeDialog(dialog) {
    if (!dialog?.open || dialog.classList.contains('is-closing')) return;
    this.resetHandleDrag(dialog);
    dialog.classList.add('is-closing');
    if (this.reduceMotion) {
      dialog.close();
      return;
    }
    window.clearTimeout(this.closeTimer);
    this.closeTimer = window.setTimeout(() => dialog.open && dialog.close(), 260);
  }

  handleDialogCancel(event) {
    event.preventDefault();
    this.closeDialog(event.currentTarget);
  }

  handleDialogClose(event) {
    this.resetHandleDrag(event.currentTarget);
    event.currentTarget.classList.remove('is-closing');
    this.dialogStates.get(event.currentTarget)?.backdropInteraction?.hide();
    this.returnFocus?.focus({ preventScroll: true });
    this.returnFocus = null;
  }

  handleBlockSelect(event) {
    if (event.detail?.sectionId && event.detail.sectionId !== this.dataset.sectionId) return;
    const index = this.slides.findIndex((slide) => slide.dataset.blockId === event.detail?.blockId);
    if (index < 0) return;
    this.initializeCarousel();
    this.swiper?.update();
    this.swiper?.slideTo(index, this.reduceMotion ? 0 : 320);
  }
}

if (!customElements.get('shoppable-video-section')) {
  customElements.define('shoppable-video-section', ShoppableVideoSection);
}
