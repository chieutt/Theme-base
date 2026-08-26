import { A11y, Navigation, Swiper } from './swiper-loader.js';
import { initializeWhenVisible } from './initialize-when-visible.js';

class EditorialCollectionTabs extends HTMLElement {
  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    this.organizeBlocks();
    window.ThemeAnimations?.refresh(this);
    this.tabs = Array.from(this.querySelectorAll('[data-editorial-collection-tab]'));
    this.panels = Array.from(this.querySelectorAll('[data-editorial-collection-panel]'));
    this.swipers = new Map();
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.onClick = this.handleClick.bind(this);
    this.onKeydown = this.handleKeydown.bind(this);
    this.onBlockSelect = this.handleBlockSelect.bind(this);
    this.addEventListener('click', this.onClick);
    this.addEventListener('keydown', this.onKeydown);
    document.addEventListener('shopify:block:select', this.onBlockSelect);
    if (this.tabs.length) this.selectTab(this.tabs[0]);
    this.cancelDeferredInitialization = initializeWhenVisible(this, () => this.activateCarousels());
  }

  organizeBlocks() {
    const source = this.querySelector('[data-editorial-collection-source]');
    const tablist = this.querySelector('[data-editorial-collection-tablist]');
    const panels = this.querySelector('[data-editorial-collection-panels]');
    if (!source || !tablist || !panels) return;
    source.querySelectorAll('[data-editorial-collection-tab]').forEach((tab) => tablist.append(tab));
    source.querySelectorAll('[data-editorial-collection-panel]').forEach((panel) => panels.append(panel));
    source.remove();
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.onClick);
    this.removeEventListener('keydown', this.onKeydown);
    document.removeEventListener('shopify:block:select', this.onBlockSelect);
    this.cancelDeferredInitialization?.();
    window.clearTimeout(this.panelAnimationTimer);
    this.swipers.forEach((swiper) => swiper.destroy(true, true));
    this.swipers.clear();
    this.initialized = false;
  }

  activateCarousels() {
    if (this.carouselsReady) return;
    this.carouselsReady = true;
    this.panels.filter((panel) => !panel.hidden).forEach((panel) => this.createCarousel(panel));
  }

  createCarousel(panel) {
    if (!panel || panel.hidden) return;
    const existing = this.swipers.get(panel);
    if (existing) {
      existing.update();
      this.updateNavigation(panel, existing);
      return;
    }

    const carousel = panel.querySelector('[data-editorial-collection-carousel]');
    if (!carousel?.querySelector('.swiper-slide')) return;
    const desktopColumns = Number.parseInt(this.dataset.desktopColumns, 10) || 4;
    const mobileColumns = Number.parseFloat(this.dataset.mobileColumns) || 1;
    const tabletColumns = Math.min(desktopColumns, 2);
    const productCount = carousel.querySelectorAll('.swiper-slide').length;
    const mobileSlides = mobileColumns === 1 && productCount > 1 ? 1.2 : mobileColumns;
    const swiper = new Swiper(carousel, {
      modules: [A11y, Navigation],
      slidesPerView: mobileSlides,
      spaceBetween: this.cssNumber('--editorial-tabs-mobile-gap'),
      speed: this.reduceMotion ? 0 : 360,
      watchOverflow: true,
      navigation: {
        prevEl: panel.querySelector('[data-editorial-collection-previous]'),
        nextEl: panel.querySelector('[data-editorial-collection-next]'),
      },
      a11y: { enabled: true, slideRole: 'listitem' },
      breakpoints: {
        768: {
          slidesPerView: tabletColumns,
          spaceBetween: this.cssNumber('--editorial-tabs-gap'),
        },
        1150: {
          slidesPerView: desktopColumns,
          spaceBetween: this.cssNumber('--editorial-tabs-gap'),
        },
      },
    });
    swiper.on('update resize breakpoint slideChange transitionEnd', () => this.updateNavigation(panel, swiper));
    this.swipers.set(panel, swiper);
    this.updateNavigation(panel, swiper);
  }

  cssNumber(name) {
    return Number.parseFloat(getComputedStyle(this).getPropertyValue(name)) || 0;
  }

  selectTab(tab, moveFocus = false) {
    if (!tab) return;
    const panelId = tab.getAttribute('aria-controls');
    const selectedPanel = this.panels.find((panel) => panel.id === panelId);
    this.tabs.forEach((candidate) => {
      const selected = candidate === tab;
      candidate.setAttribute('aria-selected', String(selected));
      candidate.tabIndex = selected ? 0 : -1;
    });
    this.panels.forEach((panel) => {
      panel.hidden = panel !== selectedPanel;
    });
    if (selectedPanel) {
      this.animatePanel(selectedPanel);
      this.createCarousel(selectedPanel);
    }
    if (moveFocus) tab.focus();
  }

  animatePanel(panel) {
    if (this.reduceMotion) return;
    window.clearTimeout(this.panelAnimationTimer);
    this.panels.forEach((candidate) => candidate.classList.remove('editorial-collection-tabs__panel--entering'));
    void panel.offsetWidth;
    panel.classList.add('editorial-collection-tabs__panel--entering');
    this.panelAnimationTimer = window.setTimeout(() => {
      panel.classList.remove('editorial-collection-tabs__panel--entering');
    }, 520);
  }

  updateProgress(panel, swiper) {
    const progress = panel.querySelector('[data-editorial-collection-progress]');
    if (!progress || !swiper?.slides?.length) return;
    const parsedTotal = Number.parseInt(panel.dataset.productTotal, 10);
    const total = Number.isNaN(parsedTotal) ? swiper.slides.length : parsedTotal;
    const visible = Math.min(
      Math.max(swiper.slidesPerViewDynamic(), Number(swiper.params.slidesPerView) || 1),
      swiper.slides.length,
    );
    const showingCount = Math.min(total, swiper.activeIndex + Math.ceil(visible));
    const showing = panel.querySelector('[data-editorial-collection-showing]');
    if (showing) showing.textContent = `Showing ${showingCount} of ${total}`;

    const thumbSize = Math.min(1, visible / swiper.slides.length);
    const progressValue = swiper.slides.length <= Math.ceil(visible)
      ? 1
      : thumbSize + (swiper.progress * (1 - thumbSize));
    progress.style.setProperty('--editorial-tabs-progress', progressValue);

    const pageLabel = panel.querySelector('[data-editorial-collection-page-label]');
    if (pageLabel) {
      const page = String(swiper.activeIndex + 1).padStart(2, '0');
      pageLabel.textContent = `${panel.dataset.collectionLabel || 'Collection'} / Page ${page}`;
    }
  }

  updateNavigation(panel, swiper) {
    if (!panel || !swiper?.slides?.length) return;
    const visible = Math.min(
      Math.max(swiper.slidesPerViewDynamic(), Number(swiper.params.slidesPerView) || 1),
      swiper.slides.length,
    );
    const hasOverflow = swiper.slides.length > Math.ceil(visible);
    panel.classList.toggle('is-carousel-scrollable', hasOverflow);
    panel.classList.add('is-carousel-navigation-ready');
    panel.classList.toggle('is-carousel-static', !hasOverflow);
    panel.querySelectorAll('[data-editorial-collection-previous], [data-editorial-collection-next]').forEach((button) => {
      button.disabled = !hasOverflow;
    });
    if (hasOverflow) swiper.navigation.update();
    this.updateProgress(panel, swiper);
  }

  handleClick(event) {
    const tab = event.target.closest('[data-editorial-collection-tab]');
    if (tab && this.contains(tab)) this.selectTab(tab);
  }

  handleKeydown(event) {
    const tab = event.target.closest('[data-editorial-collection-tab]');
    if (!tab) return;
    const currentIndex = this.tabs.indexOf(tab);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % this.tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = this.tabs.length - 1;
    if (nextIndex === currentIndex) return;
    event.preventDefault();
    this.selectTab(this.tabs[nextIndex], true);
  }

  handleBlockSelect(event) {
    const tab = this.tabs.find((candidate) => candidate.dataset.blockId === event.detail?.blockId);
    if (!tab) return;
    this.activateCarousels();
    this.selectTab(tab);
  }
}

if (!customElements.get('editorial-collection-tabs')) {
  customElements.define('editorial-collection-tabs', EditorialCollectionTabs);
}
