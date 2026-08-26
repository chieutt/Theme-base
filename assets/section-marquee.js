if (!customElements.get('theme-marquee')) {
  class ThemeMarquee extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('.marquee__track');
      this.sourceGroup = this.querySelector('.marquee__group');
      if (!this.track || !this.sourceGroup || !this.sourceGroup.children.length) return;

      this.originalChildren = Array.from(this.sourceGroup.children);
      this.queueRefresh = this.queueRefresh.bind(this);
      this.queueParallax = this.queueParallax.bind(this);
      this.resizeObserver = new ResizeObserver(this.queueRefresh);
      this.resizeObserver.observe(this);
      this.refresh();
      document.fonts?.ready.then(this.queueRefresh);

      if ('IntersectionObserver' in window) {
        this.visibilityObserver = new IntersectionObserver((entries) => {
          this.classList.toggle('is-active', entries.some((entry) => entry.isIntersecting));
        });
        this.visibilityObserver.observe(this);
      } else {
        this.classList.add('is-active');
      }

      this.sectionRoot = this.closest('.marquee-section');
      this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.parallaxEnabled = this.sectionRoot?.dataset.marqueeParallax === 'true';
      this.parallaxFrame = 0;

      if (this.parallaxEnabled) {
        window.addEventListener('scroll', this.queueParallax, { passive: true });
        window.addEventListener('resize', this.queueParallax);
        this.reduceMotion.addEventListener?.('change', this.queueParallax);
        this.queueParallax();
      }
    }

    disconnectedCallback() {
      this.resizeObserver?.disconnect();
      this.visibilityObserver?.disconnect();
      window.removeEventListener('scroll', this.queueParallax);
      window.removeEventListener('resize', this.queueParallax);
      this.reduceMotion?.removeEventListener?.('change', this.queueParallax);
      cancelAnimationFrame(this.refreshFrame);
      cancelAnimationFrame(this.parallaxFrame);
    }

    queueRefresh() {
      cancelAnimationFrame(this.refreshFrame);
      this.refreshFrame = requestAnimationFrame(() => {
        this.refresh();
        this.queueParallax();
      });
    }

    refresh() {
      if (!this.isConnected || this.clientWidth === 0) return;

      this.track.querySelector('[data-marquee-duplicate]')?.remove();
      this.sourceGroup.querySelectorAll('[data-marquee-clone]').forEach((clone) => clone.remove());

      let clonePasses = 0;
      while (this.sourceGroup.scrollWidth < this.clientWidth && clonePasses < 20) {
        const fragment = document.createDocumentFragment();
        this.originalChildren.forEach((original) => {
          const clone = this.cloneForAnimation(original);
          clone.setAttribute('data-marquee-clone', '');
          fragment.appendChild(clone);
        });
        this.sourceGroup.appendChild(fragment);
        clonePasses += 1;
      }

      const duplicate = this.cloneForAnimation(this.sourceGroup);
      duplicate.setAttribute('data-marquee-duplicate', '');
      this.track.appendChild(duplicate);
    }

    queueParallax() {
      if (!this.parallaxEnabled || this.parallaxFrame) return;
      this.parallaxFrame = requestAnimationFrame(() => this.renderParallax());
    }

    renderParallax() {
      this.parallaxFrame = 0;
      if (!this.track || !this.sectionRoot) return;

      if (this.reduceMotion?.matches) {
        this.track.style.translate = 'none';
        return;
      }

      const rect = this.sectionRoot.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const progress = Math.min(1, Math.max(0, (viewportHeight - rect.top) / (viewportHeight + rect.height)));
      const normalized = (progress - 0.5) * 2;
      const desktopStrength = Number.parseFloat(this.sectionRoot.dataset.marqueeParallaxStrength) || 0;
      const mobileStrength = Number.parseFloat(this.sectionRoot.dataset.marqueeParallaxStrengthMobile) || 0;
      const strength = viewportWidth <= 767 ? mobileStrength : desktopStrength;
      const direction = this.classList.contains('marquee--direction-right') ? 1 : -1;
      const x = normalized * strength * direction;

      this.track.style.translate = `${x.toFixed(2)}px 0`;
    }

    cloneForAnimation(element) {
      const clone = element.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      const preserveEditorMetadata = Boolean(window.Shopify?.designMode);

      [clone, ...clone.querySelectorAll('*')].forEach((node) => {
        node.removeAttribute('id');
        if (!preserveEditorMetadata) {
          Array.from(node.attributes).forEach((attribute) => {
            if (attribute.name.startsWith('data-shopify-editor')) node.removeAttribute(attribute.name);
          });
        }
      });
      clone.querySelectorAll('a, button, input, select, textarea, [tabindex]').forEach((control) => {
        control.tabIndex = -1;
      });
      return clone;
    }
  }

  customElements.define('theme-marquee', ThemeMarquee);
}
