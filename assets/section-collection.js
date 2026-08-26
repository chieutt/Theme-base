if (!customElements.get('collection-sort-select')) {
  class CollectionSortSelect extends HTMLElement {
    connectedCallback() {
      this.select = this.querySelector('[data-collection-sort-native]');
      this.trigger = this.querySelector('[data-collection-sort-trigger]');
      this.value = this.querySelector('[data-collection-sort-value]');
      this.listbox = this.querySelector('[data-collection-sort-listbox]');
      this.options = Array.from(this.querySelectorAll('[data-collection-sort-option]'));
      if (!this.select || !this.trigger || !this.value || !this.listbox || !this.options.length) return;

      this.onTriggerClick = () => this.toggle();
      this.onTriggerKeydown = (event) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        this.open();
        const selectedIndex = this.options.findIndex((option) => option.getAttribute('aria-selected') === 'true');
        const targetIndex = event.key === 'ArrowUp' || event.key === 'End'
          ? this.options.length - 1
          : event.key === 'Home'
            ? 0
            : Math.max(selectedIndex, 0);
        this.options[targetIndex]?.focus();
      };
      this.onListboxClick = (event) => {
        const option = event.target.closest('[data-collection-sort-option]');
        if (option) this.choose(option);
      };
      this.onListboxKeydown = (event) => {
        const currentIndex = this.options.indexOf(document.activeElement);
        if (event.key === 'Escape') {
          event.preventDefault();
          this.close(true);
          return;
        }
        if (event.key === 'Tab') {
          this.close();
          return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;

        event.preventDefault();
        let nextIndex = currentIndex;
        if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % this.options.length;
        if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + this.options.length) % this.options.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = this.options.length - 1;
        this.options[nextIndex]?.focus();
      };
      this.onDocumentClick = (event) => {
        if (!this.contains(event.target)) this.close();
      };
      this.onSelectChange = () => this.sync();

      this.trigger.addEventListener('click', this.onTriggerClick);
      this.trigger.addEventListener('keydown', this.onTriggerKeydown);
      this.listbox.addEventListener('click', this.onListboxClick);
      this.listbox.addEventListener('keydown', this.onListboxKeydown);
      this.select.addEventListener('change', this.onSelectChange);
      document.addEventListener('click', this.onDocumentClick);
      this.sync();
    }

    disconnectedCallback() {
      this.trigger?.removeEventListener('click', this.onTriggerClick);
      this.trigger?.removeEventListener('keydown', this.onTriggerKeydown);
      this.listbox?.removeEventListener('click', this.onListboxClick);
      this.listbox?.removeEventListener('keydown', this.onListboxKeydown);
      this.select?.removeEventListener('change', this.onSelectChange);
      document.removeEventListener('click', this.onDocumentClick);
    }

    toggle() {
      if (this.listbox.hidden) {
        this.open();
      } else {
        this.close();
      }
    }

    open() {
      this.listbox.hidden = false;
      this.trigger.setAttribute('aria-expanded', 'true');
    }

    close(returnFocus = false) {
      this.listbox.hidden = true;
      this.trigger.setAttribute('aria-expanded', 'false');
      if (returnFocus) this.trigger.focus();
    }

    choose(option) {
      this.select.value = option.dataset.value;
      this.sync();
      this.close(true);
      this.select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    sync() {
      const selectedOption = this.options.find((option) => option.dataset.value === this.select.value);
      if (!selectedOption) return;
      this.value.textContent = selectedOption.querySelector('span')?.textContent.trim() || '';
      this.trigger.title = this.value.textContent;
      this.options.forEach((option) => {
        option.setAttribute('aria-selected', String(option === selectedOption));
      });
    }
  }

  customElements.define('collection-sort-select', CollectionSortSelect);
}

