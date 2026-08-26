import { A11y, Navigation, Swiper } from './swiper-loader.js';
import { initializeWhenVisible } from './initialize-when-visible.js';

class CollectionList extends HTMLElement {
  connectedCallback() {
    this.slider = this.querySelector('[data-collection-list-slider]');
    this.pagination = this.querySelector('[data-collection-list-pagination]');
    this.progress = this.querySelector('[data-collection-list-progress]');
    this.previousButton = this.querySelector('[data-collection-list-previous]');
    this.nextButton = this.querySelector('[data-collection-list-next]');
    this.mobileMedia = window.matchMedia('(max-width: 767.98px)');
    this.tabletMedia = window.matchMedia('(max-width: 1149.98px)');
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.currentDevice = null;
    this.swiper = null;
    this.onBreakpointChange = this.refresh.bind(this);
    this.onBlockSelect = this.handleBlockSelect.bind(this);

    this.mobileMedia.addEventListener('change', this.onBreakpointChange);
    this.tabletMedia.addEventListener('change', this.onBreakpointChange);
    document.addEventListener('shopify:block:select', this.onBlockSelect);
    this.isReady = false;
    this.cancelDeferredInitialization = initializeWhenVisible(this, () => {
      this.isReady = true;
      this.refresh();
    });
  }

  disconnectedCallback() {
    this.mobileMedia?.removeEventListener('change', this.onBreakpointChange);
    this.tabletMedia?.removeEventListener('change', this.onBreakpointChange);
    document.removeEventListener('shopify:block:select', this.onBlockSelect);
    this.cancelDeferredInitialization?.();
    this.destroySlider();
  }

  getDevice() {
    if (this.mobileMedia.matches) return 'mobile';
    if (this.tabletMedia.matches) return 'tablet';
    return 'desktop';
  }

  refresh() {
    if (!this.isReady) return;
    const device = this.getDevice();
    if (device === this.currentDevice) return;
    this.currentDevice = device;

    const layout = this.dataset[`layout${this.capitalize(device)}`] || 'slider';
    this.dataset.currentLayout = layout;
    this.destroySlider();

    if (layout === 'slider') this.createSlider(device);
  }

  createSlider(device) {
    if (!this.slider?.querySelector('.swiper-slide')) return;

    const columns = Number.parseInt(this.dataset[`columns${this.capitalize(device)}`], 10) || 1;
    const slidesPerView = device === 'mobile' && columns === 1 ? 1.2 : columns;
    const styles = getComputedStyle(this);
    const gapProperty = device === 'mobile' ? '--collection-list-mobile-column-gap' : '--collection-list-column-gap';
    const gap = Number.parseFloat(styles.getPropertyValue(gapProperty)) || 0;
    const slideCount = this.slider.querySelectorAll('.swiper-slide').length;
    const previousMessage = this.previousButton?.getAttribute('aria-label') || '';
    const nextMessage = this.nextButton?.getAttribute('aria-label') || '';

    this.swiper = new Swiper(this.slider, {
      modules: [A11y, Navigation],
      slidesPerView,
      spaceBetween: gap,
      speed: this.reduceMotion.matches ? 0 : 360,
      watchOverflow: true,
      grabCursor: slideCount > slidesPerView,
      navigation: {
        prevEl: this.previousButton,
        nextEl: this.nextButton,
      },
      a11y: {
        enabled: true,
        prevSlideMessage: previousMessage,
        nextSlideMessage: nextMessage,
        slideRole: null,
      },
    });
    this.swiper.on('update resize breakpoint slideChange transitionEnd', () => this.updateNavigation());
    this.updateNavigation();
  }

  updateNavigation() {
    const carousel = this.querySelector('.collection-list__carousel');
    if (!carousel || !this.swiper?.slides?.length) return;
    const visible = Math.min(
      Math.max(this.swiper.slidesPerViewDynamic(), Number(this.swiper.params.slidesPerView) || 1),
      this.swiper.slides.length,
    );
    const hasOverflow = this.swiper.slides.length > Math.ceil(visible);
    carousel.classList.toggle('is-carousel-scrollable', hasOverflow);
    [this.previousButton, this.nextButton].forEach((button) => {
      if (button) button.disabled = !hasOverflow;
    });
    if (hasOverflow) this.swiper.navigation.update();
    this.updateProgress();
  }

  updateProgress() {
    if (!this.pagination || !this.progress || !this.swiper?.slides?.length) return;
    const enabled = this.dataset.showPagination === 'true';
    const visible = Math.min(
      Math.max(this.swiper.slidesPerViewDynamic(), Number(this.swiper.params.slidesPerView) || 1),
      this.swiper.slides.length,
    );
    const hasOverflow = this.swiper.slides.length > Math.ceil(visible);
    this.pagination.hidden = !enabled || !hasOverflow;
    if (!enabled || !hasOverflow) {
      this.progress.style.setProperty('--collection-list-progress', 1);
      return;
    }
    const thumbSize = Math.min(1, visible / this.swiper.slides.length);
    this.progress.style.setProperty(
      '--collection-list-progress',
      thumbSize + (this.swiper.progress * (1 - thumbSize)),
    );
  }

  destroySlider() {
    this.swiper?.destroy(true, true);
    this.swiper = null;
  }

  handleBlockSelect(event) {
    if (!this.isReady) {
      this.isReady = true;
      this.cancelDeferredInitialization?.();
      this.refresh();
    }
    if (!this.swiper || event.detail?.sectionId !== this.dataset.sectionId) return;
    const slide = this.querySelector(`[data-block-id="${CSS.escape(event.detail.blockId)}"]`);
    if (!slide) return;
    const index = Array.from(this.querySelectorAll('.swiper-slide')).indexOf(slide);
    if (index >= 0) this.swiper.slideTo(index);
  }

  capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}

if (!customElements.get('collection-list')) customElements.define('collection-list', CollectionList);
