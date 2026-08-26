class ScrollNavigation extends HTMLElement {
  constructor() {
    super();
    this.sections = [];
    this.buttons = [];
    this.activeIndex = -1;
    this.frame = null;
    this.refreshTimer = null;
    this.abortController = new AbortController();
  }

  connectedCallback() {
    if (this.abortController.signal.aborted) this.abortController = new AbortController();

    this.main = document.getElementById('MainContent');
    this.list = this.querySelector('[data-scroll-navigation-list]');
    this.current = this.querySelector('[data-scroll-navigation-current]');
    this.total = this.querySelector('[data-scroll-navigation-total]');
    this.giftIcon = this.querySelector('[data-scroll-navigation-gift-icon]');

    if (!this.main || !this.list || !this.current || !this.total) return;

    document.documentElement.classList.add('has-scroll-navigation');
    this.refresh();

    const signal = this.abortController.signal;
    window.addEventListener('scroll', () => this.requestUpdate(), { passive: true, signal });
    window.addEventListener('resize', () => this.scheduleRefresh(), { passive: true, signal });
    document.addEventListener('shopify:section:load', () => this.scheduleRefresh(), { signal });
    document.addEventListener('shopify:section:unload', () => this.scheduleRefresh(), { signal });
    document.addEventListener('shopify:section:reorder', () => this.scheduleRefresh(), { signal });

    this.mutationObserver = new MutationObserver(() => this.scheduleRefresh());
    this.mutationObserver.observe(this.main, { childList: true });
  }

  disconnectedCallback() {
    this.abortController.abort();
    this.mutationObserver?.disconnect();
    window.cancelAnimationFrame(this.frame);
    window.clearTimeout(this.refreshTimer);

    if (!document.querySelector('scroll-navigation')) {
      document.documentElement.classList.remove('has-scroll-navigation');
    }
  }

  scheduleRefresh() {
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => this.refresh(), 60);
  }

  refresh() {
    this.sections = [...this.main.querySelectorAll(':scope > .shopify-section')].filter((section) => {
      const styles = window.getComputedStyle(section);
      return !section.hidden && styles.display !== 'none' && styles.visibility !== 'hidden' && section.getClientRects().length > 0;
    });

    this.render();
    this.updateActive();
  }

  render() {
    this.list.replaceChildren();
    const availableHeight = Math.max(window.innerHeight - 176, 0);
    const itemHeight = Math.max(16, Math.min(44, availableHeight / Math.max(this.sections.length, 1)));
    this.style.setProperty('--scroll-navigation-item-height', `${itemHeight}px`);
    this.activeIndex = -1;
    this.buttons = this.sections.map((section, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      const number = this.formatNumber(index + 1);
      const label = this.getSectionLabel(section, number);

      item.className = 'scroll-navigation__item';
      button.className = 'scroll-navigation__button';
      button.type = 'button';
      button.setAttribute('aria-label', label);
      button.dataset.scrollNavigationIndex = index;

      if (this.isGiftSection(section)) {
        const icon = document.createElement('span');
        icon.className = 'scroll-navigation__gift-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.innerHTML = this.giftIcon?.innerHTML || '';
        button.append(icon);
      } else {
        button.textContent = number;
      }

      button.addEventListener('click', () => this.goToSection(index));
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.goToSection(index);
      });
      item.append(button);
      this.list.append(item);
      return button;
    });

    this.total.textContent = this.formatNumber(this.sections.length);
    if (!this.sections.length) this.current.textContent = '00';
  }

  requestUpdate() {
    if (this.frame) return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null;
      this.updateActive();
    });
  }

  updateActive() {
    if (!this.sections.length) return;

    const marker = this.getStickyHeaderOffset() + 1;
    let nextIndex = 0;

    this.sections.forEach((section, index) => {
      if (section.getBoundingClientRect().top <= marker) nextIndex = index;
    });

    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      nextIndex = this.sections.length - 1;
    }

    if (nextIndex === this.activeIndex) return;

    this.buttons[this.activeIndex]?.classList.remove('is-active');
    this.buttons[this.activeIndex]?.removeAttribute('aria-current');
    this.activeIndex = nextIndex;
    this.buttons[nextIndex]?.classList.add('is-active');
    this.buttons[nextIndex]?.setAttribute('aria-current', 'true');
    this.current.textContent = this.formatNumber(nextIndex + 1);
  }

  goToSection(index) {
    const section = this.sections[index];
    if (!section) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = reduceMotion ? 'auto' : this.dataset.scrollBehavior;
    const top = section.getBoundingClientRect().top + window.scrollY - this.getStickyHeaderOffset();
    window.scrollTo({ top: Math.max(0, top), behavior });
  }

  getStickyHeaderOffset() {
    const header = document.querySelector('[data-header].header--sticky');
    if (!header || window.getComputedStyle(header).display === 'none') return 0;
    return header.getBoundingClientRect().height;
  }

  getSectionLabel(section, number) {
    const explicitLabel = section.dataset.scrollNavigationLabel;
    const heading = section.querySelector('h1, h2, h3');
    const headingText = heading?.textContent?.replace(/\s+/g, ' ').trim();
    return explicitLabel || headingText ? `Section ${number}: ${explicitLabel || headingText}` : `Go to section ${number}`;
  }

  isGiftSection(section) {
    const identity = `${section.id} ${section.className}`.toLowerCase();
    return identity.includes('gift') || Boolean(section.querySelector('[class*="gift-spinel"], [data-scroll-navigation-gift]'));
  }

  formatNumber(value) {
    return String(value).padStart(2, '0');
  }
}

if (!customElements.get('scroll-navigation')) {
  customElements.define('scroll-navigation', ScrollNavigation);
}
