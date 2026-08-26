import Swiper from './swiper-12.2.0.min.mjs';
import A11y from './swiper-12.2.0-a11y.min.mjs';
import Navigation from './swiper-12.2.0-navigation.min.mjs';
import Parallax from './swiper-12.2.0-parallax.min.mjs';
import { setupFirstViewportHeight } from './first-viewport-height.js';

class SpinelSlideshow extends HTMLElement {
  connectedCallback() {
    this.slider = this.querySelector('[data-slideshow-slider]');
    this.previousButton = this.querySelector('[data-slideshow-previous]');
    this.nextButton = this.querySelector('[data-slideshow-next]');
    this.currentSlide = this.querySelector('[data-slideshow-current]');
    this.totalSlides = this.querySelector('[data-slideshow-total]');
    this.progress = this.querySelector('[data-slideshow-progress]');
    this.progressBar = this.querySelector('[data-slideshow-progress-bar]');
    this.autoplayToggle = this.querySelector('[data-slideshow-autoplay-toggle]');
    this.autoplayIcon = this.querySelector('[data-slideshow-autoplay-icon]');
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.isDoubleSlide = this.dataset.desktopStyle === 'double';
    this.isDesktop = window.matchMedia('(min-width: 768px)');
    this.onViewportChange = () => this.updateControls();
    this.onMotionChange = this.handleMotionChange.bind(this);
    this.onBlockSelect = this.handleBlockSelect.bind(this);
    this.onVisibilityChange = this.handleVisibilityChange.bind(this);
    this.onMouseEnter = this.pauseForHover.bind(this);
    this.onMouseLeave = this.resumeAfterHover.bind(this);
    this.onFocusIn = this.pauseForFocus.bind(this);
    this.onFocusOut = this.resumeAfterFocus.bind(this);
    this.onAutoplayToggle = this.toggleAutoplay.bind(this);
    this.autoplayManuallyPaused = false;
    this.autoplayHoverPaused = false;
    this.autoplayFocusPaused = false;
    this.destroyFirstViewportHeight = setupFirstViewportHeight(this);

    document.addEventListener('shopify:block:select', this.onBlockSelect);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.isDesktop.addEventListener?.('change', this.onViewportChange);
    this.reduceMotion.addEventListener?.('change', this.onMotionChange);
    this.addEventListener('mouseenter', this.onMouseEnter);
    this.addEventListener('mouseleave', this.onMouseLeave);
    this.addEventListener('focusin', this.onFocusIn);
    this.addEventListener('focusout', this.onFocusOut);
    this.autoplayToggle?.addEventListener('click', this.onAutoplayToggle);
    this.isVisible = !('IntersectionObserver' in window);
    this.initialize();

    if ('IntersectionObserver' in window) {
      this.visibilityObserver = new IntersectionObserver((entries) => {
        this.isVisible = entries.some((entry) => entry.isIntersecting);
        if (this.isVisible) this.scheduleAutoplay();
        else this.pauseAutoplay();
      });
      this.visibilityObserver.observe(this);
    }
  }

  disconnectedCallback() {
    this.destroyFirstViewportHeight?.();
    this.destroyFirstViewportHeight = null;
    document.removeEventListener('shopify:block:select', this.onBlockSelect);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.isDesktop?.removeEventListener?.('change', this.onViewportChange);
    this.reduceMotion?.removeEventListener?.('change', this.onMotionChange);
    this.removeEventListener('mouseenter', this.onMouseEnter);
    this.removeEventListener('mouseleave', this.onMouseLeave);
    this.removeEventListener('focusin', this.onFocusIn);
    this.removeEventListener('focusout', this.onFocusOut);
    this.autoplayToggle?.removeEventListener('click', this.onAutoplayToggle);
    this.visibilityObserver?.disconnect();
    window.clearTimeout(this.autoplayTimer);
    window.cancelAnimationFrame(this.autoplayProgressFrame);
    this.swiper?.destroy(true, true);
    this.swiper = null;
  }

