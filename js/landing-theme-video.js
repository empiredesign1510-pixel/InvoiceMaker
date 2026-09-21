(() => {
  'use strict';

  const SELECTOR = '.hero-product-shell';
  const LIGHT_VIDEO = 'assets/videos/landing-light.mp4';
  const DARK_VIDEO = 'assets/videos/landing-dark.mp4';
  const LIGHT_POSTER = 'assets/videos/landing-light-poster.webp';
  const DARK_POSTER = 'assets/videos/landing-dark-poster.webp';

  const css = `
    .theme-video-stage {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      border-radius: inherit;
      background: #f6f2e9;
      isolation: isolate;
      transform: translateZ(0);
      transition: background-color .42s cubic-bezier(.22,.61,.36,1), box-shadow .42s cubic-bezier(.22,.61,.36,1);
    }
    html[data-theme="dark"] .theme-video-stage { background: #07111b; }
    .theme-video-stage::after {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 3;
      pointer-events: none;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.08);
      border-radius: inherit;
    }
    .theme-video {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
      object-position: center center;
      opacity: 0;
      z-index: 1;
      pointer-events: none;
      transform: translate3d(0,0,0);
      backface-visibility: hidden;
      will-change: opacity;
      transition: opacity .46s cubic-bezier(.22,.61,.36,1);
    }
    .theme-video.is-active { opacity: 1; z-index: 2; }
    .theme-video-status {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      z-index: 0;
      font-size: .72rem;
      color: rgba(17,24,39,.48);
      letter-spacing: .03em;
    }
    html[data-theme="dark"] .theme-video-status { color: rgba(255,255,255,.42); }
    @media (max-width: 760px) {
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
      .theme-video { transition-duration: .16s; }
      .theme-video-stage { transition-duration: .16s; }
    }
  `;

  const ensureStyle = () => {
    if (document.getElementById('invoiceku-theme-video-style')) return;
    const style = document.createElement('style');
    style.id = 'invoiceku-theme-video-style';
    style.textContent = css;
    document.head.appendChild(style);
  };

  const makeVideo = ({ mode, src, poster }) => {
    const video = document.createElement('video');
    video.className = `theme-video theme-video-${mode}`;
    video.dataset.themeVideo = mode;
    video.src = src;
    video.poster = poster;
    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    video.disablePictureInPicture = true;
    return video;
  };

  const safePlay = video => {
    if (!video || !video.paused) return;
    video.play().catch(() => {});
  };

  const init = () => {
    const target = document.querySelector(SELECTOR);
    if (!target || target.dataset.themeVideoReady === '1') return;

    ensureStyle();
    target.dataset.themeVideoReady = '1';
    target.classList.add('theme-video-host');

    const stage = document.createElement('div');
    stage.className = 'theme-video-stage';
    stage.innerHTML = '<div class="theme-video-status">Memuat tampilan…</div>';

    const light = makeVideo({ mode: 'light', src: LIGHT_VIDEO, poster: LIGHT_POSTER });
    const dark = makeVideo({ mode: 'dark', src: DARK_VIDEO, poster: DARK_POSTER });
    stage.append(light, dark);
    target.replaceChildren(stage);

    let currentTheme = null;
    const applyTheme = () => {
      const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      if (theme === currentTheme) return;
      currentTheme = theme;

      // Kedua video sudah loaded & berjalan di background. Yang berubah hanya opacity,
      // sehingga toggle light/dark tidak perlu mengganti src dan tidak menunggu decode baru.
      light.classList.toggle('is-active', theme === 'light');
      dark.classList.toggle('is-active', theme === 'dark');
      safePlay(light);
      safePlay(dark);
    };

    const markReady = () => {
      if (light.readyState >= 2 || dark.readyState >= 2) {
        stage.querySelector('.theme-video-status')?.remove();
      }
    };
    light.addEventListener('loadeddata', markReady, { once: true });
    dark.addEventListener('loadeddata', markReady, { once: true });

    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    applyTheme();

    // Hemat CPU/GPU saat hero tidak terlihat. Saat kembali terlihat kedua video dipanaskan lagi.
    const visibilityObserver = new IntersectionObserver(entries => {
      const visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0.05);
      if (visible) {
        safePlay(light);
        safePlay(dark);
      } else {
        light.pause();
        dark.pause();
      }
    }, { threshold: [0, .05, .25] });
    visibilityObserver.observe(stage);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        light.pause();
        dark.pause();
      } else if (stage.getBoundingClientRect().bottom > 0 && stage.getBoundingClientRect().top < innerHeight) {
        safePlay(light);
        safePlay(dark);
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
