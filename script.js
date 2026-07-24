const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const toggle = document.querySelector("[data-nav-toggle]");
const progress = document.querySelector(".scroll-progress");
const productShot = document.querySelector(".product-shot");
const tiltCard = document.querySelector("[data-tilt-card]");
const hapticTargets = document.querySelectorAll("[data-haptic]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const localeButtons = document.querySelectorAll("[data-locale-option]");
const appConfig = window.PORTFOLIO_CONFIG || {};
const supportedLocales = ["en", "vi"];
const defaultLocale = "en";
const contentCache = new Map();

const getInitialLocale = () => {
  const params = new URLSearchParams(window.location.search);
  const requestedLocale = params.get("lang") || localStorage.getItem("portfolio-locale");
  return supportedLocales.includes(requestedLocale) ? requestedLocale : defaultLocale;
};

let activeLocale = getInitialLocale();

const getPageKey = () => {
  return window.location.pathname.endsWith("projects.html") ? "projects" : "home";
};

const getContentUrl = (locale) => {
  return `api/content.${locale}.json`;
};

const getContentCacheKey = (locale) => {
  return `${locale}:${getPageKey()}:${appConfig.useSupabaseContent ? "remote" : "local"}`;
};

const fetchLocalContent = async (locale) => {
  const response = await fetch(getContentUrl(locale), { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Unable to load ${locale} content`);
  return response.json();
};

const fetchSupabaseContent = async (locale, page) => {
  const { supabaseUrl, supabaseAnonKey, contentTable = "content" } = appConfig;
  if (!appConfig.useSupabaseContent || !supabaseUrl || !supabaseAnonKey) return null;

  const endpoint = new URL(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/${contentTable}`);
  endpoint.searchParams.set("locale", `eq.${locale}`);
  endpoint.searchParams.set("page", `eq.${page}`);
  endpoint.searchParams.set("select", "translations,meta");

  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`
    }
  });

  if (!response.ok) throw new Error(`Unable to load Supabase content for ${locale}/${page}`);
  const rows = await response.json();
  return rows[0] || null;
};

const fetchContent = async (locale) => {
  const cacheKey = getContentCacheKey(locale);
  if (contentCache.has(cacheKey)) return contentCache.get(cacheKey);

  const page = getPageKey();
  const localContent = await fetchLocalContent(locale);
  const localPage = localContent.pages?.[page] || {};
  let content = localContent;

  try {
    const remoteContent = await fetchSupabaseContent(locale, page);
    if (remoteContent) {
      content = {
        ...localContent,
        translations: {
          ...(localContent.translations || {}),
          ...(remoteContent.translations || {})
        },
        pages: {
          ...(localContent.pages || {}),
          [page]: {
            ...localPage,
            ...(remoteContent.meta || {})
          }
        }
      };
    }
  } catch (error) {
    console.warn(error);
  }

  contentCache.set(cacheKey, content);
  return content;
};

const updateLocaleControls = (locale) => {
  document.documentElement.lang = locale;
  localeButtons.forEach((button) => {
    const isActive = button.dataset.localeOption === locale;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
};

const applyContent = (content) => {
  const translations = content.translations || {};

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const value = translations[element.dataset.i18n];
    if (typeof value === "string") element.textContent = value;
  });

  document.querySelectorAll("[data-i18n-attr]").forEach((element) => {
    element.dataset.i18nAttr.split(",").forEach((binding) => {
      const [attribute, key] = binding.split(":").map((part) => part.trim());
      const value = translations[key];
      if (attribute && typeof value === "string") element.setAttribute(attribute, value);
    });
  });

  const pageContent = content.pages?.[getPageKey()];
  if (pageContent?.title) document.title = pageContent.title;
  if (pageContent?.description) {
    document.querySelector('meta[name="description"]')?.setAttribute("content", pageContent.description);
  }
};

const loadLocale = async (locale) => {
  const nextLocale = supportedLocales.includes(locale) ? locale : defaultLocale;
  updateLocaleControls(nextLocale);

  try {
    const content = await fetchContent(nextLocale);
    applyContent(content);
    activeLocale = nextLocale;
    localStorage.setItem("portfolio-locale", nextLocale);
  } catch (error) {
    console.warn(error);
    if (nextLocale !== defaultLocale) {
      await loadLocale(defaultLocale);
    }
  }
};

localeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    contentCache.clear();
    loadLocale(button.dataset.localeOption);
  });
});

loadLocale(activeLocale);

const syncHeader = () => {
  header.classList.toggle("is-scrolled", window.scrollY > 12);
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progressValue = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  progress.style.transform = `scaleX(${progressValue})`;
};

syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });

toggle.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("is-open");
  toggle.setAttribute("aria-expanded", String(isOpen));
});

nav.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  }
});

const navLinks = [...nav.querySelectorAll("a")];
const homeNavLink = navLinks.find((link) => !link.hash && link.getAttribute("href")?.includes("index.html"));
const samePageHashLinks = navLinks.filter((link) => {
  if (!link.hash) return false;
  const linkPath = new URL(link.href, window.location.href).pathname;
  return linkPath === window.location.pathname;
});

const scrollSpySections = [
  homeNavLink && document.querySelector(".home-hero")
    ? { link: homeNavLink, section: document.querySelector(".home-hero") }
    : null,
  ...samePageHashLinks.map((link) => {
    return { link, section: document.querySelector(link.hash) };
  }),
].filter((item) => item?.section);

const setActiveNavLink = (activeLink) => {
  navLinks.forEach((link) => link.classList.toggle("is-active", link === activeLink));
};

const syncActiveNav = () => {
  if (!scrollSpySections.length) return;
  const checkpoint = window.scrollY + window.innerHeight * 0.34;
  const activeItem = scrollSpySections.reduce((current, item) => {
    return item.section.offsetTop <= checkpoint ? item : current;
  }, scrollSpySections[0]);
  setActiveNavLink(activeItem.link);
};

if (scrollSpySections.length) {
  syncActiveNav();
  window.addEventListener("scroll", syncActiveNav, { passive: true });
  window.addEventListener("resize", syncActiveNav);
}

if (!prefersReducedMotion) {
  window.addEventListener(
    "pointermove",
    (event) => {
      document.body.style.setProperty("--mouse-x", `${event.clientX}px`);
      document.body.style.setProperty("--mouse-y", `${event.clientY}px`);
    },
    { passive: true },
  );

  window.addEventListener(
    "scroll",
    () => {
      if (!productShot) return;
      const rect = productShot.getBoundingClientRect();
      const viewportMid = window.innerHeight / 2;
      const offset = Math.max(-18, Math.min(18, (viewportMid - rect.top) * 0.025));
      productShot.style.setProperty("--float-y", `${offset}px`);
    },
    { passive: true },
  );

  if (tiltCard) {
    window.addEventListener(
      "pointermove",
      (event) => {
        const rect = tiltCard.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const tiltY = Math.max(-22, Math.min(12, -16 + ((event.clientX - centerX) / rect.width) * 14));
        const tiltX = Math.max(0, Math.min(14, 8 - ((event.clientY - centerY) / rect.height) * 10));
        tiltCard.classList.add("is-tilting");
        tiltCard.style.setProperty("--tilt-x", `${tiltX}deg`);
        tiltCard.style.setProperty("--tilt-y", `${tiltY}deg`);
      },
      { passive: true },
    );
  }
}

let audioContext;

const playClick = () => {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  audioContext ||= new AudioContextConstructor();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = 420;
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.018, audioContext.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.055);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.06);
};

hapticTargets.forEach((target) => {
  target.addEventListener("pointerdown", () => {
    target.classList.add("is-pressed");
    window.navigator.vibrate?.(8);
    playClick();
  });

  target.addEventListener("pointerup", () => target.classList.remove("is-pressed"));
  target.addEventListener("pointerleave", () => target.classList.remove("is-pressed"));
});

const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window && !prefersReducedMotion) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
  );

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}
