if (!window.SpinelSearchInputControls) {
  window.SpinelSearchInputControls = true;

  const syncSearchClearButton = (input) => {
    const clearButton = input.closest('[data-search-form]')?.querySelector('[data-search-clear]');
    if (clearButton) clearButton.hidden = input.value.length === 0;
  };

  document.querySelectorAll('[data-search-input]').forEach(syncSearchClearButton);

  document.addEventListener('input', (event) => {
    const input = event.target.closest?.('[data-search-input]');
    if (input) syncSearchClearButton(input);
  });

  document.addEventListener('click', (event) => {
    const clearButton = event.target.closest?.('[data-search-clear]');
    if (!clearButton) return;

    const input = clearButton.closest('[data-search-form]')?.querySelector('[data-search-input]');
    if (!input) return;

    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  });
}

if (!customElements.get('search-results')) {
  customElements.define('search-results', class SearchResults extends HTMLElement {
    connectedCallback() {
      this.dialog = this.querySelector('[data-search-filter-dialog]');
      this.openButton = this.querySelector('[data-search-filter-open]');
      this.closeButton = this.querySelector('[data-search-filter-close]');
      this.onOpen = () => this.dialog && this.dialog.showModal();
      this.onClose = () => this.dialog && this.dialog.close();
      this.onDialogClick = (event) => { if (event.target === this.dialog) this.dialog.close(); };
      this.openButton?.addEventListener('click', this.onOpen);
      this.closeButton?.addEventListener('click', this.onClose);
      this.dialog?.addEventListener('click', this.onDialogClick);
    }
    disconnectedCallback() {
      this.openButton?.removeEventListener('click', this.onOpen);
      this.closeButton?.removeEventListener('click', this.onClose);
      this.dialog?.removeEventListener('click', this.onDialogClick);
    }
  });
}
