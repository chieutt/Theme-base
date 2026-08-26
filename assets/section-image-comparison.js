if (!customElements.get('image-comparison-slider')) {
  class ImageComparisonSlider extends HTMLElement {
    connectedCallback() {
      this.handle = this.querySelector('[data-image-comparison-handle]');
      this.valueText = this.querySelector('[data-image-comparison-value]');
      if (!this.handle) return;

      this.onPointerDown = this.onPointerDown.bind(this);
      this.onPointerMove = this.onPointerMove.bind(this);
      this.onPointerUp = this.onPointerUp.bind(this);
      this.onKeydown = this.onKeydown.bind(this);
      this.addEventListener('pointerdown', this.onPointerDown);
      this.handle.addEventListener('keydown', this.onKeydown);

      const reveal = () => {
        this.classList.add('is-reveal-ready');
        window.requestAnimationFrame(() => this.setPosition(50));
      };
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
        reveal();
      } else {
        this.revealObserver = new IntersectionObserver((entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          this.revealObserver.disconnect();
          reveal();
        }, { rootMargin: '0px 0px -12% 0px' });
        this.revealObserver.observe(this);
      }
    }

    disconnectedCallback() {
      this.removeEventListener('pointerdown', this.onPointerDown);
      this.handle?.removeEventListener('keydown', this.onKeydown);
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      this.revealObserver?.disconnect();
      if (this.positionFrame) window.cancelAnimationFrame(this.positionFrame);
    }

    get isVertical() { return this.dataset.orientation === 'vertical'; }

    setPosition(value) {
      const position = Math.min(100, Math.max(0, Math.round(value * 10) / 10));
      this.style.setProperty('--comparison-position', `${position}%`);
      this.handle?.setAttribute('aria-valuenow', position);
      if (this.valueText) this.valueText.textContent = `${position}%`;
    }

    queuePosition(value) {
      this.queuedPosition = value;
      if (this.positionFrame) return;
      this.positionFrame = window.requestAnimationFrame(() => {
        this.positionFrame = null;
        this.setPosition(this.queuedPosition);
      });
    }

    positionFromPointer(event) {
      const bounds = this.getBoundingClientRect();
      const offset = this.isVertical ? event.clientY - bounds.top : event.clientX - bounds.left;
      const length = this.isVertical ? bounds.height : bounds.width;
      return length ? (offset / length) * 100 : 50;
    }

    onPointerDown(event) {
      if (event.button !== 0) return;
      event.preventDefault();
      this.classList.add('is-dragging');
      this.setPointerCapture?.(event.pointerId);
      this.setPosition(this.positionFromPointer(event));
      window.addEventListener('pointermove', this.onPointerMove);
      window.addEventListener('pointerup', this.onPointerUp, { once: true });
    }

    onPointerMove(event) { this.queuePosition(this.positionFromPointer(event)); }

    onPointerUp() {
      if (this.positionFrame) {
        window.cancelAnimationFrame(this.positionFrame);
        this.positionFrame = null;
        this.setPosition(this.queuedPosition);
      }
      this.classList.remove('is-dragging');
      window.removeEventListener('pointermove', this.onPointerMove);
    }

    onKeydown(event) {
      const current = Number(this.handle.getAttribute('aria-valuenow')) || 50;
      const decrease = this.isVertical ? 'ArrowUp' : 'ArrowLeft';
      const increase = this.isVertical ? 'ArrowDown' : 'ArrowRight';
      if (event.key === 'Home') { event.preventDefault(); this.setPosition(0); }
      else if (event.key === 'End') { event.preventDefault(); this.setPosition(100); }
      else if (event.key === decrease) { event.preventDefault(); this.setPosition(current - 5); }
      else if (event.key === increase) { event.preventDefault(); this.setPosition(current + 5); }
    }
  }

  customElements.define('image-comparison-slider', ImageComparisonSlider);
}
