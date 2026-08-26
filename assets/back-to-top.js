const backToTopButton = document.querySelector('[data-back-to-top]');

if (backToTopButton) {
  let frameId = null;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const updateBackToTop = () => {
    frameId = null;
    const maximumScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const scrollPosition = Math.max(0, window.scrollY);
    const progress = Math.min(100, (scrollPosition / maximumScroll) * 100);
    const isVisible = scrollPosition > Math.min(480, window.innerHeight * .6);

    backToTopButton.style.setProperty('--back-to-top-progress', progress.toFixed(2));
    backToTopButton.classList.toggle('is-visible', isVisible);
    backToTopButton.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
    backToTopButton.tabIndex = isVisible ? 0 : -1;
  };

  const requestUpdate = () => {
    if (frameId) return;
    frameId = window.requestAnimationFrame(updateBackToTop);
  };

  backToTopButton.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  });

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  reduceMotion.addEventListener?.('change', requestUpdate);
  updateBackToTop();
}
