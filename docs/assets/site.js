/*
  Backup App — sitenin tek betiği.

  Üç iş yapar: dili değiştirir, temayı değiştirir ve üst menüde bulunduğun
  sayfayı işaretler.

  Metinler sayfanın içinde durur (data-tr / data-en); hiçbir şey sonradan
  indirilmez. Bu yüzden sayfa yavaş bağlantıda tek seferde gelir ve betik
  engellense bile Türkçe hâliyle okunur — betik, sayfanın çalışması için
  gerekli değil, sadece tercih içindir. Tema da öyle: betik hiç çalışmasa
  sayfa işletim sisteminin temasını izler.
*/
(function () {
  var LANG_KEY = "backupapp-lang";
  var THEME_KEY = "backupapp-theme";
  var root = document.documentElement;

  function saved(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function remember(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* özel pencere */ }
  }

  // ---- Tema ---------------------------------------------------------------
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function dark() {
    var choice = root.getAttribute("data-theme");
    if (choice) return choice === "dark";
    return !!(media && media.matches);
  }

  function paintTheme() {
    document.querySelectorAll(".tt").forEach(function (b) {
      b.setAttribute("aria-pressed", String(dark()));
      b.setAttribute("aria-label", dark() ? "Açık tema" : "Koyu tema");
    });
    paintImages();
  }

  function setTheme(value) {
    root.setAttribute("data-theme", value);
    remember(THEME_KEY, value);
    paintTheme();
  }

  var storedTheme = saved(THEME_KEY);
  if (storedTheme === "dark" || storedTheme === "light") root.setAttribute("data-theme", storedTheme);

  // Kayıtlı seçim yoksa sistem değiştikçe sayfa da değişsin.
  if (media && media.addEventListener) {
    media.addEventListener("change", function () {
      if (!root.getAttribute("data-theme")) paintTheme();
    });
  }

  document.querySelectorAll(".tt").forEach(function (b) {
    b.addEventListener("click", function () { setTheme(dark() ? "light" : "dark"); });
  });

  // ---- Görseller ----------------------------------------------------------
  // Koyu temada koyu ekran görüntüsü gösterilir: bir ürün sayfası,
  // kullanıcının gördüğü ürünü göstermeli.
  function paintImages() {
    var lang = root.lang === "en" ? "en" : "tr";
    var isDark = dark();

    document.querySelectorAll("[data-src-tr]").forEach(function (img) {
      var src = isDark ? img.getAttribute("data-src-" + lang + "-dark") : null;
      if (!src) src = img.getAttribute("data-src-" + lang);
      if (src) img.src = src;
    });

    document.querySelectorAll("[data-dark]").forEach(function (img) {
      if (!img.dataset.light) img.dataset.light = img.getAttribute("src");
      img.src = isDark ? img.getAttribute("data-dark") : img.dataset.light;
    });
  }

  // ---- Dil ----------------------------------------------------------------
  function applyLang(lang) {
    root.lang = lang;

    document.querySelectorAll("[data-tr]").forEach(function (el) {
      var text = el.getAttribute("data-" + lang);
      if (text !== null) el.textContent = text;
    });

    var title = root.getAttribute("data-title-" + lang);
    if (title) document.title = title;

    document.querySelectorAll(".langs button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });

    remember(LANG_KEY, lang);
    paintImages();
  }

  // Kayıtlı seçim yoksa tarayıcının diline bakılır. Türkçe bir tarayıcı
  // Türkçe açar; kalan herkes İngilizce görür.
  var guess = (navigator.language || "en").toLowerCase().indexOf("tr") === 0 ? "tr" : "en";
  applyLang(saved(LANG_KEY) || guess);
  paintTheme();

  document.querySelectorAll(".langs button").forEach(function (b) {
    b.addEventListener("click", function () { applyLang(b.dataset.lang); });
  });

  // ---- Menü ---------------------------------------------------------------
  var here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("nav.menu a, .menu-narrow a").forEach(function (a) {
    var target = a.getAttribute("href").split("#")[0].split("/").pop();
    if (target === here) a.setAttribute("aria-current", "page");
  });
})();
