import { A11y, Swiper } from './swiper-loader.js';

(() => {
  if (customElements.get('search-drawer')) return;

  const triggerSelector = '[data-search-drawer-open]';

  class SearchDrawer extends HTMLElement {
    connectedCallback() {
      if (this.abortController) return;

      this.panel = this.querySelector('[data-search-drawer-panel]');
      this.form = this.querySelector('[data-search-drawer-form]');
      this.input = this.querySelector('[data-search-drawer-input]');
      if (!this.panel || !this.form || !this.input) return;

      this.clearButton = this.querySelector('[data-search-drawer-clear]');
      this.animatedPlaceholder = this.querySelector('[data-search-drawer-animated-placeholder]');
      this.predictive = this.querySelector('[data-search-drawer-predictive]');
      this.status = this.querySelector('[data-search-drawer-status]');
      this.tabs = this.querySelector('[data-search-drawer-tabs]');
      this.empty = this.querySelector('[data-search-drawer-empty]');
      this.viewAll = this.querySelector('[data-search-drawer-view-all]');
      this.navigation = this.querySelector('[data-search-drawer-navigation]');
      this.recentlyViewed = this.querySelector('[data-search-drawer-recently-viewed]');
      this.recentList = this.querySelector('[data-search-drawer-recent-list]');
      this.categoriesCarousel = this.querySelector('[data-search-drawer-categories]');
      this.categorySlides = Array.from(this.querySelectorAll('[data-search-drawer-categories] .swiper-slide'));
      this.categorySlidesPerView = Number.parseFloat(this.dataset.categorySlidesPerView) || 3.5;
      this.categorySlidesPerViewMobile = Number.parseFloat(this.dataset.categorySlidesPerViewMobile) || 3;
      this.categoriesSwiper = null;
      this.announcer = this.querySelector('[data-search-drawer-announcer]');
      this.bagIconTemplate = this.querySelector('[data-search-drawer-bag-icon]');
      this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.placeholderFallback = this.input.getAttribute('placeholder') || '';
      this.placeholderTerms = this.parsePlaceholderTerms(this.dataset.placeholderTerms);
      this.abortController = new AbortController();
      this.isOpen = false;
      this.returnFocus = null;
      this.restoreFocusAfterClose = true;
      this.closePromise = null;
      this.closeResolve = null;
      this.recentCacheKey = '';

      this.bind();
      this.syncInputState();
      this.resetPredictiveSearch({ abort: false });

      if (this.isPreviewMode() && this.recentlyViewed) {
        this.recentlyViewed.hidden = false;
      }

      if (this.dataset.visualPreviewMode === 'true') {
        window.requestAnimationFrame(() => {
          if (this.isConnected && this.hidden) this.open();
        });
      }
    }

    disconnectedCallback() {
      this.abortController?.abort();
      this.abortController = null;
      this.searchController?.abort();
      this.recentController?.abort();
      this.cartController?.abort();
      this.searchController = null;
      this.recentController = null;
      this.cartController = null;
      this.stopPlaceholderAnimation();
      this.destroyCategoriesCarousel();
      window.clearTimeout(this.searchTimer);
      window.clearTimeout(this.closeTimer);
      this.backdropInteraction?.destroy();
      this.backdropInteraction = null;
      this.resolveClose(false);
      this.isOpen = false;
      this.syncTriggers(false);
      this.hidden = true;
      this.classList.remove('is-open', 'is-closing');
      this.unlockPageScroll();
      window.themeScrollLock?.update?.();
    }

    bind() {
      const { signal } = this.abortController;

      if (typeof window.SpinelModalBackdropPointer === 'function') {
        this.backdropInteraction = new window.SpinelModalBackdropPointer({
          root: this,
          panel: this.panel,
          pointer: this.querySelector('.search-drawer__backdrop-pointer'),
          isOpen: () => this.isOpen,
        });
      }

      document.addEventListener('click', (event) => {
        const trigger = event.target.closest?.(triggerSelector);
        if (!trigger || !this.shouldHandleTriggerClick(event)) return;
        event.preventDefault();
        this.open(trigger);
      }, { signal });

      this.addEventListener('click', (event) => {
        if (event.target.closest?.('[data-search-drawer-close], [data-search-drawer-overlay]')) {
          event.preventDefault();
          this.close();
          return;
        }

        const tab = event.target.closest?.('[data-search-drawer-tab]');
        if (tab) {
          event.preventDefault();
          this.selectTab(tab.dataset.searchDrawerTab);
          return;
        }

        const quickAdd = event.target.closest?.('[data-search-drawer-quick-add]');
        if (quickAdd) {
          event.preventDefault();
          this.addRecentlyViewedProduct(quickAdd);
          return;
        }

        const chooseOptions = event.target.closest?.('[data-search-drawer-choose-options]');
        if (chooseOptions) {
          event.preventDefault();
          event.stopPropagation();
          this.openRecentlyViewedOptions(chooseOptions);
        }
      }, { signal });

      this.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          this.close();
          return;
        }
        if (event.key === 'Tab' && this.isOpen) this.trapFocus(event);
      }, { signal });

      this.input.addEventListener('input', () => this.onSearchInput(), { signal });
      this.clearButton?.addEventListener('click', () => this.clearSearch(), { signal });

      this.tabs?.addEventListener('keydown', (event) => this.onTabKeydown(event), { signal });
      this.reduceMotion.addEventListener('change', () => {
        if (this.categoriesSwiper) this.categoriesSwiper.params.speed = this.reduceMotion.matches ? 0 : 360;
        if (this.hidden) return;
        this.stopPlaceholderAnimation();
        this.startPlaceholderAnimation();
      }, { signal });

      document.addEventListener('shopify:section:select', (event) => {
        if (this.isOwnEditorEvent(event)) this.open();
      }, { signal });
      document.addEventListener('shopify:section:load', (event) => {
        if (this.dataset.designMode === 'true' && this.isOwnEditorEvent(event)) this.open();
      }, { signal });
      document.addEventListener('shopify:block:select', (event) => {
        if (this.isOwnEditorEvent(event)) this.open();
      }, { signal });
      document.addEventListener('shopify:section:deselect', (event) => {
        if (this.isOwnEditorEvent(event)) this.close({ restoreFocus: false });
      }, { signal });
      document.addEventListener('shopify:section:unload', (event) => {
        if (this.isOwnEditorEvent(event)) this.close({ restoreFocus: false, immediate: true });
      }, { signal });

      this.categoriesCarousel?.addEventListener('focusin', (event) => this.focusCategorySlide(event), { signal });
    }

    shouldHandleTriggerClick(event) {
      return !event.defaultPrevented
        && event.button === 0
        && !event.metaKey
        && !event.ctrlKey
        && !event.shiftKey
        && !event.altKey;
    }

    isOwnEditorEvent(event) {
      const sectionId = this.dataset.sectionId;
      if (!sectionId) return false;
      if (String(event.detail?.sectionId || '') === sectionId) return true;
      const target = event.target;
      if (!(target instanceof Element)) return false;
      return target.id === `shopify-section-${sectionId}`
        || target === this
        || target.contains(this)
        || this.contains(target);
    }

    isPreviewMode() {
      return this.dataset.designMode === 'true' || this.dataset.visualPreviewMode === 'true';
    }

    open(trigger = null) {
      if (!this.panel) return;

      if (!this.hidden && this.isOpen && !this.classList.contains('is-closing')) {
        if (trigger) this.returnFocus = trigger;
        this.syncTriggers(true);
        this.loadRecentlyViewedProducts();
        this.initializeCategoriesCarousel();
        this.input.focus({ preventScroll: true });
        return;
      }

      if (this.hidden) {
        this.returnFocus = trigger || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      } else if (trigger) {
        this.returnFocus = trigger;
      }

      window.clearTimeout(this.closeTimer);
      this.resolveClose(false);
      this.restoreFocusAfterClose = true;
      this.lockPageScroll();
      this.hidden = false;
      this.isOpen = true;
      this.classList.remove('is-closing');
      this.classList.remove('is-open');
      this.panel.getBoundingClientRect();
      this.classList.add('is-open');
      this.playContentReveal();
      this.initializeCategoriesCarousel();
      this.syncTriggers(true);
      this.startPlaceholderAnimation();
      this.loadRecentlyViewedProducts();

      window.requestAnimationFrame(() => {
        if (this.hidden || !this.isOpen) return;
        this.input.focus({ preventScroll: true });
        this.syncInputState();
        if (this.input.value.trim().length >= 2) this.schedulePredictiveSearch();
      });
    }

    initializeCategoriesCarousel() {
      if (!this.categoriesCarousel || this.categorySlides.length < 2) return;

      if (this.categoriesSwiper) {
        this.categoriesSwiper.update();
        return;
      }

      this.categoriesSwiper = new Swiper(this.categoriesCarousel, {
        modules: [A11y],
        slidesPerView: this.categorySlidesPerViewMobile,
        spaceBetween: 12,
        speed: this.reduceMotion.matches ? 0 : 360,
        watchOverflow: true,
        grabCursor: true,
        breakpoints: {
          750: {
            slidesPerView: this.categorySlidesPerView,
          },
        },
        a11y: {
          enabled: true,
          slideRole: null,
          slideLabelMessage: null,
        },
      });
    }

    destroyCategoriesCarousel() {
      this.categoriesSwiper?.destroy(true, true);
      this.categoriesSwiper = null;
    }

    focusCategorySlide(event) {
      const slide = event.target.closest?.('.swiper-slide');
      if (!slide || !this.categoriesCarousel?.contains(slide) || !this.categoriesSwiper) return;
      const index = this.categorySlides.indexOf(slide);
      if (index >= 0) this.categoriesSwiper.slideTo(index);
    }

    close({ restoreFocus = true, immediate = false } = {}) {
      if (this.hidden) return Promise.resolve(true);
      if (this.classList.contains('is-closing') && this.closePromise) return this.closePromise;

      this.isOpen = false;
      this.restoreFocusAfterClose = restoreFocus;
      this.searchController?.abort();
      this.recentController?.abort();
      this.searchController = null;
      this.recentController = null;
      window.clearTimeout(this.searchTimer);
      this.stopPlaceholderAnimation();
      this.stopContentReveal();
      this.syncTriggers(false);
      this.backdropInteraction?.hide();
      this.classList.remove('is-open');
      this.classList.add('is-closing');

      this.closePromise = new Promise((resolve) => {
        this.closeResolve = resolve;
      });

      const duration = immediate ? 0 : this.getMotionDuration();
      window.clearTimeout(this.closeTimer);
      this.closeTimer = window.setTimeout(() => this.finishClose(), duration);

      return this.closePromise;
    }

    finishClose() {
      const restoreFocus = this.restoreFocusAfterClose;
      const focusTarget = this.returnFocus;
      window.clearTimeout(this.closeTimer);
      this.hidden = true;
      this.isOpen = false;
      this.stopContentReveal();
      this.classList.remove('is-open', 'is-closing');
      this.unlockPageScroll();
      this.syncTriggers(false);
      this.backdropInteraction?.hide();
      this.stopPlaceholderAnimation();
      this.resetPredictiveSearch();
      this.syncInputState();
      this.restoreFocusAfterClose = true;
      this.returnFocus = null;
      window.themeScrollLock?.update?.();
      this.resolveClose(true);

      if (restoreFocus && focusTarget?.isConnected) {
        focusTarget.focus({ preventScroll: true });
      }
    }

    playContentReveal() {
      if (this.dataset.motionEnabled === 'false') return;
      window.clearTimeout(this.contentRevealTimer);
      this.classList.add('is-content-revealing');
      this.contentRevealTimer = window.setTimeout(() => {
        this.classList.remove('is-content-revealing');
      }, 900);
    }

    stopContentReveal() {
      window.clearTimeout(this.contentRevealTimer);
      this.classList.remove('is-content-revealing');
    }

    lockPageScroll() {
      if (this.pageScrollLocked) return;
      const root = document.documentElement;
      const gutterProperty = '--search-drawer-scrollbar-gutter';
      this.previousScrollbarGutter = root.style.getPropertyValue(gutterProperty);
      this.hadScrollbarGutter = this.previousScrollbarGutter !== '';
      root.style.setProperty(gutterProperty, `${Math.max(0, window.innerWidth - root.clientWidth)}px`);
      document.body.classList.add('search-drawer-open');
      this.pageScrollLocked = true;
    }

    unlockPageScroll() {
      if (!this.pageScrollLocked) return;
      document.body.classList.remove('search-drawer-open');
      const root = document.documentElement;
      const gutterProperty = '--search-drawer-scrollbar-gutter';
      if (this.hadScrollbarGutter) root.style.setProperty(gutterProperty, this.previousScrollbarGutter);
      else root.style.removeProperty(gutterProperty);
      this.previousScrollbarGutter = null;
      this.hadScrollbarGutter = false;
      this.pageScrollLocked = false;
    }

    trapFocus(event) {
      if (!this.panel) return;
      const focusable = [...this.panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((element) => element.getClientRects().length);
      if (!focusable.length) {
        event.preventDefault();
        this.panel.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (event.target === first || !this.panel.contains(event.target))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (event.target === last || !this.panel.contains(event.target))) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }

    resolveClose(value) {
      const resolve = this.closeResolve;
      this.closeResolve = null;
      this.closePromise = null;
      resolve?.(value);
    }

    getMotionDuration() {
      if (this.reduceMotion.matches) return 0;
      const value = getComputedStyle(this).getPropertyValue('--search-drawer-motion-duration').trim();
      const match = value.match(/^([\d.]+)(ms|s)$/);
      if (!match) return 350;
      return Number(match[1]) * (match[2] === 's' ? 1000 : 1);
    }

    syncTriggers(expanded) {
      document.querySelectorAll(triggerSelector).forEach((trigger) => {
        trigger.setAttribute('aria-expanded', String(expanded));
      });
    }

    onSearchInput() {
      this.syncInputState();
      this.schedulePredictiveSearch();
    }

    syncInputState() {
      if (!this.input || !this.form) return;
      const hasValue = this.input.value.length > 0;
      this.form.classList.toggle('has-value', hasValue);
      if (this.clearButton) this.clearButton.hidden = !hasValue;
    }

    clearSearch() {
      this.input.value = '';
      this.syncInputState();
      this.resetPredictiveSearch();
      this.input.focus({ preventScroll: true });
    }

    schedulePredictiveSearch() {
      const term = this.input.value.trim();
      window.clearTimeout(this.searchTimer);
      this.searchController?.abort();
      this.searchController = null;

      if (this.dataset.searchSuggestionsEnabled !== 'true' || term.length < 2) {
        this.resetPredictiveSearch({ abort: false });
        return;
      }

      this.searchTimer = window.setTimeout(() => this.requestPredictiveSearch(term), 180);
    }

    async requestPredictiveSearch(term) {
      const controller = new AbortController();
      this.searchController = controller;
      this.showSearchStatus(this.dataset.searchingText, 'loading', false);

      try {
        const endpoint = new URL(this.dataset.predictiveSearchUrl, window.location.origin);
        endpoint.searchParams.set('q', term);
        endpoint.searchParams.set('resources[type]', 'product,collection');
        endpoint.searchParams.set('resources[limit]', '6');
        endpoint.searchParams.set('resources[limit_scope]', 'each');
        endpoint.searchParams.set('resources[options][unavailable_products]', 'hide');
        const response = await fetch(endpoint, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        });
        if (!response.ok) throw new Error(`Predictive search request failed (${response.status})`);
        const payload = await response.json();
        if (this.searchController !== controller || this.input.value.trim() !== term) return;

        const results = payload.resources?.results || {};
        this.renderPredictiveResults(term, results.products || [], results.collections || []);
      } catch (error) {
        if (error.name === 'AbortError' || this.searchController !== controller) return;
        console.error('[Spinel] Predictive search failed.', error);
        this.showSearchStatus(this.dataset.searchErrorText, 'error', true);
      } finally {
        if (this.searchController === controller) this.searchController = null;
      }
    }

    renderPredictiveResults(term, products, collections) {
      const productPanel = this.querySelector('[data-search-drawer-panel-name="products"]');
      const collectionPanel = this.querySelector('[data-search-drawer-panel-name="collections"]');
      this.renderProducts(productPanel, products.slice(0, 6));
      this.renderCollections(collectionPanel, collections.slice(0, 6));

      const productsTab = this.querySelector('[data-search-drawer-tab="products"]');
      const collectionsTab = this.querySelector('[data-search-drawer-tab="collections"]');
      if (productsTab) productsTab.hidden = products.length === 0;
      if (collectionsTab) collectionsTab.hidden = collections.length === 0;

      const hasResults = products.length > 0 || collections.length > 0;
      this.predictive.hidden = false;
      this.predictive.setAttribute('aria-busy', 'false');
      this.predictive.classList.remove('is-loading', 'has-error');
      if (this.tabs) this.tabs.hidden = !hasResults;
      if (this.empty) {
        this.empty.hidden = hasResults;
        this.empty.textContent = hasResults ? '' : this.interpolate(this.dataset.noResultsText, '__term__', term);
      }
      if (hasResults) this.selectTab(products.length ? 'products' : 'collections');
      else this.querySelectorAll('[data-search-drawer-panel-name]').forEach((panel) => { panel.hidden = true; });

      if (this.viewAll) {
        const viewAllUrl = new URL(this.form.action, window.location.origin);
        viewAllUrl.searchParams.set('q', term);
        this.viewAll.href = viewAllUrl.toString();
        this.viewAll.hidden = false;
      }

      if (this.navigation) this.navigation.hidden = hasResults;
      if (this.status) {
        const resultCount = products.length + collections.length;
        this.status.hidden = false;
        this.status.classList.add('visually-hidden');
        this.status.textContent = hasResults
          ? this.interpolate(this.dataset.resultsFoundText, '__count__', String(resultCount))
          : this.interpolate(this.dataset.noResultsText, '__term__', term);
      }
    }

    renderProducts(panel, products) {
      if (!panel) return;
      panel.replaceChildren();
      if (!products.length) return;

      const grid = document.createElement('div');
      grid.className = 'search-drawer__product-grid';
      products.forEach((product) => {
        const card = this.createLink(product.url, 'search-drawer__product');
        const imageUrl = this.imageUrl(product.featured_image || product.image);
        if (imageUrl) {
          const image = document.createElement('img');
          image.className = 'search-drawer__product-image';
          image.src = imageUrl;
          image.alt = product.featured_image?.alt || product.image_alt || product.title || '';
          image.loading = 'lazy';
          card.append(image);
        } else {
          const imagePlaceholder = document.createElement('span');
          imagePlaceholder.className = 'search-drawer__product-image';
          imagePlaceholder.setAttribute('aria-hidden', 'true');
          card.append(imagePlaceholder);
        }

        const title = document.createElement('span');
        title.className = 'search-drawer__product-title product-title-text';
        title.textContent = product.title || '';
        card.append(title);

        if (product.price !== undefined && product.price !== null) {
          const price = document.createElement('span');
          price.className = 'search-drawer__product-price';
          price.textContent = this.formatPredictivePrice(product.price);
          card.append(price);
        }
        grid.append(card);
      });
      panel.append(grid);
    }

    renderCollections(panel, collections) {
      if (!panel) return;
      panel.replaceChildren();
      if (!collections.length) return;

      const grid = document.createElement('div');
      grid.className = 'search-drawer__collection-grid';
      collections.forEach((collection) => {
        const card = this.createLink(collection.url, 'search-drawer__collection');
        const imageUrl = this.imageUrl(collection.featured_image || collection.image);
        if (imageUrl) {
          const image = document.createElement('img');
          image.className = 'search-drawer__collection-image';
          image.src = imageUrl;
          image.alt = collection.featured_image?.alt || collection.image_alt || collection.title || '';
          image.loading = 'lazy';
          card.append(image);
        } else {
          const imagePlaceholder = document.createElement('span');
          imagePlaceholder.className = 'search-drawer__collection-image';
          imagePlaceholder.setAttribute('aria-hidden', 'true');
          card.append(imagePlaceholder);
        }

        const copy = document.createElement('span');
        copy.className = 'search-drawer__collection-copy';
        const title = document.createElement('span');
        title.className = 'search-drawer__collection-title';
        title.textContent = collection.title || '';
        copy.append(title);

        const productCount = collection.product_count ?? collection.products_count;
        if (productCount !== undefined && productCount !== null) {
          const count = document.createElement('span');
          count.className = 'search-drawer__collection-count';
          const template = Number(productCount) === 1 ? this.dataset.productCountOne : this.dataset.productCountOther;
          count.textContent = this.interpolate(template, '__count__', String(productCount));
          copy.append(count);
        }
        card.append(copy);
        grid.append(card);
      });
      panel.append(grid);
    }

    selectTab(tabName) {
      this.querySelectorAll('[data-search-drawer-tab]').forEach((tab) => {
        const isSelected = !tab.hidden && tab.dataset.searchDrawerTab === tabName;
        tab.setAttribute('aria-selected', String(isSelected));
        tab.tabIndex = isSelected ? 0 : -1;
      });
      this.querySelectorAll('[data-search-drawer-panel-name]').forEach((panel) => {
        panel.hidden = panel.dataset.searchDrawerPanelName !== tabName;
      });
    }

    onTabKeydown(event) {
      const tab = event.target.closest?.('[data-search-drawer-tab]');
      if (!tab) return;
      const visibleTabs = [...this.querySelectorAll('[data-search-drawer-tab]:not([hidden])')];
      const index = visibleTabs.indexOf(tab);
      if (index < 0 || visibleTabs.length < 2) return;

      let nextIndex;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % visibleTabs.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + visibleTabs.length) % visibleTabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = visibleTabs.length - 1;
      else return;

      event.preventDefault();
      const nextTab = visibleTabs[nextIndex];
      this.selectTab(nextTab.dataset.searchDrawerTab);
      nextTab.focus({ preventScroll: true });
    }

    showSearchStatus(message, state, showDefault) {
      if (!this.predictive || !this.status) return;
      this.predictive.hidden = false;
      this.predictive.setAttribute('aria-busy', String(state === 'loading'));
      this.predictive.classList.toggle('is-loading', state === 'loading');
      this.predictive.classList.toggle('has-error', state === 'error');
      this.status.hidden = false;
      this.status.textContent = message || '';
      this.status.classList.remove('visually-hidden');
      if (this.tabs) this.tabs.hidden = true;
      this.querySelectorAll('[data-search-drawer-panel-name]').forEach((panel) => { panel.hidden = true; });
      if (this.empty) this.empty.hidden = true;
      if (this.viewAll) this.viewAll.hidden = true;
      if (this.navigation) this.navigation.hidden = !showDefault;
    }

    resetPredictiveSearch({ abort = true } = {}) {
      window.clearTimeout(this.searchTimer);
      if (abort) this.searchController?.abort();
      this.searchController = null;
      if (this.predictive) {
        this.predictive.hidden = true;
        this.predictive.setAttribute('aria-busy', 'false');
        this.predictive.classList.remove('is-loading', 'has-error');
      }
      if (this.status) {
        this.status.hidden = true;
        this.status.textContent = '';
        this.status.classList.remove('visually-hidden');
      }
      if (this.navigation) this.navigation.hidden = false;
    }

    parsePlaceholderTerms(value) {
      return [...new Set(String(value || '')
        .split(/[\n,]+/)
        .map((term) => term.trim())
        .filter(Boolean))];
    }

    startPlaceholderAnimation() {
      if (!this.animatedPlaceholder || !this.placeholderTerms.length || this.hidden) return;
      this.stopPlaceholderAnimation();
      this.placeholderIndex = 0;
      this.animatedPlaceholder.textContent = this.placeholderTerms[0];
      this.input.setAttribute('placeholder', '');
      this.form.classList.add('has-animated-placeholder');
      if (this.reduceMotion.matches || this.placeholderTerms.length < 2) return;

      this.placeholderTimer = window.setInterval(() => {
        if (this.hidden || this.input.value) return;
        this.animatedPlaceholder.classList.add('is-changing');
        window.clearTimeout(this.placeholderSwapTimer);
        this.placeholderSwapTimer = window.setTimeout(() => {
          this.placeholderIndex = (this.placeholderIndex + 1) % this.placeholderTerms.length;
          this.animatedPlaceholder.textContent = this.placeholderTerms[this.placeholderIndex];
          this.animatedPlaceholder.classList.remove('is-changing');
        }, 320);
      }, 3500);
    }

    stopPlaceholderAnimation() {
      window.clearInterval(this.placeholderTimer);
      window.clearTimeout(this.placeholderSwapTimer);
      this.placeholderTimer = null;
      this.placeholderSwapTimer = null;
      this.animatedPlaceholder?.classList.remove('is-changing');
      this.form?.classList.remove('has-animated-placeholder');
      if (this.input) this.input.setAttribute('placeholder', this.placeholderFallback || '');
    }

    async loadRecentlyViewedProducts() {
      if (this.dataset.recentlyViewedEnabled !== 'true' || !this.recentlyViewed || !this.recentList) return;
      if (this.isPreviewMode()) {
        this.recentlyViewed.hidden = false;
        return;
      }

      const handles = this.readRecentlyViewedHandles();
      const limit = Math.min(6, Math.max(1, Number.parseInt(this.dataset.recentlyViewedLimit, 10) || 4));
      const visibleHandles = handles.slice(0, limit);
      if (!visibleHandles.length) {
        this.recentlyViewed.hidden = true;
        return;
      }

      const cacheKey = visibleHandles.join('|');
      if (cacheKey === this.recentCacheKey && this.recentList.children.length) {
        this.recentlyViewed.hidden = false;
        return;
      }

      this.recentController?.abort();
      const controller = new AbortController();
      this.recentController = controller;
      this.recentList.setAttribute('aria-busy', 'true');

      try {
        const products = await Promise.all(visibleHandles.map(async (handle) => {
          try {
            const response = await fetch(this.localeUrl(`products/${encodeURIComponent(handle)}.js`), {
              signal: controller.signal,
              headers: { Accept: 'application/json' },
              credentials: 'same-origin',
            });
            if (!response.ok) return null;
            const product = await response.json();
            return product
              && typeof product === 'object'
              && typeof product.title === 'string'
              && product.title.trim()
              ? { product, handle }
              : null;
          } catch (error) {
            if (error.name === 'AbortError') throw error;
            return null;
          }
        }));
        if (this.recentController !== controller) return;

        const visibleProducts = products.filter(Boolean);
        this.recentList.replaceChildren(...visibleProducts.map(({ product, handle }, index) => this.createRecentProduct(product, handle, index)));
        this.recentCacheKey = cacheKey;
        this.recentlyViewed.hidden = visibleProducts.length === 0;
      } catch (error) {
        if (error.name !== 'AbortError') this.recentlyViewed.hidden = true;
      } finally {
        if (this.recentController === controller) this.recentController = null;
        this.recentList.removeAttribute('aria-busy');
      }
    }

    readRecentlyViewedHandles() {
      try {
        const stored = JSON.parse(localStorage.getItem('spinel:recently-viewed') || '[]');
        if (!Array.isArray(stored)) return [];
        const seen = new Set();
        return stored.filter((value) => {
          if (typeof value !== 'string') return false;
          const handle = value.trim();
          if (!handle || handle.length > 255 || /[\\/?#]/.test(handle) || seen.has(handle)) return false;
          seen.add(handle);
          return true;
        }).map((handle) => handle.trim());
      } catch (_) {
        return [];
      }
    }

    createRecentProduct(product, fallbackHandle, index) {
      const row = document.createElement('article');
      row.className = 'search-drawer__recent-product';
      const productUrl = this.localeUrl(`products/${encodeURIComponent(product.handle || fallbackHandle)}`);
      const media = this.createLink(productUrl, 'search-drawer__recent-media');
      const imageUrl = this.imageUrl(product.featured_image || product.images?.[0]);
      if (imageUrl) {
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = product.title || '';
        image.loading = 'lazy';
        media.append(image);
      } else {
        const placeholder = document.createElement('span');
        placeholder.setAttribute('aria-hidden', 'true');
        media.append(placeholder);
      }

      const details = document.createElement('div');
      details.className = 'search-drawer__recent-details';
      const title = document.createElement('h4');
      title.className = 'search-drawer__recent-title product-title-text heading-h4 heading-text';
      title.id = `SearchDrawerRecent-${this.dataset.sectionId}-${String(product.id || index).replace(/[^a-zA-Z0-9_-]/g, '')}`;
      const titleLink = this.createLink(productUrl);
      titleLink.textContent = product.title || '';
      title.append(titleLink);
      const price = document.createElement('p');
      price.className = 'search-drawer__recent-price';
      const variant = this.availableVariant(product);
      price.textContent = this.formatMoney(variant?.price ?? product.price);
      details.append(title, price);
      row.append(media, details);

      const variants = Array.isArray(product.variants) ? product.variants : [];
      const requiresSellingPlan = Boolean(product.requires_selling_plan || variant?.requires_selling_plan);
      if (this.dataset.showQuickAdd === 'true' && variant?.id && variant.available !== false) {
        const button = document.createElement('button');
        button.className = 'quick-add-button search-drawer__quick-add';
        button.type = 'button';
        if (variants.length === 1 && !requiresSellingPlan) {
          button.dataset.searchDrawerQuickAdd = '';
          button.dataset.variantId = String(variant.id);
          button.setAttribute('aria-label', this.dataset.quickAddLabel || '');
        } else {
          button.dataset.searchDrawerChooseOptions = '';
          button.dataset.productCardQuickViewOpen = '';
          button.dataset.productCardQuickViewUrl = productUrl;
          button.setAttribute('aria-haspopup', 'dialog');
          button.setAttribute('aria-label', this.dataset.chooseOptionsLabel || '');
        }
        button.setAttribute('aria-describedby', title.id);
        if (this.bagIconTemplate) button.append(this.bagIconTemplate.content.cloneNode(true));
        row.append(button);
      }

      return row;
    }

    availableVariant(product) {
      const preferred = product.selected_or_first_available_variant || product.selected_variant;
      if (preferred?.id && preferred.available !== false) return preferred;
      const variants = Array.isArray(product.variants) ? product.variants : [];
      return variants.find((variant) => variant?.available) || variants[0] || null;
    }

    async openRecentlyViewedOptions(button) {
      const quickViewUrl = button.dataset.productCardQuickViewUrl;
      if (!quickViewUrl) return;
      const quickViewModal = document.querySelector('[data-quick-view-modal]');
      const reopenSearchDrawer = () => {
        if (this.isConnected) this.open(button);
      };

      quickViewModal?.addEventListener('close', reopenSearchDrawer, { once: true });
      await this.close({ restoreFocus: false });
      if (window.SpinelQuickView?.open) {
        window.SpinelQuickView.open(quickViewUrl, button);
      } else {
        window.location.assign(quickViewUrl);
      }
    }

    async addRecentlyViewedProduct(button) {
      const variantId = button.dataset.variantId;
      if (!variantId || button.disabled || this.cartController) return;

      const controller = new AbortController();
      this.cartController = controller;
      const returnTarget = this.returnFocus?.isConnected ? this.returnFocus : null;
      const image = button.closest('.search-drawer__recent-product')?.querySelector('img') || null;
      const quickAddButtons = [...this.querySelectorAll('[data-search-drawer-quick-add]')];
      quickAddButtons.forEach((candidate) => { candidate.disabled = true; });
      button.classList.add('is-loading');
      button.setAttribute('aria-busy', 'true');
      this.announce(this.dataset.addingLabel);

      try {
        const formData = new FormData();
        formData.set('id', variantId);
        formData.set('quantity', '1');
        const response = await fetch(this.localeUrl('cart/add.js'), {
          method: 'POST',
          signal: controller.signal,
          headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: formData,
        });
        const item = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(item.description || item.message || this.dataset.addErrorLabel);

        let cart = null;
        try {
          const cartResponse = await fetch(this.localeUrl('cart.js'), {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
          });
          if (cartResponse.ok) cart = await cartResponse.json();
        } catch (error) {
          if (error.name === 'AbortError') throw error;
        }

        this.announce(this.dataset.addedLabel);
        if (cart) document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true, detail: { item, cart } }));
        document.dispatchEvent(new CustomEvent('cart:add:success', {
          bubbles: true,
          detail: {
            item,
            cart,
            button: returnTarget || button,
            sourceButton: button,
            image,
            imageUrl: image?.currentSrc || image?.src,
          },
        }));
      } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('[Spinel] Search drawer quick add failed.', error);
        this.announce(error.message || this.dataset.addErrorLabel);
      } finally {
        if (this.cartController === controller) this.cartController = null;
        quickAddButtons.forEach((candidate) => { candidate.disabled = false; });
        button.classList.remove('is-loading');
        button.removeAttribute('aria-busy');
      }
    }

    announce(message) {
      if (!this.announcer) return;
      this.announcer.textContent = '';
      window.requestAnimationFrame(() => { this.announcer.textContent = message || ''; });
    }

    createLink(url, className = '') {
      const link = document.createElement('a');
      if (className) link.className = className;
      link.href = url || this.form.action;
      return link;
    }

    imageUrl(image) {
      if (!image) return '';
      if (typeof image === 'string') return image;
      return image.url || image.src || '';
    }

    formatPredictivePrice(price) {
      const value = Number.parseFloat(price);
      if (!Number.isFinite(value)) return String(price || '');
      return this.formatMoney(Math.round(value * 100));
    }

    formatMoney(cents) {
      const value = Number(cents);
      if (!Number.isFinite(value)) return '';
      return window.SpinelMoney?.format(value, {
        currency: this.dataset.currencyCode || 'USD',
        showCurrencyCode: this.dataset.showCurrencyCode === 'true',
      }) || new Intl.NumberFormat(document.documentElement.lang || undefined, {
        style: 'currency',
        currency: this.dataset.currencyCode || 'USD',
      }).format(value / 100);
    }

    interpolate(template, token, value) {
      return String(template || '').replace(token, value);
    }

    localeUrl(path) {
      const root = window.Shopify?.routes?.root || '/';
      const normalizedRoot = root.endsWith('/') ? root : `${root}/`;
      return `${normalizedRoot}${String(path || '').replace(/^\/+/, '')}`;
    }
  }

  customElements.define('search-drawer', SearchDrawer);
})();
