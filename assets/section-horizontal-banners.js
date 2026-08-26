if (!customElements.get('horizontal-scrolling-banners')) {
  class HorizontalScrollingBanners extends HTMLElement {
    connectedCallback() {
      this.scene = this.querySelector('[data-horizontal-banners-scene]');
      this.sticky = this.querySelector('[data-horizontal-banners-sticky]');
      this.track = this.querySelector('[data-horizontal-banners-track]');
      this.panels = Array.from(this.querySelectorAll('[data-horizontal-banners-panel]'));
      this.videos = Array.from(this.querySelectorAll('video.horizontal-banners__media-element'));
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.handleVideoMotionChange = this.updateVideoPlayback.bind(this);
      this.motionQuery.addEventListener('change', this.handleVideoMotionChange);
      this.updateVideoPlayback();
      if (!this.scene || !this.sticky || !this.track || this.panels.length < 2) return;

      this.desktopQuery = window.matchMedia('(min-width: 1150px)');
      this.handleScroll = this.handleScroll.bind(this);
      this.handleResize = this.measure.bind(this);
      this.handleModeChange = this.setup.bind(this);
      this.handleRailScroll = this.updateRailProgress.bind(this);
      this.handleBlockSelect = this.selectBlock.bind(this);
      this.handlePointerDown = this.onPointerDown.bind(this);
      this.handlePointerMove = this.onPointerMove.bind(this);
      this.handlePointerEnd = this.onPointerEnd.bind(this);
      this.handleTrackClick = this.onTrackClick.bind(this);
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(this.sticky);
      this.resizeObserver.observe(this.track);
      this.desktopQuery.addEventListener('change', this.handleModeChange);
      this.motionQuery.addEventListener('change', this.handleModeChange);
      window.visualViewport?.addEventListener('resize', this.handleResize);
      this.track.addEventListener('scroll', this.handleRailScroll, { passive: true });
      this.track.addEventListener('pointerdown', this.handlePointerDown);
      this.track.addEventListener('pointermove', this.handlePointerMove, { passive: false });
      this.track.addEventListener('pointerup', this.handlePointerEnd);
      this.track.addEventListener('pointercancel', this.handlePointerEnd);
      this.track.addEventListener('click', this.handleTrackClick, true);
      document.addEventListener('shopify:block:select', this.handleBlockSelect);
      document.fonts?.ready.then(this.handleResize);
      this.setup();
    }

    disconnectedCallback() {
      window.removeEventListener('scroll', this.handleScroll);
      this.desktopQuery?.removeEventListener('change', this.handleModeChange);
      this.motionQuery?.removeEventListener('change', this.handleModeChange);
      this.motionQuery?.removeEventListener('change', this.handleVideoMotionChange);
      window.visualViewport?.removeEventListener('resize', this.handleResize);
      this.track?.removeEventListener('scroll', this.handleRailScroll);
      this.track?.removeEventListener('pointerdown', this.handlePointerDown);
      this.track?.removeEventListener('pointermove', this.handlePointerMove);
      this.track?.removeEventListener('pointerup', this.handlePointerEnd);
      this.track?.removeEventListener('pointercancel', this.handlePointerEnd);
      this.track?.removeEventListener('click', this.handleTrackClick, true);
      document.removeEventListener('shopify:block:select', this.handleBlockSelect);
      this.resizeObserver?.disconnect();
      if (this.raf) window.cancelAnimationFrame(this.raf);
    }

    setup() {
      window.removeEventListener('scroll', this.handleScroll);
      this.classList.remove('is-scroll-linked');
      this.scene.style.removeProperty('--horizontal-banners-scene-height');
      this.track.style.removeProperty('transform');
      this.style.setProperty('--horizontal-banners-progress', '0');
      this.updateVideoPlayback();

      if (!this.motionQuery.matches) {
        this.classList.add('is-scroll-linked');
        window.addEventListener('scroll', this.handleScroll, { passive: true });
        this.measure();
      } else {
        this.updateRailProgress();
      }
    }

    updateVideoPlayback() {
      if (!this.videos?.length) return;

      this.videos.forEach((video) => {
        if (this.motionQuery?.matches) {
          video.pause();
          return;
        }

        const playRequest = video.play();
        if (playRequest && typeof playRequest.catch === 'function') {
          playRequest.catch(() => {});
        }
      });
    }

    measure() {
      if (!this.classList.contains('is-scroll-linked')) return;
      this.travel = Math.max(0, this.track.scrollWidth - this.sticky.clientWidth);
      const sceneHeight = this.sticky.offsetHeight + this.travel;
      this.scene.style.setProperty('--horizontal-banners-scene-height', `${sceneHeight}px`);
      this.scrollRange = Math.max(1, this.travel);
      this.pinOffset = Math.max(0, Number.parseFloat(window.getComputedStyle(this.sticky).top) || 0);
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
      const progress = Math.min(1, Math.max(0, (this.pinOffset - this.scene.getBoundingClientRect().top) / this.scrollRange));
      const position = this.travel * progress;
      this.track.style.transform = `translate3d(${-position}px, 0, 0)`;
      this.style.setProperty('--horizontal-banners-progress', progress.toFixed(4));
      this.updatePanelMotion(position);
    }

    updatePanelMotion(position) {
      if (!this.classList.contains('horizontal-banners--animate')) return;
      const viewportCenter = position + this.sticky.clientWidth / 2;
      this.panels.forEach((panel) => {
        const panelCenter = panel.offsetLeft + panel.offsetWidth / 2;
        const distance = Math.abs(panelCenter - viewportCenter);
        const visibility = Math.max(0, 1 - distance / Math.max(this.sticky.clientWidth, panel.offsetWidth));
        panel.style.setProperty('--horizontal-banners-panel-visibility', visibility.toFixed(3));
      });
    }

    updateRailProgress() {
      if (this.classList.contains('is-scroll-linked')) return;
      const range = Math.max(1, this.track.scrollWidth - this.track.clientWidth);
      const progress = Math.min(1, Math.max(0, this.track.scrollLeft / range));
      this.style.setProperty('--horizontal-banners-progress', progress.toFixed(4));
    }

    getLinkedPosition() {
      if (!this.classList.contains('is-scroll-linked')) return this.track.scrollLeft;
      return Math.min(this.travel, Math.max(0, this.pinOffset - this.scene.getBoundingClientRect().top));
    }

    onPointerDown(event) {
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      if (!this.classList.contains('is-scroll-linked') && event.pointerType !== 'mouse') return;

      this.dragPointerId = event.pointerId;
      this.dragStartX = event.clientX;
      this.dragStartY = event.clientY;
      this.dragStartPosition = this.getLinkedPosition();
      this.dragAxis = null;
      this.didDrag = false;
    }

    onPointerMove(event) {
      if (event.pointerId !== this.dragPointerId) return;

      const deltaX = event.clientX - this.dragStartX;
      const deltaY = event.clientY - this.dragStartY;
      if (!this.dragAxis) {
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 6) return;
        this.dragAxis = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
        if (this.dragAxis === 'x') {
          this.track.setPointerCapture?.(event.pointerId);
          this.classList.add('is-dragging');
        }
      }

      if (this.dragAxis !== 'x') return;
      event.preventDefault();
      this.didDrag = true;

      if (this.classList.contains('is-scroll-linked')) {
        const position = Math.min(this.travel, Math.max(0, this.dragStartPosition - deltaX));
        const sceneTop = this.scene.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: sceneTop - this.pinOffset + position, behavior: 'auto' });
      } else {
        this.track.scrollLeft = this.dragStartPosition - deltaX;
      }
    }

    onPointerEnd(event) {
      if (event.pointerId !== this.dragPointerId) return;
      if (this.track.hasPointerCapture?.(event.pointerId)) this.track.releasePointerCapture(event.pointerId);
      this.suppressClick = this.didDrag;
      this.dragPointerId = null;
      this.dragAxis = null;
      this.didDrag = false;
      this.classList.remove('is-dragging');
      window.setTimeout(() => {
        this.suppressClick = false;
      }, 0);
    }

    onTrackClick(event) {
      if (!this.suppressClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.suppressClick = false;
    }

    selectBlock(event) {
      if (!this.contains(event.target)) return;
      const blockId = event.detail?.blockId;
      const panel = blockId ? this.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`) : event.target.closest('[data-horizontal-banners-panel]');
      if (!panel) return;

      if (this.classList.contains('is-scroll-linked')) {
        const progress = this.travel > 0 ? Math.min(1, panel.offsetLeft / this.travel) : 0;
        const sceneTop = this.scene.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: sceneTop - this.pinOffset + progress * this.scrollRange, behavior: 'smooth' });
      } else {
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }

  customElements.define('horizontal-scrolling-banners', HorizontalScrollingBanners);
}