  initialize() {
    if (!this.slider || !this.slider.querySelector('.swiper-slide')) return;

    const slideCount = this.slider.querySelectorAll('.swiper-slide').length;
    this.slideCount = slideCount;
    const desktopSlides = this.isDoubleSlide ? 2 : 1;
    this.autoplayEnabled = this.dataset.autoplay === 'true' && !this.reduceMotion.matches && slideCount > 1;
    this.autoplayDelay = Math.max(1, Number.parseInt(this.dataset.autoplayDelay, 10) || 5) * 1000;
    const gap = Math.max(0, Number.parseInt(this.dataset.slideGap, 10) || 0);

    // Reveal every slide before Swiper measures the track. The pre-hydration
    // fallback hides non-active slides and otherwise makes mobile Safari treat
    // the carousel as a single locked slide.
    this.classList.add('slideshow--ready');

    this.swiper = new Swiper(this.slider, {
      modules: [A11y, Navigation, Parallax],
      slidesPerView: 1,
      spaceBetween: gap,
      speed: this.reduceMotion.matches ? 0 : 1000,
      loop: !this.isDoubleSlide && slideCount > desktopSlides,
      parallax: true,
      watchOverflow: true,
      grabCursor: slideCount > 1,
      navigation: {
        prevEl: this.previousButton,
        nextEl: this.nextButton,
      },
      a11y: {
        enabled: true,
        prevSlideMessage: this.previousButton?.getAttribute('aria-label') || '',
        nextSlideMessage: this.nextButton?.getAttribute('aria-label') || '',
        slideRole: 'group',
      },
      breakpoints: {
        750: {
          slidesPerView: desktopSlides,
        },
      },
    });

    this.updateControls();
    this.updateAutoplayToggle();
    this.swiper.on('slideChange', () => {
      this.resetAutoplayProgress();
      this.updateControls();
    });
    this.swiper.on('slideChangeTransitionEnd', () => this.scheduleAutoplay());
    this.scheduleAutoplay();
  }

  updateControls() {
    if (!this.swiper) return;

    const visibleSlides = this.isDoubleSlide && this.isDesktop.matches ? 2 : 1;
    const total = this.isDoubleSlide
      ? Math.max(1, this.slideCount - visibleSlides + 1)
      : this.slideCount;
    const current = this.swiper.realIndex + 1;

    if (this.currentSlide) this.currentSlide.textContent = current;
    if (this.totalSlides) this.totalSlides.textContent = total;
    if (this.progress) {
      this.progress.setAttribute('aria-valuemax', total);
      this.progress.setAttribute('aria-valuenow', Math.min(current, total));
    }
  }

