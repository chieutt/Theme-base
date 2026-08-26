import { A11y, EffectFade, Swiper } from './swiper-loader.js';

class EditorialSlideshow extends HTMLElement {
  connectedCallback() {
    if (this.abortController) return;

    this.abortController = new AbortController();
    const { signal } = this.abortController;
    this.slider = this.querySelector('[data-editorial-slideshow-slider]');
    this.navigator = this.querySelector('[data-editorial-navigator]');
    this.productStage = this.querySelector('[data-editorial-product-stage]');
    this.tabsContainer = this.querySelector('[data-editorial-slide-tabs]');
    this.mobileCurrent = this.querySelector('[data-editorial-mobile-current]');
    this.mobileTotal = this.querySelector('[data-editorial-mobile-total]');
    this.mobileLabel = this.querySelector('[data-editorial-mobile-label]');
    this.previousButton = this.querySelector('[data-editorial-previous]');
    this.nextButton = this.querySelector('[data-editorial-next]');
    this.autoplayToggle = this.querySelector('[data-editorial-autoplay-toggle]');
    this.tabs = [];
    this.progressBars = [];
    this.productCards = [];
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.mobileStackedLayout = window.matchMedia('(max-width: 767.98px)');
    // The split layout keeps the navigator in its own lower row. It must remain
    // horizontal at every desktop width rather than collapsing over the slide.
    this.compactNavigator = window.matchMedia('(max-width: 0px)');
    this.isCompactNavigator = this.compactNavigator.matches;
    this.autoplaySetting = this.dataset.autoplay === 'true';
    this.autoplayDelay = Math.max(1000, Number(this.dataset.autoplayDelay) || 6000);
    this.autoplayManuallyPaused = false;
    this.manualPauseProgress = null;
    this.animatePausedProgress = false;
    this.delayProgressStartForExit = false;
    this.progressExitTimers = new Map();
    this.progressStartedAt = null;
    this.progressStartElapsed = 0;
    this.progressStartIndex = null;
    this.navigatorRevealTimer = null;
    this.navigatorRevealFallbackTimer = null;
    this.pointerFocusTimer = null;
    this.isPointerFocus = false;
    this.pauseReasons = new Set();
    this.slideSignature = '';
    this.slideRefreshFrame = null;
    this.slideObserver = null;
    this.announcementBarResizeObserver = null;
    this.isInViewport = !('IntersectionObserver' in window);

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleBlockSelect = this.handleBlockSelect.bind(this);
    this.handleMotionPreferenceChange = this.handleMotionPreferenceChange.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handleCompactNavigatorChange = this.handleCompactNavigatorChange.bind(this);
    this.handleViewportResize = this.handleViewportResize.bind(this);
    this.handleAnnouncementBarChange = this.handleAnnouncementBarChange.bind(this);

    this.buildNavigatorTabs();
    this.addEventListener('keydown', this.handleKeydown, { signal });
    this.addEventListener('pointerdown', this.handlePointerDown, { signal });
    this.addEventListener('focusin', () => this.handleFocusIn(), { signal });
    this.addEventListener('focusout', (event) => this.handleFocusOut(event), { signal });
    this.bindNavigatorTabs();
    this.autoplayToggle?.addEventListener('click', () => this.toggleAutoplay(), { signal });
    this.previousButton?.addEventListener('click', () => this.selectIndex((this.activeIndex || 0) - 1), { signal });
    this.nextButton?.addEventListener('click', () => this.selectIndex((this.activeIndex || 0) + 1), { signal });
    document.addEventListener('visibilitychange', this.handleVisibilityChange, { signal });
    document.addEventListener('shopify:block:select', this.handleBlockSelect, { signal });
    this.reduceMotion.addEventListener?.('change', this.handleMotionPreferenceChange, { signal });
    this.compactNavigator.addEventListener?.('change', this.handleCompactNavigatorChange, { signal });
    window.addEventListener('resize', this.handleViewportResize, { signal });
    document.addEventListener('shopify:section:load', this.handleAnnouncementBarChange, { signal });
    document.addEventListener('shopify:section:unload', this.handleAnnouncementBarChange, { signal });
    document.addEventListener('shopify:section:reorder', this.handleAnnouncementBarChange, { signal });

    this.observeAnnouncementBars();

    if (this.autoplayToggle && !this.autoplaySetting) {
      this.autoplayToggle.disabled = true;
      this.autoplayToggle.setAttribute('aria-pressed', 'false');
    }

    this.initialize();
    this.observeSlideCollection();

    if ('IntersectionObserver' in window) {
      this.visibilityObserver = new IntersectionObserver(
        (entries) => {
          this.isInViewport = entries.some((entry) => entry.isIntersecting);
          this.syncPlayback();
        },
        { threshold: 0.01 },
      );
      this.visibilityObserver.observe(this);
    }
  }