if (!customElements.get('collection-price-range')) {
  class CollectionPriceRange extends HTMLElement {
    connectedCallback() {
      this.slider = this.querySelector('[data-price-range-slider]');
      this.minRange = this.querySelector('[data-price-range-min]');
      this.maxRange = this.querySelector('[data-price-range-max]');
      this.minNumber = this.querySelector('[data-price-number-min]');
      this.maxNumber = this.querySelector('[data-price-number-max]');
      if (!this.slider || !this.minRange || !this.maxRange || !this.minNumber || !this.maxNumber) return;

      this.onInput = (event) => {
        if (event.target === this.minRange || event.target === this.maxRange) {
          this.syncNumbersFromRanges(event.target);
          return;
        }

        if (event.target === this.minNumber || event.target === this.maxNumber) {
          this.syncRangesFromNumbers(event.target);
        }
      };

      this.addEventListener('input', this.onInput);
      this.syncRangesFromNumbers();
    }

    disconnectedCallback() {
      this.removeEventListener('input', this.onInput);
    }

    limits() {
      return {
        lower: Number(this.minRange.min) || 0,
        upper: Number(this.maxRange.max) || 0
      };
    }

    syncNumbersFromRanges(changedRange) {
      const { lower, upper } = this.limits();
      let minValue = Number(this.minRange.value);
      let maxValue = Number(this.maxRange.value);

      if (minValue > maxValue) {
        if (changedRange === this.minRange) {
          minValue = maxValue;
          this.minRange.value = String(minValue);
        } else {
          maxValue = minValue;
          this.maxRange.value = String(maxValue);
        }
      }

      this.minNumber.value = minValue <= lower ? '' : String(minValue);
      this.maxNumber.value = maxValue >= upper ? '' : String(maxValue);
      this.updateTrack(minValue, maxValue);
    }

    syncRangesFromNumbers(changedNumber) {
      const { lower, upper } = this.limits();
      let minValue = this.minNumber.value === '' ? lower : Number(this.minNumber.value);
      let maxValue = this.maxNumber.value === '' ? upper : Number(this.maxNumber.value);

      minValue = Math.min(Math.max(minValue, lower), upper);
      maxValue = Math.min(Math.max(maxValue, lower), upper);

      if (minValue > maxValue) {
        if (changedNumber === this.minNumber) {
          minValue = maxValue;
          this.minNumber.value = String(minValue);
        } else {
          maxValue = minValue;
          this.maxNumber.value = String(maxValue);
        }
      }

      this.minRange.value = String(minValue);
      this.maxRange.value = String(maxValue);
      this.updateTrack(minValue, maxValue);
    }

    updateTrack(minValue, maxValue) {
      const { lower, upper } = this.limits();
      const range = upper - lower || 1;
      const minPosition = ((minValue - lower) / range) * 100;
      const maxPosition = ((maxValue - lower) / range) * 100;
      this.slider.style.setProperty('--main-collection-price-min', `${minPosition}%`);
      this.slider.style.setProperty('--main-collection-price-max', `${maxPosition}%`);
    }
  }

  customElements.define('collection-price-range', CollectionPriceRange);
}

if (!customElements.get('collection-description')) {
  class CollectionDescription extends HTMLElement {
    connectedCallback() {
      this.content = this.querySelector('[data-collection-description]');
      this.toggle = this.querySelector('[data-collection-description-toggle]');
      if (!this.content || !this.toggle) return;

      this.classList.add('is-enhanced');
      this.syncOverflow = () => {
        this.content.classList.add('main-collection__description--collapsed');
        const isOverflowing = this.content.scrollHeight > this.content.clientHeight + 1;
        this.toggle.hidden = !isOverflowing;
        if (!isOverflowing) this.content.classList.remove('main-collection__description--collapsed');
      };

      this.onToggle = () => {
        const isExpanded = this.toggle.getAttribute('aria-expanded') === 'true';
        this.toggle.setAttribute('aria-expanded', String(!isExpanded));
        this.content.classList.toggle('main-collection__description--collapsed', isExpanded);
        this.toggle.textContent = isExpanded ? this.toggle.dataset.moreLabel : this.toggle.dataset.lessLabel;
      };
      this.onResize = () => {
        window.clearTimeout(this.resizeTimer);
        this.resizeTimer = window.setTimeout(this.syncOverflow, 100);
      };
      this.toggle.addEventListener('click', this.onToggle);
      window.addEventListener('resize', this.onResize);
      this.syncOverflow();
    }

    disconnectedCallback() {
      if (this.toggle && this.onToggle) this.toggle.removeEventListener('click', this.onToggle);
      if (this.onResize) window.removeEventListener('resize', this.onResize);
      window.clearTimeout(this.resizeTimer);
    }
  }

  customElements.define('collection-description', CollectionDescription);
}

