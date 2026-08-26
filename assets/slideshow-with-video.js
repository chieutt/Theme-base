import Swiper from './swiper-12.2.0.min.mjs';
import A11y from './swiper-12.2.0-a11y.min.mjs';
import Parallax from './swiper-12.2.0-parallax.min.mjs';
import { setupFirstViewportHeight } from './first-viewport-height.js';

class SpinelSlideshow extends HTMLElement {
  connectedCallback() {
    this.slider = this.querySelector('[data-slideshow-slider]');
    this.paginationButtons = Array.from(this.querySelectorAll('[data-slideshow-pagination-button]'));
    this.paginationProgress = Array.from(this.querySelectorAll('.slideshow__pagination-progress'));
    this.cursor = this.querySelector('[data-slideshow-cursor]');
    this.cursorProgress = this.querySelector('.slideshow__cursor-progress');
    this.autoplayToggle = this.querySelector('[data-slideshow-autoplay-toggle]');
    this.autoplayIcon = this.querySelector('[data-slideshow-autoplay-icon]');
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    this.onBlockSelect = this.handleBlockSelect.bind(this);
    this.onVisibilityChange = this.handleVisibilityChange.bind(this);
    this.onMouseEnter = this.pauseForHover.bind(this);
    this.onMouseLeave = this.resumeAfterHover.bind(this);
    this.onFocusIn = this.pauseForFocus.bind(this);
    this.onAutoplayToggle = this.toggleAutoplay.bind(this);
    this.onClick = this.handleClick.bind(this);
    this.onPointerMove = this.handlePointerMove.bind(this);
    this.onPointerLeave = this.hideCursor.bind(this);
    this.onVideoEnded = this.handleVideoEnded.bind(this);
    this.onProgressFrame = this.updateProgress.bind(this);
    this.autoplayHoverPaused = false;
    this.destroyFirstViewportHeight = setupFirstViewportHeight(this);

    document.addEventListener('shopify:block:select', this.onBlockSelect);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.addEventListener('mouseenter', this.onMouseEnter);
    this.addEventListener('mouseleave', this.onMouseLeave);
    this.addEventListener('focusin', this.onFocusIn);
    this.autoplayToggle?.addEventListener('click', this.onAutoplayToggle);
    this.addEventListener('click', this.onClick);
    this.addEventListener('pointermove', this.onPointerMove);
    this.addEventListener('pointerleave', this.onPointerLeave);
    this.isVisible = !('IntersectionObserver' in window);
    this.initialize();

    if ('IntersectionObserver' in window) {
      this.visibilityObserver = new IntersectionObserver((entries) => {
        this.isVisible = entries.some((entry) => entry.isIntersecting);
        if (this.isVisible) {
          this.playActiveVideo();
          this.scheduleAutoplay();
        } else {
          this.pauseAutoplay();
          this.pauseActiveVideo();
        }
      });
      this.visibilityObserver.observe(this);
    }
  }

  disconnectedCallback() {
    this.destroyFirstViewportHeight?.();
    this.destroyFirstViewportHeight = null;
    document.removeEventListener('shopify:block:select', this.onBlockSelect);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.removeEventListener('mouseenter', this.onMouseEnter);
    this.removeEventListener('mouseleave', this.onMouseLeave);
    this.removeEventListener('focusin', this.onFocusIn);
    this.autoplayToggle?.removeEventListener('click', this.onAutoplayToggle);
    this.removeEventListener('click', this.onClick);
    this.removeEventListener('pointermove', this.onPointerMove);
    this.removeEventListener('pointerleave', this.onPointerLeave);
    this.videos?.forEach((video) => video.removeEventListener('ended', this.onVideoEnded));
    this.visibilityObserver?.disconnect();
    window.clearTimeout(this.autoplayTimer);
    window.cancelAnimationFrame(this.progressFrame);
    this.resetVideos();
    this.swiper?.destroy(true, true);
    this.swiper = null;
  }

  initialize() {
    if (!this.slider || !this.slider.querySelector('.swiper-slide')) return;

    const slideCount = this.slider.querySelectorAll('.swiper-slide').length;
    this.slideCount = slideCount;
    const desktopSlides = this.dataset.desktopStyle === 'double' ? 2 : 1;
    this.autoplayEnabled = this.dataset.autoplay === 'true' && !this.reduceMotion.matches && slideCount > 1;
    this.autoplayManuallyPaused = !this.autoplayEnabled;
    this.autoplayDelay = Math.max(1, Number.parseInt(this.dataset.autoplayDelay, 10) || 5) * 1000;
    const gap = Math.max(0, Number.parseInt(this.dataset.slideGap, 10) || 0);

    this.classList.add('slideshow--ready');

    this.swiper = new Swiper(this.slider, {
      modules: [A11y, Parallax],
      slidesPerView: 1,
      spaceBetween: gap,
      speed: this.reduceMotion.matches ? 0 : 1000,
      loop: slideCount > desktopSlides,
      parallax: true,
      watchOverflow: true,
      grabCursor: false,
      a11y: {
        enabled: true,
        slideRole: 'group',
      },
      breakpoints: {
        750: {
          slidesPerView: desktopSlides,
        },
      },
    });

    this.videos = Array.from(this.querySelectorAll('.slideshow__video'));
    this.videos.forEach((video) => video.addEventListener('ended', this.onVideoEnded));
    this.updatePagination();
    this.updateAutoplayToggle();
    this.swiper.on('slideChangeTransitionStart', () => {
      this.pauseAutoplay();
      this.resetVideos();
      this.resetProgress();
      this.updatePagination();
    });
    this.swiper.on('slideChangeTransitionEnd', () => {
      this.playActiveVideo();
      this.scheduleAutoplay();
    });
    this.playActiveVideo();
    this.scheduleAutoplay();
  }

