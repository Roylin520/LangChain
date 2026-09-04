/* API 用戶端：統一處理 token、錯誤訊息與查詢字串。 */
(function (global) {
  "use strict";

  var TOKEN_KEY = "notes_hub_token";

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (err) {
      return "";
    }
  }

  function setToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (err) {
      /* 無痕模式下 localStorage 可能被擋，忽略即可 */
    }
  }

  function qs(params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (key) {
      var value = params[key];
      if (value === undefined || value === null || value === "") return;
      parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
    });
    return parts.length ? "?" + parts.join("&") : "";
  }

  function describeError(status, body) {
    if (body && typeof body.detail === "string") return body.detail;
    if (body && Array.isArray(body.detail) && body.detail.length) {
      var first = body.detail[0];
      var field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : "";
      return (field ? field + "：" : "") + (first.msg || "輸入格式不正確");
    }
    if (status === 401) return "登入已過期，請重新登入";
    if (status === 413) return "資料太大，請分批送";
    return "伺服器錯誤（HTTP " + status + "）";
  }

  function request(method, path, options) {
    options = options || {};
    var headers = {};
    var token = getToken();
    if (token) headers.Authorization = "Bearer " + token;

    var init = { method: method, headers: headers };
    if (options.json !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.json);
    } else if (options.body !== undefined) {
      init.body = options.body;
    }

    return fetch(path, init).then(function (resp) {
      if (resp.status === 204) return null;
      return resp
        .json()
        .catch(function () {
          return null;
        })
        .then(function (body) {
          if (!resp.ok) {
            var error = new Error(describeError(resp.status, body));
            error.status = resp.status;
            throw error;
          }
          return body;
        });
    });
  }

  global.Api = {
    getToken: getToken,
    setToken: setToken,

    health: function () {
      return request("GET", "/api/health");
    },
    register: function (payload) {
      return request("POST", "/api/auth/register", { json: payload });
    },
    login: function (payload) {
      return request("POST", "/api/auth/login", { json: payload });
    },
    me: function () {
      return request("GET", "/api/auth/me");
    },

    listNotes: function (params) {
      return request("GET", "/api/notes" + qs(params));
    },
    getNote: function (id) {
      return request("GET", "/api/notes/" + id);
    },
    getNoteByPath: function (path) {
      return request("GET", "/api/notes/by-path" + qs({ path: path }));
    },
    resolveLink: function (target) {
      return request("GET", "/api/notes/resolve" + qs({ target: target }));
    },
    backlinks: function (id) {
      return request("GET", "/api/notes/" + id + "/backlinks");
    },
    saveNote: function (id, payload) {
      return request("PUT", "/api/notes/" + id, { json: payload });
    },
    deleteNote: function (id) {
      return request("DELETE", "/api/notes/" + id);
    },
    createNote: function (payload) {
      return request("POST", "/api/sync/push", { json: { notes: [payload] } });
    },
    upload: function (files, baseFolder) {
      var form = new FormData();
      for (var i = 0; i < files.length; i++) form.append("files", files[i]);
      return request("POST", "/api/notes/upload" + qs({ base_folder: baseFolder }), { body: form });
    },

    tags: function () {
      return request("GET", "/api/tags");
    },
    folders: function () {
      return request("GET", "/api/folders");
    },
    stats: function () {
      return request("GET", "/api/stats");
    },

    listTokens: function () {
      return request("GET", "/api/tokens");
    },
    createApiToken: function (name) {
      return request("POST", "/api/tokens", { json: { name: name } });
    },
    revokeApiToken: function (id) {
      return request("DELETE", "/api/tokens/" + id);
    }
  };
})(window);