if (!customElements.get('collection-facets')) {
  class CollectionFacets extends HTMLElement {
    connectedCallback() {
      this.classList.add('is-enhanced');
      this.sectionId = this.dataset.sectionId;
      this.dialog = this.querySelector('[data-collection-filter-dialog]');
      this.filterPanel = this.dialog?.querySelector('.main-collection__filter-form');
      this.backdropPointer = this.dialog?.querySelector('.main-collection__filter-backdrop-pointer');
      this.mobileDialog = window.matchMedia('(max-width: 767.98px)');
      this.backdropInteraction = this.dialog && window.SpinelModalBackdropPointer
        ? new window.SpinelModalBackdropPointer({
          root: this.dialog,
          panel: this.filterPanel,
          pointer: this.backdropPointer,
          isOpen: () => this.dialog.open && !this.dialog.classList.contains('is-closing'),
          relativeToRoot: true,
        })
        : null;
      this.onDialogCancel = (event) => {
        event.preventDefault();
        this.closeDialog();
      };
      this.onDialogClose = () => this.hideBackdropPointer();

      this.resetHandleDrag = () => {
        window.clearTimeout(this.handleDragTimer);
        this.handleDragTimer = null;
        if (this.handleDrag) {
          try { this.handleDrag.handle.releasePointerCapture(this.handleDrag.pointerId); } catch (_) {}
        }
        this.handleDrag = null;
        this.dialog?.classList.remove('is-handle-dragging', 'is-handle-settling', 'is-handle-closing');
        this.dialog?.style.removeProperty('transform');
        this.dialog?.style.removeProperty('opacity');
        this.dialog?.style.removeProperty('transition');
      };
      this.onHandlePointerDown = (event) => {
        const handle = event.target.closest('[data-collection-filter-handle]');
        if (!handle || !this.dialog?.open || !this.mobileDialog.matches || !event.isPrimary || event.button > 0 || this.dialog.classList.contains('is-closing')) return;
        event.preventDefault();
        this.handleDrag = { handle, pointerId: event.pointerId, startY: event.clientY, lastY: event.clientY, lastTime: performance.now(), velocity: 0, distance: 0 };
        this.dialog.style.transform = 'translate3d(0, 0, 0)';
        this.dialog.style.opacity = '1';
        this.dialog.classList.add('is-handle-dragging');
        handle.setPointerCapture?.(event.pointerId);
      };
      this.onHandlePointerMove = (event) => {
        const drag = this.handleDrag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.preventDefault();
        const distance = Math.max(0, event.clientY - drag.startY);
        const now = performance.now();
        drag.velocity = Math.max(0, (event.clientY - drag.lastY) / Math.max(1, now - drag.lastTime));
        drag.lastY = event.clientY;
        drag.lastTime = now;
        drag.distance = distance;
        this.dialog.style.transform = `translate3d(0, ${distance}px, 0)`;
        this.dialog.style.opacity = String(Math.max(.35, 1 - distance / Math.max(1, this.dialog.offsetHeight)));
      };
      this.onHandlePointerUp = (event) => {
        const drag = this.handleDrag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        const shouldClose = drag.distance > Math.max(96, this.dialog.offsetHeight * .18) || drag.velocity > .75;
        try { drag.handle.releasePointerCapture(event.pointerId); } catch (_) {}
        this.handleDrag = null;
        this.dialog.classList.remove('is-handle-dragging');
        if (shouldClose) {
          this.dialog.classList.add('is-handle-closing');
          this.dialog.style.transform = `translate3d(0, ${Math.max(window.innerHeight, this.dialog.offsetHeight + 60)}px, 0)`;
          this.dialog.style.opacity = '0';
          this.handleDragTimer = window.setTimeout(() => this.finishCloseDialog(), 240);
          return;
        }
        this.dialog.classList.add('is-handle-settling');
        this.dialog.style.transform = 'translate3d(0, 0, 0)';
        this.dialog.style.opacity = '1';
      };

      this.onClick = (event) => {
        if (event.target.closest('[data-collection-filter-open]')) {
          if (this.dialog && !this.dialog.open) this.dialog.showModal();
          return;
        }

        if (event.target.closest('[data-collection-filter-close]')) {
          this.closeDialog();
          return;
        }

        if (event.target === this.dialog) {
          this.closeDialog();
          return;
        }

        const link = event.target.closest(
          '.main-collection__active-filters a, .main-collection__filter-footer a, .main-collection__pagination a, .main-collection__empty a'
        );
        if (!link) return;

        event.preventDefault();
        this.render(link.href, {
          reopenDialog: Boolean(link.closest('[data-collection-filter-dialog]'))
        });
      };

      this.onChange = (event) => {
        const control = event.target;
        if (control.matches('[data-collection-sort]')) {
          this.renderFromForm(control.form);
          return;
        }

        if (!control.closest('[data-collection-filter-dialog]')) return;
        if (control.matches('input[type="number"]')) {
          window.clearTimeout(this.priceTimer);
        }
        this.renderFromForm(control.form, { reopenDialog: true, focusControl: control });
      };

      this.onInput = (event) => {
        const control = event.target;
        if (!control.matches('.main-collection__price-filter input')) return;

        window.clearTimeout(this.priceTimer);
        this.priceTimer = window.setTimeout(() => {
          this.renderFromForm(control.form, { reopenDialog: true, focusControl: control });
        }, 450);
      };

      this.onSubmit = (event) => {
        if (!event.target.matches('.main-collection__filter-form, [data-collection-sort-form]')) return;
        event.preventDefault();
        this.renderFromForm(event.target, {
          closeDialog: event.target.matches('.main-collection__filter-form')
        });
      };

      this.onPopState = () => this.render(window.location.href, { updateHistory: false });
      this.onSectionUnload = (event) => {
        if (event.target.contains(this)) this.finishCloseDialog();
      };

      this.addEventListener('click', this.onClick);
      this.addEventListener('change', this.onChange);
      this.addEventListener('input', this.onInput);
      this.addEventListener('submit', this.onSubmit);
      this.dialog?.addEventListener('cancel', this.onDialogCancel);
      this.dialog?.addEventListener('close', this.onDialogClose);
      this.dialog?.addEventListener('pointerdown', this.onHandlePointerDown);
      this.dialog?.addEventListener('pointermove', this.onHandlePointerMove);
      this.dialog?.addEventListener('pointerup', this.onHandlePointerUp);
      this.dialog?.addEventListener('pointercancel', this.onHandlePointerUp);
      window.addEventListener('popstate', this.onPopState);
      document.addEventListener('shopify:section:unload', this.onSectionUnload);
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.onClick);
      this.removeEventListener('change', this.onChange);
      this.removeEventListener('input', this.onInput);
      this.removeEventListener('submit', this.onSubmit);
      this.dialog?.removeEventListener('cancel', this.onDialogCancel);
      this.dialog?.removeEventListener('close', this.onDialogClose);
      this.dialog?.removeEventListener('pointerdown', this.onHandlePointerDown);
      this.dialog?.removeEventListener('pointermove', this.onHandlePointerMove);
      this.dialog?.removeEventListener('pointerup', this.onHandlePointerUp);
      this.dialog?.removeEventListener('pointercancel', this.onHandlePointerUp);
      window.removeEventListener('popstate', this.onPopState);
      document.removeEventListener('shopify:section:unload', this.onSectionUnload);
      window.clearTimeout(this.priceTimer);
      this.resetHandleDrag?.();
      this.backdropInteraction?.destroy();
      this.hideBackdropPointer();
      this.finishCloseDialog();
      this.requestController?.abort();
    }

    hideBackdropPointer() {
      this.backdropInteraction?.hide();
    }

    updateFilterGroups(nextDialog) {
      const currentGroups = Array.from(this.dialog.querySelectorAll('.main-collection__filter-group'));
      const nextGroups = Array.from(nextDialog.querySelectorAll('.main-collection__filter-group'));

      currentGroups.forEach((currentGroup, index) => {
        const nextGroup = nextGroups[index];
        if (!nextGroup) return;

        const currentSummary = currentGroup.firstElementChild;
        Array.from(currentGroup.children).forEach((child) => {
          if (child !== currentSummary) child.remove();
        });
        Array.from(nextGroup.children).forEach((child) => {
          if (child !== nextGroup.firstElementChild) currentGroup.append(child.cloneNode(true));
        });
      });
    }

    closeDialog() {
      if (!this.dialog?.open) return Promise.resolve();
      if (this.closePromise) return this.closePromise;
      this.resetHandleDrag?.();
      this.hideBackdropPointer();

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.dialog.close();
        return Promise.resolve();
      }

      this.dialog.classList.add('is-closing');
      this.closePromise = new Promise((resolve) => {
        this.resolveClose = resolve;
        this.closeTimer = window.setTimeout(() => this.finishCloseDialog(), 240);
      });
      return this.closePromise;
    }

    finishCloseDialog() {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
      if (this.dialog?.open) this.dialog.close();
      this.dialog?.classList.remove('is-closing');
      this.resetHandleDrag?.();
      this.hideBackdropPointer();
      const resolve = this.resolveClose;
      this.resolveClose = null;
      this.closePromise = null;
      resolve?.();
    }

    renderFromForm(form, options = {}) {
      if (!form) return;

      const url = new URL(form.action, window.location.origin);
      const formData = new FormData(form);
      for (const [name, value] of formData.entries()) {
        if (String(value).trim() !== '') url.searchParams.append(name, value);
      }
      url.searchParams.delete('page');

      const focusControl = options.focusControl;
      this.render(url, {
        ...options,
        focusName: focusControl?.name,
        focusValue: focusControl?.value
      });
    }

    async render(urlValue, options = {}) {
      const navigationUrl = new URL(urlValue, window.location.origin);
      navigationUrl.searchParams.delete('section_id');
      const requestUrl = new URL(navigationUrl);
      requestUrl.searchParams.set('section_id', this.sectionId);

      const body = this.querySelector('.main-collection__filter-body');
      const dialogScrollTop = body?.scrollTop || 0;
      const keepDialogOpen = options.reopenDialog && this.dialog?.open;
      const closePromise = options.closeDialog ? this.closeDialog() : Promise.resolve();

      this.requestController?.abort();
      this.requestController = new AbortController();
      this.setAttribute('aria-busy', 'true');

      try {
        const response = await fetch(requestUrl, {
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          signal: this.requestController.signal
        });
        if (!response.ok) throw new Error(`Collection request failed: ${response.status}`);

        const documentHtml = new DOMParser().parseFromString(await response.text(), 'text/html');
        const nextFacets = documentHtml.querySelector(`collection-facets[data-section-id="${this.sectionId}"]`);
        if (!nextFacets) throw new Error('Collection response did not contain facets');

        if (options.updateHistory !== false && navigationUrl.href !== window.location.href) {
          window.history.pushState({}, '', navigationUrl);
        }

        await closePromise;

        if (keepDialogOpen) {
          const nextDialog = nextFacets.querySelector('[data-collection-filter-dialog]');
          const currentToolbar = this.querySelector('.main-collection__toolbar');
          const nextToolbar = nextFacets.querySelector('.main-collection__toolbar');
          const currentProducts = this.querySelector('.main-collection__products');
          const nextProducts = nextFacets.querySelector('.main-collection__products');
          if (!nextDialog || !currentToolbar || !nextToolbar || !currentProducts || !nextProducts) {
            throw new Error('Collection response was missing dynamic content');
          }

          currentToolbar.replaceWith(nextToolbar);
          currentProducts.replaceWith(nextProducts);
          window.ThemeAnimations?.init(nextProducts);
          const currentHeader = this.dialog.querySelector('.main-collection__filter-header');
          const nextHeader = nextDialog.querySelector('.main-collection__filter-header');
          const currentActiveFilters = this.dialog.querySelector('.main-collection__active-filters');
          const nextActiveFilters = nextDialog.querySelector('.main-collection__active-filters');
          const currentFooter = this.dialog.querySelector('.main-collection__filter-footer');
          const nextFooter = nextDialog.querySelector('.main-collection__filter-footer');

          if (currentHeader && nextHeader) currentHeader.replaceWith(nextHeader);
          if (currentActiveFilters && nextActiveFilters) {
            currentActiveFilters.replaceWith(nextActiveFilters);
          } else if (currentActiveFilters) {
            currentActiveFilters.remove();
          } else if (nextActiveFilters) {
            this.dialog.querySelector('.main-collection__filter-body')?.prepend(nextActiveFilters);
          }
          if (currentFooter && nextFooter) currentFooter.replaceWith(nextFooter);
          this.updateFilterGroups(nextDialog);
          this.filterPanel = this.dialog.querySelector('.main-collection__filter-form');
          this.backdropPointer = this.dialog.querySelector('.main-collection__filter-backdrop-pointer');
          if (this.backdropInteraction) {
            this.backdropInteraction.panel = this.filterPanel;
            this.backdropInteraction.pointer = this.backdropPointer;
          }
          nextProducts.dispatchEvent(new CustomEvent('collection:products-loaded', { bubbles: true }));

          window.requestAnimationFrame(() => {
            const nextBody = this.dialog.querySelector('.main-collection__filter-body');
            if (nextBody) nextBody.scrollTop = dialogScrollTop;

            if (options.focusName) {
              const matchingControl = Array.from(this.dialog.querySelectorAll('[name]')).find(
                (control) => control.name === options.focusName && control.value === options.focusValue
              );
              matchingControl?.focus({ preventScroll: true });
            }
          });
        } else {
          const nextProducts = nextFacets.querySelector('.main-collection__products');
          this.replaceWith(nextFacets);
          window.ThemeAnimations?.init(nextProducts);
          nextProducts?.dispatchEvent(new CustomEvent('collection:products-loaded', { bubbles: true }));
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        window.location.assign(navigationUrl);
      } finally {
        this.removeAttribute('aria-busy');
      }
    }
  }

  customElements.define('collection-facets', CollectionFacets);
}
