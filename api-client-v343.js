(function() {
"use strict";

function getApiUrl() {
  var cfg = window.IYIBIS_CONFIG || {};
  return String(cfg.API_PROXY_URL || "").trim();
}

async function callApi(method, args) {
  var url = getApiUrl();
  if (!url || !/^https:\/\//i.test(url)) {
    throw new Error("İYİBİS API proxy adresi config.js içinde tanımlı değil.");
  }

  var response = await fetch(url, {
    method: "POST",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json;charset=UTF-8"
    },
    body: JSON.stringify({
      method: method,
      args: args || []
    })
  });

  var text = await response.text();
  var payload;
  try {
    payload = JSON.parse(text);
  } catch (_) {
    throw new Error("API geçersiz yanıt verdi: " + text.slice(0, 180));
  }

  if (!response.ok || !payload || payload.ok !== true) {
    throw new Error(payload && payload.error ? payload.error : ("API HTTP " + response.status));
  }
  return payload.value;
}

function makeRunner(success, failure) {
  var base = {
    withSuccessHandler: function(fn) {
      return makeRunner(fn, failure);
    },
    withFailureHandler: function(fn) {
      return makeRunner(success, fn);
    }
  };

  return new Proxy(base, {
    get: function(target, prop) {
      if (prop in target) return target[prop];
      if (prop === "then") return undefined;

      return function() {
        var args = Array.prototype.slice.call(arguments);
        callApi(String(prop), args)
          .then(function(value) {
            if (success) success(value);
          })
          .catch(function(err) {
            if (failure) failure(err);
            else console.error(err);
          });
      };
    }
  });
}

window.google = window.google || {};
window.google.script = window.google.script || {};
window.google.script.run = makeRunner(null, null);

window.IYIBIS_API = {
  call: callApi
};
})();
