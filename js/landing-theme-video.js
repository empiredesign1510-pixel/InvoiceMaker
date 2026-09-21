(() => {
  'use strict';

  const HOST_SELECTOR = '.hero-product-shell';
  const MOBILE_QUERY = '(max-width: 760px)';
  const ASSETS = {
    light: {
      desktop: 'assets/videos/landing-light.mp4',
      mobile: 'assets/videos/landing-light-mobile.mp4',
      poster: 'assets/videos/landing-light-poster.webp',
      mobilePoster: 'assets/videos/landing-light-mobile-poster.webp'
    },
    dark: {
      desktop: 'assets/videos/landing-dark.mp4',
      mobile: 'assets/videos/landing-dark-mobile.mp4',
      poster: 'assets/videos/landing-dark-poster.webp',
      mobilePoster: 'assets/videos/landing-dark-mobile-poster.webp'
    }
  };

  const css = `
    .theme-video-host {
      padding: 0 !important;
      overflow: hidden !important;
      isolation: isolate;
      background: transparent !important;
      transform: translateZ(0);
    }
    .theme-video-stage {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      border-radius: inherit;
      background: #f3efe6;
      isolation: isolate;
      transform: translate3d(0,0,0);
      contain: layout paint;
      transition: background-color .42s cubic-bezier(.22,.61,.36,1), box-shadow .42s cubic-bezier(.22,.61,.36,1);
    }
    html[data-theme="dark"] .theme-video-stage { background: #07111b; }
    .theme-video-stage::after {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 4;
      pointer-events: none;
      border-radius: inherit;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.07);
    }
    .theme-video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
      object-position: center;
      opacity: 0;
      z-index: 1;
      pointer-events: none;
      transform: translate3d(0,0,0) scale(1.001);
      backface-visibility: hidden;
      will-change: opacity;
      transition: opacity .46s cubic-bezier(.22,.61,.36,1);
    }
    .theme-video.is-active { opacity: 1; z-index: 2; }
    .theme-video-loader {
      position: absolute;
      inset: 0;
      z-index: 0;
      display: grid;
      place-items: center;
      font-size: .7rem;
      letter-spacing: .04em;
      color: rgba(17,24,39,.46);
    }
    html[data-theme="dark"] .theme-video-loader { color: rgba(255,255,255,.42); }

    /* Smooth theme change without expensive transition: all */
    .landing,
    .landing-nav,
    .cloud-hero,
    .hero-copy,
    .hero-kicker,
    .hero-primary,
    .hero-secondary,
    .hero-trust,
    .product-strip,
    .features,
    .bento-card,
    .showcase-section,
    .how,
    .app-download-section,
    .landing-final,
    .landing-footer,
    .support-author-link {
      transition-property: background-color, color, border-color, box-shadow;
      transition-duration: .38s;
      transition-timing-function: cubic-bezier(.22,.61,.36,1);
    }

    @media (max-width: 760px) {
      .theme-video-host { width: 100% !important; max-width: 100% !important; }
      .theme-video-stage {
        width: 100%;
        max-width: 100%;
        aspect-ratio: 16 / 9;
        min-height: 0;
        border-radius: 16px;
      }
      .theme-video {
        object-fit: contain;
        object-position: center center;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .theme-video { transition-duration: .15s; }
      .theme-video-stage,
      .landing,
      .landing-nav,
      .cloud-hero,
      .hero-copy,
      .hero-kicker,
      .hero-primary,
      .hero-secondary,
      .hero-trust,
      .product-strip,
      .features,
      .bento-card,
      .showcase-section,
      .how,
      .app-download-section,
      .landing-final,
      .landing-footer,
      .support-author-link { transition-duration: .15s; }
    }
  `;

  const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;

  function ensureStyles() {
    if (document.getElementById('invoiceku-theme-video-style')) return;
    const style = document.createElement('style');
    style.id = 'invoiceku-theme-video-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function createVideo(mode) {
    const asset = ASSETS[mode];
    const video = document.createElement('video');
    video.className = `theme-video theme-video-${mode}`;
    video.dataset.themeVideo = mode;
    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.disablePictureInPicture = true;
    video.disableRemotePlayback = true;
    video.poster = isMobile() ? asset.mobilePoster : asset.poster;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('aria-hidden', 'true');

    const mobileSource = document.createElement('source');
    mobileSource.media = MOBILE_QUERY;
    mobileSource.src = asset.mobile;
    mobileSource.type = 'video/mp4';

    const desktopSource = document.createElement('source');
    desktopSource.src = asset.desktop;
    desktopSource.type = 'video/mp4';

    video.append(mobileSource, desktopSource);
    return video;
  }

  function safePlay(video) {
    if (!video || !video.paused) return;
    const p = video.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }

  function init() {
    const host = document.querySelector(HOST_SELECTOR);
    if (!host || host.dataset.themeVideoReady === '1') return;

    ensureStyles();
    host.dataset.themeVideoReady = '1';
    host.classList.add('theme-video-host');

    const stage = document.createElement('div');
    stage.className = 'theme-video-stage';
    stage.innerHTML = '<div class="theme-video-loader">Memuat tampilan…</div>';

    const light = createVideo('light');
    const dark = createVideo('dark');
    stage.append(light, dark);
    host.replaceChildren(stage);

    let currentTheme = '';
    let heroVisible = true;

    const applyTheme = () => {
      const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      if (nextTheme === currentTheme) return;
      currentTheme = nextTheme;

      light.classList.toggle('is-active', nextTheme === 'light');
      dark.classList.toggle('is-active', nextTheme === 'dark');

      if (heroVisible && !document.hidden) {
        // Both stay warm while visible. Theme switching only changes opacity,
        // so no source reload / re-decode is needed at toggle time.
        safePlay(light);
        safePlay(dark);
      }
    };

    let readyCount = 0;
    const markReady = () => {
      readyCount += 1;
      if (readyCount >= 1) stage.querySelector('.theme-video-loader')?.remove();
    };
    light.addEventListener('loadeddata', markReady, { once: true });
    dark.addEventListener('loadeddata', markReady, { once: true });

    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    applyTheme();

    const visibilityObserver = new IntersectionObserver(entries => {
      heroVisible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0.04);
      if (heroVisible && !document.hidden) {
        safePlay(light);
        safePlay(dark);
      } else {
        light.pause();
        dark.pause();
      }
    }, { threshold: [0, .04, .2] });
    visibilityObserver.observe(stage);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden || !heroVisible) {
        light.pause();
        dark.pause();
      } else {
        safePlay(light);
        safePlay(dark);
      }
    });

    // If a browser blocks autoplay temporarily, any first user interaction warms both layers.
    const warmOnFirstInteraction = () => {
      if (heroVisible) {
        safePlay(light);
        safePlay(dark);
      }
      document.removeEventListener('pointerdown', warmOnFirstInteraction, true);
      document.removeEventListener('touchstart', warmOnFirstInteraction, true);
    };
    document.addEventListener('pointerdown', warmOnFirstInteraction, true);
    document.addEventListener('touchstart', warmOnFirstInteraction, { capture: true, passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
