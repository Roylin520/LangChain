/* Notes Hub 主應用。 */
(function () {
  "use strict";

  var html = UI.html;
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useRef = React.useRef;
  var useCallback = React.useCallback;

  /* ---------------------------------------------------------------- 登入頁 */

  function AuthPage(props) {
    var modeState = useState("login");
    var mode = modeState[0];
    var setMode = modeState[1];
    var formState = useState({ email: "", password: "", display_name: "" });
    var form = formState[0];
    var setForm = formState[1];
    var busyState = useState(false);
    var busy = busyState[0];
    var setBusy = busyState[1];
    var errorState = useState("");
    var error = errorState[0];
    var setError = errorState[1];

    function field(name) {
      return function (event) {
        var value = event.target.value;
        setForm(function (prev) {
          var next = Object.assign({}, prev);
          next[name] = value;
          return next;
        });
      };
    }

    function submit(event) {
      event.preventDefault();
      setError("");

      if (mode === "register" && form.password.length < 8) {
        setError("密碼至少要 8 個字元");
        return;
      }

      setBusy(true);
      var payload =
        mode === "register"
          ? { email: form.email, password: form.password, display_name: form.display_name }
          : { email: form.email, password: form.password };
      var call = mode === "register" ? Api.register(payload) : Api.login(payload);

      call
        .then(function (data) {
          Api.setToken(data.access_token);
          return Api.me();
        })
        .then(function (user) {
          props.onAuthed(user);
        })
        .catch(function (err) {
          Api.setToken("");
          setError(err.message);
        })
        .finally(function () {
          setBusy(false);
        });
    }

    return html`
      <div class="auth-page">
        <div class="auth-card">
          <div class="auth-brand">
            <span class="brand-mark">◈</span>
            <div>
              <h1>Notes Hub</h1>
              <p>把 Obsidian 的 Markdown 同步到雲端，隨處可讀可搜。</p>
            </div>
          </div>

          <div class="tabs">
            <button
              class=${"tab " + (mode === "login" ? "tab-on" : "")}
              onClick=${function () {
                setMode("login");
                setError("");
              }}
            >
              登入
            </button>
            <button
              class=${"tab " + (mode === "register" ? "tab-on" : "")}
              disabled=${!props.allowRegistration}
              title=${props.allowRegistration ? "" : "本站已關閉註冊"}
              onClick=${function () {
                setMode("register");
                setError("");
              }}
            >
              註冊
            </button>
          </div>

          <form onSubmit=${submit}>
            <label class="field">
              <span>Email</span>
              <input type="email" required autoComplete="username" value=${form.email} onInput=${field("email")} />
            </label>

            ${mode === "register"
              ? html`
                  <label class="field">
                    <span>顯示名稱<em>（可留空）</em></span>
                    <input type="text" maxLength="100" value=${form.display_name} onInput=${field("display_name")} />
                  </label>
                `
              : null}

            <label class="field">
              <span>密碼${mode === "register" ? html`<em>（至少 8 字元）</em>` : null}</span>
              <input
                type="password"
                required
                autoComplete=${mode === "register" ? "new-password" : "current-password"}
                value=${form.password}
                onInput=${field("password")}
              />
            </label>

            ${error ? html`<p class="form-error">${error}</p>` : null}

            <button class="btn btn-primary btn-block" type="submit" disabled=${busy}>
              ${busy ? html`<${UI.Spinner} />` : mode === "register" ? "建立帳號" : "登入"}
            </button>
          </form>
        </div>
      </div>
    `;
  }

  /* ------------------------------------------------------------ 側邊欄 */

  function Sidebar(props) {
    var filter = props.filter;
    var openState = useState({ folders: true, tags: true });
    var open = openState[0];
    var setOpen = openState[1];

    function toggle(key) {
      setOpen(function (prev) {
        var next = Object.assign({}, prev);
        next[key] = !prev[key];
        return next;
      });
    }

    function isAll() {
      return !filter.tag && !filter.folder;
    }

    return html`
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">◈</span>
          <span class="brand-name">Notes Hub</span>
        </div>

        <div class="sidebar-actions">
          <button class="btn btn-primary btn-sm" onClick=${props.onNew}>＋ 新筆記</button>
          <button class="btn btn-ghost btn-sm" onClick=${props.onUpload}>⬆ 上傳</button>
        </div>

        <nav class="side-nav">
          <button class=${"side-item " + (isAll() ? "side-on" : "")} onClick=${function () {
            props.onFilter({ tag: "", folder: "" });
          }}>
            <span>📚 全部筆記</span>
            <span class="badge">${props.stats ? props.stats.notes : "…"}</span>
          </button>
        </nav>

        <section class="side-section">
          <button class="side-head" onClick=${function () {
            toggle("folders");
          }}>
            <span>${open.folders ? "▾" : "▸"} 資料夾</span>
            <span class="badge">${props.folders.length}</span>
          </button>
          ${open.folders
            ? html`
                <div class="side-list">
                  ${props.folders.length === 0
                    ? html`<p class="side-empty">還沒有資料夾</p>`
                    : props.folders.map(function (row) {
                        var value = row.name === "/" ? "" : row.name;
                        var active = filter.folder === row.name && row.name !== "/";
                        return html`
                          <button
                            key=${row.name}
                            class=${"side-item " + (active ? "side-on" : "")}
                            title=${row.name}
                            onClick=${function () {
                              props.onFilter({ folder: active ? "" : value, tag: "" });
                            }}
                          >
                            <span class="ellipsis">📁 ${row.name}</span>
                            <span class="badge">${row.count}</span>
                          </button>
                        `;
                      })}
                </div>
              `
            : null}
        </section>

        <section class="side-section">
          <button class="side-head" onClick=${function () {
            toggle("tags");
          }}>
            <span>${open.tags ? "▾" : "▸"} 標籤</span>
            <span class="badge">${props.tags.length}</span>
          </button>
          ${open.tags
            ? html`
                <div class="tag-cloud">
                  ${props.tags.length === 0
                    ? html`<p class="side-empty">還沒有標籤</p>`
                    : props.tags.map(function (row) {
                        var active = filter.tag === row.name;
                        return html`
                          <button
                            key=${row.name}
                            class=${"chip " + (active ? "chip-on" : "")}
                            onClick=${function () {
                              props.onFilter({ tag: active ? "" : row.name, folder: "" });
                            }}
                          >
                            #${row.name}<span class="chip-count">${row.count}</span>
                          </button>
                        `;
                      })}
                </div>
              `
            : null}
        </section>

        <footer class="sidebar-foot">
          ${props.stats
            ? html`<p class="muted small">
                ${props.stats.notes} 篇 · ${UI.formatBytes(props.stats.total_bytes)} · 最後更新
                ${UI.formatDate(props.stats.last_updated)}
              </p>`
            : null}
          <div class="user-row">
            <span class="ellipsis" title=${props.user.email}>👤 ${props.user.display_name || props.user.email}</span>
          </div>
          <div class="sidebar-actions">
            <button class="btn btn-ghost btn-sm" onClick=${props.onSettings}>⚙ 設定</button>
            <button class="btn btn-ghost btn-sm" onClick=${props.onLogout}>登出</button>
          </div>
        </footer>
      </aside>
    `;
  }

  /* ------------------------------------------------------------ 筆記清單 */

  function NoteList(props) {
    var inputRef = useRef(null);

    useEffect(function () {
      function onKey(event) {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
          event.preventDefault();
          if (inputRef.current) inputRef.current.focus();
        }
      }
      document.addEventListener("keydown", onKey);
      return function () {
        document.removeEventListener("keydown", onKey);
      };
    }, []);

    var filter = props.filter;
    var scopeLabel = filter.tag ? "#" + filter.tag : filter.folder ? "📁 " + filter.folder : "全部筆記";

    return html`
      <section class="list-pane">
        <div class="list-head">
          <input
            ref=${inputRef}
            class="search"
            type="search"
            placeholder="搜尋標題、路徑或內文…（Ctrl+K）"
            value=${filter.q}
            onInput=${function (event) {
              props.onFilter({ q: event.target.value });
            }}
          />
          <div class="list-meta">
            <span class="ellipsis">${scopeLabel} · ${props.total} 篇</span>
            <select
              class="select"
              value=${props.sort}
              onChange=${function (event) {
                props.onSort(event.target.value);
              }}
            >
              <option value="updated">最近更新</option>
              <option value="created">最近建立</option>
              <option value="title">標題</option>
              <option value="path">路徑</option>
              <option value="size">大小</option>
            </select>
          </div>
        </div>

        <div class="list-body">
          ${props.loading && props.items.length === 0
            ? html`<div class="list-loading"><${UI.Spinner} /> 載入中…</div>`
            : null}
          ${!props.loading && props.items.length === 0
            ? html`<${UI.EmptyState}
                icon="🔍"
                title=${filter.q ? "沒有符合的筆記" : "這裡還沒有筆記"}
                hint=${filter.q ? "換個關鍵字試試" : "用左上角的「上傳」匯入 Obsidian 的 .md 或整包 vault.zip"}
              />`
            : null}
          ${props.items.map(function (item) {
            return html`
              <button
                key=${item.id}
                class=${"note-card " + (props.selectedId === item.id ? "note-on" : "")}
                onClick=${function () {
                  props.onSelect(item.id);
                }}
              >
                <div class="note-card-title ellipsis">${item.title}</div>
                <div class="note-card-path ellipsis">${item.path}</div>
                ${item.excerpt ? html`<div class="note-card-excerpt">${item.excerpt}</div>` : null}
                <div class="note-card-foot">
                  <span class="muted small">${UI.formatDate(item.updated_at)}</span>
                  ${item.source === "obsidian" ? html`<span class="pill">Obsidian</span>` : null}
                  ${item.tags.slice(0, 3).map(function (tag) {
                    return html`<span key=${tag} class="pill pill-tag">#${tag}</span>`;
                  })}
                </div>
              </button>
            `;
          })}
          ${props.items.length < props.total
            ? html`<button class="btn btn-ghost btn-block" onClick=${props.onLoadMore} disabled=${props.loading}>
                ${props.loading ? "載入中…" : "載入更多（剩 " + (props.total - props.items.length) + " 篇）"}
              </button>`
            : null}
        </div>
      </section>
    `;
  }

  /* ------------------------------------------------------------ 筆記檢視 */

  function NoteView(props) {
    var note = props.note;
    var editingState = useState(false);
    var editing = editingState[0];
    var setEditing = editingState[1];
    var draftState = useState("");
    var draft = draftState[0];
    var setDraft = draftState[1];
    var busyState = useState(false);
    var busy = busyState[0];
    var setBusy = busyState[1];
    var backlinksState = useState([]);
    var backlinks = backlinksState[0];
    var setBacklinks = backlinksState[1];

    useEffect(
      function () {
        setEditing(false);
        setBacklinks([]);
        if (!note) return;
        setDraft(note.content);
        Api.backlinks(note.id).then(setBacklinks, function () {
          setBacklinks([]);
        });
      },
      [note && note.id, note && note.updated_at]
    );

    function save() {
      setBusy(true);
      Api.saveNote(note.id, { content: draft })
        .then(function (updated) {
          setEditing(false);
          props.onSaved(updated);
        })
        .catch(function (err) {
          props.toast(err.message, "error");
        })
        .finally(function () {
          setBusy(false);
        });
    }

    function remove() {
      if (!window.confirm("確定要刪除「" + note.title + "」？此動作無法復原。")) return;
      setBusy(true);
      Api.deleteNote(note.id)
        .then(function () {
          props.onDeleted(note.id);
        })
        .catch(function (err) {
          props.toast(err.message, "error");
        })
        .finally(function () {
          setBusy(false);
        });
    }

    function onBodyClick(event) {
      var target = event.target.closest ? event.target.closest("[data-wikilink]") : null;
      if (target) {
        event.preventDefault();
        props.onOpenWiki(target.getAttribute("data-wikilink"));
      }
    }

    if (!note) {
      return html`
        <section class="view-pane">
          <${UI.EmptyState}
            icon="📖"
            title="選一篇筆記開始閱讀"
            hint="左側清單點一下就能開啟；支援 [[wiki 連結]] 與反向連結。"
          />
        </section>
      `;
    }

    return html`
      <section class="view-pane">
        <header class="view-head">
          <div class="view-title-row">
            <h1 class="ellipsis" title=${note.title}>${note.title}</h1>
            <div class="view-actions">
              ${editing
                ? html`
                    <button class="btn btn-ghost btn-sm" onClick=${function () {
                      setDraft(note.content);
                      setEditing(false);
                    }} disabled=${busy}>取消</button>
                    <button class="btn btn-primary btn-sm" onClick=${save} disabled=${busy}>
                      ${busy ? html`<${UI.Spinner} />` : "儲存"}
                    </button>
                  `
                : html`
                    <button class="btn btn-ghost btn-sm" onClick=${function () {
                      setEditing(true);
                    }}>✎ 編輯</button>
                    <button class="btn btn-danger btn-sm" onClick=${remove} disabled=${busy}>刪除</button>
                  `}
            </div>
          </div>
          <p class="view-path ellipsis" title=${note.path}>${note.path}</p>
          <div class="view-meta">
            <span class="muted small">
              ${UI.formatBytes(note.size_bytes)} · 更新於 ${UI.formatDate(note.updated_at)} ·
              來源 ${note.source === "obsidian" ? "Obsidian" : "網頁"}
            </span>
            ${note.tags.map(function (tag) {
              return html`<button
                key=${tag}
                class="pill pill-tag pill-btn"
                onClick=${function () {
                  props.onFilter({ tag: tag, folder: "", q: "" });
                }}
              >
                #${tag}
              </button>`;
            })}
          </div>
        </header>

        <div class="view-body">
          ${editing
            ? html`<textarea
                class="editor"
                value=${draft}
                spellCheck="false"
                onInput=${function (event) {
                  setDraft(event.target.value);
                }}
              ></textarea>`
            : html`<article
                class="markdown"
                onClick=${onBodyClick}
                dangerouslySetInnerHTML=${{ __html: Markdown.render(note.content) }}
              ></article>`}

          ${!editing && backlinks.length > 0
            ? html`
                <section class="backlinks">
                  <h3>反向連結（${backlinks.length}）</h3>
                  <ul>
                    ${backlinks.map(function (row) {
                      return html`<li key=${row.id}>
                        <button class="link" onClick=${function () {
                          props.onSelect(row.id);
                        }}>${row.title}</button>
                        <span class="muted small">${row.path}</span>
                      </li>`;
                    })}
                  </ul>
                </section>
              `
            : null}
        </div>
      </section>
    `;
  }

  /* ------------------------------------------------------------ 上傳 */

  function UploadModal(props) {
    var filesState = useState([]);
    var files = filesState[0];
    var setFiles = filesState[1];
    var folderState = useState("");
    var folder = folderState[0];
    var setFolder = folderState[1];
    var busyState = useState(false);
    var busy = busyState[0];
    var setBusy = busyState[1];
    var resultState = useState(null);
    var result = resultState[0];
    var setResult = resultState[1];
    var dragState = useState(false);
    var dragging = dragState[0];
    var setDragging = dragState[1];

    function addFiles(fileList) {
      var incoming = Array.prototype.slice.call(fileList);
      setFiles(function (prev) {
        return prev.concat(incoming);
      });
    }

    function submit() {
      if (files.length === 0) return;
      setBusy(true);
      Api.upload(files, folder)
        .then(function (data) {
          setResult(data);
          setFiles([]);
          props.onDone();
          var summary = "新增 " + data.created + " · 更新 " + data.updated + " · 未變 " + data.unchanged;
          props.toast(data.errors ? summary + " · 失敗 " + data.errors : summary, data.errors ? "warn" : "ok");
        })
        .catch(function (err) {
          props.toast(err.message, "error");
        })
        .finally(function () {
          setBusy(false);
        });
    }

    return html`
      <${UI.Modal} title="上傳筆記" onClose=${props.onClose} wide=${true}>
        <div
          class=${"dropzone " + (dragging ? "dropzone-on" : "")}
          onDragOver=${function (e) {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave=${function () {
            setDragging(false);
          }}
          onDrop=${function (e) {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <p class="dropzone-title">把 .md 檔或整包 vault.zip 拖進來</p>
          <p class="muted small">支援 .md / .markdown / .txt / .zip；zip 內的資料夾結構會保留，.obsidian 設定會自動略過</p>
          <label class="btn btn-ghost btn-sm">
            選擇檔案
            <input
              type="file"
              multiple
              accept=".md,.markdown,.txt,.zip"
              hidden
              onChange=${function (event) {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </div>

        <label class="field">
          <span>放到哪個資料夾<em>（可留空，直接放根目錄）</em></span>
          <input
            type="text"
            placeholder="例如：匯入/2026"
            value=${folder}
            onInput=${function (event) {
              setFolder(event.target.value);
            }}
          />
        </label>

        ${files.length > 0
          ? html`
              <div class="file-list">
                ${files.map(function (file, index) {
                  return html`<div class="file-row" key=${file.name + index}>
                    <span class="ellipsis">${file.name}</span>
                    <span class="muted small">${UI.formatBytes(file.size)}</span>
                    <button
                      class="icon-btn"
                      aria-label="移除"
                      onClick=${function () {
                        setFiles(function (prev) {
                          return prev.filter(function (_item, i) {
                            return i !== index;
                          });
                        });
                      }}
                    >
                      ✕
                    </button>
                  </div>`;
                })}
              </div>
            `
          : null}

        ${result
          ? html`
              <div class="result-box">
                <p>新增 ${result.created} · 更新 ${result.updated} · 未變更 ${result.unchanged} · 失敗 ${result.errors}</p>
                ${result.results
                  .filter(function (row) {
                    return row.status === "error";
                  })
                  .slice(0, 10)
                  .map(function (row, index) {
                    return html`<p key=${index} class="form-error small">${row.path}：${row.detail}</p>`;
                  })}
              </div>
            `
          : null}

        <div class="modal-foot">
          <button class="btn btn-ghost" onClick=${props.onClose}>關閉</button>
          <button class="btn btn-primary" onClick=${submit} disabled=${busy || files.length === 0}>
            ${busy ? html`<${UI.Spinner} />` : "上傳 " + files.length + " 個檔案"}
          </button>
        </div>
      <//>
    `;
  }

  /* ------------------------------------------------------------ 新筆記 */

  function NewNoteModal(props) {
    var pathState = useState("");
    var path = pathState[0];
    var setPath = pathState[1];
    var contentState = useState("");
    var content = contentState[0];
    var setContent = contentState[1];
    var busyState = useState(false);
    var busy = busyState[0];
    var setBusy = busyState[1];

    function submit(event) {
      event.preventDefault();
      setBusy(true);
      Api.createNote({ path: path, content: content })
        .then(function (data) {
          var row = data.results[0];
          if (row.status === "error") throw new Error(row.detail || "建立失敗");
          props.onCreated(row.note_id);
        })
        .catch(function (err) {
          props.toast(err.message, "error");
        })
        .finally(function () {
          setBusy(false);
        });
    }

    return html`
      <${UI.Modal} title="新筆記" onClose=${props.onClose} wide=${true}>
        <form onSubmit=${submit}>
          <label class="field">
            <span>路徑<em>（沒寫副檔名會自動補 .md）</em></span>
            <input
              type="text"
              required
              placeholder="例如：工作/週報/2026-W36.md"
              value=${path}
              onInput=${function (event) {
                setPath(event.target.value);
              }}
            />
          </label>
          <label class="field">
            <span>內容</span>
            <textarea
              class="editor editor-sm"
              placeholder=${"---\ntags: [工作]\n---\n\n# 標題\n\n內容…"}
              value=${content}
              onInput=${function (event) {
                setContent(event.target.value);
              }}
            ></textarea>
          </label>
          <div class="modal-foot">
            <button class="btn btn-ghost" type="button" onClick=${props.onClose}>取消</button>
            <button class="btn btn-primary" type="submit" disabled=${busy || !path.trim()}>
              ${busy ? html`<${UI.Spinner} />` : "建立"}
            </button>
          </div>
        </form>
      <//>
    `;
  }

  /* ------------------------------------------------------------ 設定 */

  function SettingsModal(props) {
    var tokensState = useState([]);
    var tokens = tokensState[0];
    var setTokens = tokensState[1];
    var nameState = useState("我的 Obsidian");
    var name = nameState[0];
    var setName = nameState[1];
    var freshState = useState(null);
    var fresh = freshState[0];
    var setFresh = freshState[1];
    var busyState = useState(false);
    var busy = busyState[0];
    var setBusy = busyState[1];

    var reload = useCallback(function () {
      Api.listTokens().then(setTokens, function (err) {
        props.toast(err.message, "error");
      });
    }, []);

    useEffect(
      function () {
        reload();
      },
      [reload]
    );

    function create() {
      setBusy(true);
      Api.createApiToken(name)
        .then(function (data) {
          setFresh(data);
          reload();
        })
        .catch(function (err) {
          props.toast(err.message, "error");
        })
        .finally(function () {
          setBusy(false);
        });
    }

    function revoke(id) {
      if (!window.confirm("撤銷後，用這把 token 的裝置會立刻無法同步。確定嗎？")) return;
      Api.revokeApiToken(id)
        .then(function () {
          if (fresh && fresh.id === id) setFresh(null);
          reload();
          props.toast("已撤銷", "ok");
        })
        .catch(function (err) {
          props.toast(err.message, "error");
        });
    }

    return html`
      <${UI.Modal} title="設定 · Obsidian 同步" onClose=${props.onClose} wide=${true}>
        <section class="settings-block">
          <h3>1. 建立 API Token</h3>
          <p class="muted small">Obsidian 外掛用這把 token 上傳筆記。Token 只在建立當下顯示一次，伺服器只留雜湊。</p>
          <div class="inline-form">
            <input
              type="text"
              maxLength="100"
              value=${name}
              onInput=${function (event) {
                setName(event.target.value);
              }}
            />
            <button class="btn btn-primary btn-sm" onClick=${create} disabled=${busy}>
              ${busy ? html`<${UI.Spinner} />` : "建立"}
            </button>
          </div>

          ${fresh
            ? html`
                <div class="result-box">
                  <p class="small"><strong>請立刻複製 — 關掉就看不到了：</strong></p>
                  <${UI.CopyField} value=${fresh.token} />
                </div>
              `
            : null}

          <div class="token-list">
            ${tokens.length === 0
              ? html`<p class="muted small">目前沒有任何 token</p>`
              : tokens.map(function (row) {
                  return html`
                    <div class="token-row" key=${row.id}>
                      <div>
                        <div>${row.name}</div>
                        <div class="muted small">
                          ${row.prefix + "… · 建立於 " + UI.formatDate(row.created_at) + " · 最後使用 " +
                          (row.last_used_at ? UI.formatDate(row.last_used_at) : "從未")}
                        </div>
                      </div>
                      <button class="btn btn-danger btn-sm" onClick=${function () {
                        revoke(row.id);
                      }}>撤銷</button>
                    </div>
                  `;
                })}
          </div>
        </section>

        <section class="settings-block">
          <h3>2. 安裝 Obsidian 外掛</h3>
          <ol class="steps">
            <li>把專案裡的 <code>obsidian-plugin/</code> 整個資料夾複製到 vault 的
              <code>.obsidian/plugins/notes-hub-sync/</code>。</li>
            <li>Obsidian → 設定 → 第三方外掛 → 關閉「安全模式」→ 啟用 <strong>Notes Hub Sync</strong>。</li>
            <li>在外掛設定填入伺服器網址與剛剛複製的 token,按「立即同步」。</li>
          </ol>
          <p class="muted small">伺服器網址：</p>
          <${UI.CopyField} value=${window.location.origin} />
        </section>

        <section class="settings-block">
          <h3>3. 也可以直接用 curl 測</h3>
          <pre class="code-block">${
            "curl -X POST " +
            window.location.origin +
            "/api/sync/push \\\n" +
            '  -H "Authorization: Bearer <你的 token>" \\\n' +
            '  -H "Content-Type: application/json" \\\n' +
            '  -d \'{"notes":[{"path":"測試.md","content":"# Hello"}]}\''
          }</pre>
        </section>

        <div class="modal-foot">
          <button class="btn btn-ghost" onClick=${props.onClose}>關閉</button>
        </div>
      <//>
    `;
  }

  /* ------------------------------------------------------------ 根元件 */

  var PAGE_SIZE = 50;

  function App() {
    var bootState = useState(true);
    var booting = bootState[0];
    var setBooting = bootState[1];
    var userState = useState(null);
    var user = userState[0];
    var setUser = userState[1];
    var regState = useState(true);
    var allowRegistration = regState[0];
    var setAllowRegistration = regState[1];

    var filterState = useState({ q: "", tag: "", folder: "" });
    var filter = filterState[0];
    var setFilter = filterState[1];
    var sortState = useState("updated");
    var sort = sortState[0];
    var setSort = sortState[1];

    var itemsState = useState([]);
    var items = itemsState[0];
    var setItems = itemsState[1];
    var totalState = useState(0);
    var total = totalState[0];
    var setTotal = totalState[1];
    var loadingState = useState(false);
    var loading = loadingState[0];
    var setLoading = loadingState[1];

    var noteState = useState(null);
    var note = noteState[0];
    var setNote = noteState[1];
    var tagsState = useState([]);
    var tags = tagsState[0];
    var setTags = tagsState[1];
    var foldersState = useState([]);
    var folders = foldersState[0];
    var setFolders = foldersState[1];
    var statsState = useState(null);
    var stats = statsState[0];
    var setStats = statsState[1];

    var modalState = useState("");
    var modal = modalState[0];
    var setModal = modalState[1];

    var toastPair = UI.useToasts();
    var toasts = toastPair[0];
    var toast = toastPair[1];

    /* --- 啟動：有 token 就直接還原登入狀態 --- */
    useEffect(function () {
      Api.health()
        .then(function (info) {
          setAllowRegistration(!!info.registration);
        })
        .catch(function () {});

      if (!Api.getToken()) {
        setBooting(false);
        return;
      }
      Api.me()
        .then(setUser)
        .catch(function () {
          Api.setToken("");
        })
        .finally(function () {
          setBooting(false);
        });
    }, []);

    var refreshMeta = useCallback(function () {
      Api.tags().then(setTags, function () {});
      Api.folders().then(setFolders, function () {});
      Api.stats().then(setStats, function () {});
    }, []);

    var loadNotes = useCallback(
      function (offset) {
        setLoading(true);
        return Api.listNotes({
          q: filter.q,
          tag: filter.tag,
          folder: filter.folder === "/" ? "" : filter.folder,
          sort: sort,
          order: sort === "title" || sort === "path" ? "asc" : "desc",
          limit: PAGE_SIZE,
          offset: offset || 0
        })
          .then(function (data) {
            setTotal(data.total);
            setItems(function (prev) {
              return offset ? prev.concat(data.items) : data.items;
            });
          })
          .catch(function (err) {
            if (err.status === 401) {
              Api.setToken("");
              setUser(null);
            } else {
              toast(err.message, "error");
            }
          })
          .finally(function () {
            setLoading(false);
          });
      },
      [filter.q, filter.tag, filter.folder, sort, toast]
    );

    /* 搜尋輸入做 250ms 去抖，其他條件立即套用 */
    useEffect(
      function () {
        if (!user) return;
        var timer = setTimeout(function () {
          loadNotes(0);
        }, filter.q ? 250 : 0);
        return function () {
          clearTimeout(timer);
        };
      },
      [user, loadNotes, filter.q]
    );

    useEffect(
      function () {
        if (user) refreshMeta();
      },
      [user, refreshMeta]
    );

    function patchFilter(patch) {
      setFilter(function (prev) {
        return Object.assign({}, prev, patch);
      });
    }

    function openNote(id) {
      Api.getNote(id).then(setNote, function (err) {
        toast(err.message, "error");
      });
    }

    function openWikiLink(target) {
      // 後端會照 Obsidian 的語意解析：先比完整路徑，再比檔名
      Api.resolveLink(target)
        .then(setNote)
        .catch(function () {
          // 真的沒有這篇，就退成關鍵字搜尋，讓使用者自己挑
          patchFilter({ q: target, tag: "", folder: "" });
          toast("找不到「" + target + "」，已改用關鍵字搜尋", "warn");
        });
    }

    function afterMutation() {
      loadNotes(0);
      refreshMeta();
    }

    function logout() {
      Api.setToken("");
      setUser(null);
      setNote(null);
      setItems([]);
      setTotal(0);
    }

    if (booting) {
      return html`<div class="boot"><${UI.Spinner} /> 載入中…</div>`;
    }

    if (!user) {
      return html`
        <div>
          <${AuthPage}
            allowRegistration=${allowRegistration}
            onAuthed=${function (loggedIn) {
              setUser(loggedIn);
            }}
          />
          <${UI.ToastHost} toasts=${toasts} />
        </div>
      `;
    }

    return html`
      <div class="shell">
        <${Sidebar}
          user=${user}
          stats=${stats}
          tags=${tags}
          folders=${folders}
          filter=${filter}
          onFilter=${patchFilter}
          onNew=${function () {
            setModal("new");
          }}
          onUpload=${function () {
            setModal("upload");
          }}
          onSettings=${function () {
            setModal("settings");
          }}
          onLogout=${logout}
        />

        <${NoteList}
          items=${items}
          total=${total}
          loading=${loading}
          filter=${filter}
          sort=${sort}
          selectedId=${note ? note.id : null}
          onFilter=${patchFilter}
          onSort=${setSort}
          onSelect=${openNote}
          onLoadMore=${function () {
            loadNotes(items.length);
          }}
        />

        <${NoteView}
          note=${note}
          toast=${toast}
          onFilter=${patchFilter}
          onSelect=${openNote}
          onOpenWiki=${openWikiLink}
          onSaved=${function (updated) {
            setNote(updated);
            afterMutation();
            toast("已儲存", "ok");
          }}
          onDeleted=${function () {
            setNote(null);
            afterMutation();
            toast("已刪除", "ok");
          }}
        />

        ${modal === "upload"
          ? html`<${UploadModal}
              toast=${toast}
              onDone=${afterMutation}
              onClose=${function () {
                setModal("");
              }}
            />`
          : null}
        ${modal === "new"
          ? html`<${NewNoteModal}
              toast=${toast}
              onCreated=${function (id) {
                setModal("");
                afterMutation();
                openNote(id);
                toast("已建立", "ok");
              }}
              onClose=${function () {
                setModal("");
              }}
            />`
          : null}
        ${modal === "settings"
          ? html`<${SettingsModal}
              toast=${toast}
              onClose=${function () {
                setModal("");
              }}
            />`
          : null}

        <${UI.ToastHost} toasts=${toasts} />
      </div>
    `;
  }

  ReactDOM.createRoot(document.getElementById("root")).render(html`<${App} />`);
})();
