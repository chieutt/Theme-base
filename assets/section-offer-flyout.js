if (!customElements.get('offer-flyout')) {
  class OfferFlyout extends HTMLElement {
    connectedCallback() {
      this.dialog = this.querySelector('[data-offer-flyout-dialog]');
      this.panel = this.querySelector('.offer-flyout__panel');
      this.tab = this.querySelector('.offer-flyout__tab');
      this.openButton = this.querySelector('[data-offer-flyout-open]');
      this.dismissButton = this.querySelector('[data-offer-flyout-dismiss]');
      this.closeButton = this.querySelector('[data-offer-flyout-close]');
      this.successMessage = this.querySelector('[data-offer-flyout-form-success]');
      this.form = this.querySelector('.offer-flyout__form');
      this.tagsInput = this.querySelector('[data-offer-flyout-tags]');
      this.preferenceInputs = this.querySelectorAll('[data-offer-flyout-preference]');
      this.backdropPointer = this.dialog?.querySelector('.quick-view-modal__backdrop-pointer');
      this.handle = this.querySelector('[data-offer-flyout-handle]');
      this.closeTimer = null;
      this.handleDrag = null;
      this.handleDragTimer = null;
      this.showTimer = null;
      this.returnFocus = null;
      this.tabDismissed = false;
      this.tabUnlocked = false;
      this.rememberOnClose = false;
      this.mobileModal = window.matchMedia('(max-width: 767.98px)');
      this.storageKey = `offer-flyout:${this.dataset.sectionId}`;

      if (!this.dialog || !this.tab || !this.openButton) return;

      this.backdropInteraction = new window.SpinelModalBackdropPointer({
        root: this.dialog,
        panel: this.panel,
        pointer: this.backdropPointer,
        isOpen: () => this.dialog.open,
        cursorClass: 'quick-view-backdrop-cursor',
        pointerX: '--quick-view-pointer-x',
        pointerY: '--quick-view-pointer-y',
        relativeToRoot: true,
        isDisabled: () => this.mobileModal.matches,
      });

      this.onOpenClick = () => this.open(this.openButton, true);
      this.onDismissClick = () => {
        this.tabDismissed = true;
        this.setTabVisible(false);
      };
      this.onCloseClick = () => this.close();
      this.onDialogClick = (event) => {
        if (event.target === this.dialog) this.close();
      };
      this.onDialogCancel = (event) => {
        event.preventDefault();
        this.close();
      };
      this.onDialogClose = () => {
        window.clearTimeout(this.closeTimer);
        this.resetHandleDrag();
        this.dialog.classList.remove('is-closing');
        this.backdropInteraction?.hide();
        if (this.rememberOnClose) this.rememberDisplay();
        this.rememberOnClose = false;
        this.tabUnlocked = true;
        this.syncTabVisibility();
        this.returnFocus?.focus({ preventScroll: true });
        this.returnFocus = null;
      };
      this.onSectionSelect = (event) => {
        if (event.detail?.sectionId === this.dataset.sectionId) this.open(null, false);
      };
      this.onBlockSelect = (event) => {
        if (event.target?.closest('offer-flyout') === this) this.open(null, false);
      };
      this.onFormSubmit = () => {
        if (!this.tagsInput) return;
        const selectedTags = Array.from(this.preferenceInputs)
          .filter((input) => input.checked && input.value.trim())
          .map((input) => input.value.trim());
        this.tagsInput.value = Array.from(new Set(['newsletter', ...selectedTags])).join(', ');
      };
      this.onHandlePointerDown = (event) => this.startHandleDrag(event);
      this.onHandlePointerMove = (event) => this.moveHandleDrag(event);
      this.onHandlePointerUp = (event) => this.endHandleDrag(event);
      this.onHandlePointerCancel = (event) => this.endHandleDrag(event, true);
      this.onHandleTouchStart = (event) => this.startTouchHandleDrag(event);
      this.onHandleTouchMove = (event) => this.moveTouchHandleDrag(event);
      this.onHandleTouchEnd = (event) => this.endTouchHandleDrag(event);
      this.onHandleTouchCancel = (event) => this.endTouchHandleDrag(event, true);

      this.openButton.addEventListener('click', this.onOpenClick);
      this.dismissButton?.addEventListener('click', this.onDismissClick);
      this.closeButton?.addEventListener('click', this.onCloseClick);
      this.dialog.addEventListener('click', this.onDialogClick);
      this.dialog.addEventListener('cancel', this.onDialogCancel);
      this.dialog.addEventListener('close', this.onDialogClose);
      document.addEventListener('shopify:section:select', this.onSectionSelect);
      document.addEventListener('shopify:block:select', this.onBlockSelect);
      this.form?.addEventListener('submit', this.onFormSubmit);
      if ('PointerEvent' in window) {
        this.handle?.addEventListener('pointerdown', this.onHandlePointerDown);
        this.dialog.addEventListener('pointermove', this.onHandlePointerMove);
        this.dialog.addEventListener('pointerup', this.onHandlePointerUp);
        this.dialog.addEventListener('pointercancel', this.onHandlePointerCancel);
      } else {
        this.handle?.addEventListener('touchstart', this.onHandleTouchStart, { passive: false });
        this.dialog.addEventListener('touchmove', this.onHandleTouchMove, { passive: false });
        this.dialog.addEventListener('touchend', this.onHandleTouchEnd);
        this.dialog.addEventListener('touchcancel', this.onHandleTouchCancel);
      }

      this.setTabVisible(false);
      if (this.successMessage) {
        this.open(null, true);
      } else if (window.Shopify?.designMode) {
        this.tabUnlocked = true;
        this.syncTabVisibility();
      } else if (this.isEligible()) {
        const configuredShowDelay = Number(this.dataset.showDelay);
        const showDelay = Math.max(0, Number.isFinite(configuredShowDelay) ? configuredShowDelay : 10000);
        this.showTimer = window.setTimeout(() => this.open(null, true), showDelay);
      } else {
        this.tabUnlocked = true;
        this.syncTabVisibility();
      }
    }

    disconnectedCallback() {
      this.openButton?.removeEventListener('click', this.onOpenClick);
      this.dismissButton?.removeEventListener('click', this.onDismissClick);
      this.closeButton?.removeEventListener('click', this.onCloseClick);
      this.dialog?.removeEventListener('click', this.onDialogClick);
      this.dialog?.removeEventListener('cancel', this.onDialogCancel);
      this.dialog?.removeEventListener('close', this.onDialogClose);
      this.backdropInteraction?.destroy();
      document.removeEventListener('shopify:section:select', this.onSectionSelect);
      document.removeEventListener('shopify:block:select', this.onBlockSelect);
      this.form?.removeEventListener('submit', this.onFormSubmit);
      this.handle?.removeEventListener('pointerdown', this.onHandlePointerDown);
      this.dialog?.removeEventListener('pointermove', this.onHandlePointerMove);
      this.dialog?.removeEventListener('pointerup', this.onHandlePointerUp);
      this.dialog?.removeEventListener('pointercancel', this.onHandlePointerCancel);
      this.handle?.removeEventListener('touchstart', this.onHandleTouchStart);
      this.dialog?.removeEventListener('touchmove', this.onHandleTouchMove);
      this.dialog?.removeEventListener('touchend', this.onHandleTouchEnd);
      this.dialog?.removeEventListener('touchcancel', this.onHandleTouchCancel);
      window.clearTimeout(this.closeTimer);
      window.clearTimeout(this.showTimer);
      this.resetHandleDrag();
      this.backdropInteraction?.hide();
    }

    startTouchHandleDrag(event) {
      const touch = event.changedTouches[0];
      if (!touch) return;
      this.startHandleDrag({
        target: event.target,
        isPrimary: true,
        button: 0,
        pointerId: touch.identifier,
        clientY: touch.clientY,
        preventDefault: () => event.preventDefault(),
      });
    }

    moveTouchHandleDrag(event) {
      const drag = this.handleDrag;
      if (!drag) return;
      const touch = Array.from(event.changedTouches).find(
        (candidate) => candidate.identifier === drag.pointerId,
      );
      if (!touch) return;
      this.moveHandleDrag({
        pointerId: touch.identifier,
        clientY: touch.clientY,
        preventDefault: () => event.preventDefault(),
      });
    }

    endTouchHandleDrag(event, cancelled = false) {
      const drag = this.handleDrag;
      if (!drag) return;
      const touch = Array.from(event.changedTouches).find(
        (candidate) => candidate.identifier === drag.pointerId,
      );
      if (!touch) return;
      this.endHandleDrag({ pointerId: touch.identifier }, cancelled);
    }

    startHandleDrag(event) {
      if (
        !this.mobileModal.matches ||
        !event.isPrimary ||
        event.button > 0 ||
        this.dialog.classList.contains('is-closing')
      ) {
        return;
      }

      window.clearTimeout(this.handleDragTimer);
      this.handleDrag = {
        pointerId: event.pointerId,
        handle: this.handle,
        startY: event.clientY,
        lastY: event.clientY,
        lastTime: performance.now(),
        velocity: 0,
        distance: 0,
      };
      this.dialog.classList.remove('is-handle-settling', 'is-handle-closing');
      this.dialog.style.transform = 'translate3d(0, 0, 0)';
      this.dialog.style.opacity = '1';
      this.dialog.classList.add('is-handle-dragging');
      this.dialog.style.removeProperty('transition');
      this.dialog.style.removeProperty('opacity');
      try {
        this.handle.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is an enhancement; dragging still works without it.
      }
      event.preventDefault();
    }

    moveHandleDrag(event) {
      const drag = this.handleDrag;
      if (!drag || event.pointerId !== drag.pointerId) return;

      const now = performance.now();
      const elapsed = Math.max(now - drag.lastTime, 1);
      drag.velocity = (event.clientY - drag.lastY) / elapsed;
      drag.lastY = event.clientY;
      drag.lastTime = now;
      drag.distance = Math.max(0, event.clientY - drag.startY);
      this.dialog.style.transform = `translate3d(0, ${drag.distance}px, 0)`;
      event.preventDefault();
    }

    endHandleDrag(event, cancelled = false) {
      const drag = this.handleDrag;
      if (!drag || event.pointerId !== drag.pointerId) return;

      try {
        drag.handle.releasePointerCapture(event.pointerId);
      } catch {
        // The pointer can already be released when the gesture is cancelled.
      }
      const closeDistance = Math.min(140, this.dialog.getBoundingClientRect().height * 0.2);
      const shouldClose =
        !cancelled &&
        (drag.distance >= closeDistance || (drag.distance >= 32 && drag.velocity > 0.55));
      this.handleDrag = null;
      this.dialog.classList.remove('is-handle-dragging');

      if (shouldClose) {
        this.dialog.classList.add('is-closing', 'is-handle-closing');
        this.dialog.style.opacity = '1';
        window.requestAnimationFrame(() => {
          const closeOffset = Math.max(window.innerHeight, this.dialog.offsetHeight + 60);
          this.dialog.style.transform = `translate3d(0, ${closeOffset}px, 0)`;
          this.dialog.style.opacity = '0';
        });
        window.clearTimeout(this.closeTimer);
        this.closeTimer = window.setTimeout(() => this.finishClose(), 240);
        return;
      }

      this.dialog.classList.add('is-handle-settling');
      window.requestAnimationFrame(() => {
        this.dialog.style.transform = 'translate3d(0, 0, 0)';
        this.dialog.style.opacity = '1';
      });
    }

    resetHandleDrag() {
      window.clearTimeout(this.handleDragTimer);
      this.handleDragTimer = null;
      if (this.handleDrag) {
        try {
          this.handleDrag.handle.releasePointerCapture(this.handleDrag.pointerId);
        } catch {
          // The pointer can already be released when the dialog closes.
        }
      }
      this.handleDrag = null;
      this.dialog?.classList.remove(
        'is-handle-dragging',
        'is-handle-settling',
        'is-handle-closing',
      );
      this.dialog?.style.removeProperty('transform');
      this.dialog?.style.removeProperty('opacity');
      this.dialog?.style.removeProperty('transition');
    }

    syncTabVisibility() {
      if (this.dialog.open) {
        this.setTabVisible(false);
        return;
      }

      this.setTabVisible(this.tabUnlocked && !this.tabDismissed);
    }

    open(trigger, rememberOnClose) {
      if (this.dialog.open) return;
      this.returnFocus = trigger || document.activeElement;
      this.rememberOnClose = rememberOnClose;
      window.clearTimeout(this.closeTimer);
      this.resetHandleDrag();
      this.dialog.classList.remove('is-closing');
      this.setTabVisible(false);
      this.dialog.showModal();
      (this.successMessage || this.closeButton)?.focus({ preventScroll: true });
    }

    close() {
      if (!this.dialog.open || this.dialog.classList.contains('is-closing')) return;
      this.resetHandleDrag();
      this.dialog.classList.add('is-closing');

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.finishClose();
        return;
      }

      const closeDuration = this.mobileModal.matches ? 280 : 260;
      this.closeTimer = window.setTimeout(() => this.finishClose(), closeDuration);
    }

    finishClose() {
      if (this.dialog.open) this.dialog.close();
    }

    isEligible() {
      const frequency = this.dataset.frequency || '1_day';
      if (frequency === 'always') return true;

      try {
        const storedAt = Number(window.localStorage.getItem(this.storageKey));
        if (!storedAt) return true;
        if (frequency === 'once') return false;

        const durations = {
          '6_hours': 6 * 60 * 60 * 1000,
          '1_day': 24 * 60 * 60 * 1000,
          '3_days': 3 * 24 * 60 * 60 * 1000,
          '1_week': 7 * 24 * 60 * 60 * 1000,
        };
        return Date.now() - storedAt >= (durations[frequency] || durations['1_day']);
      } catch (error) {
        return true;
      }
    }

    rememberDisplay() {
      if (this.dataset.frequency === 'always') return;
      try {
        window.localStorage.setItem(this.storageKey, String(Date.now()));
      } catch (error) {
        return;
      }
    }

    setTabVisible(visible) {
      this.tab.classList.toggle('is-visible', visible);
      this.tab.setAttribute('aria-hidden', String(!visible));
    }

  }

  customElements.define('offer-flyout', OfferFlyout);
}
