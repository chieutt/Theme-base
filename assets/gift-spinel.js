const giftSpinelInstances = new Set();
const giftSpinelLayoutOwners = new Set();

const syncGiftSpinelLayoutState = () => {
  document.documentElement.classList.toggle('gift-spinel-layout-changing', giftSpinelLayoutOwners.size > 0);
};

const handleGiftSpinelDocumentClick = (event) => {
  const link = event.target.closest?.('[data-gift-spinel-link]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const destination = new URL(link.href, window.location.href);
  if (destination.origin !== window.location.origin || destination.pathname !== window.location.pathname) return;

  const target = destination.hash === '#gift-spinel'
    ? document.querySelector('gift-spinel')
    : document.getElementById(destination.hash.slice(1));
  if (!(target instanceof GiftSpinel) || !destination.hash.startsWith('#gift-spinel')) return;

  event.preventDefault();
  target.scrollToAnchor(destination.hash);
};

class GiftSpinel extends HTMLElement {
  connectedCallback() {
    if (!this.isBound) {
      this.isBound = true;
      this.onClick = this.handleClick.bind(this);
      this.onBlockSelect = this.handleBlockSelect.bind(this);
      this.onSectionLoad = this.handleSectionLoad.bind(this);
      this.addEventListener('click', this.onClick);
      document.addEventListener('shopify:block:select', this.onBlockSelect);
      document.addEventListener('shopify:section:load', this.onSectionLoad);
      giftSpinelInstances.add(this);
      if (giftSpinelInstances.size === 1) document.addEventListener('click', handleGiftSpinelDocumentClick);
      this.editorObserver = new MutationObserver((records) => {
        if (records.some((record) => record.target === this)) this.scheduleInitialize();
      });
      this.editorObserver.observe(this, { childList: true });
    }

    this.initialize();
    if (window.location.hash === `#${this.id}` || (window.location.hash === '#gift-spinel' && document.querySelector('gift-spinel') === this)) {
      this.anchorScrollFrame = window.requestAnimationFrame(() => this.scrollToAnchor(window.location.hash, false));
    }
  }

  disconnectedCallback() {
    this.restoreActiveResultSource();
    this.removeEventListener('click', this.onClick);
    document.removeEventListener('shopify:block:select', this.onBlockSelect);
    document.removeEventListener('shopify:section:load', this.onSectionLoad);
    giftSpinelInstances.delete(this);
    if (giftSpinelInstances.size === 0) document.removeEventListener('click', handleGiftSpinelDocumentClick);
    this.editorObserver?.disconnect();
    this.cancelPanelTransition();
    window.clearTimeout(this.transitionTimer);
    window.clearTimeout(this.anchorTimer);
    window.cancelAnimationFrame(this.initializeFrame);
    window.cancelAnimationFrame(this.anchorScrollFrame);
    window.cancelAnimationFrame(this.scrollAnchorReleaseFrame);
    giftSpinelLayoutOwners.delete(this);
    syncGiftSpinelLayoutState();
    this.isBound = false;
  }

  cancelPanelTransition() {
    this.panelAnimations?.forEach((animation) => animation.cancel());
    this.panelAnimations = [];
    this.isPanelTransitioning = false;
    window.cancelAnimationFrame(this.scrollAnchorReleaseFrame);
    giftSpinelLayoutOwners.delete(this);
    syncGiftSpinelLayoutState();
    if (!this.finder) return;
    this.finder.style.removeProperty('height');
    this.finder.style.removeProperty('overflow');
    this.finder.style.removeProperty('will-change');
  }

  disableScrollAnchoring() {
    window.cancelAnimationFrame(this.scrollAnchorReleaseFrame);
    giftSpinelLayoutOwners.add(this);
    syncGiftSpinelLayoutState();
  }

  releaseScrollAnchoring() {
    window.cancelAnimationFrame(this.scrollAnchorReleaseFrame);
    this.scrollAnchorReleaseFrame = window.requestAnimationFrame(() => {
      this.scrollAnchorReleaseFrame = window.requestAnimationFrame(() => {
        giftSpinelLayoutOwners.delete(this);
        syncGiftSpinelLayoutState();
      });
    });
  }

  initialize() {
    this.cancelPanelTransition();
    this.restoreActiveResultSource();
    this.finder = this.querySelector('.gift-spinel__finder');
    this.intro = this.querySelector('.gift-spinel__intro');
    this.questions = this.querySelector('[data-gift-spinel-questions]');
    this.result = this.querySelector('[data-gift-spinel-result]');
    this.status = this.querySelector('[data-gift-spinel-status]');
    this.question = this.querySelector('[data-gift-spinel-question]');
    this.choices = this.querySelector('[data-gift-spinel-choices]');
    this.paths = Array.from(this.querySelectorAll('[data-gift-spinel-path-root]'));
    this.placeholderPath = this.querySelector('template[data-gift-spinel-placeholder]');
    this.options = this.readOptions();

    if (!this.questions || !this.result || !this.question || !this.choices || !this.options.length) return;

    window.clearTimeout(this.transitionTimer);
    this.recipient = undefined;
    this.finder.classList.remove('is-showing-path');
    this.questions.hidden = false;
    this.result.hidden = true;
    this.result.replaceChildren();
    if (this.status) this.status.textContent = '';
    this.resetChoices();
    this.openOnlyPath();
  }

  scheduleInitialize() {
    window.cancelAnimationFrame(this.initializeFrame);
    this.initializeFrame = window.requestAnimationFrame(() => this.initialize());
  }

  handleSectionLoad(event) {
    const section = this.closest('[id^="shopify-section-"]');
    if (event.target === section || event.target?.contains(this)) this.scheduleInitialize();
  }

  scrollToAnchor(hash = `#${this.id}`, updateHistory = true) {
    document.querySelectorAll('[data-header] details[open]').forEach((details) => {
      details.open = false;
    });

    const header = document.querySelector('[data-header]');
    const headerHeight = header ? header.getBoundingClientRect().height : 0;
    const gap = 24;
    const destinationTop = Math.max(0, window.scrollY + this.getBoundingClientRect().top - headerHeight - gap);
    const distance = Math.abs(destinationTop - window.scrollY);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = Math.min(1050, Math.max(480, Math.round(distance * 0.45)));

    if (updateHistory) window.history.pushState(null, '', hash);
    this.classList.remove('is-anchor-target');
    void this.offsetWidth;
    this.classList.add('is-anchor-target');
    window.scrollTo({ top: destinationTop, behavior: reduceMotion ? 'auto' : 'smooth' });

    window.clearTimeout(this.anchorTimer);
    this.anchorTimer = window.setTimeout(() => this.classList.remove('is-anchor-target'), reduceMotion ? 0 : duration);
  }

  readOptions() {
    const choiceOptions = Array.from(this.querySelectorAll('[data-gift-spinel-choice]')).map((choice) => ({
      value: choice.dataset.giftSpinelChoice,
      label: choice.querySelector('.gift-spinel__choice-label')?.textContent?.trim() || choice.dataset.recipient || '',
    }));
    if (choiceOptions.length) return choiceOptions;

    try {
      return JSON.parse(this.querySelector('[data-gift-spinel-options]')?.textContent || '[]');
    } catch (error) {
      return [];
    }
  }

  resetChoices() {
    this.choices.querySelectorAll('[data-gift-spinel-choice]').forEach((button) => {
      button.classList.remove('is-selected');
      button.setAttribute('aria-pressed', 'false');
      button.disabled = false;
    });
  }

  openOnlyPath() {
    if (this.paths.length !== 1 || !this.options.length) return;

    const path = this.paths[0];
    this.recipient = this.optionFor(path.dataset.blockId);
    const choice = this.choices.querySelector(`[data-gift-spinel-choice="${CSS.escape(path.dataset.blockId || '')}"]`);
    if (choice) {
      choice.classList.add('is-selected');
      choice.setAttribute('aria-pressed', 'true');
      choice.disabled = true;
    }
    this.showResult(path, false);
  }

  handleClick(event) {
    const choice = event.target.closest('[data-gift-spinel-choice]');
    if (choice && this.contains(choice)) {
      this.selectRecipient(choice);
      return;
    }

    const change = event.target.closest('[data-gift-spinel-change]');
    if (change && this.contains(change)) this.changeRecipient();

    const bundleAdd = event.target.closest('[data-gift-spinel-bundle-add]');
    if (bundleAdd && this.contains(bundleAdd)) this.addBundle(bundleAdd);
  }

  handleBlockSelect(event) {
    const selectedBlockId = event.detail?.blockId;
    const path = this.paths.find((item) => item.dataset.blockId === selectedBlockId)
      || this.paths.find((item) => item.querySelector(`[data-shopify-editor-block="${CSS.escape(selectedBlockId || '')}"]`))
      || this.pathForVisibleEditorBlock(selectedBlockId);
    if (!path) return;
    this.recipient = this.optionFor(path.dataset.blockId);
    this.disableScrollAnchoring();
    this.showResult(path, false);
    this.releaseScrollAnchoring();
  }

  optionFor(value) {
    return this.options.find((option) => option.value === value) || { value, label: value };
  }

  selectRecipient(choice) {
    if (choice.disabled) return;
    this.recipient = this.optionFor(choice.dataset.giftSpinelChoice);
    this.choices.querySelectorAll('[data-gift-spinel-choice]').forEach((button) => {
      const selected = button === choice;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = true;
    });

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = reduceMotion ? 0 : 120;
    this.transitionTimer = window.setTimeout(() => {
      if (reduceMotion) {
        this.disableScrollAnchoring();
        this.showResult();
        this.releaseScrollAnchoring();
        return;
      }

      this.transitionToResult();
    }, delay);
  }

  findMatchingPath() {
    return (
      this.paths.find((path) => path.dataset.blockId === this.recipient?.value)
      || this.paths.find((path) => path.dataset.recipient === this.recipient?.value)
      || this.placeholderPath
    );
  }

  replaceTokens(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes.reduce((changes, node) => {
      const value = node.nodeValue.replaceAll('{recipient}', this.recipient?.label || '');
      if (value !== node.nodeValue) {
        changes.push({ node, value: node.nodeValue });
        node.nodeValue = value;
      }
      return changes;
    }, []);
  }

  pathForVisibleEditorBlock(blockId) {
    if (!blockId || !this.result) return null;

    const selected = this.result.querySelector(`[data-shopify-editor-block="${CSS.escape(blockId)}"]`);
    const path = selected?.closest('.gift-spinel__path');
    if (path && this.paths.includes(path)) return path;

    const resultBlock = selected?.closest('[data-gift-spinel-result-block]');
    if (!resultBlock) return null;

    return this.paths.find((path) => path.dataset.blockId === resultBlock.dataset.giftSpinelResultBlock) || null;
  }

  restoreActiveResultSource() {
    if (!this.result || !this.paths?.length) return;

    const path = this.paths.find((item) => item.parentElement === this.result);
    if (!path) return;

    this.activeTokenChanges?.forEach(({ node, value }) => { node.nodeValue = value; });
    this.activeTokenChanges = undefined;
    path.querySelector('[data-gift-spinel-path]')?.setAttribute('hidden', '');
    path.classList.remove('is-active-path');

    if (this.activePathMarker?.parentNode) this.activePathMarker.replaceWith(path);
    else this.choices?.append(path);
    this.activePathMarker = undefined;
  }

  showResult(preferredPath, shouldFocus = true) {
    const path = preferredPath || this.findMatchingPath();
    if (!path || !this.result) {
      this.questions.hidden = false;
      this.result.hidden = true;
      if (this.status) this.status.textContent = '';
      return;
    }

    this.restoreActiveResultSource();

    const isGiftPath = path.matches('[data-gift-spinel-path-root]');
    let source;
    if (isGiftPath) {
      this.activePathMarker = document.createComment('gift-spinel-path-position');
      path.before(this.activePathMarker);
      this.result.replaceChildren(path);
      path.classList.add('is-active-path');
      this.finder?.classList.add('is-showing-path');
      path.querySelector('[data-gift-spinel-path]')?.removeAttribute('hidden');
      source = path.querySelector('[data-gift-spinel-result-block]');
    } else {
      source = path.content?.cloneNode(true);
    }
    if (!source) return;

    const content = source;
    this.activeTokenChanges = isGiftPath ? this.replaceTokens(content) : undefined;
    const chips = content.querySelector('[data-gift-spinel-chips]');
    if (chips && this.recipient) {
      chips.replaceChildren();
      const chip = document.createElement('span');
      chip.className = 'gift-spinel__chip';
      chip.textContent = this.recipient.label;
      chips.append(chip);
    }

    this.questions.hidden = true;
    if (!isGiftPath) this.result.replaceChildren(content);
    this.result.hidden = false;
    window.ThemeAnimations?.refresh(this.result);
    if (this.status) this.status.textContent = this.result.querySelector('.content-block--heading')?.textContent?.trim() || '';
    this.result.dispatchEvent(
      new CustomEvent('gift-spinel:products-loaded', {
        bubbles: true,
        detail: { panel: this.result },
      }),
    );
    if (shouldFocus) this.result.querySelector('.content-block--heading')?.focus({ preventScroll: true });
  }

  resetRecipientView(shouldFocus = true) {
    this.recipient = undefined;
    this.restoreActiveResultSource();
    this.finder?.classList.remove('is-showing-path');
    this.result.hidden = true;
    this.result.replaceChildren();
    if (this.status) this.status.textContent = '';
    this.questions.hidden = false;
    this.resetChoices();
    if (shouldFocus) this.question.focus({ preventScroll: true });
  }

  getFinderTargetHeight(panel) {
    const finderStyle = window.getComputedStyle(this.finder);
    const verticalPadding = Number.parseFloat(finderStyle.paddingTop) + Number.parseFloat(finderStyle.paddingBottom);
    const panelHeight = panel.getBoundingClientRect().height + verticalPadding;
    const introMinHeight = this.intro ? Number.parseFloat(window.getComputedStyle(this.intro).minHeight) || 0 : 0;
    return Math.ceil(Math.max(panelHeight, introMinHeight));
  }

  transitionToResult() {
    if (this.isPanelTransitioning) return;

    const path = this.findMatchingPath();
    if (!this.finder || this.questions.hidden || !path) {
      this.disableScrollAnchoring();
      this.showResult(path);
      this.releaseScrollAnchoring();
      return;
    }

    this.isPanelTransitioning = true;
    this.disableScrollAnchoring();
    const startHeight = this.finder.getBoundingClientRect().height;
    this.finder.style.height = `${startHeight}px`;
    this.finder.style.overflow = 'hidden';
    this.finder.style.willChange = 'height';

    const exitAnimation = this.questions.animate(
      [
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(-8px)' },
      ],
      {
        duration: 160,
        easing: 'cubic-bezier(.4, 0, 1, 1)',
        fill: 'forwards',
      },
    );
    this.panelAnimations = [exitAnimation];

    exitAnimation.finished.catch(() => null).then(() => {
      if (!this.isPanelTransitioning) return;

      this.showResult(path, false);
      const targetHeight = this.getFinderTargetHeight(this.result);
      const resizeAnimation = this.finder.animate(
        [
          { height: `${startHeight}px` },
          { height: `${targetHeight}px` },
        ],
        {
          duration: 320,
          easing: 'cubic-bezier(.22, 1, .36, 1)',
          fill: 'forwards',
        },
      );
      this.panelAnimations.push(resizeAnimation);

      resizeAnimation.finished.catch(() => null).then(() => {
        if (!this.isPanelTransitioning) return;

        this.finder.style.height = `${targetHeight}px`;
        this.panelAnimations.forEach((animation) => animation.cancel());
        this.panelAnimations = [];
        this.finder.style.removeProperty('overflow');
        this.finder.style.removeProperty('will-change');

        window.requestAnimationFrame(() => {
          if (!this.isPanelTransitioning) return;
          this.finder.style.removeProperty('height');
          this.isPanelTransitioning = false;
          this.result.querySelector('.content-block--heading')?.focus({ preventScroll: true });
          this.releaseScrollAnchoring();
        });
      });
    });
  }

  changeRecipient() {
    if (this.isPanelTransitioning) return;
    window.clearTimeout(this.transitionTimer);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !this.finder || this.result.hidden) {
      this.disableScrollAnchoring();
      this.resetRecipientView();
      this.releaseScrollAnchoring();
      return;
    }

    this.isPanelTransitioning = true;
    this.disableScrollAnchoring();
    const startHeight = this.finder.getBoundingClientRect().height;
    const outgoingPanel = this.result.firstElementChild || this.result;
    this.finder.style.height = `${startHeight}px`;
    this.finder.style.overflow = 'hidden';
    this.finder.style.willChange = 'height';

    const exitAnimation = outgoingPanel.animate(
      [
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(-8px)' },
      ],
      {
        duration: 160,
        easing: 'cubic-bezier(.4, 0, 1, 1)',
        fill: 'forwards',
      },
    );
    this.panelAnimations = [exitAnimation];

    exitAnimation.finished.catch(() => null).then(() => {
      if (!this.isPanelTransitioning) return;

      // This animation runs on the actual Gift path root (rather than a clone)
      // so its `fill: forwards` state must be cleared before that root returns
      // to the recipient choice grid. Otherwise the choice remains clickable
      // but inherits opacity: 0 after "Change recipient".
      exitAnimation.cancel();
      this.resetRecipientView(false);
      const targetHeight = this.getFinderTargetHeight(this.questions);

      const resizeAnimation = this.finder.animate(
        [
          { height: `${startHeight}px` },
          { height: `${targetHeight}px` },
        ],
        {
          duration: 320,
          easing: 'cubic-bezier(.22, 1, .36, 1)',
          fill: 'forwards',
        },
      );
      const enterAnimation = this.questions.animate(
        [
          { opacity: 0, transform: 'translateY(10px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        {
          duration: 280,
          delay: 50,
          easing: 'cubic-bezier(.22, 1, .36, 1)',
          fill: 'both',
        },
      );
      this.panelAnimations = [resizeAnimation, enterAnimation];

      Promise.allSettled([resizeAnimation.finished, enterAnimation.finished]).then(() => {
        if (!this.isPanelTransitioning) return;

        this.finder.style.height = `${targetHeight}px`;
        this.panelAnimations.forEach((animation) => animation.cancel());
        this.panelAnimations = [];
        this.finder.style.removeProperty('overflow');
        this.finder.style.removeProperty('will-change');

        window.requestAnimationFrame(() => {
          if (!this.isPanelTransitioning) return;
          this.finder.style.removeProperty('height');
          this.isPanelTransitioning = false;
          this.question.focus({ preventScroll: true });
          this.releaseScrollAnchoring();
        });
      });
    });
  }

  async addBundle(button) {
    if (button.disabled) return;

    let items;
    try {
      items = JSON.parse(button.dataset.giftSpinelBundleItems || '[]');
    } catch (_) {
      items = [];
    }
    if (!Array.isArray(items) || !items.length) return;

    const label = button.querySelector('[data-gift-spinel-bundle-label]');
    const initialLabel = button.dataset.giftSpinelBundleLabel || label?.textContent || '';
    const addingLabel = button.dataset.giftSpinelBundleAddingLabel || initialLabel;
    const addedLabel = button.dataset.giftSpinelBundleAddedLabel || initialLabel;
    const errorLabel = button.dataset.giftSpinelBundleErrorLabel || 'Unable to add this gift edit.';
    const bundleName = button.dataset.giftSpinelBundleName || 'Gift finder edit';

    button.disabled = true;
    button.classList.add('is-loading');
    button.setAttribute('aria-busy', 'true');
    if (label) label.textContent = addingLabel;
    if (this.status) this.status.textContent = addingLabel;

    const recipient = this.recipient?.label || '';
    const cartItems = items.map((item) => ({
      id: item.id,
      quantity: Number(item.quantity) || 1,
      properties: {
        _bundle: bundleName,
        _gift_recipient: recipient,
      },
    }));

    try {
      const response = await fetch(window.routes?.cart_add_url || '/cart/add.js', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ items: cartItems }),
      });
      const item = await response.json();
      if (!response.ok) throw new Error(item.description || item.message || errorLabel);

      let cart = null;
      try {
        const cartResponse = await fetch('/cart.js', { headers: { Accept: 'application/json' } });
        if (cartResponse.ok) cart = await cartResponse.json();
      } catch (_) {
        // Cart drawer refreshes independently when the add succeeds.
      }

      if (label) label.textContent = addedLabel;
      button.classList.add('is-added');
      if (this.status) this.status.textContent = addedLabel;
      document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true, detail: { item, cart } }));
      document.dispatchEvent(new CustomEvent('cart:add:success', { bubbles: true, detail: { item, cart, button } }));

      window.setTimeout(() => {
        if (!button.isConnected) return;
        button.classList.remove('is-added');
        button.disabled = false;
        button.removeAttribute('aria-busy');
        if (label) label.textContent = initialLabel;
        if (this.status) this.status.textContent = '';
      }, 1600);
    } catch (error) {
      console.error('[Spinel] Gift bundle add failed', error);
      if (label) label.textContent = initialLabel;
      if (this.status) this.status.textContent = error.message || errorLabel;
      button.disabled = false;
      button.removeAttribute('aria-busy');
    } finally {
      button.classList.remove('is-loading');
    }
  }
}

if (!customElements.get('gift-spinel')) customElements.define('gift-spinel', GiftSpinel);
