import { A11y, EffectFade, Navigation, Swiper } from './swiper-loader.js';
import { initializeWhenVisible } from './initialize-when-visible.js';

class TestimonialsSlider extends HTMLElement {
  connectedCallback() {
    this.slider = this.querySelector('[data-testimonials-slider]');
    this.controls = this.querySelector('[data-testimonials-controls]');
    this.previousButton = this.querySelector('[data-testimonials-previous]');
    this.nextButton = this.querySelector('[data-testimonials-next]');
    this.currentCount = this.querySelector('[data-testimonials-current]');
    this.totalCount = this.querySelector('[data-testimonials-total]');
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.swiper = null;
    this.onBlockSelect = this.handleBlockSelect.bind(this);

    document.addEventListener('shopify:block:select', this.onBlockSelect);
    this.isReady = false;
    this.cancelDeferredInitialization = initializeWhenVisible(this, () => {
      this.isReady = true;
      this.refresh();
    });
  }

  disconnectedCallback() {
    document.removeEventListener('shopify:block:select', this.onBlockSelect);
    this.cancelDeferredInitialization?.();
    this.destroySlider();
  }

  refresh() {
    if (!this.isReady) return;
    this.updateControls();
    this.destroySlider();
    this.createSlider();
  }

  createSlider() {
    if (!this.slider?.querySelector('.swiper-slide')) return;

    const slideCount = this.slider.querySelectorAll('.swiper-slide').length;
    this.swiper = new Swiper(this.slider, {
      modules: [A11y, EffectFade, Navigation],
      slidesPerView: 1,
      spaceBetween: 0,
      speed: this.reduceMotion.matches ? 0 : 700,
      effect: 'fade',
      fadeEffect: {
        crossFade: true,
      },
      watchOverflow: true,
      grabCursor: slideCount > 1,
      loop: false,
      rewind: slideCount > 1,
      navigation: {
        prevEl: this.previousButton,
        nextEl: this.nextButton,
      },
      a11y: {
        enabled: true,
        prevSlideMessage: this.previousButton?.getAttribute('aria-label') || '',
        nextSlideMessage: this.nextButton?.getAttribute('aria-label') || '',
        slideRole: null,
      },
      on: {
        init: (swiper) => this.updateCounter(slideCount, swiper),
        slideChange: (swiper) => this.updateCounter(slideCount, swiper),
      },
    });
    this.classList.add('testimonials--ready');
  }

  updateCounter(slideCount, swiper = this.swiper) {
    if (!this.currentCount || !this.totalCount) return;
    const currentIndex = (swiper?.realIndex ?? 0) + 1;
    this.currentCount.textContent = String(currentIndex).padStart(2, '0');
    this.totalCount.textContent = String(slideCount).padStart(2, '0');
  }

  updateControls() {
    if (!this.controls) return;
    const slideCount = this.slider?.querySelectorAll('.swiper-slide').length || 0;
    this.controls.hidden = slideCount <= 1;
  }

  destroySlider() {
    this.swiper?.destroy(true, true);
    this.swiper = null;
    this.classList.remove('testimonials--ready');
  }

  handleBlockSelect(event) {
    if (!this.isReady) {
      this.isReady = true;
      this.cancelDeferredInitialization?.();
      this.refresh();
    }
    if (!this.swiper || event.detail?.sectionId !== this.dataset.sectionId) return;
    const slide = this.querySelector(`[data-block-id="${CSS.escape(event.detail.blockId)}"]`);
    const index = slide ? Array.from(this.querySelectorAll('.swiper-slide')).indexOf(slide) : -1;
    if (index < 0) return;
    if (this.swiper.params.loop && typeof this.swiper.slideToLoop === 'function') {
      this.swiper.slideToLoop(index);
      return;
    }
    this.swiper.slideTo(index);
  }
}

if (!customElements.get('testimonials-slider')) customElements.define('testimonials-slider', TestimonialsSlider);