  handleBlockSelect(event) {
    if (!this.swiper || event.detail?.sectionId !== this.dataset.sectionId) return;

    const selectedSlide = this.querySelector(`[data-block-id="${CSS.escape(event.detail.blockId)}"]`);
    if (!selectedSlide) return;

    const index = Number.parseInt(selectedSlide.dataset.swiperSlideIndex, 10);
    const fallbackIndex = Array.from(this.querySelectorAll('.swiper-slide:not(.swiper-slide-duplicate)')).indexOf(selectedSlide);
    this.pauseAutoplay();
    this.swiper.slideToLoop(Number.isNaN(index) ? Math.max(fallbackIndex, 0) : index, 0);
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.pauseAutoplay();
    } else {
      this.scheduleAutoplay();
    }
  }

  handleMotionChange() {
    this.autoplayEnabled = this.dataset.autoplay === 'true' && !this.reduceMotion.matches && this.slideCount > 1;
    if (this.autoplayEnabled) this.scheduleAutoplay();
    else this.pauseAutoplay();
    this.updateAutoplayToggle();
  }

  pauseForHover() {
    this.autoplayHoverPaused = true;
    this.pauseAutoplay();
  }

  resumeAfterHover() {
    this.autoplayHoverPaused = false;
    this.scheduleAutoplay();
  }

  pauseForFocus(event) {
    if (event.target.closest('[data-slideshow-autoplay-toggle]')) return;
    this.autoplayFocusPaused = true;
    this.pauseAutoplay();
  }

  resumeAfterFocus(event) {
    if (event.relatedTarget && this.contains(event.relatedTarget)) return;
    this.autoplayFocusPaused = false;
    this.scheduleAutoplay();
  }

  toggleAutoplay() {
    if (!this.autoplayEnabled) return;
    this.autoplayManuallyPaused = !this.autoplayManuallyPaused;
    if (this.autoplayManuallyPaused) this.pauseAutoplay();
    else this.scheduleAutoplay();
    this.updateAutoplayToggle();
  }

  updateAutoplayToggle() {
    if (!this.autoplayToggle) return;
    const isPaused = this.autoplayManuallyPaused || !this.autoplayEnabled;
    this.autoplayToggle.setAttribute('aria-label', isPaused ? this.autoplayToggle.dataset.resumeLabel : this.autoplayToggle.dataset.pauseLabel);
    this.autoplayToggle.setAttribute('aria-pressed', String(this.autoplayManuallyPaused));
    this.autoplayToggle.disabled = !this.autoplayEnabled;
    if (this.autoplayIcon) {
      this.autoplayIcon.setAttribute('d', isPaused ? 'm8 5.5 6 4.5-6 4.5z' : 'M7 5.5v9M13 5.5v9');
      this.autoplayIcon.setAttribute('fill', isPaused ? 'currentColor' : 'none');
    }
  }

  scheduleAutoplay() {
    window.clearTimeout(this.autoplayTimer);
    if (
      !this.autoplayEnabled
      || this.autoplayManuallyPaused
      || this.autoplayHoverPaused
      || this.autoplayFocusPaused
      || document.hidden
      || !this.isVisible
      || !this.swiper
    ) {
      this.resetAutoplayProgress();
      return;
    }

    const remainingDelay = Math.max(0, this.autoplayDelay - (this.autoplayProgressElapsed || 0));
    this.startAutoplayProgress();
    this.autoplayTimer = window.setTimeout(() => this.swiper?.slideNext(), remainingDelay);
  }

  pauseAutoplay() {
    window.clearTimeout(this.autoplayTimer);
    this.pauseAutoplayProgress();
  }

  startAutoplayProgress() {
    if (!this.progressBar) return;

    const elapsed = Math.min(this.autoplayProgressElapsed || 0, this.autoplayDelay);
    const remaining = Math.max(0, this.autoplayDelay - elapsed);
    window.cancelAnimationFrame(this.autoplayProgressFrame);
    this.progressBar.style.transition = 'none';
    this.progressBar.style.transform = `scaleX(${elapsed / this.autoplayDelay})`;
    this.progressBar.getBoundingClientRect();
    this.autoplayProgressFrame = window.requestAnimationFrame(() => {
      this.autoplayProgressFrame = window.requestAnimationFrame(() => {
        this.autoplayProgressStartedAt = performance.now();
        this.progressBar.style.transition = `transform ${remaining}ms linear`;
        this.progressBar.style.transform = 'scaleX(1)';
      });
    });
  }

  pauseAutoplayProgress() {
    if (!this.progressBar) return;

    window.cancelAnimationFrame(this.autoplayProgressFrame);
    if (this.autoplayProgressStartedAt) {
      this.autoplayProgressElapsed = Math.min(
        this.autoplayDelay,
        (this.autoplayProgressElapsed || 0) + performance.now() - this.autoplayProgressStartedAt,
      );
    }
    this.autoplayProgressStartedAt = 0;
    this.progressBar.style.transition = 'none';
    this.progressBar.style.transform = `scaleX(${(this.autoplayProgressElapsed || 0) / this.autoplayDelay})`;
  }

  resetAutoplayProgress() {
    this.autoplayProgressElapsed = 0;
    this.autoplayProgressStartedAt = 0;
    if (!this.progressBar) return;

    window.cancelAnimationFrame(this.autoplayProgressFrame);
    this.progressBar.style.transition = 'none';
    this.progressBar.style.transform = 'scaleX(0)';
  }
}

if (!customElements.get('spinel-slideshow')) {
  customElements.define('spinel-slideshow', SpinelSlideshow);
}