  disconnectedCallback() {
    this.slideObserver?.disconnect();
    this.slideObserver = null;
    this.announcementBarResizeObserver?.disconnect();
    this.announcementBarResizeObserver = null;
    if (this.slideRefreshFrame) window.cancelAnimationFrame(this.slideRefreshFrame);
    this.slideRefreshFrame = null;
    this.abortController?.abort();
    this.abortController = null;
    this.visibilityObserver?.disconnect();
    this.visibilityObserver = null;
    this.clearAutoplayTimer();
    this.cancelProgressFrame();
    this.progressExitTimers?.forEach((timer) => window.clearTimeout(timer));
    this.progressExitTimers?.clear();
    this.clearNavigatorRevealTimer();
    if (this.pointerFocusTimer) window.clearTimeout(this.pointerFocusTimer);
    this.pointerFocusTimer = null;
    this.isPointerFocus = false;
    this.navigator?.classList.remove('is-transitioning');
    this.navigator?.classList.remove('is-collapsed');
    this.navigator?.setAttribute('hidden', '');
    this.classList.remove('editorial-slideshow--navigator-collapsed', 'editorial-slideshow--has-navigator');
    this.swiper?.destroy(true, true);
    this.swiper = null;
    this.pauseReasons?.clear();
  }

  getSlides() {
    return this.slider
      ? [...this.slider.querySelectorAll('.editorial-slideshow__slide:not(.swiper-slide-duplicate)')]
      : [];
  }

  collectProductCards() {
    if (!this.productStage) return;

    const cards = [];
    this.getSlides().forEach((slide) => {
      const productCard = slide.querySelector('.editorial-slideshow__product-card');
      if (!productCard) return;

      productCard.dataset.editorialSlideId = slide.dataset.blockId || '';
      cards.push(productCard);
    });

    this.productCards = [
      ...this.productStage.querySelectorAll('.editorial-slideshow__product-card'),
      ...cards,
    ].filter((card, index, collection) => collection.indexOf(card) === index);

    this.productCards.forEach((productCard) => this.productStage.append(productCard));
  }

  syncActiveProductCard(index) {
    if (!this.productCards.length) return;

    const activeSlide = this.getSlides()[index];
    const activeBlockId = activeSlide?.dataset.blockId || '';

    this.productCards.forEach((productCard) => {
      const isActive = productCard.dataset.editorialSlideId === activeBlockId;
      productCard.classList.toggle('is-active', isActive);
      productCard.toggleAttribute('aria-hidden', !isActive);
    });
  }

  syncMobileViewportHeight() {
    if (!this.slider) return;

    if (!this.mobileStackedLayout.matches) {
      this.slider.style.removeProperty('height');
      return;
    }

    const setHeight = () => {
      if (!this.isConnected || !this.mobileStackedLayout.matches) return;

      // A desktop-to-mobile breakpoint change can leave the last desktop
      // height inline on the Swiper viewport. Clear it before measuring so
      // the normal-flow mobile slide determines its own height immediately.
      this.slider.style.setProperty('height', 'auto', 'important');

      window.requestAnimationFrame(() => {
        if (!this.isConnected || !this.mobileStackedLayout.matches) return;

        const activeSlide = this.getSlides()[this.activeIndex || 0];
        if (!activeSlide) return;

        this.slider.style.setProperty('height', `${activeSlide.scrollHeight}px`, 'important');
      });
    };

    window.requestAnimationFrame(() => window.requestAnimationFrame(setHeight));
  }

