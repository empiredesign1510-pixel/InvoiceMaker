(() => {
  'use strict';

  const HOST_SELECTOR = '#landingThemeVideo';
  const HERO_SELECTOR = '.theme-video-hero';
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
    /* InvoiceKu v6.4 — cinematic full-screen theme video hero */
    .landing { overflow-x: clip; }
    .landing-nav {
      position: absolute !important;
      inset: 0 0 auto 0;
      z-index: 40;
      width: min(1180px, calc(100% - 40px));
      margin: 0 auto !important;
      background: transparent !important;
      border-color: transparent !important;
      -webkit-backdrop-filter: none !important;
      backdrop-filter: none !important;
      transition: color .38s cubic-bezier(.22,.61,.36,1), border-color .38s cubic-bezier(.22,.61,.36,1);
    }

    .theme-video-hero.cloud-hero {
      position: relative !important;
      isolation: isolate;
      display: block !important;
      width: 100% !important;
      max-width: none !important;
      min-height: 100svh;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden;
      background: #f6f4ef;
    }
    html[data-theme="dark"] .theme-video-hero.cloud-hero { background: #070b0e; }

    .theme-video-fullbleed {
      position: absolute;
      inset: 0;
      z-index: 0;
      overflow: hidden;
      background: #f6f4ef;
      transform: translateZ(0);
      contain: paint;
    }
    html[data-theme="dark"] .theme-video-fullbleed { background: #070b0e; }

    .theme-video {
      position: absolute;
      inset: -2px;
      width: calc(100% + 4px);
      height: calc(100% + 4px);
      display: block;
      object-fit: cover;
      object-position: center center;
      opacity: 0;
      z-index: 1;
      pointer-events: none;
      transform: translate3d(0,0,0) scale(1.002);
      backface-visibility: hidden;
      will-change: opacity;
      transition: opacity .52s cubic-bezier(.22,.61,.36,1);
    }
    .theme-video.is-active { opacity: 1; z-index: 2; }

    .theme-video-loader {
      position: absolute;
      inset: 0;
      z-index: 0;
      background: #f6f4ef center/cover no-repeat;
      transition: opacity .3s ease;
    }
    html[data-theme="dark"] .theme-video-loader { background-color: #070b0e; }

    .theme-video-overlay {
      position: absolute;
      inset: 0;
      z-index: 4;
      pointer-events: none;
      background:
        linear-gradient(90deg, rgba(247,247,244,.96) 0%, rgba(247,247,244,.88) 27%, rgba(247,247,244,.48) 51%, rgba(247,247,244,.10) 76%, rgba(247,247,244,.03) 100%),
        linear-gradient(180deg, rgba(247,247,244,.36) 0%, rgba(247,247,244,0) 34%, rgba(247,247,244,.10) 100%);
      transition: background .42s cubic-bezier(.22,.61,.36,1);
    }
    html[data-theme="dark"] .theme-video-overlay {
      background:
        linear-gradient(90deg, rgba(7,11,14,.97) 0%, rgba(7,11,14,.91) 27%, rgba(7,11,14,.55) 52%, rgba(7,11,14,.14) 77%, rgba(7,11,14,.05) 100%),
        linear-gradient(180deg, rgba(7,11,14,.43) 0%, rgba(7,11,14,0) 37%, rgba(7,11,14,.18) 100%);
    }

    .theme-video-hero .hero-content {
      position: relative;
      z-index: 10;
      display: flex;
      align-items: center;
      width: 100%;
      min-height: 100svh;
      padding-top: 112px !important;
      padding-bottom: 82px !important;
    }
    .theme-video-hero .hero-copy {
      width: min(610px, 54vw);
      max-width: 610px;
      margin: 0 !important;
      position: relative;
      z-index: 2;
    }
    .theme-video-hero .hero-copy h1 {
      max-width: 600px;
      text-wrap: balance;
    }
    .theme-video-hero .hero-copy > p {
      max-width: 590px;
    }
    .theme-video-hero .hero-actions { flex-wrap: wrap; }
    .theme-video-hero .hero-trust { flex-wrap: wrap; }

    .hero-scroll-cue {
      position: absolute;
      z-index: 12;
      left: 50%;
      bottom: 26px;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 9px;
      color: currentColor;
      text-decoration: none;
      opacity: .62;
      font-size: .62rem;
      font-weight: 760;
      letter-spacing: .13em;
      text-transform: uppercase;
    }
    .hero-scroll-cue i {
      width: 28px;
      height: 28px;
      border: 1px solid currentColor;
      border-radius: 999px;
      display: grid;
      place-items: center;
      font-style: normal;
      animation: invoicekuHeroBounce 2.2s ease-in-out infinite;
    }
    @keyframes invoicekuHeroBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(4px)} }

    /* Only cheap compositor-friendly theme transitions. */
    .landing,
    .landing-nav,
    .theme-video-hero,
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
      .landing-nav {
        width: calc(100% - 24px);
        padding-top: max(14px, env(safe-area-inset-top)) !important;
      }
      .theme-video-hero.cloud-hero {
        min-height: 100svh;
        background: #f6f4ef;
      }
      html[data-theme="dark"] .theme-video-hero.cloud-hero { background: #070b0e; }

      /* Mobile: show the ENTIRE 16:9 movie. No cropping. */
      .theme-video-fullbleed {
        display: flex;
        align-items: flex-end;
        justify-content: center;
      }
      .theme-video {
        inset: auto 0 5vh 0;
        width: 100%;
        height: auto;
        aspect-ratio: 16 / 9;
        object-fit: contain;
        object-position: center center;
        transform: translate3d(0,0,0);
      }
      .theme-video-overlay {
        background:
          linear-gradient(180deg, rgba(247,247,244,.99) 0%, rgba(247,247,244,.96) 31%, rgba(247,247,244,.70) 51%, rgba(247,247,244,.14) 72%, rgba(247,247,244,.06) 100%);
      }
      html[data-theme="dark"] .theme-video-overlay {
        background:
          linear-gradient(180deg, rgba(7,11,14,.99) 0%, rgba(7,11,14,.97) 31%, rgba(7,11,14,.74) 51%, rgba(7,11,14,.18) 73%, rgba(7,11,14,.08) 100%);
      }
      .theme-video-hero .hero-content {
        align-items: flex-start;
        min-height: 100svh;
        padding: calc(92px + env(safe-area-inset-top)) 18px max(310px, 41vh) !important;
      }
      .theme-video-hero .hero-copy {
        width: 100%;
        max-width: 560px;
      }
      .theme-video-hero .hero-copy h1 {
        max-width: 100%;
        text-wrap: balance;
      }
      .theme-video-hero .hero-copy > p { max-width: 100%; }
      .theme-video-hero .hero-actions { gap: 8px; }
      .theme-video-hero .hero-actions > * { flex: 1 1 auto; }
      .hero-scroll-cue { display: none; }
    }

    @media (max-width: 480px) {
      .theme-video-hero .hero-content {
        padding-left: 16px !important;
        padding-right: 16px !important;
        padding-bottom: max(275px, 39vh) !important;
      }
      .theme-video-hero .hero-copy h1 { font-size: clamp(3rem, 16vw, 4.6rem) !important; }
      .theme-video-hero .hero-copy > p { font-size: .82rem; line-height: 1.6; }
      .theme-video-hero .hero-trust { gap: 7px 12px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .theme-video { transition-duration: .14s; }
      .hero-scroll-cue i { animation: none; }
      .landing,
      .landing-nav,
      .theme-video-hero,
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
      .support-author-link { transition-duration: .14s; }
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

    const mobile = document.createElement('source');
    mobile.media = MOBILE_QUERY;
    mobile.src = asset.mobile;
    mobile.type = 'video/mp4';

    const desktop = document.createElement('source');
    desktop.src = asset.desktop;
    desktop.type = 'video/mp4';

    video.append(mobile, desktop);
    return video;
  }

  function safePlay(video) {
    if (!video || !video.paused) return;
    const promise = video.play();
    if (promise?.catch) promise.catch(() => {});
  }

  function init() {
    const host = document.querySelector(HOST_SELECTOR);
    const hero = document.querySelector(HERO_SELECTOR);
    if (!host || !hero || host.dataset.themeVideoReady === '1') return;

    ensureStyles();
    host.dataset.themeVideoReady = '1';

    const loader = document.createElement('div');
    loader.className = 'theme-video-loader';
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const firstAsset = ASSETS[current];
    loader.style.backgroundImage = `url("${isMobile() ? firstAsset.mobilePoster : firstAsset.poster}")`;

    const light = createVideo('light');
    const dark = createVideo('dark');
    host.append(loader, light, dark);

    let activeTheme = '';
    let heroVisible = true;
    let firstFrameShown = false;

    const applyTheme = () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      if (next === activeTheme) return;
      activeTheme = next;

      light.classList.toggle('is-active', next === 'light');
      dark.classList.toggle('is-active', next === 'dark');

      if (heroVisible && !document.hidden) {
        // Keep both streams warm. Theme changes only crossfade opacity.
        safePlay(light);
        safePlay(dark);
      }
    };

    const markFrame = () => {
      if (firstFrameShown) return;
      firstFrameShown = true;
      requestAnimationFrame(() => { loader.style.opacity = '0'; });
      setTimeout(() => loader.remove(), 380);
    };
    light.addEventListener('loadeddata', markFrame, { once: true });
    dark.addEventListener('loadeddata', markFrame, { once: true });

    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    applyTheme();

    const observer = new IntersectionObserver(entries => {
      heroVisible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0.02);
      if (heroVisible && !document.hidden) {
        safePlay(light);
        safePlay(dark);
      } else {
        light.pause();
        dark.pause();
      }
    }, { threshold: [0, .02, .15] });
    observer.observe(hero);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden || !heroVisible) {
        light.pause();
        dark.pause();
      } else {
        safePlay(light);
        safePlay(dark);
      }
    });

    const warm = () => {
      if (heroVisible) {
        safePlay(light);
        safePlay(dark);
      }
      removeEventListener('pointerdown', warm);
      removeEventListener('touchstart', warm);
    };
    addEventListener('pointerdown', warm, { passive: true, once: true });
    addEventListener('touchstart', warm, { passive: true, once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
