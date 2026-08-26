export function initializeWhenVisible(element, callback, rootMargin = '320px 0px') {
  if (window.Shopify?.designMode || !('IntersectionObserver' in window)) {
    callback();
    return () => {};
  }

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    callback();
  }, { rootMargin });

  observer.observe(element);
  return () => observer.disconnect();
}