  observeAnnouncementBars() {
    this.announcementBarResizeObserver?.disconnect();
    this.announcementBarResizeObserver = 'ResizeObserver' in window
      ? new ResizeObserver(() => this.updateAnnouncementBarHeight())
      : null;

    document.querySelectorAll('announcement-bar').forEach((announcementBar) => {
      this.announcementBarResizeObserver?.observe(announcementBar);
    });
    this.updateAnnouncementBarHeight();
  }

  handleAnnouncementBarChange() {
    window.requestAnimationFrame(() => {
      if (!this.isConnected) return;
      this.observeAnnouncementBars();
    });
  }

  updateAnnouncementBarHeight() {
    const announcementBarHeight = [...document.querySelectorAll('announcement-bar')]
      .filter((announcementBar) => !announcementBar.hidden && getComputedStyle(announcementBar).display !== 'none')
      .reduce((height, announcementBar) => height + announcementBar.getBoundingClientRect().height, 0);

    this.style.setProperty('--editorial-announcement-bar-height', `${announcementBarHeight}px`);
  }

  preloadSlideImage(slide) {
    slide?.querySelectorAll('img[loading="lazy"]').forEach((image) => {
      if (!image.complete || image.naturalWidth === 0) image.loading = 'eager';
    });
  }

  preloadAdjacentSlides(index = this.activeIndex || 0) {
    const slides = this.getSlides();
    if (slides.length < 2) return;

    const normalizedIndex = (index + slides.length) % slides.length;
    const getSlideAtIndex = (slideIndex) => {
      const blockId = this.tabs[slideIndex]?.dataset.editorialBlockId;
      return slides.find((slide) => slide.dataset.blockId === blockId) || slides[slideIndex];
    };
    [normalizedIndex, normalizedIndex - 1, normalizedIndex + 1].forEach((slideIndex) => {
      this.preloadSlideImage(getSlideAtIndex((slideIndex + slides.length) % slides.length));
    });
  }

  getSlideSignature() {
    return this.getSlides()
      .map((slide) => [
        slide.dataset.blockId,
        slide.dataset.editorialNavLabel,
        slide.dataset.editorialNavDetail,
        slide.dataset.editorialDesktopRatio,
        slide.dataset.editorialMobileRatio,
      ].join('::'))
      .join('|');
  }

