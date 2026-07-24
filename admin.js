import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.PORTFOLIO_CONFIG || {};
const tableName = config.contentTable || "content";
const supportedLocales = ["en", "vi"];
const pageFiles = {
  home: "index.html",
  projects: "projects.html"
};

const hiddenKeyPrefixes = ["nav.", "language.", "footer.", "home.console."];

const combinedFields = {
  home: [
    {
      label: "Hero Title",
      helper: "Each line maps to one visible hero title line.",
      keys: ["home.hero.title1", "home.hero.title2", "home.hero.title3"],
      sectionKey: "home.hero.title1",
      rows: 3
    },
    {
      label: "Hero Intro",
      helper: "Each line maps to one visible intro line under the hero title.",
      keys: ["home.hero.lede1", "home.hero.lede2", "home.hero.lede3"],
      sectionKey: "home.hero.lede1",
      rows: 3
    }
  ]
};

const pageSections = {
  home: [
    {
      title: "Hero",
      description: "Main first-screen headline, intro copy, and primary actions.",
      prefixes: ["home.hero."]
    },
    {
      title: "Hero Visual",
      description: "Text inside the phone mockup and floating signal badges.",
      prefixes: ["home.device.", "home.signals."]
    },
    {
      title: "Hero Proof",
      description: "Metrics, console rows, availability, ticker, and proof strip.",
      prefixes: ["home.metrics.", "home.console.", "home.availability.", "home.ticker.", "home.proof."]
    },
    {
      title: "Profile",
      description: "Profile summary section below the proof strip.",
      prefixes: ["home.profile."]
    },
    {
      title: "Featured Case",
      description: "DP247 featured case teaser on the home page.",
      prefixes: ["home.featured."]
    },
    {
      title: "Experience",
      description: "Work experience section and bullet points.",
      prefixes: ["home.experience."]
    },
    {
      title: "Stack",
      description: "Technology stack cards and labels.",
      prefixes: ["home.stack."]
    },
    {
      title: "Contact",
      description: "Final contact section headline.",
      prefixes: ["home.contact."]
    }
  ],
  projects: [
    {
      title: "Projects Hero",
      description: "Top headline, intro text, and project stats.",
      prefixes: ["projects.hero.", "projects.stats."]
    },
    {
      title: "Project Overview",
      description: "Overview heading and project index cards.",
      prefixes: ["projects.overview."]
    },
    {
      title: "Engineering Signal",
      description: "Architecture, integration, and product UX notes.",
      prefixes: ["projects.system."]
    },
    {
      title: "DP247",
      description: "Featured POS project content, modules, details, and proof notes.",
      prefixes: ["projects.dp247."]
    },
    {
      title: "HUIT EDU",
      description: "Lecturer operations project content.",
      prefixes: ["projects.huitEdu."]
    },
    {
      title: "HUIT STUDENT",
      description: "Student feedback and survey project content.",
      prefixes: ["projects.huitStudent."]
    },
    {
      title: "MY DP247",
      description: "Consumer commerce project content.",
      prefixes: ["projects.myDp247."]
    },
    {
      title: "DC4.0",
      description: "Community management platform content.",
      prefixes: ["projects.dc40."]
    },
    {
      title: "HearMe App",
      description: "Android music streaming project content.",
      prefixes: ["projects.hearme."]
    },
    {
      title: "Reading Habit",
      description: "Children reading platform project content.",
      prefixes: ["projects.readingHabit."]
    },
    {
      title: "Shared Project Labels",
      description: "Labels reused across multiple project detail sections.",
      prefixes: ["projects.common."]
    }
  ]
};

const setupNotice = document.querySelector("[data-admin-setup]");
const loginForm = document.querySelector("[data-admin-login]");
const editor = document.querySelector("[data-admin-editor]");
const localeSelect = document.querySelector("[data-admin-locale]");
const pageSelect = document.querySelector("[data-admin-page]");
const loadButton = document.querySelector("[data-admin-load]");
const saveButton = document.querySelector("[data-admin-save]");
const logoutButton = document.querySelector("[data-admin-logout]");
const titleInput = document.querySelector("[data-admin-title]");
const descriptionInput = document.querySelector("[data-admin-description]");
const fieldsContainer = document.querySelector("[data-admin-fields]");
const statusElement = document.querySelector("[data-admin-status]");
const toastRegion = document.querySelector("[data-toast-region]");
const contextElement = document.querySelector("[data-admin-context]");

let supabase;
let currentKeys = [];
let currentTranslations = {};

const setStatus = (message, tone = "neutral") => {
  statusElement.textContent = message;
  statusElement.dataset.tone = tone;
};