  updatePagination() {
    if (!this.swiper) return;

    const current = this.swiper.realIndex + 1;
    this.paginationButtons.forEach((button, index) => {
      const isActive = index + 1 === current;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-current', isActive ? 'true' : 'false');
    });
  }

  handleBlockSelect(event) {
    if (!this.swiper || event.detail?.sectionId !== this.dataset.sectionId) return;

    const selectedSlide = this.querySelector(`[data-block-id="${CSS.escape(event.detail.blockId)}"]`);
    if (!selectedSlide) return;

    const index = Number.parseInt(selectedSlide.dataset.swiperSlideIndex, 10);
    const fallbackIndex = Array.from(this.querySelectorAll('.swiper-slide:not(.swiper-slide-duplicate)')).indexOf(selectedSlide);
    this.pauseAutoplay();
    this.goToSlide(Number.isNaN(index) ? Math.max(fallbackIndex, 0) : index, 0);
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.pauseAutoplay();
      this.pauseActiveVideo();
    } else {
      this.playActiveVideo();
      this.scheduleAutoplay();
    }
  }

  scheduleAutoplay() {
    window.clearTimeout(this.autoplayTimer);
    if (!this.autoplayEnabled || this.autoplayManuallyPaused || this.autoplayHoverPaused || document.hidden || !this.isVisible || !this.swiper) {
      this.pauseProgressTracking();
      return;
    }

    this.startProgressTracking();
    if (this.getActiveVideo()) return;
    const remainingDelay = Math.max(0, this.autoplayDelay - (this.autoplayProgressElapsed || 0));
    this.autoplayTimer = window.setTimeout(() => this.goToNextSlide(), remainingDelay);
  }

  pauseAutoplay() {
    window.clearTimeout(this.autoplayTimer);
    this.pauseProgressTracking();
  }

  pauseForHover() {
    this.autoplayHoverPaused = true;
    this.pauseAutoplay();
    this.pauseActiveVideo();
  }

  resumeAfterHover() {
    this.autoplayHoverPaused = false;
    this.playActiveVideo();
    this.scheduleAutoplay();
  }

  pauseForFocus(event) {
    if (event.target.closest('[data-slideshow-autoplay-toggle]')) return;
    if (!this.autoplayEnabled || this.autoplayManuallyPaused) return;

    this.autoplayManuallyPaused = true;
    this.pauseAutoplay();
    this.getActiveVideo()?.pause();
    this.updateAutoplayToggle();
  }

  toggleAutoplay() {
    if (!this.autoplayEnabled) return;

    this.autoplayManuallyPaused = !this.autoplayManuallyPaused;
    if (this.autoplayManuallyPaused) {
      this.pauseAutoplay();
      this.getActiveVideo()?.pause();
    } else {
      this.playActiveVideo();
      this.scheduleAutoplay();
    }
    this.updateAutoplayToggle();
  }

  updateAutoplayToggle() {
    if (!this.autoplayToggle) return;

    const isPaused = this.autoplayManuallyPaused || !this.autoplayEnabled;
    const label = isPaused ? this.autoplayToggle.dataset.resumeLabel : this.autoplayToggle.dataset.pauseLabel;
    this.autoplayToggle.setAttribute('aria-label', label || '');
    this.autoplayToggle.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
    this.autoplayToggle.disabled = !this.autoplayEnabled;
    if (this.autoplayIcon) {
      this.autoplayIcon.setAttribute('d', isPaused ? 'm8 5.5 6 4.5-6 4.5z' : 'M7 5.5v9M13 5.5v9');
      this.autoplayIcon.setAttribute('fill', isPaused ? 'currentColor' : 'none');
    }
  }

  getActiveVideo() {
    return this.querySelector('.swiper-slide-active .slideshow__video');
  }

  playActiveVideo() {
    const video = this.getActiveVideo();
    if (!video || !this.autoplayEnabled || this.autoplayManuallyPaused || this.autoplayHoverPaused || document.hidden || !this.isVisible) return;

    video.play().catch(() => {});
  }

  pauseActiveVideo() {
    this.getActiveVideo()?.pause();
  }

  startProgressTracking() {
    if (!this.autoplayEnabled || this.autoplayManuallyPaused || this.autoplayHoverPaused || document.hidden || !this.isVisible) return;
    window.cancelAnimationFrame(this.progressFrame);
    if (!this.autoplayProgressStartedAt && !this.getActiveVideo()) {
      this.autoplayProgressStartedAt = performance.now();
    }
    this.progressFrame = window.requestAnimationFrame(this.onProgressFrame);
  }

  updateProgress() {
    if (!this.autoplayEnabled || this.autoplayManuallyPaused || this.autoplayHoverPaused || document.hidden || !this.isVisible) {
      this.pauseProgressTracking();
      return;
    }
    const video = this.getActiveVideo();
    let ratio = 0;

    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      ratio = Math.min(1, video.currentTime / video.duration);
    } else if (!video && this.autoplayDelay > 0) {
      const elapsed = (this.autoplayProgressElapsed || 0) + (this.autoplayProgressStartedAt ? performance.now() - this.autoplayProgressStartedAt : 0);
      ratio = Math.min(1, elapsed / this.autoplayDelay);
    }

    this.setProgress(ratio);
    this.progressFrame = window.requestAnimationFrame(this.onProgressFrame);
  }

  setProgress(ratio) {
    const activeIndex = this.swiper?.realIndex || 0;
    this.paginationProgress.forEach((progress, index) => {
      progress.style.strokeDashoffset = `${87.96 * (index === activeIndex ? 1 - ratio : 1)}`;
    });
    if (this.cursorProgress) this.cursorProgress.style.strokeDashoffset = `${169.65 * (1 - ratio)}`;
  }

  pauseProgressTracking() {
    window.cancelAnimationFrame(this.progressFrame);
    if (this.autoplayProgressStartedAt) {
      this.autoplayProgressElapsed = Math.min(
        this.autoplayDelay,
        (this.autoplayProgressElapsed || 0) + performance.now() - this.autoplayProgressStartedAt,
      );
      this.autoplayProgressStartedAt = 0;
    }
  }

  resetProgress() {
    window.cancelAnimationFrame(this.progressFrame);
    this.autoplayProgressElapsed = 0;
    this.autoplayProgressStartedAt = 0;
    this.setProgress(0);
  }

  resetVideos() {
    this.videos?.forEach((video) => {
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
      }
    });
  }

  handleVideoEnded(event) {
    const slide = event.currentTarget.closest('.swiper-slide');
    if (!slide?.classList.contains('swiper-slide-active')) return;

    this.goToNextSlide();
  }

  goToNextSlide() {
    if (!this.swiper) return;

    if (this.swiper.params.loop) {
      this.swiper.slideNext();
      return;
    }

    this.swiper.slideTo((this.swiper.realIndex + 1) % this.slideCount);
  }

  goToPreviousSlide() {
    if (!this.swiper) return;

    if (this.swiper.params.loop) {
      this.swiper.slidePrev();
      return;
    }

    this.swiper.slideTo((this.swiper.realIndex - 1 + this.slideCount) % this.slideCount);
  }

  goToSlide(index, speed) {
    if (!this.swiper) return;

    if (this.swiper.params.loop) {
      this.swiper.slideToLoop(index, speed);
      return;
    }

    this.swiper.slideTo(index, speed);
  }

  handleClick(event) {
    const paginationButton = event.target.closest('[data-slideshow-pagination-button]');
    if (paginationButton) {
      const index = Number.parseInt(paginationButton.dataset.slideshowSlideIndex, 10);
      if (!Number.isNaN(index)) this.goToSlide(index);
      return;
    }

    if (event.target.closest('a, button, input, textarea, select, label') || this.swiper?.allowClick === false) return;

    const bounds = this.getBoundingClientRect();
    if (event.clientX - bounds.left < bounds.width / 2) this.goToPreviousSlide();
    else this.goToNextSlide();
  }

  handlePointerMove(event) {
    if (!this.finePointer.matches || !this.cursor) return;

    if (event.target.closest('a, button, input, textarea, select, label')) {
      this.hideCursor();
      return;
    }

    const bounds = this.getBoundingClientRect();
    const isPrevious = event.clientX - bounds.left < bounds.width / 2;
    const cursorX = Math.round(event.clientX - bounds.left);
    const cursorY = Math.round(event.clientY - bounds.top);
    this.cursor.classList.toggle('slideshow__cursor--previous', isPrevious);
    this.cursor.style.left = `${cursorX}px`;
    this.cursor.style.top = `${cursorY}px`;
    this.classList.add('slideshow--cursor-active');
  }

  hideCursor() {
    this.classList.remove('slideshow--cursor-active');
  }
}

if (!customElements.get('spinel-slideshow-video')) {
  customElements.define('spinel-slideshow-video', SpinelSlideshow);
}