  bindNavigatorTabs() {
    this.tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        this.selectIndex(Number.parseInt(tab.dataset.editorialIndex, 10));
      }, { signal: this.abortController?.signal });
    });
  }

  observeSlideCollection() {
    if (!this.slider || !('MutationObserver' in window)) return;

    this.slideObserver = new MutationObserver(() => this.queueSlideRefresh());
    this.slideObserver.observe(this.slider, {
      attributes: true,
      attributeFilter: [
        'data-block-id',
        'data-editorial-nav-label',
        'data-editorial-nav-detail',
        'data-editorial-desktop-ratio',
        'data-editorial-mobile-ratio',
      ],
      childList: true,
      subtree: true,
    });
  }

  queueSlideRefresh() {
    if (this.slideRefreshFrame) return;

    this.slideRefreshFrame = window.requestAnimationFrame(() => {
      this.slideRefreshFrame = window.requestAnimationFrame(() => {
        this.slideRefreshFrame = null;
        if (this.isConnected) this.refreshSlideCollection();
      });
    });
  }

  refreshSlideCollection() {
    const nextSignature = this.getSlideSignature();
    const activeSlide = this.getSlides().find((slide) => slide.classList.contains('swiper-slide-active'));
    if (nextSignature === this.slideSignature && activeSlide) return;

    const activeBlockId = activeSlide?.dataset.blockId
      || this.tabs[this.activeIndex || 0]?.dataset.editorialBlockId;
    this.classList.remove('editorial-slideshow--ready');
    this.destroySwiper();
    this.collectProductCards();
    this.buildNavigatorTabs();
    this.bindNavigatorTabs();

    const nextSlides = this.getSlides();
    const nextActiveIndex = nextSlides.findIndex((slide) => slide.dataset.blockId === activeBlockId);
    this.initialize(nextActiveIndex >= 0 ? nextActiveIndex : 0);
  }

  syncNavigatorViewportState() {
    if (!this.navigator) return;

    const isCompact = this.compactNavigator.matches;
    this.navigator.classList.remove('is-transitioning');
    this.navigator.classList.toggle('is-collapsed', isCompact);

    if (!this.classList.contains('editorial-slideshow--has-navigator')) {
      this.classList.remove('editorial-slideshow--navigator-collapsed');
      return;
    }

    this.classList.toggle('editorial-slideshow--navigator-collapsed', isCompact);
  }

  syncSlideRatios() {
    const firstSlide = this.getSlides()[0];
    if (!firstSlide) return;

    const desktopRatio = Number(firstSlide.dataset.editorialDesktopRatio);
    const mobileRatio = Number(firstSlide.dataset.editorialMobileRatio);
    if (desktopRatio > 0) this.style.setProperty('--editorial-slideshow-desktop-ratio', desktopRatio);
    if (mobileRatio > 0) this.style.setProperty('--editorial-slideshow-mobile-ratio', mobileRatio);
  }

  buildNavigatorTabs() {
    if (!this.tabsContainer) return;

    this.tabsContainer.replaceChildren();
    this.getSlides().forEach((slide, index) => {
      const tab = document.createElement('button');
      const label = document.createElement('span');
      const detail = document.createElement('span');
      const number = document.createElement('span');
      const progress = document.createElement('span');
      const isActive = index === 0;

      tab.className = `editorial-slideshow__tab${isActive ? ' is-active' : ''}`;
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(isActive));
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
      tab.dataset.editorialSlideTab = '';
      tab.dataset.editorialIndex = String(index);
      tab.dataset.editorialBlockId = slide.dataset.blockId || '';

      label.className = 'editorial-slideshow__tab-label';
      label.textContent = slide.dataset.editorialNavLabel || 'Slide';
      detail.className = 'editorial-slideshow__tab-detail';
      detail.textContent = slide.dataset.editorialNavDetail || 'EDITORIAL';
      number.className = 'editorial-slideshow__tab-number';
      number.textContent = String(index + 1).padStart(2, '0');
      tab.setAttribute('aria-label', `${number.textContent} ${label.textContent}`);
      progress.className = 'editorial-slideshow__tab-progress';
      progress.setAttribute('aria-hidden', 'true');
      tab.append(label, detail, number, progress);
      this.tabsContainer.append(tab);
    });

    this.tabs = [...this.tabsContainer.querySelectorAll('[data-editorial-slide-tab]')];
    this.progressBars = [...this.tabsContainer.querySelectorAll('.editorial-slideshow__tab-progress')];
    if (this.mobileTotal) this.mobileTotal.textContent = String(this.tabs.length).padStart(2, '0');
    if (this.mobileCurrent) this.mobileCurrent.textContent = '01';
    if (this.mobileLabel) this.mobileLabel.textContent = this.getSlides()[0]?.dataset.editorialNavLabel || 'Slide';
    this.syncSlideRatios();
  }

  syncNavigatorAvailability(slideCount) {
    const hasNavigator = Boolean(this.navigator && slideCount > 1 && this.tabs.length > 1);
    this.classList.toggle('editorial-slideshow--has-navigator', hasNavigator);
    this.navigator?.toggleAttribute('hidden', !hasNavigator);

    if (hasNavigator) {
      this.syncNavigatorViewportState();
      return true;
    }

    this.clearNavigatorRevealTimer();
    this.navigator?.classList.remove('is-transitioning');
    this.classList.remove('editorial-slideshow--navigator-collapsed');
    return false;
  }

  destroySwiper() {
    this.clearNavigatorRevealTimer();
    this.clearAutoplayTimer();
    this.cancelProgressFrame();
    this.swiper?.destroy(true, true);
    this.swiper = null;
  }

  initialize(initialSlide = 0) {
    const slideCount = this.getSlides().length;
    this.slideCount = slideCount;
    this.slideSignature = this.getSlideSignature();
    this.syncNavigatorAvailability(slideCount);
    this.classList.toggle('editorial-slideshow--ready', slideCount > 0);
    if (!slideCount) return;

    this.collectProductCards();
    this.preloadAdjacentSlides(initialSlide);

    try {
      this.swiper = new Swiper(this.slider, {
        modules: [A11y, EffectFade],
        slidesPerView: 1,
        speed: this.reduceMotion.matches ? 0 : 1000,
        effect: 'fade',
        fadeEffect: {
          crossFade: true,
        },
        initialSlide: Math.max(0, Math.min(initialSlide, slideCount - 1)),
        loop: false,
        rewind: slideCount > 1,
        watchOverflow: true,
        grabCursor: slideCount > 1,
        a11y: {
          enabled: true,
          prevSlideMessage: this.previousButton?.getAttribute('aria-label') || '',
          nextSlideMessage: this.nextButton?.getAttribute('aria-label') || '',
          slideRole: 'group',
        },
      });
    } catch (error) {
      this.classList.remove('editorial-slideshow--ready');
      throw error;
    }

    this.swiper.on('slideChange', () => {
      this.syncActiveState(this.swiper.realIndex, true);
    });
    this.swiper.on('slideChangeTransitionStart', () => this.setNavigatorTransitioning(true));
    const revealNavigator = () => {
      this.setNavigatorTransitioning(false);
      this.syncPlayback();
    };
    this.swiper.on('slideChangeTransitionEnd', revealNavigator);
    this.swiper.on('transitionEnd', revealNavigator);
    this.syncActiveState(this.swiper.realIndex || 0, false);
    this.syncMobileViewportHeight();
    this.syncPlayback();
  }

  clearNavigatorRevealTimer() {
    if (this.navigatorRevealTimer) window.clearTimeout(this.navigatorRevealTimer);
    if (this.navigatorRevealFallbackTimer) window.clearTimeout(this.navigatorRevealFallbackTimer);
    this.navigatorRevealTimer = null;
    this.navigatorRevealFallbackTimer = null;
  }

  setNavigatorTransitioning(isTransitioning) {
    if (!this.navigator) return;

    this.clearNavigatorRevealTimer();

    if (isTransitioning) {
      if (!this.navigator.classList.contains('is-collapsed')) this.navigator.classList.add('is-transitioning');

      const transitionDuration = this.reduceMotion.matches ? 0 : Number(this.swiper?.params.speed) || 0;
      if (transitionDuration > 0) {
        this.navigatorRevealFallbackTimer = window.setTimeout(() => {
          this.navigatorRevealFallbackTimer = null;
          this.setNavigatorTransitioning(false);
        }, transitionDuration + 80);
      } else {
        this.setNavigatorTransitioning(false);
      }

      return;
    }

    if (this.reduceMotion.matches) {
      this.navigator.classList.remove('is-transitioning');
      return;
    }

    this.navigatorRevealTimer = window.setTimeout(() => {
      this.navigator?.classList.remove('is-transitioning');
      this.navigatorRevealTimer = null;
    }, 60);
  }

  get canAutoplay() {
    return this.autoplaySetting && this.slideCount > 1 && !this.reduceMotion.matches;
  }

  get isPlaying() {
    return this.canAutoplay && !this.autoplayManuallyPaused && this.pauseReasons.size === 0 && this.isInViewport && !document.hidden;
  }

  syncActiveState(index, restartProgress = true) {
    if (!this.tabs.length) return;

    const activeIndex = Math.max(0, Math.min(index, this.tabs.length - 1));
    const previousIndex = this.activeIndex;
    this.activeIndex = activeIndex;
    this.delayProgressStartForExit = restartProgress
      && Number.isInteger(previousIndex)
      && previousIndex !== activeIndex;
    this.clearProgressExit(activeIndex);
    this.preloadAdjacentSlides(activeIndex);
    this.tabs.forEach((tab, tabIndex) => {
      const isActive = tabIndex === activeIndex;
      tab.classList.toggle('is-active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });
    if (this.mobileCurrent) this.mobileCurrent.textContent = String(activeIndex + 1).padStart(2, '0');
    if (this.mobileLabel) {
      this.mobileLabel.textContent = this.getSlides()[activeIndex]?.dataset.editorialNavLabel || 'Slide';
    }
    this.syncActiveProductCard(activeIndex);
    this.syncMobileViewportHeight();

    if (restartProgress) {
      this.manualPauseProgress = null;
      this.animatePausedProgress = this.autoplayManuallyPaused;
      this.progressStartedAt = null;
      this.progressStartElapsed = 0;
      this.progressStartIndex = activeIndex;
      this.animateProgressExit(previousIndex, activeIndex);
      this.resetProgress(previousIndex);
      this.syncPlayback();
    }
  }

  selectIndex(index, moveFocus = false) {
    if (!this.swiper || this.slideCount < 2) return;

    const nextIndex = (index + this.slideCount) % this.slideCount;
    this.preloadAdjacentSlides(nextIndex);
    if (moveFocus) this.tabs[nextIndex]?.focus();
    this.swiper.slideTo(nextIndex);
  }

  handleCompactNavigatorChange(event) {
    const isCompact = Boolean(event.matches);
    this.isCompactNavigator = isCompact;
    this.syncNavigatorViewportState();
  }

  handleViewportResize() {
    const isCompact = this.compactNavigator.matches;
    if (isCompact !== this.isCompactNavigator) {
      this.handleCompactNavigatorChange({ matches: isCompact });
      return;
    }

    this.syncNavigatorViewportState();
    this.syncMobileViewportHeight();
  }

  handleKeydown(event) {
    if (!event.target.closest('[data-editorial-slide-tab]')) return;

    const currentIndex = this.activeIndex || 0;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectIndex(currentIndex + 1, true);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectIndex(currentIndex - 1, true);
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.selectIndex(0, true);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.selectIndex(this.slideCount - 1, true);
    }
  }

  handlePointerDown() {
    this.isPointerFocus = true;
    this.pauseReasons.delete('focus');
    this.syncPlayback();

    if (this.pointerFocusTimer) window.clearTimeout(this.pointerFocusTimer);
    this.pointerFocusTimer = window.setTimeout(() => {
      this.isPointerFocus = false;
      this.pointerFocusTimer = null;
    }, 0);
  }

  handleFocusIn() {
    if (this.isPointerFocus) return;
    this.pauseReasons.add('focus');
    this.syncPlayback();
  }

  handleFocusOut(event) {
    if (!this.contains(event.relatedTarget)) this.pauseReasons.delete('focus');
    this.syncPlayback();
  }

  handleVisibilityChange() {
    if (document.hidden) this.pauseReasons.add('document');
    else this.pauseReasons.delete('document');
    this.syncPlayback();
  }

  handleMotionPreferenceChange() {
    if (this.swiper) this.swiper.params.speed = this.reduceMotion.matches ? 0 : 1000;
    if (this.reduceMotion.matches) this.setNavigatorTransitioning(false);
    if (this.reduceMotion.matches) this.pauseReasons.add('reduced-motion');
    else this.pauseReasons.delete('reduced-motion');
    this.syncPlayback();
  }

  handleBlockSelect(event) {
    if (!this.swiper || event.detail?.sectionId !== this.dataset.sectionId) return;

    const eventTarget = event.target instanceof Element ? event.target : null;
    const selectedBlock = [...this.querySelectorAll('[data-shopify-editor-block]')].find((element) => {
      try {
        return JSON.parse(element.dataset.shopifyEditorBlock).id === event.detail.blockId;
      } catch {
        return false;
      }
    });
    const selectedProductCard = eventTarget?.closest('.editorial-slideshow__product-card')
      || selectedBlock?.closest('.editorial-slideshow__product-card');
    const selectedSlide = eventTarget?.closest('.editorial-slideshow__slide')
      || selectedBlock?.closest('.editorial-slideshow__slide')
      || this.getSlides().find((slide) => slide.dataset.blockId === selectedProductCard?.dataset.editorialSlideId)
      || this.querySelector(`[data-block-id="${CSS.escape(event.detail.blockId)}"]`);
    if (!selectedSlide) return;

    const slides = [...this.querySelectorAll('.swiper-slide:not(.swiper-slide-duplicate)')];
    const index = slides.indexOf(selectedSlide);
    if (index < 0) return;

    this.autoplayManuallyPaused = true;
    this.updateAutoplayToggle();
    this.swiper.slideTo(index, 0);
    this.setNavigatorTransitioning(false);
  }

  toggleAutoplay() {
    if (!this.autoplaySetting) return;

    if (!this.autoplayManuallyPaused) {
      this.manualPauseProgress = {
        elapsed: this.getCurrentProgressElapsed(),
        index: this.activeIndex || 0,
      };
      this.animatePausedProgress = true;
    } else {
      this.animatePausedProgress = false;
    }

    this.autoplayManuallyPaused = !this.autoplayManuallyPaused;
    this.updateAutoplayToggle();
    this.syncPlayback();
  }

  updateAutoplayToggle() {
    if (!this.autoplayToggle) return;

    const isPlaying = !this.autoplayManuallyPaused;
    const pauseLabel = this.autoplayToggle.dataset.labelPause || 'Pause slideshow';
    const resumeLabel = this.autoplayToggle.dataset.labelResume || 'Resume slideshow';
    this.autoplayToggle.setAttribute('aria-pressed', String(isPlaying));
    this.autoplayToggle.setAttribute('aria-label', isPlaying ? pauseLabel : resumeLabel);
  }

  syncPlayback() {
    this.clearAutoplayTimer();
    this.cancelProgressFrame();
    const activeIndex = this.activeIndex || 0;
    const pausedProgressRatio = this.manualPauseProgress?.index === activeIndex
      ? this.manualPauseProgress.elapsed / this.autoplayDelay
      : 0;
    const shouldAnimatePausedProgress = this.autoplayManuallyPaused && this.animatePausedProgress;
    this.animatePausedProgress = false;
    this.progressStartedAt = null;
    this.progressBars.forEach((bar, index) => {
      if (this.tabs[index]?.classList.contains('is-progress-exiting')) return;
      this.setProgress(
        bar,
        this.autoplayManuallyPaused && index === activeIndex
          ? (shouldAnimatePausedProgress ? pausedProgressRatio : 1)
          : 0,
      );
    });

    if (!this.isPlaying) {
      const progressBar = this.progressBars[activeIndex];
      if (shouldAnimatePausedProgress && progressBar) {
        window.requestAnimationFrame(() => {
          if (!this.autoplayManuallyPaused || this.activeIndex !== activeIndex) return;
          this.setProgress(progressBar, 1, 420, 'cubic-bezier(.22, 1, .36, 1)');
        });
      }
      return;
    }

    const resumeElapsed = this.manualPauseProgress?.index === activeIndex
      ? this.manualPauseProgress.elapsed
      : 0;
    const remainingDelay = Math.max(0, this.autoplayDelay - resumeElapsed);
    const progressStartDelay = this.delayProgressStartForExit
      ? Math.min(700, remainingDelay)
      : 0;
    this.delayProgressStartForExit = false;
    this.manualPauseProgress = null;

    const progressBar = this.progressBars[activeIndex];
    if (!progressBar) {
      this.autoplayTimer = window.setTimeout(() => {
        this.selectIndex(activeIndex + 1);
      }, remainingDelay);
      return;
    }

    this.setProgress(progressBar, resumeElapsed / this.autoplayDelay);
    this.progressFrame = window.requestAnimationFrame(() => {
      this.setProgress(progressBar, 1, Math.max(0, remainingDelay - progressStartDelay), 'linear', progressStartDelay);
      this.progressStartedAt = performance.now();
      this.progressStartElapsed = resumeElapsed;
      this.progressStartIndex = activeIndex;
      this.autoplayTimer = window.setTimeout(() => {
        this.selectIndex(activeIndex + 1);
      }, remainingDelay);
    });
  }

  getCurrentProgressElapsed() {
    const activeIndex = this.activeIndex || 0;
    if (this.progressStartedAt === null || this.progressStartIndex !== activeIndex) return 0;

    return Math.min(
      this.autoplayDelay,
      this.progressStartElapsed + performance.now() - this.progressStartedAt,
    );
  }

  setProgress(progressBar, progress, duration = 0, easing = 'linear', delay = 0) {
    if (!progressBar) return;

    progressBar.style.setProperty('--editorial-tab-progress-duration', `${Math.max(0, duration)}ms`);
    progressBar.style.setProperty('--editorial-tab-progress-easing', easing);
    progressBar.style.setProperty('--editorial-tab-progress-delay', `${Math.max(0, delay)}ms`);
    progressBar.style.setProperty('--editorial-tab-progress', `${Math.max(0, Math.min(1, progress)) * 100}%`);
  }

  resetProgress(exitingIndex) {
    this.progressBars.forEach((bar, index) => {
      if (index === exitingIndex && this.tabs[index]?.classList.contains('is-progress-exiting')) return;
      this.setProgress(bar, 0);
    });
  }

  clearProgressExit(index) {
    if (!Number.isInteger(index)) return;

    const timer = this.progressExitTimers.get(index);
    if (timer) window.clearTimeout(timer);
    this.progressExitTimers.delete(index);
    this.tabs[index]?.classList.remove('is-progress-exiting');
  }

  animateProgressExit(previousIndex, activeIndex) {
    if (!Number.isInteger(previousIndex) || previousIndex === activeIndex) return;

    const previousTab = this.tabs[previousIndex];
    const progressBar = this.progressBars[previousIndex];
    if (!previousTab || !progressBar) return;

    this.clearProgressExit(previousIndex);
    previousTab.classList.add('is-progress-exiting');
    this.setProgress(progressBar, 1);

    window.requestAnimationFrame(() => {
      if (!previousTab.classList.contains('is-progress-exiting')) return;
      this.setProgress(progressBar, 0, 700, 'ease-in-out');
    });

    const timer = window.setTimeout(() => {
      previousTab.classList.remove('is-progress-exiting');
      this.progressExitTimers.delete(previousIndex);
      this.setProgress(progressBar, 0);
    }, 720);
    this.progressExitTimers.set(previousIndex, timer);
  }

  clearAutoplayTimer() {
    if (this.autoplayTimer) window.clearTimeout(this.autoplayTimer);
    this.autoplayTimer = null;
  }

  cancelProgressFrame() {
    if (this.progressFrame) window.cancelAnimationFrame(this.progressFrame);
    this.progressFrame = null;
  }
}

if (!customElements.get('editorial-slideshow')) {
  customElements.define('editorial-slideshow', EditorialSlideshow);
}
