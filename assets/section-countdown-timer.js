if (!customElements.get('countdown-timer')) {
  class CountdownTimer extends HTMLElement {
    connectedCallback() {
      this.stop();
      if (this.hasAttribute('data-countdown-preview')) return;
      this.units = this.querySelector('[data-countdown-units]');
      this.completeMessage = this.querySelector('[data-countdown-complete]');
      this.outputs = {
        days: this.querySelector('[data-countdown-days]'),
        hours: this.querySelector('[data-countdown-hours]'),
        minutes: this.querySelector('[data-countdown-minutes]'),
        seconds: this.querySelector('[data-countdown-seconds]'),
      };
      this.endTime = new Date(this.dataset.endAt).getTime();
      this.isVisible = !('IntersectionObserver' in window);
      this.onVisibilityChange = () => {
        if (document.hidden) {
          this.stop();
        } else {
          this.update();
          this.start();
        }
      };
      if (Number.isNaN(this.endTime)) {
        this.hidden = true;
        return;
      }
      this.update();

      document.addEventListener('visibilitychange', this.onVisibilityChange);
      if ('IntersectionObserver' in window) {
        this.visibilityObserver = new IntersectionObserver((entries) => {
          this.isVisible = entries.some((entry) => entry.isIntersecting);
          if (this.isVisible) {
            this.update();
            this.start();
          } else {
            this.stop();
          }
        }, { rootMargin: '160px 0px' });
        this.visibilityObserver.observe(this);
      }
      this.start();
    }

    disconnectedCallback() {
      this.stop();
      this.visibilityObserver?.disconnect();
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }

    start() {
      this.stop();
      if (!this.isVisible || document.hidden || this.endTime <= Date.now()) return;
      this.interval = window.setInterval(() => this.update(), 1000);
    }

    stop() {
      window.clearInterval(this.interval);
      this.interval = null;
    }

    update() {
      if (Number.isNaN(this.endTime)) return;

      const remaining = Math.max(0, this.endTime - Date.now());
      const values = {
        days: Math.floor(remaining / 86400000),
        hours: Math.floor((remaining % 86400000) / 3600000),
        minutes: Math.floor((remaining % 3600000) / 60000),
        seconds: Math.floor((remaining % 60000) / 1000),
      };

      Object.entries(values).forEach(([key, value]) => {
        if (this.outputs[key]) this.outputs[key].textContent = String(value).padStart(2, '0');
      });

      if (remaining === 0) this.complete();
    }

    complete() {
      this.stop();
      this.visibilityObserver?.disconnect();

      if (this.dataset.showCompletionMessage === 'true') {
        if (this.units) this.units.hidden = true;
        if (this.completeMessage) this.completeMessage.hidden = false;
      } else {
        this.hidden = true;
      }
    }
  }

  customElements.define('countdown-timer', CountdownTimer);
}
