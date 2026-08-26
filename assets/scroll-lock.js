(() => {
  if (window.themeScrollLock?.acquire) return;

  const root = document.documentElement;
  const body = document.body;
  const bodyStyleProperties = ['position', 'top', 'right', 'left', 'width', 'overflow', 'padding-right'];
  const imperativeOwners = new Map();
  let locked = false;
  let scrollY = 0;
  let scrollbarWidth = 0;
  let savedBodyStyles = {};
  let appliedMode = '';
  let hadRootLockClass = false;
  let hadBodyLockClass = false;
  let hadRootLockAttribute = false;
  let externalUnlockObserver = null;
  let updateQueued = false;

  const userAgent = navigator.userAgent;
  const isIOS = /iP(?:ad|hone|od)/i.test(userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMobileSafari = isIOS
    && /AppleWebKit/i.test(userAgent)
    && /Safari/i.test(userAgent)
    && !/(?:CriOS|FxiOS|EdgiOS|OPiOS)/i.test(userAgent);

  const ownerMode = (owner) => {
    if (owner === 'mega-menu' || owner === 'mobile-menu') return 'overflow';
    if ((owner === 'cart-drawer' || owner === 'search') && isMobileSafari) return 'overflow';
    return 'fixed';
  };

  const getDeclarativeOwner = (element) => {
    if (element.dataset.scrollLockOwner) return element.dataset.scrollLockOwner;
    if (element.matches('[data-cart-drawer]')) return 'cart-drawer';
    if (element.matches('[data-header-mobile-drawer]')) return 'mobile-menu';
    if (element.matches('[data-search-drawer-dialog], [data-search-filter-dialog]')) return 'search';
    return 'modal';
  };

  const isImperativeOwnerActive = (owner) => {
    if (owner === 'mega-menu') return Boolean(document.querySelector('.header__submenu-disclosure--mega[open]'));
    if (owner === 'mobile-menu') {
      return Boolean(document.querySelector(
        '[data-header-mobile-drawer][data-open="true"], [data-header-mobile-drawer][data-motion-state="closing"]',
      ));
    }
    return true;
  };

  const setScrollbarVariables = (width) => {
    const value = `${Math.max(0, width)}px`;
    root.style.setProperty('--scrollbar-width', value);
    // Keep the legacy header variable available for sections that still use it.
    root.style.setProperty('--header-menu-scrollbar-width', value);
  };

  const measureScrollbarWidth = () => {
    // Once the lock is applied, clientWidth no longer includes the scrollbar.
    // Keep the measurement captured immediately before locking until unlock.
    if (!locked) {
      const measuredWidth = Math.max(0, window.innerWidth - root.clientWidth);
      const externalRootLockActive = root.style.overflow === 'hidden'
        || root.style.touchAction === 'none';

      // Shopify's account component locks the root from inside shadow DOM. A
      // click dispatched while that lock is active reports a temporary width
      // of zero, so preserve the pre-lock measurement and refresh on unlock.
      if (measuredWidth === 0 && externalRootLockActive) {
        if (!externalUnlockObserver) {
          externalUnlockObserver = new MutationObserver(() => {
            const isStillLocked = root.style.overflow === 'hidden'
              || root.style.touchAction === 'none';
            if (isStillLocked) return;

            externalUnlockObserver.disconnect();
            externalUnlockObserver = null;
            measureScrollbarWidth();
          });
          externalUnlockObserver.observe(root, {
            attributes: true,
            attributeFilter: ['style']
          });
        }
        return scrollbarWidth;
      }

      scrollbarWidth = measuredWidth;
      setScrollbarVariables(scrollbarWidth);
    }
    return scrollbarWidth;
  };

  const getActiveModes = () => {
    const modes = new Set();
    imperativeOwners.forEach((mode, owner) => {
      if (!isImperativeOwnerActive(owner)) {
        imperativeOwners.delete(owner);
        return;
      }
      modes.add(mode);
    });
    // Native dialogs are modal surfaces even when legacy markup does not yet
    // declare `scroll-lock`. Keep the state-driven drawers here too, so every
    // modal surface uses the same reference-counted lock and cannot unlock the
    // page while another surface is still open or animating out.
    document.querySelectorAll([
      '[scroll-lock][open]',
      '[scroll-lock].is-open',
      '[scroll-lock].is-closing',
      'dialog[open]',
      '[data-cart-drawer].is-open',
      '[data-cart-drawer].is-closing',
      '[data-header-mobile-drawer][data-open="true"]',
      '[data-header-mobile-drawer][data-motion-state="closing"]',
    ].join(', ')).forEach((element) => {
      modes.add(ownerMode(getDeclarativeOwner(element)));
    });

    // On mobile, the localization sheet is a non-native dialog inside an open
    // details element. Desktop localization remains a lightweight dropdown and
    // must not lock the page.
    if (window.matchMedia('(max-width: 959px)').matches) {
      document.querySelectorAll('.header__localization-selector[open] .header__localization-sheet[role="dialog"][aria-modal="true"]').forEach((element) => {
        modes.add(ownerMode(getDeclarativeOwner(element)));
      });
    }
    return modes;
  };

  const restoreBodyStyles = () => {
    bodyStyleProperties.forEach((property) => {
      body.style.setProperty(property, savedBodyStyles[property] || '');
    });
  };

  const applyLockStyles = (mode) => {
    const width = measureScrollbarWidth();
    root.setAttribute('scroll-lock', '');
    root.classList.add('scroll-locked');
    body.classList.add('scroll-locked');

    // Restore the pre-lock baseline before switching between fixed and
    // overflow modes while another owner is still holding the lock.
    restoreBodyStyles();

    if (mode === 'fixed') {
      Object.assign(body.style, {
        position: 'fixed',
        top: `-${scrollY}px`,
        right: `${width}px`,
        left: '0',
        width: `calc(100% - ${width}px)`,
        overflow: 'hidden'
      });
    } else {
      body.style.overflow = 'hidden';
      body.style.paddingRight = 'var(--scrollbar-width)';
    }
    appliedMode = mode;
  };

  const lock = (mode) => {
    if (!locked) {
      // Capture the width before changing overflow or positioning the body.
      measureScrollbarWidth();
      scrollY = window.scrollY;
      savedBodyStyles = Object.fromEntries(bodyStyleProperties.map((property) => [property, body.style.getPropertyValue(property)]));
      hadRootLockClass = root.classList.contains('scroll-locked');
      hadBodyLockClass = body.classList.contains('scroll-locked');
      hadRootLockAttribute = root.hasAttribute('scroll-lock');
      locked = true;
    }

    if (appliedMode !== mode) applyLockStyles(mode);
  };

  const unlock = () => {
    if (!locked) return;
    restoreBodyStyles();
    if (!hadRootLockClass) root.classList.remove('scroll-locked');
    if (!hadBodyLockClass) body.classList.remove('scroll-locked');
    if (!hadRootLockAttribute) root.removeAttribute('scroll-lock');
    locked = false;
    appliedMode = '';
    // The viewport may have resized while the page was locked. Re-measure
    // only after the scrollbar has been restored so the next lock uses the
    // current width (especially across the desktop/mobile breakpoint).
    measureScrollbarWidth();
    window.scrollTo(0, scrollY);
  };

  const update = () => {
    updateQueued = false;
    const activeModes = getActiveModes();
    if (!activeModes.has('overflow')) {
      // Avoid no-op class writes while the root scroll-lock attribute is set.
      // Some browsers still emit a class mutation for remove() when the token
      // is absent, which would continuously retrigger the observer below.
      if (root.classList.contains('header-menu-scroll-locked')) {
        root.classList.remove('header-menu-scroll-locked');
      }
      if (body.classList.contains('header-menu-scroll-locked')) {
        body.classList.remove('header-menu-scroll-locked');
      }
    }
    if (!activeModes.size) {
      unlock();
      return;
    }

    // Keep the existing fixed-body behavior for dialogs/drawers. The header
    // and mobile menu use the Helix-style overflow lock with body padding.
    // Once one owner has locked the page, keep that mode until every owner is
    // released so switching quickly between overlays cannot cause a reflow.
    const preferredMode = activeModes.has('overflow') ? 'overflow' : 'fixed';
    lock(locked ? appliedMode || preferredMode : preferredMode);
  };

  const scheduleUpdate = () => {
    if (updateQueued) return;
    updateQueued = true;
    window.queueMicrotask(update);
  };

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => {
      if (mutation.type === 'childList') return true;
      if (mutation.attributeName === 'open' || mutation.attributeName === 'scroll-lock' || mutation.attributeName === 'data-open' || mutation.attributeName === 'data-motion-state') return true;
      return mutation.target instanceof Element
        && mutation.target !== root
        && mutation.target.matches('[scroll-lock], [data-cart-drawer], [data-header-mobile-drawer]');
    })) scheduleUpdate();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'open', 'scroll-lock', 'data-open', 'data-motion-state'],
    childList: true,
    subtree: true
  });

  document.addEventListener('click', measureScrollbarWidth, true);
  window.addEventListener('resize', () => {
    measureScrollbarWidth();
    scheduleUpdate();
  });
  window.addEventListener('pageshow', scheduleUpdate);
  document.addEventListener('shopify:section:unload', () => window.setTimeout(update, 0), true);

  window.themeScrollLock = {
    acquire(owner, options = {}) {
      if (!owner) return;
      imperativeOwners.set(owner, options.mode || ownerMode(owner));
      update();
    },
    release(owner) {
      if (!owner) return;
      imperativeOwners.delete(owner);
      update();
    },
    has(owner) {
      return imperativeOwners.has(owner);
    },
    update,
    measure: measureScrollbarWidth
  };

  measureScrollbarWidth();
  update();
})();
