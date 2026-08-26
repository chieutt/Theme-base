class CollectionShowcase extends HTMLElement {
  connectedCallback() {
    if (this.abortController) return;

    this.abortController = new AbortController();
    const { signal } = this.abortController;
    this.tabs = [...this.querySelectorAll('[data-collection-showcase-tab]')];
    this.items = [...this.querySelectorAll('[data-collection-showcase-item]')];
    this.panels = [...this.querySelectorAll('[data-collection-showcase-panel]')];
    this.progressBars = [...this.querySelectorAll('[data-collection-showcase-progress]')];
    this.activeIndex = Math.max(0, this.tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));
    this.autoplay = this.dataset.autoplay === 'true' && this.tabs.length > 1 && !window.Shopify?.designMode;
    this.autoplayDelay = Math.max(1000, Number(this.dataset.autoplayDelay) || 6000);
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.hoverMedia = window.matchMedia('(hover: hover) and (pointer: fine)');
    this.pauseReasons = new Set();
    this.isInViewport = !('IntersectionObserver' in window);
    this.progressElapsed = 0;
    this.progressStartedAt = 0;

    this.addEventListener('click', (event) => this.handleClick(event), { signal });
    this.addEventListener('pointerover', (event) => this.handlePointerOver(event), { signal });
    this.addEventListener('focusin', (event) => this.handleFocusIn(event), { signal });
    this.addEventListener('focusout', (event) => this.handleFocusOut(event), { signal });
    this.addEventListener('keydown', (event) => this.handleKeydown(event), { signal });
    this.addEventListener('mouseenter', () => this.handleMouseEnter(), { signal });
    this.addEventListener('mouseleave', () => this.handleMouseLeave(), { signal });
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange(), { signal });
    document.addEventListener('shopify:block:select', (event) => this.handleBlockSelect(event), { signal });
    document.addEventListener('shopify:block:deselect', (event) => this.handleBlockDeselect(event), { signal });
    document.addEventListener('shopify:section:select', (event) => this.handleSectionSelect(event), { signal });
    document.addEventListener('shopify:section:deselect', (event) => this.handleSectionDeselect(event), { signal });
    this.reducedMotion.addEventListener('change', () => this.handleMotionPreferenceChange(), { signal });

    if ('IntersectionObserver' in window) {
      this.visibilityObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          this.isInViewport = Boolean(entry?.isIntersecting);
          this.syncPlayback();
        },
        { threshold: 0.01 },
      );
      this.visibilityObserver.observe(this);
    }

    if (document.hidden) this.pauseReasons.add('document');
    this.syncActiveState(this.activeIndex, false);
    this.syncPlayback();
  }

  disconnectedCallback() {
    this.abortController?.abort();
    this.abortController = null;
    this.visibilityObserver?.disconnect();
    this.visibilityObserver = null;
    this.clearAutoplayTimer();
    this.cancelProgressFrame();
    this.pauseReasons?.clear();
  }

  get canAutoplay() {
    return this.autoplay && !this.reducedMotion.matches && this.tabs.length > 1;
  }

  get isPlaying() {
    return this.canAutoplay && this.isInViewport && !document.hidden && this.pauseReasons.size === 0;
  }

  selectIndex(index, moveFocus = false) {
    if (index < 0 || index >= this.tabs.length) return;

    this.activeIndex = index;
    this.syncActiveState(index, true);
    if (moveFocus) this.tabs[index].focus();
  }

  syncActiveState(index, restartProgress = true) {
    this.tabs.forEach((tab, tabIndex) => {
      const isActive = tabIndex === index;
      tab.setAttribute('aria-selected', String(isActive));
      tab.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    this.items.forEach((item, itemIndex) => {
      item.classList.toggle('collection-showcase__item--active', itemIndex === index);
    });

    this.panels.forEach((panel, panelIndex) => {
      const isActive = panelIndex === index;
      panel.classList.toggle('collection-showcase__panel--active', isActive);
      panel.setAttribute('aria-hidden', String(!isActive));
      panel.toggleAttribute('inert', !isActive);
    });

    if (restartProgress) this.resetProgress();
  }

  resetProgress() {
    this.clearAutoplayTimer();
    this.cancelProgressFrame();
    this.progressElapsed = 0;
    this.progressStartedAt = 0;
    this.progressBars.forEach((bar) => {
      bar.style.transition = 'none';
      bar.style.transform = 'scaleX(0)';
    });
    this.syncPlayback();
  }

  syncPlayback() {
    this.clearAutoplayTimer();
    this.cancelProgressFrame();

    if (this.reducedMotion.matches) {
      this.progressBars.forEach((bar) => {
        bar.style.transition = 'none';
        bar.style.transform = 'scaleX(0)';
      });
      return;
    }

    if (!this.canAutoplay) {
      this.progressBars.forEach((bar, index) => {
        bar.style.transition = index === this.activeIndex ? 'transform 300ms ease' : 'none';
        bar.style.transform = index === this.activeIndex ? 'scaleX(1)' : 'scaleX(0)';
      });
      return;
    }

    if (!this.isPlaying) {
      this.pauseProgress();
      return;
    }

    this.startProgress();
  }

  startProgress() {
    const bar = this.progressBars[this.activeIndex];
    if (!bar) return;

    const remaining = Math.max(0, this.autoplayDelay - this.progressElapsed);
    const startAt = this.progressElapsed;
    this.progressStartedAt = performance.now() - startAt;
    bar.style.transition = 'none';
    bar.style.transform = `scaleX(${Math.min(1, startAt / this.autoplayDelay)})`;
    bar.offsetWidth;
    this.progressFrame = requestAnimationFrame(() => {
      if (!this.isPlaying || this.activeIndex >= this.progressBars.length) return;
      bar.style.transition = `transform ${remaining}ms linear`;
      bar.style.transform = 'scaleX(1)';
    });
    this.autoplayTimer = window.setTimeout(() => {
      this.progressElapsed = 0;
      this.selectIndex((this.activeIndex + 1) % this.tabs.length);
    }, remaining);
  }

  pauseProgress() {
    this.cancelProgressFrame();
    if (!this.progressStartedAt) return;

    this.progressElapsed = Math.min(this.autoplayDelay, Math.max(0, performance.now() - this.progressStartedAt));
    const bar = this.progressBars[this.activeIndex];
    if (!bar) return;
    bar.style.transition = 'none';
    bar.style.transform = `scaleX(${this.progressElapsed / this.autoplayDelay})`;
  }

  clearAutoplayTimer() {
    if (this.autoplayTimer) window.clearTimeout(this.autoplayTimer);
    this.autoplayTimer = null;
  }

  cancelProgressFrame() {
    if (this.progressFrame) window.cancelAnimationFrame(this.progressFrame);
    this.progressFrame = null;
  }

  handleClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const tab = target?.closest('[data-collection-showcase-tab]');
    if (!tab || !this.contains(tab)) return;

    const index = this.tabs.indexOf(tab);
    if (index >= 0) this.selectIndex(index);
  }

  handlePointerOver(event) {
    if (!this.hoverMedia.matches) return;

    const target = event.target instanceof Element ? event.target : null;
    const tab = target?.closest('[data-collection-showcase-tab]');
    if (!tab || !this.contains(tab) || tab.contains(event.relatedTarget)) return;

    const index = this.tabs.indexOf(tab);
    if (index >= 0) this.selectIndex(index);
  }

  handleFocusIn() {
    this.pauseReasons.add('focus');
  }

  handleFocusOut(event) {
    if (!this.contains(event.relatedTarget)) this.pauseReasons.delete('focus');
    this.syncPlayback();
  }

  handleMouseEnter() {
    if (this.hoverMedia.matches) this.pauseReasons.add('hover');
  }

  handleMouseLeave() {
    this.pauseReasons.delete('hover');
    this.syncPlayback();
  }

  handleVisibilityChange() {
    if (document.hidden) this.pauseReasons.add('document');
    else this.pauseReasons.delete('document');
    this.syncPlayback();
  }

  handleMotionPreferenceChange() {
    this.progressElapsed = 0;
    this.syncPlayback();
  }

  handleKeydown(event) {
    const target = event.target instanceof Element ? event.target : null;
    const tab = target?.closest('[data-collection-showcase-tab]');
    if (!tab || !this.contains(tab)) return;

    const currentIndex = this.tabs.indexOf(tab);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % this.tabs.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = this.tabs.length - 1;
    if (nextIndex === currentIndex) return;

    event.preventDefault();
    this.selectIndex(nextIndex, true);
  }

  isEventForThisSection(event) {
    const sectionId = event.detail?.sectionId;
    if (sectionId && sectionId !== this.dataset.sectionId) return false;
    if (!sectionId && event.target instanceof Element && !this.contains(event.target)) return false;
    return true;
  }

  handleBlockSelect(event) {
    if (!this.isEventForThisSection(event)) return;

    const index = this.items.findIndex((item) => item.dataset.blockId === event.detail?.blockId);
    if (index < 0) return;
    this.pauseReasons.add('editor');
    this.selectIndex(index);
  }

  handleBlockDeselect(event) {
    if (this.isEventForThisSection(event)) {
      this.pauseReasons.delete('editor');
      this.syncPlayback();
    }
  }

  handleSectionSelect(event) {
    if (!this.isEventForThisSection(event)) return;
    this.pauseReasons.add('editor');
    this.syncPlayback();
  }

  handleSectionDeselect(event) {
    if (!this.isEventForThisSection(event)) return;
    this.pauseReasons.delete('editor');
    this.syncPlayback();
  }
}

if (!customElements.get('collection-showcase')) {
  customElements.define('collection-showcase', CollectionShowcase);
}
