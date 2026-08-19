(function () {
  "use strict";

  var cfg = window.IYIBIS_CONFIG || {};
  var base = String(cfg.APPS_SCRIPT_EXEC_URL || "").trim();

  // Query string yanlışlıkla yapıştırılmışsa temizle.
  base = base.replace(/\?.*$/, "").replace(/\/+$/, "");

  var warning = document.getElementById("config-warning");
  var status = document.getElementById("backend-status");

  function validBase() {
    return /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(base);
  }

  if (validBase()) {
    if (status) status.textContent = "Backend: hazır";
  } else {
    if (status) status.textContent = "Backend: /exec adresi girilmedi";
    if (warning) warning.hidden = false;
  }

  document.querySelectorAll("[data-app]").forEach(function (el) {
    var route = el.getAttribute("data-app");

    if (validBase()) {
      el.href = base + "?app=" + encodeURIComponent(route);
    }

    el.addEventListener("click", function (e) {
      if (!validBase()) {
        e.preventDefault();
        if (warning) {
          warning.hidden = false;
          warning.scrollIntoView({behavior:"smooth", block:"center"});
        }
      }
    });
  });
})();
