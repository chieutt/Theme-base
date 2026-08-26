if (!customElements.get('theme-marquee')) {
  class ThemeMarquee extends HTMLElement {
    connectedCallback() {
      this.track = this.querySelector('.marquee__track');
      this.sourceGroup = this.querySelector('.marquee__group');
      if (!this.track || !this.sourceGroup || !this.sourceGroup.children.length) return;

      this.originalChildren = Array.from(this.sourceGroup.children);
      this.queueRefresh = this.queueRefresh.bind(this);
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
    }

    disconnectedCallback() {
      this.resizeObserver?.disconnect();
      this.visibilityObserver?.disconnect();
      cancelAnimationFrame(this.refreshFrame);
    }

    queueRefresh() {
      cancelAnimationFrame(this.refreshFrame);
      this.refreshFrame = requestAnimationFrame(() => this.refresh());
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

    cloneForAnimation(element) {
      const clone = element.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      [clone, ...clone.querySelectorAll('*')].forEach((node) => {
        node.removeAttribute('id');
        Array.from(node.attributes).forEach((attribute) => {
          if (attribute.name.startsWith('data-shopify-editor')) node.removeAttribute(attribute.name);
        });
      });
      clone.querySelectorAll('a, button, input, select, textarea, [tabindex]').forEach((control) => {
        control.tabIndex = -1;
      });
      return clone;
    }
  }

  customElements.define('theme-marquee', ThemeMarquee);
}
