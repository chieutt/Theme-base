import Swiper from './swiper-12.2.0.min.mjs';

if (!customElements.get('announcement-bar')) {
  class AnnouncementBar extends HTMLElement {
    connectedCallback() {
      if (this.initialized || this.dataset.layout === 'marquee') return;
      this.initialized = true;

      this.slider = this.querySelector('[data-announcement-slider]');
      this.items = Array.from(this.querySelectorAll('[data-announcement-item]'));
      this.status = this.querySelector('[data-announcement-status]');
      this.motionEnabled = this.dataset.motionEnabled !== 'false';
      this.interval = Number(this.dataset.interval) || 5000;
      // Let the current message fade in place before Swiper starts translating.
      this.slideStartDelay = 100;
      this.slideDelayTimer = null;
      this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reduceMotion = this.motionPreference.matches || !this.motionEnabled;
      this.index = 0;
      this.isPointerInside = this.matches(':hover');
      this.hasFocusWithin = this.contains(document.activeElement);
      this.rotationStoppedByUser = false;
      this.editorPaused = false;
      this.selectedEditorBlockId = null;
      this.announceNextChange = false;

      this.onBlockSelect = this.handleBlockSelect.bind(this);
      this.onBlockDeselect = this.handleBlockDeselect.bind(this);
      this.onMouseEnter = this.handleMouseEnter.bind(this);
      this.onMouseLeave = this.handleMouseLeave.bind(this);
      this.onFocusIn = this.handleFocusIn.bind(this);
      this.onFocusOut = this.handleFocusOut.bind(this);
      this.onNavigatorClick = this.handleNavigatorClick.bind(this);
      this.onMotionPreferenceChange = this.handleMotionPreferenceChange.bind(this);
      this.onVisibilityChange = this.handleVisibilityChange.bind(this);

      this.addEventListener('mouseenter', this.onMouseEnter);
      this.addEventListener('mouseleave', this.onMouseLeave);
      this.addEventListener('focusin', this.onFocusIn);
      this.addEventListener('focusout', this.onFocusOut);
      this.addEventListener('click', this.onNavigatorClick);
      this.motionPreference.addEventListener('change', this.onMotionPreferenceChange);
      document.addEventListener('shopify:block:select', this.onBlockSelect);
      document.addEventListener('shopify:block:deselect', this.onBlockDeselect);
      document.addEventListener('visibilitychange', this.onVisibilityChange);

      this.initializeSwiper();
      this.classList.add('is-ready');
      this.startRotation();
    }

    disconnectedCallback() {
      if (!this.initialized) return;
      this.initialized = false;
      this.stopRotation();
      window.clearTimeout(this.slideDelayTimer);
      this.slideDelayTimer = null;
      this.slider?.classList.remove('is-slide-preparing');
      cancelAnimationFrame(this.measureFrame);
      this.resizeObserver?.disconnect();
      this.removeEventListener('mouseenter', this.onMouseEnter);
      this.removeEventListener('mouseleave', this.onMouseLeave);
      this.removeEventListener('focusin', this.onFocusIn);
      this.removeEventListener('focusout', this.onFocusOut);
      this.removeEventListener('click', this.onNavigatorClick);
      this.motionPreference?.removeEventListener('change', this.onMotionPreferenceChange);
      document.removeEventListener('shopify:block:select', this.onBlockSelect);
      document.removeEventListener('shopify:block:deselect', this.onBlockDeselect);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      this.swiper?.destroy(true, true);
      this.swiper = null;
      this.classList.remove('is-ready');
    }

    initializeSwiper() {
      if (!this.slider || this.items.length < 2) {
        return;
      }

      this.measureSliderHeight();
      const transitionSpeed = this.reduceMotion ? 0 : 420;
      this.slider.style.setProperty('--announcement-bar-transition-duration', `${transitionSpeed}ms`);

      this.swiper = new Swiper(this.slider, {
        direction: 'vertical',
        slidesPerView: 1,
        spaceBetween: 0,
        loop: true,
        speed: transitionSpeed,
        watchOverflow: true,
        grabCursor: false,
        allowTouchMove: true,
      });

      this.swiper.on('slideChange', () => {
        this.index = this.swiper.realIndex;
        this.updateSlideAccessibility();
        if (this.announceNextChange) {
          this.announceCurrentSlide();
          this.announceNextChange = false;
        }
      });
      this.swiper.on('sliderFirstMove', () => this.handleManualInteraction(true));

      this.resizeObserver = new ResizeObserver((entries) => {
        const width = Math.round(entries[0]?.contentRect.width || 0);
        if (!width || width === this.lastMeasuredWidth) return;
        this.lastMeasuredWidth = width;
        this.scheduleHeightMeasurement();
      });
      this.resizeObserver.observe(this.slider);
      document.fonts?.ready.then(() => {
        if (this.initialized) this.scheduleHeightMeasurement();
      });

      this.updateSlideAccessibility();
    }

    scheduleHeightMeasurement() {
      cancelAnimationFrame(this.measureFrame);
      this.measureFrame = requestAnimationFrame(() => this.measureSliderHeight());
    }

    measureSliderHeight() {
      if (!this.slider || !this.items.length) return;
      const currentHeight = this.slider.style.height;
      this.slider.style.height = 'auto';
      this.items.forEach((item) => item.style.removeProperty('height'));
      const tallestSlide = Math.max(...this.items.map((item) => Math.ceil(item.scrollHeight)));
      this.slider.style.height = tallestSlide > 0 ? `${tallestSlide}px` : currentHeight;
      this.swiper?.update();
    }

    startRotation() {
      this.stopRotation();
      if (
        this.dataset.behavior !== 'rotate'
        || this.items.length < 2
        || this.reduceMotion
        || this.rotationStoppedByUser
        || this.editorPaused
        || this.isPointerInside
        || this.hasFocusWithin
        || document.hidden
        || !this.swiper
      ) return;

      this.rotationTimer = window.setInterval(() => {
        const current = this.swiper?.realIndex ?? this.index;
        this.showItem(current + 1, 'next');
      }, this.interval);
    }

    stopRotation() {
      window.clearInterval(this.rotationTimer);
      this.rotationTimer = null;
    }

    handleVisibilityChange() {
      if (document.hidden) {
        this.stopRotation();
        window.clearTimeout(this.slideDelayTimer);
        this.slideDelayTimer = null;
        this.slider?.classList.remove('is-slide-preparing');
        return;
      }
      this.startRotation();
    }

    showItem(index, direction = null, speedOverride = null) {
      if (!this.swiper || this.items.length < 2) return;

      window.clearTimeout(this.slideDelayTimer);
      this.slideDelayTimer = null;
      this.slider.classList.remove('is-slide-preparing');
      const nextIndex = (index + this.items.length) % this.items.length;
      const currentIndex = this.swiper.realIndex ?? this.index;
      if (nextIndex === currentIndex) return;

      const speed = speedOverride ?? (this.reduceMotion ? 0 : this.swiper.params.speed);
      const transition = () => {
        this.slideDelayTimer = null;
        if (!this.initialized || !this.swiper) {
          this.slider?.classList.remove('is-slide-preparing');
          return;
        }
        if (direction === 'next') {
          this.swiper.slideNext(speed);
        } else if (direction === 'prev') {
          this.swiper.slidePrev(speed);
        } else {
          this.swiper.slideToLoop(nextIndex, speed);
        }
        requestAnimationFrame(() => this.slider?.classList.remove('is-slide-preparing'));
      };

      if (speed === 0 || this.reduceMotion) {
        transition();
        return;
      }
      this.slider.classList.add('is-slide-preparing');
      this.slideDelayTimer = window.setTimeout(transition, this.slideStartDelay);
    }

    updateSlideAccessibility() {
      requestAnimationFrame(() => {
        this.slider?.querySelectorAll('.swiper-slide').forEach((slide) => {
          const isActive = slide.classList.contains('swiper-slide-active');
          slide.setAttribute('aria-hidden', String(!isActive));
          slide.toggleAttribute('inert', !isActive);
        });
      });
    }

    announceCurrentSlide() {
      if (!this.status) return;
      const current = (this.swiper?.realIndex ?? this.index) + 1;
      const template = this.status.dataset.statusTemplate || 'Announcement [current] of [total]';
      this.status.textContent = template
        .replace('[current]', String(current))
        .replace('[total]', String(this.items.length));
    }

    handleBlockSelect(event) {
      if (event.detail?.sectionId !== this.dataset.sectionId) return;
      const selectedSlide = this.items.find((item) => item.dataset.blockId === event.detail.blockId);
      if (!selectedSlide) return;

      this.editorPaused = true;
      this.selectedEditorBlockId = event.detail.blockId;
      this.stopRotation();
      this.showItem(this.items.indexOf(selectedSlide), null, 0);
    }

    handleBlockDeselect(event) {
      if (event.detail?.sectionId !== this.dataset.sectionId) return;
      if (this.selectedEditorBlockId !== event.detail.blockId) return;
      this.editorPaused = false;
      this.selectedEditorBlockId = null;
      this.startRotation();
    }

    handleMouseEnter() {
      this.isPointerInside = true;
      this.stopRotation();
    }

    handleMouseLeave() {
      this.isPointerInside = false;
      this.startRotation();
    }

    handleFocusIn() {
      this.hasFocusWithin = true;
      this.stopRotation();
    }

    handleFocusOut(event) {
      if (this.contains(event.relatedTarget)) return;
      this.hasFocusWithin = false;
      this.startRotation();
    }

    handleNavigatorClick(event) {
      const control = event.target.closest('[data-announcement-step]');
      if (!control || !this.contains(control)) return;

      event.preventDefault();
      this.handleManualInteraction(true);
      const step = Number(control.dataset.announcementStep);
      const current = this.swiper?.realIndex ?? this.index;
      this.showItem(current + step, step > 0 ? 'next' : 'prev');
    }

    handleManualInteraction(announceChange = false) {
      this.rotationStoppedByUser = true;
      this.announceNextChange = announceChange;
      this.stopRotation();
    }

    handleMotionPreferenceChange(event) {
      this.reduceMotion = event.matches || !this.motionEnabled;
      if (this.reduceMotion) {
        window.clearTimeout(this.slideDelayTimer);
        this.slideDelayTimer = null;
        this.slider?.classList.remove('is-slide-preparing');
      }
      if (this.swiper) {
        const transitionSpeed = this.reduceMotion ? 0 : 420;
        this.swiper.params.speed = transitionSpeed;
        this.swiper.params.grabCursor = false;
        this.slider?.style.setProperty('--announcement-bar-transition-duration', `${transitionSpeed}ms`);
        this.swiper.allowTouchMove = this.items.length > 1;
      }
      if (this.reduceMotion) this.stopRotation();
      else this.startRotation();
    }
  }

  customElements.define('announcement-bar', AnnouncementBar);
}
