class CollectionListPageReveal extends HTMLElement {
  connectedCallback() {
    this.cleanup();

    const cards = [...this.querySelectorAll('.collections-page__card')];
    const revealEnabled = this.dataset.revealOnScroll === 'true';
    const motionEnabled = this.dataset.motionEnabled === 'true';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!revealEnabled || !motionEnabled || reducedMotion || !('IntersectionObserver' in window) || cards.length === 0) {
      this.revealAll(cards);
      return;
    }

    cards.forEach((card) => {
      card.classList.remove('is-revealed');
      card.style.removeProperty('opacity');
      card.style.removeProperty('transform');
    });

    this.pendingFrames = new Set();
    this.observer = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          observer.unobserve(entry.target);
          this.revealCard(entry.target);
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0 }
    );

    cards.forEach((card) => this.observer.observe(card));
  }

  disconnectedCallback() {
    this.cleanup();
  }

  revealCard(card) {
    let frame;
    frame = window.requestAnimationFrame(() => {
      card.classList.add('is-revealed');
      card.style.opacity = '1';
      card.style.transform = 'translateY(0px)';
      this.pendingFrames?.delete(frame);
    });
    this.pendingFrames.add(frame);
  }

  revealAll(cards = [...this.querySelectorAll('.collections-page__card')]) {
    cards.forEach((card) => {
      card.classList.add('is-revealed');
      card.style.opacity = '1';
      card.style.transform = 'translateY(0px)';
    });
  }

  cleanup() {
    this.observer?.disconnect();
    this.observer = null;
    this.pendingFrames?.forEach((frame) => window.cancelAnimationFrame(frame));
    this.pendingFrames?.clear();
  }
}

if (!customElements.get('collection-list-page-reveal')) {
  customElements.define('collection-list-page-reveal', CollectionListPageReveal);
}