const notify = (message, tone = "neutral") => {
  if (!toastRegion) return;

  const toast = document.createElement("div");
  toast.className = "admin-toast";
  toast.dataset.tone = tone;
  toast.textContent = message;
  toastRegion.append(toast);

  window.setTimeout(() => {
    toast.classList.add("is-leaving");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 3600);
};

const isConfigured = () => {
  return Boolean(config.useSupabaseContent && config.supabaseUrl && config.supabaseAnonKey);
};

const getLocalContent = async (locale) => {
  const response = await fetch(`api/content.${locale}.json`, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`Cannot load local ${locale} content`);
  return response.json();
};

const getPageKeys = async (page) => {
  const response = await fetch(pageFiles[page]);
  if (!response.ok) throw new Error(`Cannot inspect ${pageFiles[page]}`);

  const html = await response.text();
  const documentSnapshot = new DOMParser().parseFromString(html, "text/html");
  const keys = [];

  documentSnapshot.querySelectorAll("[data-i18n]").forEach((element) => {
    keys.push(element.dataset.i18n);
  });

  documentSnapshot.querySelectorAll("[data-i18n-attr]").forEach((element) => {
    element.dataset.i18nAttr.split(",").forEach((binding) => {
      const [, key] = binding.split(":").map((part) => part.trim());
      if (key) keys.push(key);
    });
  });

  return [...new Set(keys)].filter((key) => {
    return !key.startsWith("meta.") && !hiddenKeyPrefixes.some((prefix) => key.startsWith(prefix));
  });
};

const getRemoteContent = async (locale, page) => {
  const { data, error } = await supabase
    .from(tableName)
    .select("translations, meta")
    .eq("locale", locale)
    .eq("page", page)
    .maybeSingle();

  if (error) throw error;
  return data || { translations: {}, meta: {} };
};

const getSectionDefinitions = (page) => {
  return [
    ...(pageSections[page] || []),
    {
      title: "Other",
      description: "Keys that do not match a known UI section.",
      prefixes: []
    }
  ];
};

const findSectionIndex = (key, sections) => {
  const index = sections.findIndex((section) => {
    return section.prefixes.some((prefix) => key.startsWith(prefix));
  });
  return index >= 0 ? index : sections.length - 1;
};

const formatFieldLabel = (key) => {
  const lastPart = key.split(".").at(-1) || key;
  return lastPart
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getRenderItems = (page, keys, translations) => {
  const combined = combinedFields[page] || [];
  const combinedChildKeys = new Set(combined.flatMap((field) => field.keys));
  const items = [];

  combined.forEach((field) => {
    const existingKeys = field.keys.filter((key) => keys.includes(key));
    if (!existingKeys.length) return;

    items.push({
      type: "combined",
      label: field.label,
      helper: field.helper,
      keys: existingKeys,
      sectionKey: field.sectionKey,
      rows: field.rows || existingKeys.length,
      value: existingKeys.map((key) => translations[key] || "").join("\n")
    });
  });

  keys
    .filter((key) => !combinedChildKeys.has(key))
    .forEach((key) => {
      items.push({
        type: "single",
        label: formatFieldLabel(key),
        key,
        sectionKey: key,
        value: translations[key] || ""
      });
    });

  return items;
};

const renderFields = (keys, translations) => {
  fieldsContainer.replaceChildren();

  const sections = getSectionDefinitions(pageSelect.value);
  const groups = sections.map((section) => ({ ...section, items: [] }));
  const items = getRenderItems(pageSelect.value, keys, translations);

  items.forEach((item) => {
    groups[findSectionIndex(item.sectionKey, sections)].items.push(item);
  });

  groups
    .filter((group) => group.items.length)
    .forEach((group) => {
      const section = document.createElement("section");
      section.className = "admin-section-card is-collapsed";

      const header = document.createElement("button");
      header.className = "admin-section-header";
      header.type = "button";
      header.setAttribute("aria-expanded", "false");

      const copy = document.createElement("div");
      const title = document.createElement("h3");
      title.textContent = group.title;
      const description = document.createElement("p");
      description.textContent = group.description;

      const count = document.createElement("span");
      count.className = "admin-section-count";
      count.textContent = `${group.items.length} fields`;

      copy.append(title, description);
      header.append(copy, count);

      const body = document.createElement("div");
      body.className = "admin-section-body";

      header.addEventListener("click", () => {
        const isCollapsed = section.classList.toggle("is-collapsed");
        header.setAttribute("aria-expanded", String(!isCollapsed));
      });

      group.items.forEach((item) => {
        const label = document.createElement("label");
        label.className = "admin-field";

        const labelText = document.createElement("span");
        labelText.className = "admin-field-label";
        labelText.textContent = item.label;

        const keyElement = document.createElement("code");
        keyElement.textContent = item.type === "combined" ? item.keys.join(" + ") : item.key;

        const helper = document.createElement("small");
        helper.textContent = item.helper || "";

        const textarea = document.createElement("textarea");
        textarea.rows = item.rows || (item.value.length > 180 ? 5 : item.value.length > 90 ? 4 : 2);

        if (item.type === "combined") {
          textarea.dataset.contentKeys = JSON.stringify(item.keys);
        } else {
          textarea.dataset.contentKey = item.key;
        }

        textarea.value = item.value;

        label.append(labelText, keyElement);
        if (item.helper) label.append(helper);
        label.append(textarea);
        body.append(label);
      });

      section.append(header, body);
      fieldsContainer.append(section);
    });
};

const updateContext = () => {
  const localeLabel = localeSelect.options[localeSelect.selectedIndex]?.textContent || localeSelect.value;
  const pageLabel = pageSelect.options[pageSelect.selectedIndex]?.textContent || pageSelect.value;
  contextElement.textContent = `Editing ${localeLabel} content for ${pageLabel}.`;
};

const loadEditor = async ({ silent = false } = {}) => {
  const locale = localeSelect.value;
  const page = pageSelect.value;
  updateContext();
  setStatus("Loading content...");

  const [localContent, keys, remoteContent] = await Promise.all([
    getLocalContent(locale),
    getPageKeys(page),
    getRemoteContent(locale, page)
  ]);

  currentKeys = keys;
  const translations = {
    ...(localContent.translations || {}),
    ...(remoteContent.translations || {})
  };
  currentTranslations = translations;
  const meta = {
    ...(localContent.pages?.[page] || {}),
    ...(remoteContent.meta || {})
  };

  titleInput.value = meta.title || "";
  descriptionInput.value = meta.description || "";
  renderFields(keys, translations);
  setStatus(`Loaded ${keys.length} fields for ${locale}/${page}.`, "success");
  if (!silent) notify(`Loaded ${locale}/${page} content.`, "success");
};

const saveEditor = async () => {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    setStatus("Please sign in before saving.", "error");
    notify("Please sign in before saving.", "error");
    return;
  }

  const translations = { ...currentTranslations };
  fieldsContainer.querySelectorAll("[data-content-key]").forEach((field) => {
    if (currentKeys.includes(field.dataset.contentKey)) {
      translations[field.dataset.contentKey] = field.value.trim();
    }
  });
  fieldsContainer.querySelectorAll("[data-content-keys]").forEach((field) => {
    const keys = JSON.parse(field.dataset.contentKeys || "[]");
    const lines = field.value.split("\n");
    keys.forEach((key, index) => {
      if (currentKeys.includes(key)) {
        translations[key] = (lines[index] || "").trim();
      }
    });
  });

  const payload = {
    locale: localeSelect.value,
    page: pageSelect.value,
    translations,
    meta: {
      title: titleInput.value.trim(),
      description: descriptionInput.value.trim()
    },
    updated_by: user.id
  };

  saveButton.disabled = true;
  setStatus("Verifying session and saving content...");

  const { data, error } = await supabase
    .from(tableName)
    .upsert(payload, { onConflict: "locale,page" })
    .select("locale, page, updated_at")
    .single();

  saveButton.disabled = false;

  if (error) {
    setStatus(error.message, "error");
    notify(error.message, "error");
    return;
  }

  await loadEditor({ silent: true });
  setStatus(
    `Saved ${data.locale}/${data.page} at ${new Date(data.updated_at).toLocaleString()}. Refresh the public page to see the latest content.`,
    "success"
  );
  notify(`Saved ${data.locale}/${data.page} successfully.`, "success");
};

const handleSession = async (session) => {
  const signedIn = Boolean(session);
  loginForm.hidden = signedIn;
  editor.hidden = !signedIn;
  document.body.classList.toggle("is-admin-signed-in", signedIn);

  if (signedIn) {
    await loadEditor({ silent: true });
  }
};

const boot = async () => {
  if (!isConfigured()) {
    setupNotice.hidden = false;
    loginForm.hidden = true;
    setStatus("Supabase is not configured yet.", "error");
    notify("Supabase is not configured yet.", "error");
    return;
  }

  supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));

    setStatus("Signing in...");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus(error.message, "error");
      notify(error.message, "error");
      return;
    }
    await handleSession(data.session);
    setStatus("Signed in successfully.", "success");
    notify("Signed in successfully.", "success");
  });

  loadButton.addEventListener("click", loadEditor);
  localeSelect.addEventListener("change", loadEditor);
  pageSelect.addEventListener("change", loadEditor);
  saveButton.addEventListener("click", saveEditor);
  logoutButton.addEventListener("click", async () => {
    await supabase.auth.signOut();
    await handleSession(null);
    setStatus("Signed out.");
    notify("Signed out successfully.", "success");
  });

  const {
    data: { session }
  } = await supabase.auth.getSession();

  await handleSession(session);
};

boot().catch((error) => {
  console.error(error);
  setStatus(error.message, "error");
  notify(error.message, "error");
});
