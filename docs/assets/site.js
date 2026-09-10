/*
  Backup App — sitenin tek betiği.

  İki iş yapar: dili değiştirir ve üst menüde bulunduğun sayfayı işaretler.

  Metinler sayfanın içinde durur (data-tr / data-en); hiçbir şey sonradan
  indirilmez. Bu yüzden sayfa yavaş bağlantıda tek seferde gelir ve betik
  engellense bile Türkçe hâliyle okunur — betik, sayfanın çalışması için
  gerekli değil, sadece tercih içindir.
*/
(function () {
  var KEY = "backupapp-lang";

  function apply(lang) {
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-tr]").forEach(function (el) {
      var text = el.getAttribute("data-" + lang);
      if (text !== null) el.textContent = text;
    });

    document.querySelectorAll("[data-src-tr]").forEach(function (img) {
      var src = img.getAttribute("data-src-" + lang);
      if (src) img.src = src;
    });

    // Sayfa başlığı ve açıklaması da çevrilir; sekmede ve paylaşımda görünür.
    var head = document.documentElement;
    var title = head.getAttribute("data-title-" + lang);
    if (title) document.title = title;

    document.querySelectorAll(".langs button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });

    try { localStorage.setItem(KEY, lang); } catch (e) { /* özel pencere */ }
  }

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* özel pencere */ }

  // Kayıtlı seçim yoksa tarayıcının diline bakılır. Türkçe bir tarayıcı
  // Türkçe açar; kalan herkes İngilizce görür.
  var guess = (navigator.language || "en").toLowerCase().indexOf("tr") === 0 ? "tr" : "en";
  apply(saved || guess);

  document.querySelectorAll(".langs button").forEach(function (b) {
    b.addEventListener("click", function () { apply(b.dataset.lang); });
  });

  // Bulunduğun sayfa menüde işaretlenir. Sayfa adı dosya adından okunur,
  // böylece her sayfaya elle bir işaret koymak gerekmez.
  var here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("nav.menu a, .menu-narrow a").forEach(function (a) {
    var target = a.getAttribute("href").split("#")[0].split("/").pop();
    if (target === here) a.setAttribute("aria-current", "page");
  });
})();
