import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.PORTFOLIO_CONFIG || {};
const tableName = config.contentTable || "portfolio_content";
const supportedLocales = ["en", "vi"];
const pageFiles = {
  home: "index.html",
  projects: "projects.html"
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

let supabase;
let currentKeys = [];

const setStatus = (message, tone = "neutral") => {
  statusElement.textContent = message;
  statusElement.dataset.tone = tone;
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

  return [...new Set(keys)].filter((key) => !key.startsWith("meta."));
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

const renderFields = (keys, translations) => {
  fieldsContainer.replaceChildren();

  keys.forEach((key) => {
    const label = document.createElement("label");
    label.className = "admin-field";

    const keyElement = document.createElement("span");
    keyElement.textContent = key;

    const textarea = document.createElement("textarea");
    textarea.rows = key.length > 40 ? 4 : 2;
    textarea.dataset.contentKey = key;
    textarea.value = translations[key] || "";

    label.append(keyElement, textarea);
    fieldsContainer.append(label);
  });
};

const loadEditor = async () => {
  const locale = localeSelect.value;
  const page = pageSelect.value;
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
  const meta = {
    ...(localContent.pages?.[page] || {}),
    ...(remoteContent.meta || {})
  };

  titleInput.value = meta.title || "";
  descriptionInput.value = meta.description || "";
  renderFields(keys, translations);
  setStatus(`Loaded ${keys.length} fields for ${locale}/${page}.`, "success");
};

const saveEditor = async () => {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    setStatus("Please sign in before saving.", "error");
    return;
  }

  const translations = {};
  fieldsContainer.querySelectorAll("[data-content-key]").forEach((field) => {
    if (currentKeys.includes(field.dataset.contentKey)) {
      translations[field.dataset.contentKey] = field.value.trim();
    }
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
  setStatus("Saving content...");

  const { error } = await supabase.from(tableName).upsert(payload, {
    onConflict: "locale,page"
  });

  saveButton.disabled = false;

  if (error) {
    setStatus(error.message, "error");
    return;
  }

  setStatus("Saved. Public pages will use the updated content on refresh.", "success");
};

const handleSession = async (session) => {
  const signedIn = Boolean(session);
  loginForm.hidden = signedIn;
  editor.hidden = !signedIn;

  if (signedIn) {
    await loadEditor();
  }
};

const boot = async () => {
  if (!isConfigured()) {
    setupNotice.hidden = false;
    loginForm.hidden = true;
    setStatus("Supabase is not configured yet.", "error");
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
      return;
    }
    await handleSession(data.session);
  });

  loadButton.addEventListener("click", loadEditor);
  localeSelect.addEventListener("change", loadEditor);
  pageSelect.addEventListener("change", loadEditor);
  saveButton.addEventListener("click", saveEditor);
  logoutButton.addEventListener("click", async () => {
    await supabase.auth.signOut();
    await handleSession(null);
    setStatus("Signed out.");
  });

  const {
    data: { session }
  } = await supabase.auth.getSession();

  await handleSession(session);
};

boot().catch((error) => {
  console.error(error);
  setStatus(error.message, "error");
});
