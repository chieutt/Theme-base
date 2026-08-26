if (!customElements.get('review-parallax')) {
  class ReviewParallax extends HTMLElement {
    connectedCallback() {
      this.scene = this.querySelector('[data-review-scene]');
      this.viewport = this.querySelector('[data-review-viewport]');
      this.header = this.querySelector('.section-header-block');
      this.cards = Array.from(this.querySelectorAll('[data-review-card]'));
      this.cards.forEach((card, index) => {
        const lane = index % 3;
        const laneIndex = Math.floor(index / 3);
        const rowStart = laneIndex * 8 + lane * 2 + 1;
        const laneMotion = [
          { begin: 25, end: -10 },
          { begin: -25, end: 0 },
          { begin: 20, end: -10 },
        ][lane];

        card.classList.add(`review-parallax__card--lane-${lane}`);
        card.style.setProperty('--review-row-start', rowStart);
        card.style.setProperty('--review-order', index);
        card.dataset.reviewLane = lane;
        card.dataset.reviewLaneIndex = laneIndex;
        card.dataset.reviewIndex = index;
        card.dataset.reviewBegin = laneMotion.begin;
        card.dataset.reviewEnd = laneMotion.end;
      });
      this.cardOffsets = new Map(this.cards.map((card) => [card, 0]));
      this.mobileQuery = window.matchMedia('(max-width: 1149.98px)');
      this.reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.handleScroll = this.handleScroll.bind(this);
      this.handleResize = this.measure.bind(this);
      this.handleModeChange = this.setup.bind(this);
      this.handleBlockSelect = this.selectBlock.bind(this);

      if (!this.scene || !this.viewport || this.cards.length < 2) return;

      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this.viewport);
      this.resizeObserver.observe(this.header);
      this.cards.forEach((card) => this.resizeObserver.observe(card));
      this.mobileQuery.addEventListener('change', this.handleModeChange);
      this.reduceMotionQuery.addEventListener('change', this.handleModeChange);
      window.visualViewport?.addEventListener('resize', this.handleResize);
      document.addEventListener('shopify:block:select', this.handleBlockSelect);
      document.fonts?.ready.then(this.handleResize);
      this.setup();
    }

    disconnectedCallback() {
      window.removeEventListener('scroll', this.handleScroll);
      this.mobileQuery?.removeEventListener('change', this.handleModeChange);
      this.reduceMotionQuery?.removeEventListener('change', this.handleModeChange);
      window.visualViewport?.removeEventListener('resize', this.handleResize);
      document.removeEventListener('shopify:block:select', this.handleBlockSelect);
      this.resizeObserver?.disconnect();
      if (this.raf) window.cancelAnimationFrame(this.raf);
    }

    setup() {
      window.removeEventListener('scroll', this.handleScroll);
      this.classList.remove('is-scroll-linked');
      this.cards.forEach((card) => {
        card.style.removeProperty('--review-card-offset');
        this.cardOffsets.set(card, 0);
      });

      const canLinkScroll = this.dataset.enableScroll === 'true'
        && !this.reduceMotionQuery.matches
        && !this.mobileQuery.matches
        && CSS.supports('position', 'sticky');
      if (!canLinkScroll) return;

      this.classList.add('is-scroll-linked');
      window.addEventListener('scroll', this.handleScroll, { passive: true });
      this.measure();
    }

    measure() {
      if (!this.classList.contains('is-scroll-linked')) return;

      this.update();
    }

    handleScroll() {
      if (this.raf) return;
      this.raf = window.requestAnimationFrame(() => {
        this.raf = null;
        this.update();
      });
    }

    update() {
      if (!this.classList.contains('is-scroll-linked')) return;

      const viewportHeight = document.documentElement.clientHeight;
      const cardUpdates = this.cards.map((card) => {
        const previousOffset = this.cardOffsets.get(card) || 0;
        const rect = card.getBoundingClientRect();
        const cardHeight = rect.height;
        const baseTop = rect.top - previousOffset;
        const begin = (Number.parseFloat(card.dataset.reviewBegin) || 0) * cardHeight / 100;
        const end = (Number.parseFloat(card.dataset.reviewEnd) || 0) * cardHeight / 100;
        const range = viewportHeight + cardHeight + end - begin;
        const progress = range > 0
          ? Math.min(1, Math.max(0, (viewportHeight - baseTop - begin) / range))
          : 0;
        const offset = begin + (end - begin) * progress;

        return { card, offset };
      });

      cardUpdates.forEach(({ card, offset }) => {
        this.cardOffsets.set(card, offset);
        card.style.setProperty('--review-card-offset', `${offset.toFixed(2)}px`);
      });
    }

    selectBlock(event) {
      if (event.detail?.sectionId !== this.dataset.sectionId || !this.classList.contains('is-scroll-linked')) return;
      const selectedElement = event.target instanceof Element ? event.target : null;
      const card = selectedElement?.closest('[data-review-card]')
        || this.querySelector(`[data-review-card][data-block-id="${CSS.escape(event.detail.blockId)}"]`)
        || this.querySelector(`[data-review-card][data-review-index="${CSS.escape(event.detail.blockId)}"]`);
      if (!card) return;

      const offset = this.cardOffsets.get(card) || 0;
      const rect = card.getBoundingClientRect();
      const baseTop = rect.top + window.scrollY - offset;
      const centeredTop = baseTop - (document.documentElement.clientHeight - rect.height) / 2;
      window.scrollTo({ top: centeredTop, behavior: 'smooth' });
    }
  }

  customElements.define('review-parallax', ReviewParallax);
}
