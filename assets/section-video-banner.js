if (!customElements.get('video-banner')) {
  class VideoBanner extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;
      this.initialized = true;
      this.mobileQuery = window.matchMedia('(max-width: 767.98px)');
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.playButton = this.querySelector('[data-video-banner-play]');
      this.closeButton = this.querySelector('[data-video-banner-close]');
      this.soundButton = this.querySelector('[data-video-banner-sound]');
      this.sources = Array.from(this.querySelectorAll('[data-video-banner-source]'));
      this.onPlayClick = this.togglePlayback.bind(this);
      this.onCloseClick = this.resetToBanner.bind(this);
      this.onSoundClick = this.toggleSound.bind(this);
      this.onMediaChange = this.handleMediaChange.bind(this);
      this.onNativePlay = this.syncPlaybackState.bind(this);
      this.onNativePause = this.syncPlaybackState.bind(this);

      this.playButton?.addEventListener('click', this.onPlayClick);
      this.closeButton?.addEventListener('click', this.onCloseClick);
      this.soundButton?.addEventListener('click', this.onSoundClick);
      this.mobileQuery.addEventListener('change', this.onMediaChange);
      this.motionQuery.addEventListener('change', this.onMediaChange);
      this.nativeVideos.forEach((video) => {
        video.addEventListener('play', this.onNativePlay);
        video.addEventListener('pause', this.onNativePause);
        video.addEventListener('ended', this.onNativePause);
      });
      this.handleMediaChange();
    }

    disconnectedCallback() {
      this.playButton?.removeEventListener('click', this.onPlayClick);
      this.closeButton?.removeEventListener('click', this.onCloseClick);
      this.soundButton?.removeEventListener('click', this.onSoundClick);
      this.mobileQuery?.removeEventListener('change', this.onMediaChange);
      this.motionQuery?.removeEventListener('change', this.onMediaChange);
      this.nativeVideos.forEach((video) => {
        video.removeEventListener('play', this.onNativePlay);
        video.removeEventListener('pause', this.onNativePause);
        video.removeEventListener('ended', this.onNativePause);
      });
      this.initialized = false;
    }

    get nativeVideos() {
      return Array.from(this.querySelectorAll('video'));
    }

    get activeSource() {
      const mobileSource = this.querySelector('.video-banner__source--mobile');
      if (this.mobileQuery.matches && mobileSource) return mobileSource;
      return this.querySelector('.video-banner__source--desktop');
    }

    get activeMedia() {
      return this.activeSource?.querySelector('video, iframe');
    }

    handleMediaChange() {
      if (this.motionQuery.matches && this.activeMedia instanceof HTMLVideoElement) this.activeMedia.pause();
      this.nativeVideos.forEach((video) => {
        if (video !== this.activeMedia) video.pause();
      });
      this.syncPlaybackState();
      this.syncSoundState();
      if (this.dataset.autoplay === 'true' && !this.motionQuery.matches) this.playActiveMedia();
    }

    togglePlayback() {
      const media = this.activeMedia;
      if (!media) return;
      if (media instanceof HTMLVideoElement) {
        if (media.paused) this.playActiveMedia();
        else media.pause();
        return;
      }
      if (this.externalPlaying) this.pauseExternalMedia(media);
      else this.playExternalMedia(media);
    }

    playActiveMedia() {
      const media = this.activeMedia;
      if (!media) return;
      if (media instanceof HTMLVideoElement) {
        media.loop = this.dataset.loop === 'true';
        const request = media.play();
        request?.catch?.(() => this.syncPlaybackState());
        return;
      }
      this.playExternalMedia(media);
    }

    resetToBanner() {
      const media = this.activeMedia;
      if (media instanceof HTMLVideoElement) {
        media.pause();
        try {
          media.currentTime = 0;
        } catch (_) {
          // Some streams are not seekable until their metadata is available.
        }
      } else if (media instanceof HTMLIFrameElement) {
        this.pauseExternalMedia(media);
        if (media.src.includes('youtube.com') || media.src.includes('youtu.be')) {
          media.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [0, true] }), '*');
        } else if (media.src.includes('vimeo.com')) {
          media.contentWindow?.postMessage({ method: 'setCurrentTime', value: 0 }, '*');
        }
      }
      this.externalPlaying = false;
      this.syncPlaybackState();
      this.playButton?.focus({ preventScroll: true });
    }

    playExternalMedia(iframe) {
      if (!(iframe instanceof HTMLIFrameElement)) return;
      const isYouTube = iframe.src.includes('youtube.com') || iframe.src.includes('youtu.be');
      const isVimeo = iframe.src.includes('vimeo.com');
      if (!iframe.dataset.videoBannerApiReady) {
        const source = new URL(iframe.src, window.location.href);
        source.searchParams.set('autoplay', '1');
        source.searchParams.set('playsinline', '1');
        if (isYouTube) source.searchParams.set('enablejsapi', '1');
        if (isVimeo) source.searchParams.set('api', '1');
        iframe.dataset.videoBannerApiReady = 'true';
        iframe.src = source.toString();
      } else if (isYouTube) {
        iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
      } else if (isVimeo) {
        iframe.contentWindow?.postMessage({ method: 'play' }, '*');
      }
      this.externalPlaying = true;
      this.syncPlaybackState();
    }

    pauseExternalMedia(iframe) {
      if (!(iframe instanceof HTMLIFrameElement)) return;
      if (iframe.src.includes('youtube.com') || iframe.src.includes('youtu.be')) {
        iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
      } else if (iframe.src.includes('vimeo.com')) {
        iframe.contentWindow?.postMessage({ method: 'pause' }, '*');
      }
      this.externalPlaying = false;
      this.syncPlaybackState();
    }

    toggleSound() {
      const video = this.activeMedia;
      if (!(video instanceof HTMLVideoElement)) return;
      video.muted = !video.muted;
      this.syncSoundState();
    }

    syncPlaybackState() {
      const video = this.activeMedia;
      const isPlaying = video instanceof HTMLVideoElement ? !video.paused && !video.ended : Boolean(this.externalPlaying);
      this.classList.toggle('is-playing', isPlaying);
      this.playButton?.setAttribute('aria-pressed', String(isPlaying));
    }

    syncSoundState() {
      const video = this.activeMedia;
      const muted = !(video instanceof HTMLVideoElement) || video.muted;
      if (!this.soundButton) return;
      this.soundButton.hidden = !(video instanceof HTMLVideoElement);
      this.soundButton.classList.toggle('is-muted', muted);
      this.soundButton.setAttribute('aria-pressed', String(!muted));
      this.soundButton.setAttribute('aria-label', muted ? this.soundButton.dataset.labelMuted : this.soundButton.dataset.labelUnmuted);
    }
  }

  customElements.define('video-banner', VideoBanner);
}
