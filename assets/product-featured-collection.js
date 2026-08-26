import { A11y, Navigation, Swiper } from './swiper-loader.js';

class ProductFeaturedCollection extends HTMLElement {
  connectedCallback() {
    this.abortController = new AbortController();
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.designMode = this.dataset.designMode === 'true' || Boolean(window.Shopify?.designMode);
    this.panel = this.querySelector('[data-product-featured-collection-panel]');
    this.onBlockSelect = this.handleBlockSelect.bind(this);
    document.addEventListener('shopify:block:select', this.onBlockSelect);
    if (this.dataset.productFeaturedCollectionSourceUrl) this.loadSource();
    else this.createCarousel();
  }

  disconnectedCallback() {
    this.abortController?.abort();
    document.removeEventListener('shopify:block:select', this.onBlockSelect);
    this.swiper?.destroy(true, true);
    this.swiper = null;
  }

  async loadSource() {
    try {
      const response = await fetch(this.dataset.productFeaturedCollectionSourceUrl, {
        headers: { Accept: 'text/html' },
        signal: this.abortController.signal,
      });
      if (!response.ok) throw new Error('Products unavailable');
      const template = document.createElement('template');
      template.innerHTML = await response.text();
      const source = template.content.querySelector('product-featured-collection');
      if (!source?.querySelector('.swiper-slide')) {
        if (this.designMode) {
          this.hidden = false;
          this.removeAttribute('aria-busy');
          this.createCarousel();
        } else {
          this.remove();
        }
        return;
      }
      this.innerHTML = source.innerHTML;
      this.hidden = false;
      this.removeAttribute('aria-busy');
      delete this.dataset.productFeaturedCollectionSourceUrl;
      this.panel = this.querySelector('[data-product-featured-collection-panel]');
      this.createCarousel();
      window.ThemeAnimations?.init(this);
      document.dispatchEvent(new CustomEvent('product-featured-collection:products-loaded', {
        bubbles: true,
        detail: { section: this, panel: this.panel },
      }));
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (this.designMode) {
        this.hidden = false;
        this.removeAttribute('aria-busy');
        this.createCarousel();
      } else {
        this.remove();
      }
    }
  }

  createCarousel() {
    const carousel = this.panel?.querySelector('[data-product-featured-collection-carousel]');
    const scroller = this.panel?.querySelector('[data-product-featured-collection-scroller]');
    if (!carousel || !scroller?.querySelector('.swiper-slide')) return;

    const styles = getComputedStyle(this);
    const productGap = Number.parseFloat(styles.getPropertyValue('--product-featured-collection-product-gap')) || 0;
    const mobileProductGap = Number.parseFloat(styles.getPropertyValue('--product-featured-collection-mobile-product-gap')) || 0;
    const desktopColumns = Number.parseInt(this.dataset.desktopColumns, 10) || 4;
    const mobileColumns = Number.parseInt(this.dataset.mobileColumns, 10) || 1;
    const tabletColumns = Math.min(desktopColumns, 2);
    const productCount = scroller.querySelectorAll('.swiper-slide').length;
    const slidesWithPreview = (columns) => columns + (productCount > columns ? 0.15 : 0);

    this.swiper?.destroy(true, true);
    this.swiper = new Swiper(carousel, {
      modules: [A11y, Navigation],
      slidesPerView: slidesWithPreview(mobileColumns),
      spaceBetween: mobileProductGap,
      speed: this.reduceMotion ? 0 : 360,
      watchOverflow: true,
      navigation: {
        prevEl: this.panel.querySelector('[data-product-featured-collection-previous]'),
        nextEl: this.panel.querySelector('[data-product-featured-collection-next]'),
      },
      a11y: { enabled: true, slideRole: 'listitem' },
      breakpoints: {
        750: { slidesPerView: slidesWithPreview(tabletColumns), spaceBetween: productGap },
        990: { slidesPerView: slidesWithPreview(desktopColumns) },
      },
    });
    this.swiper.on('update resize slideChange transitionEnd', () => this.updateProgress());
    this.updateProgress();
  }

  updateProgress() {
    const progressBar = this.panel?.querySelector('[data-product-featured-collection-progress]');
    const progressTrack = progressBar?.closest('.product-featured-collection__progress');
    if (!progressBar || !this.swiper?.slides?.length) return;

    const hasOverflow = !this.swiper.isLocked;
    this.panel?.classList.toggle('is-carousel-scrollable', hasOverflow);
    if (progressTrack) progressTrack.hidden = !hasOverflow;
    if (!hasOverflow) return;

    const visible = Math.min(Math.max(this.swiper.slidesPerViewDynamic(), Number(this.swiper.params.slidesPerView) || 1), this.swiper.slides.length);
    const thumbSize = Math.min(1, visible / this.swiper.slides.length);
    progressBar.style.setProperty('--product-featured-collection-progress', thumbSize + (this.swiper.progress * (1 - thumbSize)));
  }

  handleBlockSelect(event) {
    if (!this.contains(event.target)) return;
    this.swiper?.update();
    this.updateProgress();
  }
}

if (!customElements.get('product-featured-collection')) customElements.define('product-featured-collection', ProductFeaturedCollection);
