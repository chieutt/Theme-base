if (!customElements.get('footer-localization')) {
  class FooterLocalization extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('form');
      this.handleChange = () => this.form?.requestSubmit();
      this.addEventListener('change', this.handleChange);
    }

    disconnectedCallback() {
      this.removeEventListener('change', this.handleChange);
    }
  }

  customElements.define('footer-localization', FooterLocalization);
}

if (!customElements.get('footer-house')) {
  class FooterHouse extends HTMLElement {
    connectedCallback() {
      this.mobileQuery = window.matchMedia('(max-width: 767.98px)');
      this.menus = [...this.querySelectorAll('[data-footer-menu]')];
      this.section = this.closest('.shopify-section');
      this.handleViewportChange = () => this.syncMenuState();
      this.handleFooterViewportChange = () => this.scheduleStickyState();
      this.handleBlockSelect = (event) => {
        const selectedMenu = event.target.closest?.('[data-footer-menu]');
        if (selectedMenu instanceof HTMLDetailsElement && this.contains(selectedMenu)) {
          window.ThemeDetailsAccordion?.setOpen(selectedMenu, true, { immediate: true });
        }
      };
      this.handleMenuToggle = (event) => {
        if (!this.mobileQuery.matches || event.currentTarget.dataset.footerMobileAccordion !== 'true' || !event.currentTarget.open) return;
        this.menus.forEach((menu) => {
          if (menu !== event.currentTarget && menu.dataset.footerMobileAccordion === 'true' && menu.open) {
            window.ThemeDetailsAccordion?.setOpen(menu, false);
          }
        });
      };

      this.menus.forEach((menu) => menu.addEventListener('toggle', this.handleMenuToggle));
      this.addEventListener('shopify:block:select', this.handleBlockSelect);
      this.footerResizeObserver = new ResizeObserver(this.handleFooterViewportChange);
      this.footerResizeObserver.observe(this);
      window.addEventListener('resize', this.handleFooterViewportChange, { passive: true });

      if (this.mobileQuery.addEventListener) {
        this.mobileQuery.addEventListener('change', this.handleViewportChange);
      } else {
        this.mobileQuery.addListener(this.handleViewportChange);
      }

      this.syncMenuState();
      this.scheduleStickyState();
    }

    disconnectedCallback() {
      this.menus?.forEach((menu) => menu.removeEventListener('toggle', this.handleMenuToggle));
      this.removeEventListener('shopify:block:select', this.handleBlockSelect);
      this.footerResizeObserver?.disconnect();
      window.removeEventListener('resize', this.handleFooterViewportChange);
      if (this.stickyFrame) cancelAnimationFrame(this.stickyFrame);
      this.section?.classList.remove('section-footer--sticky-ready', 'section-footer--sticky-tall');
      this.section?.style.removeProperty('--footer-sticky-top');

      if (this.mobileQuery?.removeEventListener) {
        this.mobileQuery.removeEventListener('change', this.handleViewportChange);
      } else {
        this.mobileQuery?.removeListener(this.handleViewportChange);
      }
    }

    syncMenuState() {
      this.menus.forEach((menu) => {
        const usesMobileAccordion = menu.dataset.footerMobileAccordion === 'true';
        const opensByDefault = menu.dataset.footerDefaultOpen === 'true';
        if (!(menu instanceof HTMLDetailsElement)) return;
        window.ThemeDetailsAccordion?.setOpen(
          menu,
          !this.mobileQuery.matches || !usesMobileAccordion || opensByDefault,
          { immediate: true },
        );
      });
    }

    scheduleStickyState() {
      if (this.stickyFrame) cancelAnimationFrame(this.stickyFrame);
      this.stickyFrame = requestAnimationFrame(() => this.syncStickyState());
    }

    syncStickyState() {
      this.stickyFrame = null;
      if (!this.section) return;

      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const footerHeight = this.section.getBoundingClientRect().height;
      const isDesktop = window.matchMedia('(min-width: 1150px)').matches;
      const isTall = footerHeight > viewportHeight - 1;

      this.section.classList.toggle('section-footer--sticky-ready', isDesktop);
      this.section.classList.toggle('section-footer--sticky-tall', isDesktop && isTall);

      if (isDesktop && isTall) {
        this.section.style.setProperty('--footer-sticky-top', `${Math.round(viewportHeight - footerHeight - 1)}px`);
      } else {
        this.section.style.removeProperty('--footer-sticky-top');
      }
    }
  }

  customElements.define('footer-house', FooterHouse);
}

if (!customElements.get('footer-wordmark')) {
  class FooterWordmark extends HTMLElement {
    connectedCallback() {
      this.handleResize = () => this.scheduleFit();
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this);
      document.fonts?.ready.then(() => this.scheduleFit());
      this.scheduleFit();
    }

    disconnectedCallback() {
      this.resizeObserver?.disconnect();
      if (this.frame) cancelAnimationFrame(this.frame);
    }

    scheduleFit() {
      if (this.frame) cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => this.fit());
    }

    fit() {
      this.frame = null;
      const contentBlock = this.querySelector('.content-block');
      if (!contentBlock || this.clientWidth <= 0) return;

      this.style.removeProperty('--footer-wordmark-fitted-size');
      const naturalSize = Number.parseFloat(getComputedStyle(contentBlock).fontSize);
      const naturalWidth = contentBlock.scrollWidth;

      if (naturalWidth > this.clientWidth) {
        const fittedSize = Math.max(42, naturalSize * (this.clientWidth / naturalWidth) * 0.985);
        this.style.setProperty('--footer-wordmark-fitted-size', `${fittedSize}px`);
      }
    }
  }

  customElements.define('footer-wordmark', FooterWordmark);
}
