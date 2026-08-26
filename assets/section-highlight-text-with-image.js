if (!customElements.get('highlight-text-with-image')) {
  class HighlightTextWithImage extends HTMLElement {
    connectedCallback() {
      this.section = this.querySelector('.highlight-text-with-image');
      this.heading = this.querySelector('.highlight-text-with-image__heading');
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.animationFrame = null;
      this.structureFrame = null;
      this.highlightTokens = [];
      this.tokenMetrics = [];
      this.totalHighlightWidth = 0;
      this.lastHeadingWidth = 0;
      this.lastHeadingHeight = 0;
      this.lastTypographySignature = '';
      this.originalHeadingHTML ||= this.heading?.innerHTML;
      this.handleViewportChange = this.handleViewportChange.bind(this);
      this.handleMotionChange = this.handleMotionChange.bind(this);
      this.handleResize = this.handleResize.bind(this);

      if (!this.section || !this.heading) return;

      this.buildTextHighlight();
      this.classList.add('is-scroll-highlight-ready');
      this.reducedMotion.addEventListener?.('change', this.handleMotionChange);
      window.addEventListener('resize', this.handleResize, { passive: true });
      this.headingResizeObserver = new ResizeObserver(this.handleResize);
      this.headingResizeObserver.observe(this.heading);
      this.handleMotionChange();

      document.fonts?.ready.then(() => {
        if (!this.isConnected) return;

        requestAnimationFrame(() => requestAnimationFrame(() => this.scheduleStructureUpdate()));
      });
    }

    disconnectedCallback() {
      window.removeEventListener('scroll', this.handleViewportChange);
      window.removeEventListener('resize', this.handleResize);
      this.reducedMotion?.removeEventListener?.('change', this.handleMotionChange);
      this.headingResizeObserver?.disconnect();
      if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
      if (this.structureFrame) cancelAnimationFrame(this.structureFrame);
    }

    handleMotionChange() {
      window.removeEventListener('scroll', this.handleViewportChange);

      if (this.reducedMotion.matches) {
        this.setHighlightProgress(1);
        return;
      }

      window.addEventListener('scroll', this.handleViewportChange, { passive: true });
      this.handleViewportChange();
    }

    handleResize() {
      this.scheduleStructureUpdate();
    }

    scheduleStructureUpdate() {
      if (this.structureFrame) return;

      this.structureFrame = requestAnimationFrame(() => {
        this.structureFrame = null;
        if (!this.isConnected || !this.heading) return;

        const currentBounds = this.heading.getBoundingClientRect();
        const currentWidth = Math.round(currentBounds.width);
        const currentHeight = Math.round(currentBounds.height);
        const currentTypographySignature = this.getTypographySignature();

        if (
          currentWidth === this.lastHeadingWidth
          && currentHeight === this.lastHeadingHeight
          && currentTypographySignature === this.lastTypographySignature
        ) {
          this.cacheTokenMetrics();
          this.updateFillStop();
          return;
        }

        this.buildTextHighlight();
        this.updateFillStop();
      });
    }

    buildTextHighlight() {
      this.heading.innerHTML = this.originalHeadingHTML;

      const tokens = [];
      Array.from(this.heading.childNodes).forEach((node) => this.collectTokens(node, [], tokens));

      while (tokens[0]?.classList.contains('text-highlight__token--space')) tokens.shift();
      while (tokens.at(-1)?.classList.contains('text-highlight__token--space')) tokens.pop();

      const measurementFragment = document.createDocumentFragment();
      tokens.forEach((token) => measurementFragment.append(token));
      this.heading.replaceChildren(measurementFragment);
      this.heading.classList.add('is-measuring-highlight-lines');

      const lines = [];
      let activeLine = [];
      let activeCenter = null;
      const computedLineHeight = Number.parseFloat(getComputedStyle(this.heading).lineHeight) || 1;
      const lineThreshold = Math.max(computedLineHeight * 0.55, 8);

      tokens.forEach((token) => {
        const rect = token.getClientRects()[0] || token.getBoundingClientRect();
        const tokenCenter = rect.top + rect.height / 2;

        if (activeCenter !== null && Math.abs(tokenCenter - activeCenter) > lineThreshold) {
          lines.push(activeLine);
          activeLine = [];
        }

        if (activeLine.length === 0) activeCenter = tokenCenter;
        activeLine.push(token);
      });

      if (activeLine.length) lines.push(activeLine);

      const lineFragment = document.createDocumentFragment();
      lines.forEach((lineTokens) => {
        const line = document.createElement('div');
        line.className = 'text-highlight';
        lineTokens.forEach((token) => line.append(token));
        lineFragment.append(line);
      });

      this.heading.replaceChildren(lineFragment);
      this.heading.classList.remove('is-measuring-highlight-lines');
      const headingBounds = this.heading.getBoundingClientRect();
      this.lastHeadingWidth = Math.round(headingBounds.width);
      this.lastHeadingHeight = Math.round(headingBounds.height);
      this.lastTypographySignature = this.getTypographySignature();
      this.highlightTokens = Array.from(this.heading.querySelectorAll('.text-highlight__token'));
      this.cacheTokenMetrics();
      this.initializeTokenReveals();
    }

    initializeTokenReveals() {
      requestAnimationFrame(() => {
        if (!this.isConnected || !this.heading) return;
        window.ThemeAnimations?.init(this.heading);
      });
    }

    getTypographySignature() {
      const styles = getComputedStyle(this.heading);
      return [styles.fontFamily, styles.fontSize, styles.fontWeight, styles.letterSpacing, styles.lineHeight].join('|');
    }

    collectTokens(node, inheritedClasses, tokens) {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent.split(/(\s+)/).filter(Boolean).forEach((content) => {
          const token = document.createElement('span');
          const isSpace = /^\s+$/.test(content);
          token.className = ['text-highlight__token', isSpace ? 'text-highlight__token--space' : '', ...inheritedClasses]
            .filter(Boolean)
            .join(' ');
          if (!isSpace) {
            token.dataset.reveal = 'fade-up';
            token.dataset.revealDelay = String(Math.min(tokens.length * 75, 1000));
          }
          token.textContent = content;
          tokens.push(token);
        });
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;

      if (node.classList.contains('highlight-text-with-image__media')) {
        node.classList.add('text-highlight__token', 'text-highlight__token--media');
        node.dataset.reveal = 'fade-up';
        node.dataset.revealDelay = String(Math.min(tokens.length * 75, 1000));
        tokens.push(node);
        return;
      }

      if (node.classList.contains('highlight-text-with-image__marker')) {
        const markerClasses = Array.from(node.classList);
        Array.from(node.childNodes).forEach((child) => this.collectTokens(child, markerClasses, tokens));
        return;
      }

      Array.from(node.childNodes).forEach((child) => this.collectTokens(child, inheritedClasses, tokens));
    }

    cacheTokenMetrics() {
      let offset = 0;

      this.tokenMetrics = this.highlightTokens.map((token) => {
        const width = Math.max(token.getBoundingClientRect().width, 0);
        const metric = { token, start: offset, width };
        offset += width;
        return metric;
      });

      this.totalHighlightWidth = Math.max(offset, 1);
    }

    handleViewportChange() {
      if (this.animationFrame) return;

      this.animationFrame = requestAnimationFrame(() => {
        this.animationFrame = null;
        this.updateFillStop();
      });
    }

    updateFillStop() {
      if (!this.isConnected || !this.section) return;

      if (this.reducedMotion.matches) {
        this.setHighlightProgress(1);
        return;
      }

      const bounds = this.getBoundingClientRect();
      const viewportHeight = Math.max(window.innerHeight, 1);
      const start = viewportHeight * 0.8;
      const finishRatio = {
        slow: 0.12,
        medium: 0.26,
        fast: 0.4,
      }[this.dataset.animationSpeed] || 0.26;
      const finish = viewportHeight * finishRatio;
      const travel = Math.max(start - finish, 1);
      const progress = Math.min(Math.max((start - bounds.top) / travel, 0), 1);

      this.setHighlightProgress(progress);
    }

    setHighlightProgress(progress) {
      const normalizedProgress = Math.min(Math.max(progress, 0), 1);
      const filledWidth = this.totalHighlightWidth * normalizedProgress;

      this.section.style.setProperty('--highlight-fill-stop', `${(normalizedProgress * 100).toFixed(2)}%`);

      this.tokenMetrics.forEach(({ token, start, width }) => {
        if (token.classList.contains('text-highlight__token--media')) return;

        const localFill = Math.min(Math.max(filledWidth - start, 0), width);
        const transitionWidth = Math.min(Math.max(width * 0.08, 2), 8);
        const localUnfill = localFill <= 0
          ? 0
          : localFill >= width
            ? width
            : Math.min(localFill + transitionWidth, width);
        const tokenProgress = width > 0 ? localFill / width : normalizedProgress;

        token.style.setProperty('--highlight-fill-stop', `${localFill.toFixed(2)}px`);
        token.style.setProperty('--highlight-unfill-stop', `${localUnfill.toFixed(2)}px`);
        token.style.setProperty('--highlight-token-progress', tokenProgress.toFixed(4));
      });
    }
  }

  customElements.define('highlight-text-with-image', HighlightTextWithImage);
}
