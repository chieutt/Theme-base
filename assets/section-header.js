if (!window.SpinelHeaderMenus) {
  window.SpinelHeaderMenus = true;
  const megaMenuAnimations = new WeakMap();
  const desktopMegaMenuMotions = new WeakMap();
  const desktopMegaMenuRevealEnds = new WeakMap();
  const desktopMegaMenuResizeObservers = new WeakMap();
  const desktopMegaMenuHeightTimers = new WeakMap();
  const desktopMegaMenuHandoffs = new WeakMap();
  const mobileMegaMenuMotions = new WeakMap();
  const mobileDrawerMotions = new WeakMap();
  const localizationSheetMotions = new WeakMap();
  const localizationBackdropInteractions = new WeakMap();
  const localizationSheetOpenRequests = new WeakMap();
  const localizationSheetFinalizing = new WeakSet();
  const megaMenuHoverTimers = new WeakMap();
  const cartFeedbackHeaderStates = new WeakMap();
  const mobileMenuReturnFocus = new WeakMap();
  const headerMenuEasing = 'cubic-bezier(0.3, 1, 0.3, 1)';
  const headerHoverCloseDelay = 500;
  const desktopMegaMenuHoverCloseDelay = 360;
  const desktopMegaMenuTransitionDurationFallback = 300;
  const transparentHeaderSchemeExitDelay = 90;
  const headerLocalizationHoverCloseDelay = 120;
  const headerBrowserChromeClass = 'header-menu-browser-chrome-active';
  const headerBrowserChromeProperty = '--header-browser-chrome-color';
  const accountDialogTopProperty = '--shopify-account-dialog-position-top';
  const accountDialogHeaderGap = 8;
  const headerMobileMediaQuery = '(max-width: 1023.98px)';
  const headerDesktopMediaQuery = '(min-width: 1024px)';
  // Let non-sticky transparent headers clear the announcement bar before changing palette.
  const desktopTransparentHeaderSurfaceThreshold = 20;
  const mobileStickyHeaderHideThreshold = 40;
  // Desktop top-level menus use the CSS motion below; keep the legacy Web Animations fallback disabled.
  const disableLegacyMegaMenuWebAnimations = true;
  let transparentHeaderFrame = 0;
  let headerScrollLockFallbackStyles = null;
  let headerBreakpointFocusContext = null;
  let localizationSheetDrag = null;
  let localizationSheetDragTimer = null;
  let localizationSheetSettling = null;
  let headerBrowserChromeColorState = null;
  const responsiveHeaderEntryFrames = new WeakMap();
  const responsiveHeaderExitMotions = new WeakMap();
  const transparentHeaderSchemeExitTimers = new WeakMap();
  const mobileStickyHeaderStates = new WeakMap();
  const desktopStickyHeaderStates = new WeakMap();
  const localizationHoverTimers = new WeakMap();
  let wasMobileHeaderViewport = window.matchMedia(headerMobileMediaQuery).matches;

  const isMobileHeaderViewport = () => window.matchMedia(headerMobileMediaQuery).matches;

  const syncDesktopAccountDialogPosition = (account) => {
    if (!account) return;
    if (isMobileHeaderViewport()) {
      account.style.removeProperty(accountDialogTopProperty);
      return;
    }

    const header = account.closest('[data-header]');
    if (!header) return;
    const headerBottom = Math.max(0, header.getBoundingClientRect().bottom);
    account.style.setProperty(accountDialogTopProperty, `${Math.round(headerBottom + accountDialogHeaderGap)}px`);
  };

  const syncDesktopAccountDialogPositions = (scope = document) => {
    scope.querySelectorAll?.('shopify-account.header__action--account').forEach(syncDesktopAccountDialogPosition);
  };

  const resetLocalizationSheetDrag = () => {
    window.clearTimeout(localizationSheetDragTimer);
    localizationSheetDragTimer = null;

    const drag = localizationSheetDrag;
    const settling = localizationSheetSettling;
    if (drag) {
      try { drag.handle.releasePointerCapture(drag.pointerId); } catch (_) {}
    }

    localizationSheetDrag = null;
    localizationSheetSettling = null;
    drag?.sheet?.classList.remove('is-handle-dragging', 'is-handle-settling', 'is-handle-closing');
    drag?.sheet?.style.removeProperty('transform');
    drag?.sheet?.style.removeProperty('opacity');
    settling?.sheet?.classList.remove('is-handle-settling', 'is-handle-closing');
    settling?.sheet?.style.removeProperty('transform');
    settling?.sheet?.style.removeProperty('opacity');
  };

  const closeLocalizationSheetFromHandle = (drag) => {
    const { details, sheet } = drag;
    sheet.classList.add('is-handle-closing');
    sheet.style.opacity = '1';

    window.requestAnimationFrame(() => {
      sheet.style.transform = `translate3d(0, ${Math.max(window.innerHeight, sheet.offsetHeight + 60)}px, 0)`;
      sheet.style.opacity = '0';
    });

    const settling = { sheet };
    localizationSheetSettling = settling;
    localizationSheetDragTimer = window.setTimeout(() => {
      if (localizationSheetSettling !== settling) return;
      if (details.open) {
        localizationSheetFinalizing.add(details);
        details.open = false;
        details.querySelector(':scope > summary')?.focus({ preventScroll: true });
      }
      sheet.classList.remove('is-handle-closing');
      sheet.style.removeProperty('transform');
      sheet.style.removeProperty('opacity');
      localizationSheetSettling = null;
      localizationSheetDragTimer = null;
    }, getTransitionTotalMs(sheet, 'transform'));
  };

  const startLocalizationSheetDrag = (event) => {
    const handle = event.target instanceof Element
      ? event.target.closest('.header__localization-sheet-handle')
      : null;
    const sheet = handle?.closest('.header__localization-sheet');
    const details = sheet?.closest('.header__localization-selector[open]');

    if (!handle || !sheet || !details || !isMobileHeaderViewport() || !event.isPrimary || event.button > 0) return;

    resetLocalizationSheetDrag();
    localizationSheetDrag = {
      pointerId: event.pointerId,
      handle,
      sheet,
      details,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: performance.now(),
      velocity: 0,
      distance: 0,
    };
    sheet.classList.add('is-handle-dragging');
    sheet.style.transform = 'translate3d(0, 0, 0)';
    sheet.style.opacity = '1';
    try { handle.setPointerCapture(event.pointerId); } catch (_) {}
    event.preventDefault();
  };

  const moveLocalizationSheetDrag = (event) => {
    const drag = localizationSheetDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const now = performance.now();
    const elapsed = Math.max(now - drag.lastTime, 1);
    drag.velocity = (event.clientY - drag.lastY) / elapsed;
    drag.lastY = event.clientY;
    drag.lastTime = now;
    drag.distance = Math.max(0, event.clientY - drag.startY);
    drag.sheet.style.transform = `translate3d(0, ${drag.distance}px, 0)`;
    event.preventDefault();
  };

  const endLocalizationSheetDrag = (event, cancelled = false) => {
    const drag = localizationSheetDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    try { drag.handle.releasePointerCapture(event.pointerId); } catch (_) {}
    const closeDistance = Math.min(140, drag.sheet.getBoundingClientRect().height * 0.2);
    const shouldClose = !cancelled && (
      drag.distance >= closeDistance
      || (drag.distance >= 32 && drag.velocity > 0.55)
    );
    localizationSheetDrag = null;
    drag.sheet.classList.remove('is-handle-dragging');

    if (shouldClose) {
      closeLocalizationSheetFromHandle(drag);
      return;
    }

    drag.sheet.classList.add('is-handle-settling');
    window.requestAnimationFrame(() => {
      drag.sheet.style.transform = 'translate3d(0, 0, 0)';
      drag.sheet.style.opacity = '1';
    });
    const settling = { sheet: drag.sheet };
    localizationSheetSettling = settling;
    const duration = getTransitionTotalMs(drag.sheet, 'transform');
    if (!duration) {
      resetLocalizationSheetDrag();
      return;
    }
    localizationSheetDragTimer = window.setTimeout(() => {
      if (localizationSheetSettling === settling) resetLocalizationSheetDrag();
    }, duration);
  };

  const localizationSheetTouchEvent = (event, callback, cancelled = false) => {
    const activePointerId = localizationSheetDrag?.pointerId;
    const touch = Array.from(event.changedTouches).find((candidate) => candidate.identifier === activePointerId)
      || event.changedTouches[0];
    if (!touch) return;

    callback({
      target: event.target,
      isPrimary: true,
      button: 0,
      pointerId: touch.identifier,
      clientY: touch.clientY,
      preventDefault: () => event.preventDefault(),
    }, cancelled);
  };

  const focusWithoutScroll = (target, scroller, savedScroll) => {
    if (!target) return;
    const pageX = window.scrollX;
    const pageY = window.scrollY;
    const scrollLeft = savedScroll?.left ?? scroller?.scrollLeft;
    const scrollTop = savedScroll?.top ?? scroller?.scrollTop;
    target.focus({ preventScroll: true });
    if (scroller) {
      scroller.scrollLeft = scrollLeft || 0;
      scroller.scrollTop = scrollTop || 0;
    }
    if (window.scrollX !== pageX || window.scrollY !== pageY) window.scrollTo(pageX, pageY);
  };

  const getCssTimeMs = (value) => {
    const numericValue = Number.parseFloat(value);
    if (!Number.isFinite(numericValue)) return 0;
    return value.trim().endsWith('ms') ? numericValue : numericValue * 1000;
  };

  const getMobileNavigationMotion = (header) => {
    const drawer = header?.querySelector('[data-header-mobile-drawer]');
    const style = drawer ? getComputedStyle(drawer) : null;
    const duration = getCssTimeMs(style?.getPropertyValue('--header-mobile-motion-duration') || '360ms');
    const easing = style?.getPropertyValue('--header-mobile-motion-easing').trim() || 'ease-in-out';
    return { duration, easing };
  };

  const getTransitionTotalMs = (element, propertyName) => {
    if (!element) return 0;
    const style = getComputedStyle(element);
    const properties = style.transitionProperty.split(',').map((value) => value.trim());
    const durations = style.transitionDuration.split(',').map((value) => value.trim());
    const delays = style.transitionDelay.split(',').map((value) => value.trim());
    return properties.reduce((maximum, property, index) => {
      if (property !== propertyName && property !== 'all') return maximum;
      const duration = getCssTimeMs(durations[index % durations.length] || '0s');
      const delay = getCssTimeMs(delays[index % delays.length] || '0s');
      return Math.max(maximum, duration + delay);
    }, 0);
  };

  const getAnimationTotalMs = (element) => {
    if (!element) return 0;
    const style = getComputedStyle(element);
    const durations = style.animationDuration.split(',').map((value) => value.trim());
    const delays = style.animationDelay.split(',').map((value) => value.trim());
    return durations.reduce((maximum, duration, index) => Math.max(
      maximum,
      getCssTimeMs(duration) + getCssTimeMs(delays[index % delays.length] || '0s')
    ), 0);
  };

  const clearLocalizationSheetMotion = (details) => {
    const state = localizationSheetMotions.get(details);
    if (!state) return;
    window.clearTimeout(state.timer);
    localizationSheetMotions.delete(details);
    details.removeAttribute('data-motion-state');
  };

  const closeLocalizationSheet = (details, restoreFocus = true, immediate = false) => {
    if (!details?.matches?.('.header__localization-selector')) return;

    cancelLocalizationSheetOpen(details);
    if (!details.open) {
      syncHeaderLocalizationAria(details);
      return;
    }

    const existingState = localizationSheetMotions.get(details);
    if (existingState) {
      existingState.restoreFocus ||= restoreFocus;
      return;
    }

    details.removeAttribute('data-motion-state');
    resetLocalizationSheetDrag();
    const popover = details.querySelector(':scope > [data-header-localization-popover]');
    const sheet = popover?.querySelector('.header__localization-sheet');
    const backdrop = popover?.querySelector('.header__localization-backdrop');
    const state = {
      finish: null,
      restoreFocus,
      timer: 0,
    };
    const finish = () => {
      if (localizationSheetMotions.get(details) !== state) return;
      window.clearTimeout(state.timer);
      localizationSheetMotions.delete(details);
      details.removeAttribute('data-motion-state');
      localizationSheetFinalizing.add(details);
      details.open = false;
      syncHeaderLocalizationAria(details);
      if (state.restoreFocus) {
        window.requestAnimationFrame(() => focusWithoutScroll(details.querySelector(':scope > summary')));
      }
    };
    state.finish = finish;
    localizationSheetMotions.set(details, state);
    details.dataset.motionState = 'closing';
    localizationBackdropInteractions.get(details)?.hide();
    syncHeaderLocalizationAria(details);

    const duration = Math.max(getAnimationTotalMs(sheet), getAnimationTotalMs(backdrop));
    if (immediate || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !duration) {
      finish();
      return;
    }

    state.timer = window.setTimeout(finish, duration + 80);
  };

  const getMobileDrawer = (disclosure) => {
    const drawer = disclosure?.nextElementSibling;
    return drawer?.matches?.('[data-header-mobile-drawer]') ? drawer : null;
  };

  const getHeaderBrowserChromeColor = (drawer) => {
    const surface = drawer?.querySelector('.header__mobile-drawer-surface');
    const surfaceStyles = surface ? getComputedStyle(surface) : null;
    const surfaceColor = surfaceStyles?.getPropertyValue('--color-background').trim();

    if (surfaceColor) return surfaceColor;

    const bodyColor = getComputedStyle(document.body).backgroundColor;
    return bodyColor && bodyColor !== 'transparent' ? bodyColor : '#ffffff';
  };

  const setHeaderBrowserChromeColor = (color) => {
    const root = document.documentElement;
    const safeColor = color || '#ffffff';

    if (!headerBrowserChromeColorState) {
      const themeColorMetas = [...document.head.querySelectorAll('meta[name="theme-color"]')];

      headerBrowserChromeColorState = {
        rootColor: root.style.getPropertyValue(headerBrowserChromeProperty),
        metas: themeColorMetas.map((meta) => ({
          meta,
          content: meta.getAttribute('content'),
        })),
        createdMeta: null,
      };

      if (!themeColorMetas.length) {
        const meta = document.createElement('meta');
        meta.name = 'theme-color';
        meta.dataset.spinelThemeColor = '';
        document.head.appendChild(meta);
        headerBrowserChromeColorState.createdMeta = meta;
        headerBrowserChromeColorState.metas.push({ meta, content: null });
      }
    }

    headerBrowserChromeColorState.metas.forEach(({ meta }) => {
      meta.setAttribute('content', safeColor);
    });

    root.style.setProperty(headerBrowserChromeProperty, safeColor);
    root.classList.add(headerBrowserChromeClass);
  };

  const restoreHeaderBrowserChromeColor = () => {
    const root = document.documentElement;
    const state = headerBrowserChromeColorState;

    if (!state) {
      root.classList.remove(headerBrowserChromeClass);
      return;
    }

    state.metas.forEach(({ meta, content }) => {
      if (!meta.isConnected) return;
      if (content === null) {
        meta.removeAttribute('content');
      } else {
        meta.setAttribute('content', content);
      }
    });

    state.createdMeta?.remove();

    if (state.rootColor) {
      root.style.setProperty(headerBrowserChromeProperty, state.rootColor);
    } else {
      root.style.removeProperty(headerBrowserChromeProperty);
    }

    root.classList.remove(headerBrowserChromeClass);
    headerBrowserChromeColorState = null;
  };

  const cancelLocalizationSheetOpen = (details) => {
    const request = localizationSheetOpenRequests.get(details);

    if (!request) return;

    if (request.frame) window.cancelAnimationFrame(request.frame);
    localizationSheetOpenRequests.delete(details);
  };

  const isLocalizationSheetReady = (details) => {
    if (!details || !isMobileHeaderViewport()) return true;

    const drawer = details.closest('[data-header-mobile-drawer]');
    const surface = drawer?.querySelector('.header__mobile-drawer-surface');
    const navigation = drawer?.querySelector('.header__navigation--mobile');
    const utilities = drawer?.querySelector('.header__mobile-utilities');
    const surfaceRect = surface?.getBoundingClientRect();
    const hasActiveMotion = [surface, navigation, utilities]
      .filter(Boolean)
      .some((element) => element.getAnimations?.().some((animation) => animation.playState === 'running'));

    return Boolean(
      drawer?.dataset.open === 'true'
      && drawer.dataset.motionState !== 'closing'
      && surfaceRect
      && surfaceRect.left >= -0.5
      && !hasActiveMotion
    );
  };

  const focusLocalizationSheet = (details) => {
    window.requestAnimationFrame(() => {
      if (!details?.open || !details.isConnected) return;
      const sheet = details.querySelector('.header__localization-sheet');
      const target = sheet?.querySelector('[role="option"][aria-selected="true"]')
        || sheet?.querySelector('[data-header-localization-close]');
      focusWithoutScroll(target, sheet);
    });
  };

  const openLocalizationSheet = (details) => {
    if (!details || !isMobileHeaderViewport()) return;

    cancelLocalizationSheetOpen(details);

    if (details.open || isLocalizationSheetReady(details)) {
      details.open = true;
      syncHeaderLocalizationAria(details);
      focusLocalizationSheet(details);
      return;
    }

    const request = {
      frame: 0,
      startedAt: performance.now(),
    };
    localizationSheetOpenRequests.set(details, request);

    const openWhenReady = () => {
      if (localizationSheetOpenRequests.get(details) !== request) return;

      if (
        !details.isConnected
        || !isMobileHeaderViewport()
        || request.startedAt + 800 <= performance.now()
        || isLocalizationSheetReady(details)
      ) {
        localizationSheetOpenRequests.delete(details);
        if (!details.isConnected || !isMobileHeaderViewport()) return;
        details.open = true;
        syncHeaderLocalizationAria(details);
        focusLocalizationSheet(details);
        return;
      }

      request.frame = window.requestAnimationFrame(openWhenReady);
    };

    request.frame = window.requestAnimationFrame(openWhenReady);
  };

  const syncMobileDrawer = (disclosure, focusDrawer = false) => {
    const drawer = getMobileDrawer(disclosure);
    if (!drawer) return;

    const isOpen = isMobileHeaderViewport() && disclosure.open;
    drawer.dataset.open = String(isOpen);
    if (drawer.dataset.motionState !== 'closing') drawer.dataset.motionState = isOpen ? 'open' : 'closed';
    if (isMobileHeaderViewport()) {
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-modal', 'true');
      const title = drawer.querySelector('.header__mobile-drawer-header .visually-hidden');
      if (title?.id) drawer.setAttribute('aria-labelledby', title.id);
      drawer.setAttribute('aria-hidden', String(!isOpen));
    } else {
      drawer.removeAttribute('role');
      drawer.removeAttribute('aria-modal');
      drawer.removeAttribute('aria-labelledby');
      drawer.setAttribute('aria-hidden', 'true');
      drawer.inert = true;
    }
    if (isMobileHeaderViewport()) drawer.inert = !isOpen;

    if (isOpen && focusDrawer) {
      mobileMenuReturnFocus.set(drawer, disclosure.querySelector(':scope > summary'));
      window.requestAnimationFrame(() => focusWithoutScroll(drawer.querySelector('[data-header-mobile-close]'), drawer));
    }
  };

  const getActiveMobileDrawerPanel = (drawer) => {
    const localizationSheet = drawer.querySelector(
      '.header__localization-selector[open]:not([data-motion-state="closing"]) .header__localization-sheet'
    );
    if (localizationSheet) return localizationSheet;
    const panels = Array.from(drawer.querySelectorAll(
      '.header__submenu-disclosure[open] > :is(.header__submenu, .header__mega-panel), .header__submenu-nested-disclosure[open] > .header__submenu-nested'
    ));
    return panels.at(-1) || drawer;
  };

  const getMobileDrawerFocusables = (drawer) => {
    const activePanel = getActiveMobileDrawerPanel(drawer);
    const elements = Array.from(activePanel.querySelectorAll(
      'a[href], button:not([disabled]), summary, input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    const closeButton = drawer.querySelector('[data-header-mobile-close]');
    if (activePanel !== drawer && !activePanel.matches('.header__localization-sheet') && closeButton) {
      const backIndex = elements.findIndex((element) => element.matches('[data-header-mobile-back]'));
      elements.splice(backIndex + 1, 0, closeButton);
    }
    return elements.filter((element) => element.tabIndex >= 0 && (
      element.offsetWidth > 0 || element.offsetHeight > 0 || element === document.activeElement
    ));
  };

  const clearMobileDrawerMotion = (disclosure) => {
    const state = mobileDrawerMotions.get(disclosure);
    if (!state) return;
    window.clearTimeout(state.timer);
    state.surface?.removeEventListener('transitionend', state.onTransitionEnd);
    mobileDrawerMotions.delete(disclosure);
  };

  const closeMobileMenu = (disclosure, restoreFocus = true) => {
    if (!disclosure || !disclosure.open) return;
    const header = disclosure.closest('[data-header]');
    const drawer = getMobileDrawer(disclosure);
    const returnFocus = mobileMenuReturnFocus.get(drawer) || disclosure.querySelector(':scope > summary');

    if (isMobileHeaderViewport()) {
      header?.querySelectorAll('.header__localization-selector').forEach((details) => {
        cancelLocalizationSheetOpen(details);
      });
      header?.querySelectorAll('.header__localization-selector[open]').forEach((details) => {
        closeLocalizationSheet(details, false, true);
      });
    }

    const finalize = () => {
      header?.querySelectorAll('.header__submenu-disclosure[open], .header__submenu-nested-disclosure[open]').forEach((details) => {
        closeMegaMenu(details, true);
      });
      disclosure.open = false;
      if (drawer) drawer.dataset.motionState = 'closed';
      syncMobileDrawer(disclosure);
      syncHeaderMenuScrollLock();
      if (header) scheduleResponsiveHeaderSync();
      if (restoreFocus) window.requestAnimationFrame(() => focusWithoutScroll(returnFocus));
    };

    if (!drawer || !isMobileHeaderViewport()) {
      finalize();
      return;
    }

    if (drawer.dataset.motionState === 'closing') return;
    clearMobileDrawerMotion(disclosure);
    drawer.dataset.motionState = 'closing';
    syncHeaderMenuScrollLock();

    const surface = drawer.querySelector('.header__mobile-drawer-surface');
    const finish = () => {
      const state = mobileDrawerMotions.get(disclosure);
      if (!state || state.finish !== finish) return;
      clearMobileDrawerMotion(disclosure);
      finalize();
    };
    const onTransitionEnd = (event) => {
      if (event.target === surface && event.propertyName === 'transform') finish();
    };
    const state = { surface, finish, onTransitionEnd, timer: 0 };
    mobileDrawerMotions.set(disclosure, state);
    const duration = getTransitionTotalMs(surface, 'transform');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || duration === 0) {
      window.queueMicrotask(finish);
      return;
    }
    surface?.addEventListener('transitionend', onTransitionEnd);
    state.timer = window.setTimeout(finish, duration + 80);
  };

  const syncHeaderMenuScrollLock = () => {
    const isMobile = window.matchMedia(headerMobileMediaQuery).matches;
    const openMobileDrawer = document.querySelector('[data-header-mobile-drawer][data-open="true"]:not([data-motion-state="closing"])');
    const closingMobileDrawer = document.querySelector('[data-header-mobile-drawer][data-motion-state="closing"]');
    const shouldLock = Boolean(isMobile && (openMobileDrawer || closingMobileDrawer));
    const shouldShowOverlay = isMobile
      ? Boolean(openMobileDrawer)
      : Boolean(document.querySelector('.header__submenu-disclosure--mega[open]:not([data-closing="true"])'));
    const root = document.documentElement;

    if (isMobile && (openMobileDrawer || closingMobileDrawer)) {
      setHeaderBrowserChromeColor(getHeaderBrowserChromeColor(openMobileDrawer || closingMobileDrawer));
    } else {
      restoreHeaderBrowserChromeColor();
    }

    const body = document.body;
    root.classList.toggle('header-menu-overlay-visible', shouldShowOverlay);
    root.classList.toggle('header-menu-overlay-closing', isMobile && Boolean(closingMobileDrawer));
    document.querySelectorAll('[data-header-menu-overlay]').forEach((overlay) => {
      const header = document.getElementById(overlay.dataset.headerMenuOverlay);
      const drawer = overlay.closest('[data-header-mobile-drawer]')
        || getMobileDrawer(header?.querySelector(':scope > .header__inner > .header__menu-disclosure'));
      const isOwnedMobileOverlay = overlay.matches('.header__menu-overlay--mobile');
      const isOwnedDesktopOverlay = overlay.matches('.header__menu-overlay--desktop');
      const isDrawerClosing = drawer?.dataset.motionState === 'closing';
      const overlayVisible = isMobile
        ? isOwnedMobileOverlay && drawer?.dataset.open === 'true' && !isDrawerClosing
        : isOwnedDesktopOverlay && Boolean(header?.querySelector('.header__submenu-disclosure--mega[open]:not([data-closing="true"])'));
      overlay.toggleAttribute('data-visible', Boolean(overlayVisible));
      overlay.toggleAttribute('data-closing', Boolean(isMobile && isOwnedMobileOverlay && isDrawerClosing));
    });

    const scrollLock = window.themeScrollLock;
    if (scrollLock?.acquire && headerScrollLockFallbackStyles) {
      root.classList.remove('header-menu-scroll-locked');
      body?.classList.remove('header-menu-scroll-locked');
      body?.style.setProperty('overflow', headerScrollLockFallbackStyles.overflow);
      body?.style.setProperty('padding-right', headerScrollLockFallbackStyles.paddingRight);
      headerScrollLockFallbackStyles = null;
    }

    if (shouldLock) {
      if (scrollLock?.acquire) {
        const owner = isMobile ? 'mobile-menu' : 'mega-menu';
        const inactiveOwner = isMobile ? 'mega-menu' : 'mobile-menu';
        scrollLock.acquire(owner, { mode: 'overflow' });
        scrollLock.release(inactiveOwner);
      } else {
        const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth);
        root.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`);
        root.style.setProperty('--header-menu-scrollbar-width', `${scrollbarWidth}px`);
        headerScrollLockFallbackStyles ||= {
          overflow: body?.style.getPropertyValue('overflow') || '',
          paddingRight: body?.style.getPropertyValue('padding-right') || ''
        };
        body?.style.setProperty('overflow', 'hidden');
        body?.style.setProperty('padding-right', 'var(--scrollbar-width)');
      }

      root.classList.add('header-menu-scroll-locked');
      body?.classList.add('header-menu-scroll-locked');
      return;
    }

    root.classList.remove('header-menu-scroll-locked');
    body?.classList.remove('header-menu-scroll-locked');

    if (scrollLock?.release) {
      scrollLock.release('mega-menu');
      scrollLock.release('mobile-menu');
    } else if (headerScrollLockFallbackStyles) {
      body?.style.setProperty('overflow', headerScrollLockFallbackStyles.overflow);
      body?.style.setProperty('padding-right', headerScrollLockFallbackStyles.paddingRight);
      headerScrollLockFallbackStyles = null;
      const scrollbarWidth = Math.max(0, window.innerWidth - root.clientWidth);
      root.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`);
      root.style.setProperty('--header-menu-scrollbar-width', `${scrollbarWidth}px`);
    }
  };

  const setTransparentHeaderColorScheme = (header, showSurface) => {
    const defaultColorClass = header.dataset.defaultColorClass;
    const transparentColorClass = header.dataset.transparentColorClass;
    const activeColorClass = showSurface ? defaultColorClass : transparentColorClass;
    const inactiveColorClass = showSurface ? transparentColorClass : defaultColorClass;
    const isActiveSchemeApplied = !activeColorClass || header.classList.contains(activeColorClass);
    const isInactiveSchemeRemoved = !inactiveColorClass
      || inactiveColorClass === activeColorClass
      || !header.classList.contains(inactiveColorClass);

    if (isActiveSchemeApplied && isInactiveSchemeRemoved) return;

    if (inactiveColorClass && inactiveColorClass !== activeColorClass) {
      header.classList.remove(inactiveColorClass);
    }
    if (activeColorClass) header.classList.add(activeColorClass);
  };

  const clearTransparentHeaderSchemeExit = (header) => {
    const timer = transparentHeaderSchemeExitTimers.get(header);
    if (timer) window.clearTimeout(timer);
    transparentHeaderSchemeExitTimers.delete(header);
  };

  const syncTransparentHeaderColorScheme = (header, showSurface) => {
    const defaultColorClass = header.dataset.defaultColorClass;
    const hasSurfaceScheme = Boolean(defaultColorClass && header.classList.contains(defaultColorClass));

    if (showSurface) {
      clearTransparentHeaderSchemeExit(header);
      setTransparentHeaderColorScheme(header, true);
      return;
    }

    if (!hasSurfaceScheme) {
      clearTransparentHeaderSchemeExit(header);
      return;
    }

    if (transparentHeaderSchemeExitTimers.has(header)) return;
    const timer = window.setTimeout(() => {
      transparentHeaderSchemeExitTimers.delete(header);
      if (!header.classList.contains('header--surface-visible')) {
        setTransparentHeaderColorScheme(header, false);
      }
    }, transparentHeaderSchemeExitDelay);
    transparentHeaderSchemeExitTimers.set(header, timer);
  };

  const clearResponsiveHeaderExit = (header) => {
    const motion = responsiveHeaderExitMotions.get(header);
    if (motion?.frame) window.cancelAnimationFrame(motion.frame);
    if (motion?.timer) window.clearTimeout(motion.timer);
    responsiveHeaderExitMotions.delete(header);
    header.removeAttribute('data-scroll-exiting');
    header.style.removeProperty('--header-scroll-exit-offset');
  };

  const finishResponsiveHeaderExit = (header, motion) => {
    if (responsiveHeaderExitMotions.get(header) !== motion) return;
    responsiveHeaderExitMotions.delete(header);
    if (motion.frame) window.cancelAnimationFrame(motion.frame);
    if (motion.timer) window.clearTimeout(motion.timer);
    header.removeAttribute('data-scroll-exiting');
    header.style.removeProperty('--header-scroll-exit-offset');
  };

  const startResponsiveHeaderExit = (header) => {
    if (responsiveHeaderExitMotions.has(header)) return;

    const sectionWrapper = header.parentElement;
    const currentTop = header.getBoundingClientRect().top;
    const targetTop = sectionWrapper?.getBoundingClientRect().top ?? currentTop;
    const motion = { frame: 0, timer: 0 };
    responsiveHeaderExitMotions.set(header, motion);

    clearResponsiveHeaderEntry(header);
    header.style.setProperty('--header-scroll-exit-offset', `${currentTop - targetTop}px`);
    header.dataset.scrollExiting = 'preparing';
    header.classList.remove('header--scrolled');
    header.getBoundingClientRect();

    motion.frame = window.requestAnimationFrame(() => {
      if (responsiveHeaderExitMotions.get(header) !== motion) return;
      motion.frame = 0;
      if (!header.isConnected || header.classList.contains('header--scrolled')) {
        finishResponsiveHeaderExit(header, motion);
        return;
      }

      header.dataset.scrollExiting = 'true';
      header.getBoundingClientRect();
      header.style.setProperty('--header-scroll-exit-offset', '0px');
      const duration = getTransitionTotalMs(header, 'transform');
      if (!duration) {
        finishResponsiveHeaderExit(header, motion);
        return;
      }
      motion.timer = window.setTimeout(() => finishResponsiveHeaderExit(header, motion), duration + 80);
    });
  };

  const clearResponsiveHeaderEntry = (header) => {
    const frame = responsiveHeaderEntryFrames.get(header);
    if (frame) window.cancelAnimationFrame(frame);
    responsiveHeaderEntryFrames.delete(header);
    header.removeAttribute('data-scroll-entering');
    header.style.removeProperty('--header-scroll-entry-offset');
    header.style.removeProperty('--header-scroll-entry-top');
  };

  const syncResponsiveHeaderScrollState = (header, isScrolled, animateEntry) => {
    const wasScrolled = header.classList.contains('header--scrolled');
    if (wasScrolled === isScrolled) {
      if (!animateEntry || !isScrolled) clearResponsiveHeaderEntry(header);
      return;
    }

    if (!isScrolled) {
      if (animateEntry) {
        startResponsiveHeaderExit(header);
      } else {
        clearResponsiveHeaderEntry(header);
        header.classList.remove('header--scrolled');
      }
      return;
    }

    const entryOffset = header.getBoundingClientRect().top;
    clearResponsiveHeaderExit(header);
    if (!animateEntry) {
      clearResponsiveHeaderEntry(header);
      header.classList.add('header--scrolled');
      return;
    }

    clearResponsiveHeaderEntry(header);
    header.style.setProperty('--header-scroll-entry-offset', `${entryOffset}px`);
    header.dataset.scrollEntering = 'true';
    header.classList.add('header--scrolled');
    header.getBoundingClientRect();

    const frame = window.requestAnimationFrame(() => {
      if (responsiveHeaderEntryFrames.get(header) !== frame) return;
      responsiveHeaderEntryFrames.delete(header);
      if (!header.isConnected || !header.classList.contains('header--scrolled')) return;
      header.style.setProperty('--header-scroll-entry-offset', '0px');
      header.removeAttribute('data-scroll-entering');
    });
    responsiveHeaderEntryFrames.set(header, frame);
  };

  const syncMobileStickyHeaders = () => {
    const isMobile = isMobileHeaderViewport();
    const currentScrollY = window.scrollY;

    document.querySelectorAll('[data-header]').forEach((header) => {
      if (!header.classList.contains('header--sticky')) {
        mobileStickyHeaderStates.delete(header);
        header.classList.remove('header--mobile-hidden');
        return;
      }

      const isResponsiveHeader = header.dataset.transparentHeader === 'true'
        || header.dataset.floatingHeader === 'true';
      if (!isResponsiveHeader) {
        header.classList.toggle('header--scrolled', currentScrollY > 1);
      }

      const previousState = mobileStickyHeaderStates.get(header) || {
        lastScrollY: currentScrollY,
        hidden: false
      };
      let hidden = previousState.hidden;

      if (!isMobile || currentScrollY <= mobileStickyHeaderHideThreshold) {
        hidden = false;
      } else if (currentScrollY > previousState.lastScrollY + 0.5) {
        hidden = true;
      } else if (currentScrollY < previousState.lastScrollY - 0.5) {
        hidden = false;
      }

      header.classList.toggle('header--mobile-hidden', hidden);
      mobileStickyHeaderStates.set(header, { lastScrollY: currentScrollY, hidden });
    });
  };

  const getDesktopStickyHeaderTrigger = () => {
    const main = document.querySelector('#MainContent');
    const firstContentSection = main?.querySelector(':scope > .shopify-section')
      || main?.querySelector('.shopify-section');
    if (!firstContentSection) return Number.POSITIVE_INFINITY;
    const sectionTop = firstContentSection.getBoundingClientRect().top + window.scrollY;
    // Begin auto-hiding only once the first content section has fully left the viewport.
    return Math.max(0, sectionTop + firstContentSection.offsetHeight);
  };

  const syncDesktopStickyHeaders = () => {
    if (!window.matchMedia(headerDesktopMediaQuery).matches) {
      document.querySelectorAll('[data-header]').forEach((header) => {
        header.classList.remove('header--desktop-hidden');
        desktopStickyHeaderStates.delete(header);
      });
      return;
    }

    const currentScrollY = window.scrollY;
    document.querySelectorAll('[data-header].header--sticky').forEach((header) => {
      const previousState = desktopStickyHeaderStates.get(header) || {
        lastScrollY: currentScrollY,
        hidden: false
      };
      const hasOpenOverlay = Boolean(header.querySelector(
        '.header__submenu-disclosure[open]:not([data-closing="true"]), .header__actions .header__localization-selector[open]:not([data-closing="true"])'
      ));
      const hasPassedFirstSection = currentScrollY > getDesktopStickyHeaderTrigger();
      let hidden = previousState.hidden;

      if (!hasPassedFirstSection || hasOpenOverlay) {
        hidden = false;
      } else if (currentScrollY > previousState.lastScrollY + 0.5) {
        hidden = true;
      } else if (currentScrollY < previousState.lastScrollY - 0.5) {
        hidden = false;
      }

      header.classList.toggle('header--desktop-hidden', hidden);
      desktopStickyHeaderStates.set(header, { lastScrollY: currentScrollY, hidden });
    });
  };

  const syncResponsiveHeader = (header) => {
    const isFloatingHeader = header.dataset.floatingHeader === 'true';
    const isTransparentHeader = header.dataset.transparentHeader === 'true';
    if (!isFloatingHeader && !isTransparentHeader) return;

    const sectionWrapper = header.parentElement;
    const origin = sectionWrapper
      ? sectionWrapper.getBoundingClientRect().top + window.scrollY
      : header.getBoundingClientRect().top + window.scrollY;
    const isMobile = isMobileHeaderViewport();
    const isStickyTransparentHeader = isTransparentHeader
      && header.classList.contains('header--sticky');
    const scrollThreshold = isTransparentHeader && !isMobile && !isStickyTransparentHeader
      ? desktopTransparentHeaderSurfaceThreshold
      : 1;
    const isScrolled = window.scrollY > origin + scrollThreshold;
    syncResponsiveHeaderScrollState(
      header,
      isScrolled,
      isStickyTransparentHeader
    );

    if (!isTransparentHeader) return;

    // Keep the surface present until the closing panel has completed its own motion.
    // This prevents the transparent header from exposing the hero between the
    // mega menu's opacity and height transitions.
    const hasOpenDesktopOverlay = !isMobile
      && (
        header.classList.contains('header--account-panel-open')
        || Boolean(header.querySelector(
          '.header__submenu-disclosure[open]:not([data-closing="true"]), .header__actions .header__localization-selector[open]:not([data-closing="true"])'
        ))
      );
    const showSurface = isScrolled || hasOpenDesktopOverlay;
    header.classList.toggle('header--surface-visible', showSurface);
    syncTransparentHeaderColorScheme(header, showSurface);
  };

  const syncResponsiveHeaders = () => {
    transparentHeaderFrame = 0;
    syncMobileStickyHeaders();
    syncDesktopStickyHeaders();
    document.querySelectorAll('[data-transparent-header="true"], [data-floating-header="true"]').forEach(syncResponsiveHeader);
    syncDesktopAccountDialogPositions();
  };

  const scheduleResponsiveHeaderSync = () => {
    if (transparentHeaderFrame) return;
    transparentHeaderFrame = window.requestAnimationFrame(syncResponsiveHeaders);
  };

  const initializeResponsiveHeaders = (scope = document) => {
    scope.querySelectorAll?.('[data-transparent-header="true"], [data-floating-header="true"]').forEach((header) => {
      syncResponsiveHeader(header);
    });
    syncMobileStickyHeaders();
    syncDesktopAccountDialogPositions(scope);
  };

  initializeResponsiveHeaders();
  window.addEventListener('scroll', scheduleResponsiveHeaderSync, { passive: true });
  window.addEventListener('resize', () => {
    const isMobile = isMobileHeaderViewport();
    const crossedHeaderBreakpoint = isMobile !== wasMobileHeaderViewport;
    wasMobileHeaderViewport = isMobile;
    scheduleResponsiveHeaderSync();
    if (crossedHeaderBreakpoint) {
      const breakpointFocusTargets = [];
      document.querySelectorAll('[data-header]').forEach((header) => {
        const activeElement = document.activeElement;
        const activeDisclosure = activeElement?.closest?.(
          '.header__submenu-disclosure[open], .header__submenu-nested-disclosure[open], .header__localization-selector[open], [data-header-mobile-drawer][data-open="true"]'
        );
        const rememberedOwner = headerBreakpointFocusContext?.header === header
          ? headerBreakpointFocusContext.owner
          : null;
        const rememberedOwnerIsOpen = rememberedOwner?.matches?.('details')
          ? rememberedOwner.open
          : rememberedOwner?.dataset.open === 'true';
        if ((!activeDisclosure || !header.contains(activeElement)) && !rememberedOwnerIsOpen) return;
        const focusTarget = isMobile
          ? header.querySelector(':scope > .header__inner > .header__menu-disclosure > summary')
          : header.querySelector('.header__submenu-disclosure > summary')
            || Array.from(header.querySelectorAll('.header__navigation a[href], .header__navigation button:not([disabled])'))
              .find((element) => element.getClientRects().length > 0);
        if (focusTarget) breakpointFocusTargets.push(focusTarget);
      });
      document.querySelectorAll('.header__submenu-disclosure, .header__submenu-nested-disclosure').forEach(clearMegaMenuHoverTimer);
      document.querySelectorAll('.header__submenu-disclosure[open], .header__submenu-nested-disclosure[open]').forEach((details) => closeMegaMenu(details, true));
      document.querySelectorAll('.header__localization-selector').forEach(clearLocalizationHoverTimer);
      document.querySelectorAll('.header__localization-selector[open]').forEach((details) => {
        if (desktopMegaMenuMotions.has(details) || details.dataset.megaPanelVisible === 'true') closeMegaMenu(details, true);
        else closeLocalizationSheet(details, false, true);
      });
      document.querySelectorAll('.header__submenu-disclosure').forEach(resetDesktopMegaMenuPresentation);
      document.querySelectorAll('[data-header]').forEach((header) => {
        desktopMegaMenuHandoffs.delete(header);
        resetDesktopMegaMenuBackground(header);
      });
      if (breakpointFocusTargets.length) {
        window.requestAnimationFrame(() => {
          if (breakpointFocusTargets[0].isConnected) focusWithoutScroll(breakpointFocusTargets[0]);
        });
      }
    } else if (!isMobile) {
      document.querySelectorAll('.header__submenu-disclosure[open]:not([data-closing="true"]), .header__localization-selector[open]:not([data-closing="true"])').forEach(syncDesktopMegaMenuPanelHeight);
    }
    document.querySelectorAll('[data-header] > .header__inner > .header__menu-disclosure').forEach((disclosure) => {
      if (crossedHeaderBreakpoint) {
        document.querySelectorAll('.header__localization-selector').forEach((details) => {
          cancelLocalizationSheetOpen(details);
        });
        document.querySelectorAll('.header__localization-selector[open]').forEach((details) => {
          closeLocalizationSheet(details, false, true);
        });
        clearMobileDrawerMotion(disclosure);
        disclosure.open = false;
        const drawer = getMobileDrawer(disclosure);
        if (drawer) drawer.dataset.motionState = 'closed';
      } else if (!isMobile) {
        mobileDrawerMotions.get(disclosure)?.finish();
      }
      syncMobileDrawer(disclosure);
    });
    syncHeaderMenuScrollLock();
  });
  document.addEventListener('shopify:section:load', (event) => initializeResponsiveHeaders(event.target));

  document.addEventListener('focusin', (event) => {
    const header = event.target.closest?.('[data-header]');
    if (!header) {
      headerBreakpointFocusContext = null;
      return;
    }
    const owner = event.target.closest?.(
      '.header__submenu-disclosure[open], .header__submenu-nested-disclosure[open], [data-header-mobile-drawer][data-open="true"]'
    );
    headerBreakpointFocusContext = owner ? { header, owner } : null;
  });

  document.addEventListener('click', (event) => {
    const account = event.target.closest?.('shopify-account.header__action--account');
    if (account) syncDesktopAccountDialogPosition(account);
  }, true);

  const syncAccountPanelHeaderState = (account, isOpen) => {
    const header = account?.closest?.('[data-header]');
    if (!header) return;
    header.classList.toggle('header--account-panel-open', isOpen);
    if (header.dataset.transparentHeader === 'true' || header.dataset.floatingHeader === 'true') {
      scheduleResponsiveHeaderSync();
    }
  };

  document.addEventListener('open', (event) => {
    if (event.target.matches?.('shopify-account.header__action--account')) {
      syncAccountPanelHeaderState(event.target, true);
    }
  }, true);

  document.addEventListener('close', (event) => {
    if (event.target.matches?.('shopify-account.header__action--account')) {
      syncAccountPanelHeaderState(event.target, false);
    }
  }, true);

  const revealHeaderForCartFeedback = (duration = 2200) => {
    document.querySelectorAll('[data-header]').forEach((header) => {
      const existingState = cartFeedbackHeaderStates.get(header);
      window.clearTimeout(existingState?.timer);

      const sectionWrapper = header.parentElement;
      const previousMinHeight = existingState?.previousMinHeight ?? sectionWrapper?.style.minHeight ?? '';
      if (sectionWrapper) {
        sectionWrapper.style.minHeight = `${Math.ceil(header.getBoundingClientRect().height)}px`;
      }

      header.classList.add('header--cart-feedback-visible');
      if (header.dataset.transparentHeader === 'true') {
        header.classList.add('header--surface-visible');
        setTransparentHeaderColorScheme(header, true);
      }

      const timer = window.setTimeout(() => {
        header.classList.remove('header--cart-feedback-visible');
        if (sectionWrapper) sectionWrapper.style.minHeight = previousMinHeight;
        if (header.dataset.transparentHeader === 'true' || header.dataset.floatingHeader === 'true') syncResponsiveHeader(header);
        cartFeedbackHeaderStates.delete(header);
      }, duration);
      cartFeedbackHeaderStates.set(header, { timer, previousMinHeight });
    });
  };

  document.addEventListener('header:reveal-for-cart-feedback', (event) => {
    revealHeaderForCartFeedback(Math.max(0, Number.parseInt(event.detail?.duration, 10) || 2200));
  });

  document.addEventListener('cart:add:success', (event) => {
    if (!event.detail?.button?.closest('[data-product-card]')) return;
    revealHeaderForCartFeedback();
  });

  document.addEventListener('product:add:success', (event) => {
    if (!event.detail?.button?.matches('[data-sticky-cart-add]')) return;
    revealHeaderForCartFeedback();
  });

  const getMegaMenuAnimation = (details) => {
    const header = details.closest('[data-header]');
    const isMegaMenu = details.matches('.header__submenu-disclosure--mega');
    const isTopLevelMenu = details.matches('.header__submenu-disclosure');
    const isNestedMenu = details.matches('.header__submenu-nested-disclosure');
    const isLocalizationSelector = details.matches('.header__localization-selector');
    const isDesktopLocalization = !isMobileHeaderViewport() && isLocalizationSelector;
    const isMobileDrawerMenu = isMobileHeaderViewport() && (isTopLevelMenu || isNestedMenu);
    const mobileMotion = isMobileDrawerMenu ? getMobileNavigationMotion(header) : null;
    const panel = isMegaMenu
      ? details.querySelector('.header__mega-panel')
      : isNestedMenu
        ? details.querySelector(':scope > .header__submenu-nested')
        : isLocalizationSelector
          ? details.querySelector(':scope > .header__localization-popover')
        : details.querySelector(':scope > .header__submenu');
    const type = isMobileDrawerMenu
      ? 'mobile_slide'
      : isNestedMenu
      ? 'cascading_flyout'
      : isTopLevelMenu
        ? 'cascading_root'
        : isDesktopLocalization
          ? 'cascading_root'
        : 'slide_down';
    const configuredDuration = Number.parseInt(header?.dataset.megaMenuAnimationDuration || '300', 10);
    const isDesktopCascadingMenu = !isMobileDrawerMenu && (isTopLevelMenu || isNestedMenu || isDesktopLocalization);
    const duration = isMobileDrawerMenu
      ? mobileMotion.duration
      : isDesktopCascadingMenu
        ? 650
        : configuredDuration;
    const delay = 0;
    const easing = isMobileDrawerMenu
      ? mobileMotion.easing
      : isDesktopCascadingMenu
        ? headerMenuEasing
        : 'cubic-bezier(0.22, 1, 0.36, 1)';
    return { panel, type, duration, delay, easing };
  };

  const getMegaMenuFrames = (type, opening, panel, currentHeightOverride) => {
    let frames;

    if (type === 'mobile_accordion') {
      const expandedHeight = Math.max(panel?.scrollHeight || 0, panel?.getBoundingClientRect().height || 0);
      const currentHeight = Math.max(0, currentHeightOverride ?? panel?.getBoundingClientRect().height ?? expandedHeight);
      const collapsedHeight = Math.max(0, currentHeightOverride ?? 0);
      frames = opening
        ? [
            { height: `${collapsedHeight}px`, opacity: 1, overflow: 'hidden' },
            { height: `${expandedHeight}px`, opacity: 1, overflow: 'hidden' }
          ]
        : [
            { height: `${currentHeight}px`, opacity: 1, overflow: 'hidden' },
            { height: '0px', opacity: 1, overflow: 'hidden' }
          ];
      return frames;
    } else if (type === 'mobile_slide') {
      const slideOffset = getComputedStyle(panel).direction === 'rtl'
        ? 'translateX(-100%)'
        : 'translateX(100%)';
      frames = [{ opacity: 1, transform: slideOffset }, { opacity: 1, transform: 'translateX(0)' }];
    } else if (type === 'cascading_root') {
      frames = [{ opacity: 0, translate: '0 -30px' }, { opacity: 1, translate: '0 0' }];
    } else if (type === 'cascading_flyout') {
      frames = [{ opacity: 0, translate: '0 20px' }, { opacity: 1, translate: '0 0' }];
    } else if (type === 'fade') {
      frames = [{ opacity: 0 }, { opacity: 1 }];
    } else if (type === 'scale') {
      frames = [{ opacity: 0, scale: '0.98' }, { opacity: 1, scale: '1' }];
    } else if (type === 'slide_right') {
      frames = [{ opacity: 0, translate: '-8px 0' }, { opacity: 1, translate: '0 0' }];
    } else {
      frames = [{ opacity: 0, translate: '0 -8px' }, { opacity: 1, translate: '0 0' }];
    }

    return opening ? frames : frames.slice().reverse();
  };

  const usesDesktopMegaMenuCssMotion = (details) => (
    !isMobileHeaderViewport()
    && details.matches('.header__submenu-disclosure, .header__localization-selector')
    && Boolean(details.querySelector(':scope > .header__mega-panel, :scope > .header__submenu, :scope > .header__localization-popover'))
  );

  const getDesktopMegaMenuPanel = (details) => details.querySelector(
    ':scope > .header__mega-panel, :scope > .header__submenu, :scope > .header__localization-popover'
  );

  const getDesktopMegaMenuTransitionDuration = (details) => {
    const header = details?.closest('[data-header]');
    const panel = getDesktopMegaMenuPanel(details);
    const background = header?.querySelector(':scope > .header__mega-background');
    const cssToken = header
      ? getCssTimeMs(getComputedStyle(header).getPropertyValue('--header-mega-menu-transition-duration'))
      : 0;
    return Math.max(
      cssToken,
      getTransitionTotalMs(panel, 'height'),
      getTransitionTotalMs(background, 'height'),
      desktopMegaMenuTransitionDurationFallback
    );
  };

  const resetDesktopMegaMenuBackground = (header) => {
    if (!header) return;
    header.classList.remove('is-menu-open');
    delete header.dataset.megaBackgroundClosing;
    header.style.removeProperty('--header-mega-background-height');
  };

  const measureDesktopMegaMenuPanelHeight = (details) => {
    const panel = getDesktopMegaMenuPanel(details);
    if (!panel) return 0;
    const availableHeight = Math.max(0, document.documentElement.clientHeight - panel.getBoundingClientRect().top);
    return Math.ceil(Math.min(Math.max(0, panel.scrollHeight), availableHeight));
  };

  const syncDesktopMegaMenuBackground = (header, preferredDetails, preferredHeight) => {
    if (!header || isMobileHeaderViewport()) {
      resetDesktopMegaMenuBackground(header);
      return 0;
    }

    const handoff = desktopMegaMenuHandoffs.get(header);
    if (handoff?.fromIsMega && !handoff.toIsMega) {
      // Fade and collapse the shared mega surface with the outgoing panel.
      // Waiting for the compact submenu to finish first leaves a white tail
      // behind the new panel during a fast hover handoff.
      header.dataset.megaBackgroundClosing = 'true';
      const panelHeight = Number.isFinite(handoff.backgroundHeight) && handoff.backgroundHeight > 0
        ? handoff.backgroundHeight
        : measureDesktopMegaMenuPanelHeight(handoff.from);
      header.style.setProperty('--header-mega-background-height', `${panelHeight}px`);
      header.classList.add('is-menu-open');
      return panelHeight;
    }

    // The shared viewport background belongs to mega menus only. A compact
    // submenu never claims it after a mega-to-submenu handoff.
    const preferredIsActive = preferredDetails?.matches('.header__submenu-disclosure--mega')
      && preferredDetails.open
      && preferredDetails.dataset.closing !== 'true';
    const activeDetails = preferredIsActive
      ? preferredDetails
      : header.querySelector('.header__submenu-disclosure--mega[open]:not([data-closing="true"])');
    const closingDetails = header.querySelector('.header__submenu-disclosure--mega[open][data-closing="true"]');

    if (activeDetails) {
      delete header.dataset.megaBackgroundClosing;
      const panelHeight = activeDetails === preferredDetails && Number.isFinite(preferredHeight)
        ? preferredHeight
        : measureDesktopMegaMenuPanelHeight(activeDetails);
      header.style.setProperty('--header-mega-background-height', `${panelHeight}px`);
      header.classList.add('is-menu-open');
      return panelHeight;
    }

    if (closingDetails) {
      const currentBackgroundHeight = Number.parseFloat(
        header.style.getPropertyValue('--header-mega-background-height')
      );
      const panelHeight = Number.isFinite(currentBackgroundHeight) && currentBackgroundHeight > 0
        ? currentBackgroundHeight
        : measureDesktopMegaMenuPanelHeight(closingDetails);
      header.style.setProperty('--header-mega-background-height', `${panelHeight}px`);
      header.classList.add('is-menu-open');
      header.dataset.megaBackgroundClosing = 'true';
      return panelHeight;
    }

    resetDesktopMegaMenuBackground(header);
    return 0;
  };

  const clearDesktopMegaMenuMotion = (details, result = false) => {
    const state = desktopMegaMenuMotions.get(details);
    if (!state) return;
    if (state.frame) window.cancelAnimationFrame(state.frame);
    window.clearTimeout(state.timer);
    window.clearTimeout(state.heightTimer);
    state.panel.removeEventListener('transitionend', state.onTransitionEnd);
    desktopMegaMenuMotions.delete(details);
    state.resolve(result);
  };

  const getDesktopMegaMenuRevealTargets = (details) => {
    const panel = getDesktopMegaMenuPanel(details);
    if (!panel) return [];
    if (details.matches('.header__submenu-disclosure--mega')) {
      return Array.from(panel.querySelectorAll(
        '.header__mega-heading, .header__mega-list, .header__mega-promo'
      ));
    }
    return Array.from(panel.children).filter((element) => (
      !element.matches('.header__mobile-submenu-back-item')
    ));
  };

  const clearDesktopMegaMenuRevealDelays = (details) => {
    getDesktopMegaMenuRevealTargets(details).forEach((element) => {
      element.style.removeProperty('--header-mega-reveal-delay');
    });
  };

  const clearDesktopMegaMenuHeightGuard = (details) => {
    const timer = desktopMegaMenuHeightTimers.get(details);
    if (!timer) return;
    window.clearTimeout(timer);
    desktopMegaMenuHeightTimers.delete(details);
    delete details.dataset.opening;
  };

  const resetDesktopMegaMenuPresentation = (details) => {
    clearDesktopMegaMenuMotion(details);
    clearDesktopMegaMenuHeightGuard(details);
    desktopMegaMenuRevealEnds.delete(details);
    delete details.dataset.opening;
    delete details.dataset.closing;
    delete details.dataset.megaPanelVisible;
    delete details.dataset.megaMenuHandoff;
    const panel = getDesktopMegaMenuPanel(details);
    panel?.style.removeProperty('height');
    panel?.style.removeProperty('--header-mega-panel-height');
    if (panel) panel.inert = false;
    clearDesktopMegaMenuRevealDelays(details);
  };

  const updateDesktopMegaMenuRevealDelays = (details) => {
    const panel = getDesktopMegaMenuPanel(details);
    if (!panel) return;
    const revealStart = getDesktopMegaMenuTransitionDuration(details);
    if (!details.matches('.header__submenu-disclosure--mega')) {
      const items = getDesktopMegaMenuRevealTargets(details);
      items.forEach((item, index) => {
        item.style.setProperty('--header-mega-reveal-delay', `${revealStart + (index * 50)}ms`);
      });
      return items.length ? revealStart + ((items.length - 1) * 50) + 400 : 0;
    }
    const heading = panel.querySelector('.header__mega-heading');
    const columns = Array.from(panel.querySelectorAll('.header__mega-list'));
    const promotions = Array.from(panel.querySelectorAll('.header__mega-promo'));
    heading?.style.setProperty('--header-mega-reveal-delay', `${revealStart}ms`);
    columns.forEach((column, index) => {
      column.style.setProperty('--header-mega-reveal-delay', `${revealStart + (index * 50)}ms`);
    });
    const promotionDelay = Math.max(revealStart + 150, Math.min(revealStart + 200, revealStart + (columns.length * 50)));
    promotions.forEach((promotion, index) => {
      promotion.style.setProperty('--header-mega-reveal-delay', `${Math.min(400, promotionDelay + (index * 50))}ms`);
    });
    const revealDelays = [
      heading ? revealStart : 0,
      ...columns.map((_, index) => revealStart + (index * 50)),
      ...promotions.map((_, index) => Math.min(400, promotionDelay + (index * 50)))
    ];
    return Math.max(0, ...revealDelays) + 400;
  };

  const scheduleDesktopMegaMenuMotionFinish = (state) => {
    window.clearTimeout(state.timer);
    const transitionEndsAt = Math.max(state.heightTransitionEndsAt, state.revealEndsAt);
    const remainingDuration = Math.max(0, transitionEndsAt - performance.now());
    const finishDelay = state.opening ? remainingDuration + 80 : Math.min(remainingDuration, 600) + 80;
    state.timer = window.setTimeout(
      state.finish,
      finishDelay
    );
  };

  const syncDesktopMegaMenuPanelHeight = (details) => {
    const panel = getDesktopMegaMenuPanel(details);
    if (!panel) return 0;
    const panelHeight = measureDesktopMegaMenuPanelHeight(details);
    const heightValue = `${panelHeight}px`;
    const heightChanged = panel.style.getPropertyValue('--header-mega-panel-height') !== heightValue;
    const state = desktopMegaMenuMotions.get(details);
    const guardStableResize = heightChanged
      && !state
      && details.open
      && details.dataset.closing !== 'true'
      && details.dataset.megaPanelVisible === 'true'
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (guardStableResize) details.dataset.opening = 'true';
    panel.style.setProperty('--header-mega-panel-height', heightValue);
    if (details.open && details.dataset.closing !== 'true') {
      syncDesktopMegaMenuBackground(details.closest('[data-header]'), details, panelHeight);
    }
    if (heightChanged && state?.opening) {
      state.heightTransitionEndsAt = performance.now() + getDesktopMegaMenuTransitionDuration(details);
      scheduleDesktopMegaMenuMotionFinish(state);
    } else if (guardStableResize) {
      window.clearTimeout(desktopMegaMenuHeightTimers.get(details));
      desktopMegaMenuHeightTimers.set(details, window.setTimeout(() => {
        desktopMegaMenuHeightTimers.delete(details);
        if (desktopMegaMenuMotions.has(details) || !details.open || details.dataset.closing === 'true') return;
        delete details.dataset.opening;
      }, getDesktopMegaMenuTransitionDuration(details) + 80));
    }
    return panelHeight;
  };

  const runDesktopMegaMenuCssMotion = (details, opening, focusAfterMotion = false, motionOptions = {}) => {
    const panel = getDesktopMegaMenuPanel(details);
    if (!panel) return Promise.resolve(false);

    const transitionDuration = getDesktopMegaMenuTransitionDuration(details);
    const currentHeight = Math.max(0, panel.getBoundingClientRect().height);
    const wasVisible = details.dataset.megaPanelVisible === 'true';
    clearDesktopMegaMenuMotion(details);
    clearDesktopMegaMenuHeightGuard(details);
    panel.style.height = `${currentHeight}px`;
    const header = details.closest('[data-header]');
    const responsiveHeader = details.closest('[data-transparent-header="true"], [data-floating-header="true"]');
    const now = performance.now();
    let revealEndsAt = desktopMegaMenuRevealEnds.get(details) || now;

    if (opening) {
      panel.inert = false;
      details.dataset.opening = 'true';
      delete details.dataset.closing;
      const skipRevealDelay = details.dataset.megaMenuHandoff === 'from-mega';
      if (skipRevealDelay) clearDesktopMegaMenuRevealDelays(details);
      const revealDuration = skipRevealDelay ? 0 : updateDesktopMegaMenuRevealDelays(details);
      if (!wasVisible) {
        revealEndsAt = now + revealDuration;
        desktopMegaMenuRevealEnds.set(details, revealEndsAt);
      }
      const panelHeight = measureDesktopMegaMenuPanelHeight(details);
      panel.style.setProperty('--header-mega-panel-height', `${panelHeight}px`);
      syncDesktopMegaMenuBackground(header, details, panelHeight);
    } else {
      if (panel.contains(document.activeElement)) {
        focusWithoutScroll(details.querySelector(':scope > summary'));
      }
      panel.inert = true;
      details.dataset.closing = 'true';
      delete details.dataset.opening;
      syncDesktopMegaMenuBackground(header);
    }

    panel.getBoundingClientRect();
    syncHeaderDisclosureAria(details);
    syncHeaderMenuScrollLock();
    if (responsiveHeader) syncResponsiveHeader(responsiveHeader);

    let resolveMotion;
    const motionPromise = new Promise((resolve) => { resolveMotion = resolve; });
    let heightTransitionNotified = false;
    const notifyHeightTransition = () => {
      if (heightTransitionNotified) return;
      heightTransitionNotified = true;
      motionOptions.onHeightTransitionEnd?.();
    };
    const finish = () => {
      const state = desktopMegaMenuMotions.get(details);
      if (!state || state.finish !== finish) return;
      if (!opening) notifyHeightTransition();
      clearDesktopMegaMenuMotion(details, true);
      panel.style.removeProperty('height');
      if (opening) {
        delete details.dataset.opening;
        desktopMegaMenuRevealEnds.delete(details);
        syncDesktopMegaMenuPanelHeight(details);
      } else {
        details.open = false;
        delete details.dataset.closing;
        delete details.dataset.megaPanelVisible;
        delete details.dataset.megaMenuHandoff;
        desktopMegaMenuRevealEnds.delete(details);
        panel.style.removeProperty('--header-mega-panel-height');
        clearDesktopMegaMenuRevealDelays(details);
        syncDesktopMegaMenuBackground(header);
      }
      syncHeaderDisclosureAria(details);
      syncHeaderMenuScrollLock();
      if (responsiveHeader) syncResponsiveHeader(responsiveHeader);
      if (!header?.querySelector('.header__submenu-disclosure--mega[open]')) {
        delete header?.dataset.megaSurfaceImmediateClose;
      }
      if (focusAfterMotion) focusWithoutScroll(details.querySelector(':scope > summary'));
      motionOptions.onFinish?.(details, opening);
    };
    const onTransitionEnd = (event) => {
      if (event.target !== panel || event.propertyName !== 'height') return;
      notifyHeightTransition();
      if (!opening) finish();
    };
    const state = {
      panel,
      opening,
      frame: 0,
      timer: 0,
      heightTimer: 0,
      heightTransitionEndsAt: now + transitionDuration,
      revealEndsAt: opening ? revealEndsAt : now + transitionDuration,
      finish,
      onTransitionEnd,
      resolve: resolveMotion
    };
    desktopMegaMenuMotions.set(details, state);
    panel.addEventListener('transitionend', onTransitionEnd);

    state.frame = window.requestAnimationFrame(() => {
      state.frame = 0;
      if (desktopMegaMenuMotions.get(details) !== state) return;
      if (opening) details.dataset.megaPanelVisible = 'true';
      panel.style.removeProperty('height');
      state.heightTransitionEndsAt = performance.now() + transitionDuration;
      state.heightTimer = window.setTimeout(() => {
        if (desktopMegaMenuMotions.get(details) === state) notifyHeightTransition();
      }, transitionDuration + 80);
      scheduleDesktopMegaMenuMotionFinish(state);
    });

    return motionPromise;
  };

  const observeDesktopMegaMenu = (details) => {
    if (!window.ResizeObserver || desktopMegaMenuResizeObservers.has(details)) return;
    const panel = getDesktopMegaMenuPanel(details);
    if (!panel) return;
    const surface = panel.querySelector(':scope > .header__mega-surface');
    const observedElements = [surface || panel];
    if (!surface) observedElements.push(...Array.from(panel.children));
    const observer = new ResizeObserver(() => {
      if (usesDesktopMegaMenuCssMotion(details) && details.open && details.dataset.closing !== 'true') {
        syncDesktopMegaMenuPanelHeight(details);
      }
    });
    observedElements.forEach((element) => observer.observe(element));
    desktopMegaMenuResizeObservers.set(details, observer);
  };

  const initializeDesktopMegaMenuObservers = (scope = document) => {
    scope.querySelectorAll?.('.header__submenu-disclosure, .header__localization-selector').forEach(observeDesktopMegaMenu);
  };

  const disconnectDesktopMegaMenuObserver = (details) => {
    desktopMegaMenuResizeObservers.get(details)?.disconnect();
    desktopMegaMenuResizeObservers.delete(details);
  };

  const runMobileMegaMenuMotion = (details, opening, focusAfterMotion = false) => {
    const { panel, type, duration, delay, easing } = getMegaMenuAnimation(details);
    const summary = details.querySelector(':scope > summary');
    const scroller = details.parentElement?.closest('.header__submenu, .header__mega-panel, .header__submenu-nested, .header__navigation-content')
      || details.closest('.header__navigation-content');
    const savedScroll = {
      left: scroller?.scrollLeft || 0,
      top: scroller?.scrollTop || 0
    };
    const finalizeWithoutMotion = () => {
      delete details.dataset.opening;
      delete details.dataset.closing;
      if (!opening) details.open = false;
      syncHeaderDisclosureAria(details);
      syncHeaderMenuScrollLock();
      const target = opening ? panel?.querySelector('[data-header-mobile-back]') : summary;
      if ((opening || focusAfterMotion) && !details.closest('[data-header-mobile-drawer][data-motion-state="closing"]')) {
        window.queueMicrotask(() => focusWithoutScroll(target, scroller, savedScroll));
      }
    };

    if (!panel || type !== 'mobile_slide' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finalizeWithoutMotion();
      return Promise.resolve(true);
    }

    let state = mobileMegaMenuMotions.get(details);
    if (!state || state.panel !== panel || state.animation.playState === 'idle') {
      state?.animation.cancel();
      const animation = panel.animate(getMegaMenuFrames(type, true, panel), {
        duration,
        delay,
        easing,
        fill: 'both'
      });
      animation.pause();
      state = {
        animation,
        panel,
        revision: 0,
        desiredOpen: opening,
        scroller,
        savedScroll
      };
      mobileMegaMenuMotions.set(details, state);
      animation.currentTime = opening ? 0 : duration;
    }

    state.revision += 1;
    state.desiredOpen = opening;
    state.scroller = scroller;
    state.savedScroll = savedScroll;
    const revision = state.revision;
    if (opening) {
      details.dataset.opening = 'true';
      delete details.dataset.closing;
    } else {
      details.dataset.closing = 'true';
      delete details.dataset.opening;
    }
    syncHeaderDisclosureAria(details);
    syncHeaderMenuScrollLock();
    state.animation.playbackRate = opening ? 1 : -1;
    state.animation.play();

    return state.animation.finished
      .then(() => {
        const currentState = mobileMegaMenuMotions.get(details);
        if (currentState !== state || state.revision !== revision || state.desiredOpen !== opening) return false;
        delete details.dataset.opening;
        delete details.dataset.closing;
        if (opening) {
          syncHeaderDisclosureAria(details);
          syncHeaderMenuScrollLock();
          if (focusAfterMotion && !details.closest('[data-header-mobile-drawer][data-motion-state="closing"]')) {
            focusWithoutScroll(panel.querySelector('[data-header-mobile-back]'), state.scroller, state.savedScroll);
          }
          return true;
        }

        details.open = false;
        syncHeaderDisclosureAria(details);
        syncHeaderMenuScrollLock();
        state.animation.cancel();
        mobileMegaMenuMotions.delete(details);
        if (focusAfterMotion && !details.closest('[data-header-mobile-drawer][data-motion-state="closing"]')) {
          focusWithoutScroll(summary, state.scroller, state.savedScroll);
        }
        return true;
      })
      .catch(() => false);
  };

  const animateMegaMenuOpen = (details, focusAfterMotion = false, motionOptions = {}) => {
    if (usesDesktopMegaMenuCssMotion(details)) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        clearDesktopMegaMenuMotion(details);
        clearDesktopMegaMenuHeightGuard(details);
        const panel = getDesktopMegaMenuPanel(details);
        if (panel) {
          panel.inert = false;
          panel.style.removeProperty('height');
        }
        updateDesktopMegaMenuRevealDelays(details);
        const panelHeight = syncDesktopMegaMenuPanelHeight(details);
        details.dataset.megaPanelVisible = 'true';
        delete details.dataset.opening;
        delete details.dataset.closing;
        syncDesktopMegaMenuBackground(details.closest('[data-header]'), details, panelHeight);
        syncHeaderDisclosureAria(details);
        syncHeaderMenuScrollLock();
        motionOptions.onHeightTransitionEnd?.();
        motionOptions.onFinish?.(details, true);
        return Promise.resolve(true);
      }
      return runDesktopMegaMenuCssMotion(details, true, focusAfterMotion, motionOptions);
    }

    const { panel, type, duration, delay, easing } = getMegaMenuAnimation(details);
    if (type === 'mobile_slide') return runMobileMegaMenuMotion(details, true, focusAfterMotion);

    if (disableLegacyMegaMenuWebAnimations) {
      megaMenuAnimations.get(details)?.cancel();
      megaMenuAnimations.delete(details);
      mobileMegaMenuMotions.get(details)?.animation.cancel();
      mobileMegaMenuMotions.delete(details);
      delete details.dataset.opening;
      delete details.dataset.closing;
      syncHeaderDisclosureAria(details);
      syncHeaderMenuScrollLock();
      return Promise.resolve(false);
    }

    if (!panel || type === 'none' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve(false);

    const existingAnimation = megaMenuAnimations.get(details);
    const currentHeight = existingAnimation && type === 'mobile_accordion'
      ? panel.getBoundingClientRect().height
      : undefined;
    existingAnimation?.cancel();
    const animation = panel.animate(getMegaMenuFrames(type, true, panel, currentHeight), {
      duration,
      delay,
      easing,
      fill: 'both'
    });
    megaMenuAnimations.set(details, animation);
    return animation.finished
      .then(() => {
        if (megaMenuAnimations.get(details) !== animation) return false;
        megaMenuAnimations.delete(details);
        delete details.dataset.opening;
        animation.cancel();
        return true;
      })
      .catch(() => false);
  };

  const closeMegaMenu = (details, immediate = false, focusAfterMotion = false, motionOptions = {}) => {
    if (!details.open || (!immediate && details.dataset.closing === 'true')) return;

    const header = details.closest('[data-header]');
    if (usesDesktopMegaMenuCssMotion(details) && !motionOptions.handoff) {
      const handoff = header && desktopMegaMenuHandoffs.get(header);
      if (handoff && (handoff.from === details || handoff.to === details)) desktopMegaMenuHandoffs.delete(header);
    }

    const { panel, type, duration, easing } = getMegaMenuAnimation(details);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const currentHeight = type === 'mobile_accordion' ? panel?.getBoundingClientRect().height : undefined;

    if (details.matches('.header__submenu-disclosure')) {
      details.querySelectorAll('.header__submenu-nested-disclosure[open]').forEach((nestedDetails) => {
        closeMegaMenu(nestedDetails, true);
      });
    }

    if (usesDesktopMegaMenuCssMotion(details)) {
      if (immediate || reduceMotion) {
        const header = details.closest('[data-header]');
        const desktopPanel = getDesktopMegaMenuPanel(details);
        if (desktopPanel?.contains(document.activeElement)) {
          focusWithoutScroll(details.querySelector(':scope > summary'));
        }
        resetDesktopMegaMenuPresentation(details);
        details.open = false;
        syncDesktopMegaMenuBackground(header);
        syncHeaderDisclosureAria(details);
        syncHeaderMenuScrollLock();
        if (details.closest('[data-transparent-header="true"], [data-floating-header="true"]')) scheduleResponsiveHeaderSync();
        if (focusAfterMotion) focusWithoutScroll(details.querySelector(':scope > summary'));
        return;
      }
      return runDesktopMegaMenuCssMotion(details, false, focusAfterMotion, motionOptions);
    }

    if (!immediate && type === 'mobile_slide') return runMobileMegaMenuMotion(details, false, focusAfterMotion);

    if (immediate || disableLegacyMegaMenuWebAnimations || !panel || type === 'none' || reduceMotion) {
      resetDesktopMegaMenuPresentation(details);
      megaMenuAnimations.get(details)?.cancel();
      megaMenuAnimations.delete(details);
      mobileMegaMenuMotions.get(details)?.animation.cancel();
      mobileMegaMenuMotions.delete(details);
      delete details.dataset.opening;
      delete details.dataset.closing;
      details.open = false;
      syncHeaderDisclosureAria(details);
      syncHeaderMenuScrollLock();
      if (focusAfterMotion) focusWithoutScroll(details.querySelector(':scope > summary'));
      return;
    }

    megaMenuAnimations.get(details)?.cancel();
    details.dataset.closing = 'true';
    syncHeaderDisclosureAria(details);
    syncHeaderMenuScrollLock();
    if (!isMobileHeaderViewport()) {
      const responsiveHeader = details.closest('[data-transparent-header="true"]');
      if (responsiveHeader) syncResponsiveHeader(responsiveHeader);
    }
    const animation = panel.animate(getMegaMenuFrames(type, false, panel, currentHeight), {
      duration,
      easing,
      fill: 'both'
    });
    megaMenuAnimations.set(details, animation);
    animation.finished
      .then(() => {
        if (megaMenuAnimations.get(details) !== animation) return;
        megaMenuAnimations.delete(details);
        delete details.dataset.closing;
        delete details.dataset.opening;
        details.open = false;
        syncHeaderDisclosureAria(details);
        syncHeaderMenuScrollLock();
        animation.cancel();
        if (focusAfterMotion) focusWithoutScroll(details.querySelector(':scope > summary'));
      })
      .catch(() => {});
  };

  const supportsDesktopHeaderHover = () => window.matchMedia(`${headerDesktopMediaQuery} and (hover: hover) and (pointer: fine)`).matches;
  const shouldAnimateHeaderSubmenu = (details) => details.matches(
    '.header__submenu-disclosure, .header__submenu-nested-disclosure'
  );

  const syncHeaderDisclosureAria = (details) => {
    if (details.matches?.('.header__localization-selector')) {
      syncHeaderLocalizationAria(details);
      return;
    }
    const summary = details.querySelector(':scope > summary[aria-controls]');
    if (!summary) return;
    const isOpen = details.open && !(usesDesktopMegaMenuCssMotion(details) && details.dataset.closing === 'true');
    summary.setAttribute('aria-expanded', String(isOpen));
    const stateLabel = isOpen ? summary.dataset.closeLabel : summary.dataset.openLabel;
    if (stateLabel) summary.setAttribute('aria-label', stateLabel);
  };

  const syncHeaderLocalizationAria = (details) => {
    const summary = details.querySelector(':scope > summary');
    if (!summary) return;
    const isOpen = (
      details.open
      && details.dataset.motionState !== 'closing'
      && details.dataset.closing !== 'true'
    );
    summary.setAttribute('aria-expanded', String(isOpen));
    const sheet = details.querySelector('.header__localization-sheet');
    if (!sheet) return;
    if (isMobileHeaderViewport() && isOpen) {
      sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-modal', 'true');
    } else {
      sheet.removeAttribute('role');
      sheet.removeAttribute('aria-modal');
    }
  };

  const clearLocalizationHoverTimer = (details) => {
    const timer = localizationHoverTimers.get(details);
    if (timer) window.clearTimeout(timer);
    localizationHoverTimers.delete(details);
  };

  const closeHeaderLocalization = (details) => {
    clearLocalizationHoverTimer(details);
    if (!details?.open) return;
    if (usesDesktopMegaMenuCssMotion(details)) {
      closeMegaMenu(details);
      return;
    }
    details.open = false;
    syncHeaderLocalizationAria(details);
    if (details.closest('[data-transparent-header="true"], [data-floating-header="true"]')) {
      scheduleResponsiveHeaderSync();
    }
  };

  const scheduleHeaderLocalizationClose = (details) => {
    clearLocalizationHoverTimer(details);
    localizationHoverTimers.set(details, window.setTimeout(() => {
      localizationHoverTimers.delete(details);
      if (details.matches(':hover') || details.querySelector(':focus-visible')) return;
      closeHeaderLocalization(details);
    }, headerLocalizationHoverCloseDelay));
  };

  const openHeaderLocalization = (details) => {
    clearLocalizationHoverTimer(details);
    const isDesktopMotion = usesDesktopMegaMenuCssMotion(details);
    if (isDesktopMotion) {
      closeOtherHeaderSubmenus(details);
      closeDesktopMenusInOtherHeaders(details);
    }
    if (details.open) {
      if (!isDesktopMotion || details.dataset.closing !== 'true') return;
      positionHeaderSubmenu(details);
      const responsiveHeader = details.closest('[data-transparent-header="true"]');
      if (responsiveHeader && !isMobileHeaderViewport()) {
        responsiveHeader.classList.add('header--surface-visible');
        setTransparentHeaderColorScheme(responsiveHeader, true);
      }
      animateMegaMenuOpen(details);
      scheduleResponsiveHeaderSync();
      return;
    }

    document.querySelectorAll('[data-header] .header__localization-selector[open]').forEach((otherDetails) => {
      if (otherDetails !== details) closeHeaderLocalization(otherDetails);
    });

    positionHeaderSubmenu(details);
    const responsiveHeader = details.closest('[data-transparent-header="true"]');
    if (responsiveHeader && !isMobileHeaderViewport()) {
      responsiveHeader.classList.add('header--surface-visible');
      setTransparentHeaderColorScheme(responsiveHeader, true);
    }
    details.dataset.opening = 'true';
    details.open = true;
    syncHeaderDisclosureAria(details);
    if (isDesktopMotion) animateMegaMenuOpen(details);
    scheduleResponsiveHeaderSync();
  };

  const initializeLocalizationOptions = (scope = document) => {
    scope.querySelectorAll?.('.header__localization-options').forEach((listbox) => {
      const options = Array.from(listbox.querySelectorAll('[role="option"]'));
      const selected = options.find((option) => option.getAttribute('aria-selected') === 'true') || options[0];
      options.forEach((option) => { option.tabIndex = option === selected ? 0 : -1; });
    });
  };

  const initializeLocalizationBackdropInteractions = (scope = document) => {
    if (!window.SpinelModalBackdropPointer) return;

    scope.querySelectorAll?.('.header__localization-selector').forEach((details) => {
      if (localizationBackdropInteractions.has(details)) return;
      const popover = details.querySelector(':scope > [data-header-localization-popover]');
      const sheet = popover?.querySelector('.header__localization-sheet');
      const pointer = popover?.querySelector('.header__localization-backdrop-pointer');
      if (!popover || !sheet || !pointer) return;

      localizationBackdropInteractions.set(details, new window.SpinelModalBackdropPointer({
        root: popover,
        panel: sheet,
        pointer,
        isOpen: () => details.open && details.dataset.motionState !== 'closing',
        relativeToRoot: true,
        isDisabled: () => !isMobileHeaderViewport(),
      }));
    });
  };

  const initializeHeaderDisclosures = (scope = document) => {
    scope.querySelectorAll?.('.header__submenu-disclosure, .header__submenu-nested-disclosure').forEach(syncHeaderDisclosureAria);
    scope.querySelectorAll?.('.header__localization-selector').forEach(syncHeaderLocalizationAria);
    initializeLocalizationOptions(scope);
    initializeLocalizationBackdropInteractions(scope);
  };

  const clearMegaMenuHoverTimer = (details) => {
    const timer = megaMenuHoverTimers.get(details);
    if (timer) window.clearTimeout(timer);
    megaMenuHoverTimers.delete(details);
  };

  const getOpenHoverMenus = (header) => header?.querySelectorAll(
    '.header__submenu-disclosure--hover[open]'
  ) || [];

  const closeOtherTopLevelHoverMenus = (menuItem) => {
    const header = menuItem.closest('[data-header]');
    const activeMenu = menuItem.querySelector(':scope > .header__submenu-disclosure--hover');
    if (activeMenu) return;
    if (header?.querySelector('.header__submenu-disclosure--mega[open]')) {
      header.dataset.megaSurfaceImmediateClose = 'true';
    }
    getOpenHoverMenus(header).forEach((openMenu) => {
      scheduleMegaMenuClose(openMenu, desktopMegaMenuHoverCloseDelay);
    });
  };

  const scheduleMegaMenuClose = (details, delay) => {
    const closeDelay = delay ?? (details.matches('.header__submenu-disclosure')
      ? desktopMegaMenuHoverCloseDelay
      : headerHoverCloseDelay);
    clearMegaMenuHoverTimer(details);
    megaMenuHoverTimers.set(details, window.setTimeout(() => {
      megaMenuHoverTimers.delete(details);
      if (details.matches(':hover') || details.querySelector(':focus-visible')) return;
      closeMegaMenu(details);
    }, closeDelay));
  };

  const positionHeaderSubmenu = (details) => {
    const isCompactDesktopDropdown = details.matches(
      '.header__submenu-disclosure:not(.header__submenu-disclosure--mega), .header__localization-selector'
    );
    if (!isCompactDesktopDropdown || window.matchMedia(headerMobileMediaQuery).matches) {
      details.style.removeProperty('--header-submenu-top');
      return;
    }

    const header = details.closest('[data-header]');
    if (!header) return;
    const headerRect = header.getBoundingClientRect();
    const detailsRect = details.getBoundingClientRect();
    details.style.setProperty('--header-submenu-top', `${Math.max(0, headerRect.bottom - detailsRect.top)}px`);
  };

  const positionNestedHeaderSubmenu = (details) => {
    if (!details.matches('.header__submenu-nested-disclosure') || window.matchMedia(headerMobileMediaQuery).matches) {
      delete details.dataset.flyoutReverse;
      return;
    }

    delete details.dataset.flyoutReverse;
    const panel = details.querySelector(':scope > .header__submenu-nested');
    if (!panel) return;
    const panelRect = panel.getBoundingClientRect();
    const isRtl = getComputedStyle(details).direction === 'rtl';
    const overflowsInlineEnd = isRtl ? panelRect.left < 20 : panelRect.right > window.innerWidth - 20;
    if (overflowsInlineEnd) details.dataset.flyoutReverse = 'true';
  };

  const closeOtherHeaderSubmenus = (details, closeImmediately = false) => {
    const header = details.closest('[data-header]');
    const openMenus = details.matches('.header__submenu-nested-disclosure')
      ? details.closest('.header__submenu-disclosure')?.querySelectorAll('.header__submenu-nested-disclosure[open]')
      : header?.querySelectorAll('.header__submenu-disclosure[open]');

    openMenus?.forEach((menu) => {
      if (menu === details) return;
      if (shouldAnimateHeaderSubmenu(menu)) closeMegaMenu(menu, closeImmediately || isMobileHeaderViewport());
      else menu.open = false;
    });
  };

  const closeDesktopMenusInOtherHeaders = (details) => {
    const activeHeader = details.closest('[data-header]');
    document.querySelectorAll('[data-header]').forEach((header) => {
      if (header === activeHeader) return;
      header.querySelectorAll('.header__submenu-disclosure[open]').forEach((menu) => closeMegaMenu(menu));
    });
  };

  const getDesktopTopLevelMenuHandoff = (details) => {
    if (isMobileHeaderViewport() || !details.matches('.header__submenu-disclosure')) return null;
    const header = details.closest('[data-header]');
    if (!header) return null;

    const openMenus = Array.from(header.querySelectorAll('.header__submenu-disclosure[open]'))
      .filter((menu) => menu !== details);
    const from = openMenus.find((menu) => menu.dataset.closing !== 'true') || openMenus[0];
    if (!from || !usesDesktopMegaMenuCssMotion(from)) return null;

    const fromIsMega = from.matches('.header__submenu-disclosure--mega');
    const toIsMega = details.matches('.header__submenu-disclosure--mega');
    if (fromIsMega === toIsMega) return null;
    return { from, fromIsMega, toIsMega };
  };

  const runDesktopTopLevelMenuHandoff = (details, handoff, focusAfterMotion = false) => {
    const header = details.closest('[data-header]');
    if (!header) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animateMegaMenuOpen(details, focusAfterMotion);
      closeMegaMenu(handoff.from, false, false);
      return;
    }

    const currentBackgroundHeight = Number.parseFloat(
      header.style.getPropertyValue('--header-mega-background-height')
    );
    const fromPanel = getDesktopMegaMenuPanel(handoff.from);
    const backgroundHeight = Number.isFinite(currentBackgroundHeight) && currentBackgroundHeight > 0
      ? currentBackgroundHeight
      : Math.max(0, Math.ceil(fromPanel?.getBoundingClientRect().height || 0));
    const handoffState = {
      from: handoff.from,
      to: details,
      fromIsMega: handoff.fromIsMega,
      toIsMega: handoff.toIsMega,
      backgroundHeight,
      sourceFinished: false,
      targetHeightFinished: false
    };
    if (handoff.fromIsMega && !handoff.toIsMega) {
      details.dataset.megaMenuHandoff = 'from-mega';
    }
    desktopMegaMenuHandoffs.set(header, handoffState);

    const finishHandoff = () => {
      if (desktopMegaMenuHandoffs.get(header) !== handoffState) return;
      if (!handoffState.sourceFinished || !handoffState.targetHeightFinished) return;
      desktopMegaMenuHandoffs.delete(header);
      if (handoffState.fromIsMega && !handoffState.toIsMega) {
        resetDesktopMegaMenuBackground(header);
      } else {
        syncDesktopMegaMenuBackground(header, details);
      }
    };

    animateMegaMenuOpen(details, focusAfterMotion, {
      onHeightTransitionEnd: () => {
        handoffState.targetHeightFinished = true;
        finishHandoff();
      }
    });
    closeMegaMenu(handoff.from, false, false, {
      handoff: handoffState,
      onFinish: () => {
        handoffState.sourceFinished = true;
        finishHandoff();
      }
    });
  };

  const openHeaderSubmenu = (details) => {
    clearMegaMenuHoverTimer(details);
    const isDesktopAnimatedMenu = usesDesktopMegaMenuCssMotion(details);
    const isDesktopTopLevelMenu = !isMobileHeaderViewport() && details.matches('.header__submenu-disclosure');
    const header = details.closest('[data-header]');
    if (isDesktopTopLevelMenu) {
      document.querySelectorAll('[data-header] .header__actions .header__localization-selector[open]')
        .forEach(closeHeaderLocalization);
    }
    if (header) delete header.dataset.megaSurfaceImmediateClose;
    const activeHandoff = header && desktopMegaMenuHandoffs.get(header);
    if (activeHandoff && activeHandoff.to !== details) {
      desktopMegaMenuHandoffs.delete(header);
    }

    if (details.open) {
      if (details.dataset.closing !== 'true') return;
      if (!isMobileHeaderViewport()) {
        const responsiveHeader = details.closest('[data-transparent-header="true"]');
        if (responsiveHeader) {
          responsiveHeader.classList.add('header--surface-visible');
          setTransparentHeaderColorScheme(responsiveHeader, true);
        }
      }
      animateMegaMenuOpen(details, isMobileHeaderViewport());
      if (isDesktopAnimatedMenu) {
        closeOtherHeaderSubmenus(details);
      }
      if (isDesktopTopLevelMenu) closeDesktopMenusInOtherHeaders(details);
      return;
    }

    if (!isDesktopAnimatedMenu) {
      closeOtherHeaderSubmenus(
        details,
        supportsDesktopHeaderHover() && details.matches('.header__submenu-disclosure--hover')
      );
    }
    const desktopHandoff = isDesktopTopLevelMenu ? getDesktopTopLevelMenuHandoff(details) : null;
    positionHeaderSubmenu(details);
    const responsiveHeader = details.closest('[data-transparent-header="true"], [data-floating-header="true"]');
    if (responsiveHeader?.dataset.transparentHeader === 'true' && !isMobileHeaderViewport()) {
      responsiveHeader.classList.add('header--surface-visible');
      setTransparentHeaderColorScheme(responsiveHeader, true);
    }
    details.dataset.opening = 'true';
    details.open = true;
    if (details.contains(document.activeElement)) {
      headerBreakpointFocusContext = { header: details.closest('[data-header]'), owner: details };
    }
    syncHeaderDisclosureAria(details);
    positionNestedHeaderSubmenu(details);
    syncHeaderMenuScrollLock();
    if (responsiveHeader) {
      scheduleResponsiveHeaderSync();
    }
    if (desktopHandoff) runDesktopTopLevelMenuHandoff(details, desktopHandoff, isMobileHeaderViewport());
    else animateMegaMenuOpen(details, isMobileHeaderViewport());
    if (isDesktopAnimatedMenu) {
      closeOtherHeaderSubmenus(details);
    }
    if (isDesktopTopLevelMenu) closeDesktopMenusInOtherHeaders(details);
  };

  window.addEventListener('resize', () => {
    document.querySelectorAll('.header__submenu-disclosure[open], .header__localization-selector[open]').forEach(positionHeaderSubmenu);
    document.querySelectorAll('.header__submenu-nested-disclosure[open]').forEach(positionNestedHeaderSubmenu);
  });

  document.addEventListener('pointerover', (event) => {
    if (!supportsDesktopHeaderHover()) return;

    const localization = event.target.closest?.('.header__localization-selector--hover');
    if (localization && !localization.contains(event.relatedTarget)) {
      openHeaderLocalization(localization);
      return;
    }

    const overlay = event.target.closest?.('.header__menu-overlay--desktop[data-header-menu-overlay]');
    if (overlay) {
      const header = document.getElementById(overlay.dataset.headerMenuOverlay);
      getOpenHoverMenus(header).forEach((openDetails) => scheduleMegaMenuClose(openDetails));
      return;
    }

    const topLevelMenuItem = event.target.closest?.('.header__menu > .header__menu-item');
    if (topLevelMenuItem && !topLevelMenuItem.contains(event.relatedTarget)) {
      closeOtherTopLevelHoverMenus(topLevelMenuItem);
    }

    const nestedDetails = event.target.closest?.('.header__submenu-disclosure:not(.header__submenu-disclosure--mega) .header__submenu-nested-disclosure');
    if (nestedDetails && !nestedDetails.contains(event.relatedTarget)) {
      clearMegaMenuHoverTimer(nestedDetails);
      megaMenuHoverTimers.set(nestedDetails, window.setTimeout(() => openHeaderSubmenu(nestedDetails), 120));
      return;
    }

    const details = event.target.closest?.('.header__submenu-disclosure--hover');
    if (!details || details.contains(event.relatedTarget)) return;

    openHeaderSubmenu(details);
  });

  document.addEventListener('pointerout', (event) => {
    if (!supportsDesktopHeaderHover()) return;

    const localization = event.target.closest?.('.header__localization-selector--hover');
    if (localization) {
      if (localization.contains(event.relatedTarget)) return;
      scheduleHeaderLocalizationClose(localization);
      return;
    }

    const nestedDetails = event.target.closest?.('.header__submenu-disclosure:not(.header__submenu-disclosure--mega) .header__submenu-nested-disclosure');
    if (nestedDetails && !nestedDetails.contains(event.relatedTarget)) {
      clearMegaMenuHoverTimer(nestedDetails);
      megaMenuHoverTimers.set(nestedDetails, window.setTimeout(() => closeMegaMenu(nestedDetails), headerHoverCloseDelay));
      const parentDetails = nestedDetails.closest('.header__submenu-disclosure--hover');
      if (parentDetails && !parentDetails.contains(event.relatedTarget)) scheduleMegaMenuClose(parentDetails);
      return;
    }

    const details = event.target.closest?.('.header__submenu-disclosure--hover');
    if (details) {
      const menuItem = details.closest('.header__menu-item--has-children');
      if (details.contains(event.relatedTarget) || menuItem?.contains(event.relatedTarget)) return;

      scheduleMegaMenuClose(details);
      return;
    }

    const header = event.target.closest?.('[data-header]');
    if (!header || header.contains(event.relatedTarget)) return;

    getOpenHoverMenus(header).forEach((openDetails) => scheduleMegaMenuClose(openDetails));
  });

  document.addEventListener('focusout', (event) => {
    if (!supportsDesktopHeaderHover()) return;
    const localization = event.target.closest?.('.header__localization-selector--hover[open]');
    if (localization && !localization.contains(event.relatedTarget) && !localization.matches(':hover')) {
      scheduleHeaderLocalizationClose(localization);
      return;
    }
    const details = event.target.closest?.('.header__submenu-disclosure--hover[open]');
    if (!details || details.contains(event.relatedTarget) || details.matches(':hover')) return;
    scheduleMegaMenuClose(details);
  });

  document.addEventListener(
    'toggle',
    (event) => {
      const details = event.target;
      if (details.matches?.('.header__menu-disclosure')) {
        const toggle = details.querySelector(':scope > .header__menu-toggle');
        if (toggle) {
          toggle.setAttribute('aria-label', details.open ? details.dataset.closeLabel : details.dataset.openLabel);
          toggle.setAttribute('aria-expanded', String(details.open));
        }
        syncMobileDrawer(details, details.open && isMobileHeaderViewport());
      }

      if (details.matches?.('.header__menu-disclosure, .header__submenu-disclosure, .header__submenu-nested-disclosure')) {
        syncHeaderMenuScrollLock();
      }

      if (details.matches?.('.header__localization-selector')) {
        if (details.open && isMobileHeaderViewport() && !isLocalizationSheetReady(details)) {
          localizationSheetFinalizing.add(details);
          details.open = false;
          openLocalizationSheet(details);
          return;
        }

        if (!details.open) {
          if (localizationSheetFinalizing.has(details)) {
            localizationSheetFinalizing.delete(details);
          } else if (isMobileHeaderViewport()) {
            details.open = true;
            closeLocalizationSheet(details);
            return;
          }
        }
      }

      if (details.open && details.matches?.('.header__localization-selector')) {
        const mobileUtilities = details.closest?.('.header__mobile-utilities');
        if (mobileUtilities) {
          mobileUtilities.querySelectorAll('.header__localization-selector[open]').forEach((otherDetails) => {
            if (otherDetails !== details) closeLocalizationSheet(otherDetails, false, true);
          });
        }
      }

      if (details.matches?.('.header__localization-selector')) {
        syncHeaderLocalizationAria(details);
        if (!isMobileHeaderViewport() && details.closest('[data-transparent-header="true"]')) {
          scheduleResponsiveHeaderSync();
        }
        if (!isMobileHeaderViewport() && usesDesktopMegaMenuCssMotion(details)) {
          positionHeaderSubmenu(details);
          if (details.open && details.dataset.opening !== 'true' && details.dataset.closing !== 'true') {
            animateMegaMenuOpen(details);
          }
        }
      }

      if (details.matches?.('.header__submenu-disclosure, .header__submenu-nested-disclosure')) {
        syncHeaderDisclosureAria(details);
      }

      if (details.closest?.('[data-transparent-header="true"], [data-floating-header="true"]')) scheduleResponsiveHeaderSync();

      if (!details.matches?.('.header__submenu-disclosure[open], .header__submenu-nested-disclosure[open]')) return;

      positionHeaderSubmenu(details);
      positionNestedHeaderSubmenu(details);
      closeOtherHeaderSubmenus(details);

      if (details.dataset.opening === 'true' || details.dataset.closing === 'true' || mobileMegaMenuMotions.has(details)) return;
      if (shouldAnimateHeaderSubmenu(details)) animateMegaMenuOpen(details);
    },
    true
  );

  document.addEventListener('click', (event) => {
    const mobileCloseButton = event.target.closest?.('[data-header-mobile-close]');
    if (mobileCloseButton) {
      closeMobileMenu(mobileCloseButton.closest('[data-header]')?.querySelector('.header__menu-disclosure[open]'));
      return;
    }

    const localizationCloseButton = event.target.closest?.('[data-header-localization-close]');
    if (localizationCloseButton && isMobileHeaderViewport()) {
      const details = localizationCloseButton.closest('.header__localization-selector');
      if (details) closeLocalizationSheet(details);
      return;
    }

    const mobileBackButton = event.target.closest?.('[data-header-mobile-back]');
    if (mobileBackButton && isMobileHeaderViewport()) {
      const details = mobileBackButton.closest('.header__submenu-nested-disclosure, .header__submenu-disclosure');
      if (details) {
        closeMegaMenu(details, false, true);
      }
      return;
    }

    const overlay = event.target.closest?.('[data-header-menu-overlay]');
    if (overlay) {
      const header = document.getElementById(overlay.dataset.headerMenuOverlay);
      const mobileDrawer = header?.querySelector('.header__menu-disclosure[open]');
      if (mobileDrawer && isMobileHeaderViewport()) {
        closeMobileMenu(mobileDrawer);
        return;
      }
      header?.querySelectorAll('.header__submenu-disclosure[open], .header__submenu-nested-disclosure[open]').forEach((details) => {
        closeMegaMenu(details);
      });
      return;
    }

    const summary = event.target.closest?.('summary');
    const submenu = summary?.parentElement;
    if (submenu?.matches('.header__localization-selector')) {
      event.preventDefault();
      if (isMobileHeaderViewport()) {
        if (submenu.open || localizationSheetOpenRequests.has(submenu)) closeLocalizationSheet(submenu);
        else openLocalizationSheet(submenu);
      } else if (submenu.matches('.header__localization-selector--hover') && supportsDesktopHeaderHover()) {
        if (submenu.open) closeHeaderLocalization(submenu);
        else openHeaderLocalization(submenu);
      } else {
        if (submenu.open) closeHeaderLocalization(submenu);
        else openHeaderLocalization(submenu);
      }
      return;
    }

    if (submenu?.matches('.header__submenu-disclosure--hover') && supportsDesktopHeaderHover()) {
      event.preventDefault();
      if (submenu.open) closeMegaMenu(submenu);
      else openHeaderSubmenu(submenu);
      return;
    }

    if (submenu?.matches('.header__submenu-disclosure, .header__submenu-nested-disclosure') && shouldAnimateHeaderSubmenu(submenu)) {
      event.preventDefault();
      if (submenu.open) closeMegaMenu(submenu);
      else openHeaderSubmenu(submenu);
      return;
    }

    if (isMobileHeaderViewport() && event.target.closest?.('[data-header-mobile-drawer]')) return;

    document.querySelectorAll('[data-header]').forEach((header) => {
      const activeDisclosure = event.target.closest?.('.header__submenu-disclosure[open], .header__submenu-nested-disclosure[open], .header__localization-selector[open]');
      if (activeDisclosure?.closest('[data-header]') === header) return;
      header.querySelectorAll('details[open]').forEach((details) => {
        if (details.matches('.header__submenu-disclosure, .header__submenu-nested-disclosure') && shouldAnimateHeaderSubmenu(details)) {
          closeMegaMenu(details);
        } else if (details.matches('.header__localization-selector') && isMobileHeaderViewport()) {
          closeLocalizationSheet(details);
        } else if (details.matches('.header__localization-selector')) {
          closeHeaderLocalization(details);
        } else {
          details.open = false;
        }
      });
    });
  });

  if ('PointerEvent' in window) {
    document.addEventListener('pointerdown', startLocalizationSheetDrag);
    document.addEventListener('pointermove', moveLocalizationSheetDrag, { passive: false });
    document.addEventListener('pointerup', endLocalizationSheetDrag);
    document.addEventListener('pointercancel', (event) => endLocalizationSheetDrag(event, true));
  } else {
    document.addEventListener('touchstart', (event) => localizationSheetTouchEvent(event, startLocalizationSheetDrag), { passive: false });
    document.addEventListener('touchmove', (event) => localizationSheetTouchEvent(event, moveLocalizationSheetDrag), { passive: false });
    document.addEventListener('touchend', (event) => localizationSheetTouchEvent(event, endLocalizationSheetDrag));
    document.addEventListener('touchcancel', (event) => localizationSheetTouchEvent(event, endLocalizationSheetDrag, true));
  }

  document.addEventListener('keydown', (event) => {
    const localizationOption = event.target.closest?.('.header__localization-options [role="option"]');
    if (localizationOption && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      const options = Array.from(localizationOption.closest('.header__localization-options').querySelectorAll('[role="option"]'))
        .filter((option) => !option.hidden);
      const currentIndex = options.indexOf(localizationOption);
      let nextIndex = currentIndex;
      if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % options.length;
      if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + options.length) % options.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = options.length - 1;
      event.preventDefault();
      options.forEach((option, index) => { option.tabIndex = index === nextIndex ? 0 : -1; });
      options[nextIndex]?.focus();
      return;
    }

    if (event.key === 'Tab' && isMobileHeaderViewport()) {
      const drawer = event.target.closest?.('[data-header-mobile-drawer][data-open="true"]');
      if (drawer) {
        const focusableElements = getMobileDrawerFocusables(drawer);
        if (!focusableElements.length) {
          event.preventDefault();
          drawer.querySelector('[data-header-mobile-close]')?.focus();
          return;
        }
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    const summary = event.target.closest?.('summary[aria-controls]');
    const disclosure = summary?.parentElement;

    if (event.key === 'ArrowRight' && disclosure?.matches('.header__submenu-nested-disclosure') && supportsDesktopHeaderHover()) {
      event.preventDefault();
      openHeaderSubmenu(disclosure);
      window.requestAnimationFrame(() => disclosure.querySelector(':scope > .header__submenu-nested a')?.focus());
      return;
    }

    if (event.key === 'ArrowLeft' && event.target.closest?.('.header__submenu-nested-disclosure[open]') && supportsDesktopHeaderHover()) {
      event.preventDefault();
      const nestedDisclosure = event.target.closest('.header__submenu-nested-disclosure');
      closeMegaMenu(nestedDisclosure);
      nestedDisclosure.querySelector(':scope > summary')?.focus();
      return;
    }

    if (event.key !== 'Escape') return;

    if (isMobileHeaderViewport()) {
      const openLocalization = event.target.closest?.('.header__localization-selector[open]');
      if (openLocalization) {
        event.preventDefault();
        closeLocalizationSheet(openLocalization);
        return;
      }

      const activeHeader = event.target.closest?.('[data-header]');
      const openMenu = event.target.closest?.('[data-header-mobile-drawer][data-open="true"]')?.closest('[data-header]')?.querySelector('.header__menu-disclosure[open]')
        || activeHeader?.querySelector('.header__menu-disclosure[open]')
        || (!activeHeader && document.querySelector('[data-header] .header__menu-disclosure[open]'));
      if (openMenu) {
        event.preventDefault();
        closeMobileMenu(openMenu);
        return;
      }
    }

    const activeHeader = event.target.closest?.('[data-header]');
    const focusTargets = [];
    const openDetails = activeHeader?.querySelectorAll('details[open]')
      || document.querySelectorAll('[data-header] details[open]');
    openDetails.forEach((details) => {
      if (details.matches('.header__submenu-disclosure')) focusTargets.push(details.querySelector(':scope > summary'));
      if (details.matches('.header__menu-disclosure')) focusTargets.push(details.querySelector(':scope > summary'));
      if (details.matches('.header__submenu-disclosure, .header__submenu-nested-disclosure') && shouldAnimateHeaderSubmenu(details)) {
        closeMegaMenu(details);
      } else if (details.matches('.header__localization-selector') && isMobileHeaderViewport()) {
        closeLocalizationSheet(details);
      } else if (details.matches('.header__localization-selector')) {
        focusTargets.push(details.querySelector(':scope > summary'));
        closeHeaderLocalization(details);
      } else {
        details.open = false;
      }
    });
    focusTargets.find(Boolean)?.focus();
  });

  initializeHeaderDisclosures();
  initializeDesktopMegaMenuObservers();
  document.querySelectorAll('[data-header] > .header__inner > .header__menu-disclosure').forEach((disclosure) => syncMobileDrawer(disclosure));
  syncHeaderMenuScrollLock();
  document.addEventListener('shopify:section:load', (event) => {
    initializeHeaderDisclosures(event.target);
    initializeDesktopMegaMenuObservers(event.target);
    event.target.querySelectorAll?.('[data-header] > .header__inner > .header__menu-disclosure').forEach((disclosure) => syncMobileDrawer(disclosure));
    syncHeaderMenuScrollLock();
  });
  document.addEventListener('shopify:section:unload', (event) => {
    if (event.target.querySelector?.('[data-header]')) resetLocalizationSheetDrag();
    if (event.target.contains?.(headerBreakpointFocusContext?.header)) headerBreakpointFocusContext = null;
    event.target.querySelectorAll?.('[data-header]').forEach((header) => {
      const cartFeedbackState = cartFeedbackHeaderStates.get(header);
      window.clearTimeout(cartFeedbackState?.timer);
      if (header.parentElement && cartFeedbackState) header.parentElement.style.minHeight = cartFeedbackState.previousMinHeight;
      cartFeedbackHeaderStates.delete(header);
      clearResponsiveHeaderEntry(header);
      clearResponsiveHeaderExit(header);
      mobileStickyHeaderStates.delete(header);
      header.classList.remove('header--mobile-hidden');
      desktopMegaMenuHandoffs.delete(header);
      resetDesktopMegaMenuBackground(header);
    });
    event.target.querySelectorAll?.('.header__localization-selector').forEach((details) => {
      localizationBackdropInteractions.get(details)?.destroy();
      localizationBackdropInteractions.delete(details);
      cancelLocalizationSheetOpen(details);
      clearLocalizationHoverTimer(details);
      clearLocalizationSheetMotion(details);
      resetDesktopMegaMenuPresentation(details);
      disconnectDesktopMegaMenuObserver(details);
      localizationSheetFinalizing.delete(details);
      details.removeAttribute('data-motion-state');
      details.open = false;
      syncHeaderLocalizationAria(details);
    });
    event.target.querySelectorAll?.('.header__submenu-disclosure, .header__submenu-nested-disclosure').forEach((details) => {
      clearMegaMenuHoverTimer(details);
      resetDesktopMegaMenuPresentation(details);
      disconnectDesktopMegaMenuObserver(details);
      megaMenuAnimations.get(details)?.cancel();
      megaMenuAnimations.delete(details);
      mobileMegaMenuMotions.get(details)?.animation.cancel();
      mobileMegaMenuMotions.delete(details);
      details.open = false;
      syncHeaderDisclosureAria(details);
    });
    event.target.querySelectorAll?.('[data-header] > .header__inner > .header__menu-disclosure').forEach((disclosure) => {
      clearMobileDrawerMotion(disclosure);
      disclosure.open = false;
      syncMobileDrawer(disclosure);
    });
    syncHeaderMenuScrollLock();
    scheduleResponsiveHeaderSync();
  });

  document.addEventListener('click', (event) => {
    const option = event.target.closest?.('[data-header-country-option]');
    if (option) {
      const picker = option.closest('[data-header-country-picker]');
      const input = picker?.querySelector('[data-header-country-input]');
      if (!input) return;

      input.value = option.dataset.countryCode;
      option.closest('form')?.submit();
      return;
    }

    const languageOption = event.target.closest?.('[data-header-language-option]');
    if (!languageOption) return;

    const picker = languageOption.closest('[data-header-language-picker]');
    const input = picker?.querySelector('[data-header-language-input]');
    if (!input) return;

    input.value = languageOption.dataset.languageCode;
    languageOption.closest('form')?.submit();
  });

  document.addEventListener('shopify:block:select', (event) => {
    const details = event.target.closest?.('.header__submenu-disclosure')
      || event.target.closest?.('.header__menu-item')?.querySelector(':scope > .header__submenu-disclosure');
    if (!details) return;

    const header = details.closest('[data-header]');
    const mobileDrawer = header?.querySelector('.header__menu-disclosure');
    if (mobileDrawer && window.matchMedia(headerMobileMediaQuery).matches) mobileDrawer.open = true;
    openHeaderSubmenu(details);
  });

}
