/* 共用小元件與格式化工具。 */
(function (global) {
  "use strict";

  var html = htm.bind(React.createElement);
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useCallback = React.useCallback;

  function formatBytes(bytes) {
    if (!bytes) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  function formatDate(value) {
    if (!value) return "—";
    var date = new Date(value);
    if (isNaN(date.getTime())) return "—";
    var diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return "剛剛";
    if (diff < 3600) return Math.floor(diff / 60) + " 分鐘前";
    if (diff < 86400) return Math.floor(diff / 3600) + " 小時前";
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + " 天前";
    return date.toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  function Spinner(props) {
    return html`<span class="spinner" aria-label=${props.label || "載入中"}></span>`;
  }

  function EmptyState(props) {
    return html`
      <div class="empty">
        <div class="empty-icon">${props.icon || "📝"}</div>
        <p class="empty-title">${props.title}</p>
        ${props.hint ? html`<p class="empty-hint">${props.hint}</p>` : null}
        ${props.children}
      </div>
    `;
  }

  function Modal(props) {
    useEffect(
      function () {
        function onKey(event) {
          if (event.key === "Escape") props.onClose();
        }
        document.addEventListener("keydown", onKey);
        return function () {
          document.removeEventListener("keydown", onKey);
        };
      },
      [props.onClose]
    );

    return html`
      <div class="modal-backdrop" onClick=${props.onClose}>
        <div
          class=${"modal " + (props.wide ? "modal-wide" : "")}
          role="dialog"
          aria-modal="true"
          aria-label=${props.title}
          onClick=${function (e) {
            e.stopPropagation();
          }}
        >
          <header class="modal-head">
            <h2>${props.title}</h2>
            <button class="icon-btn" onClick=${props.onClose} aria-label="關閉">✕</button>
          </header>
          <div class="modal-body">${props.children}</div>
        </div>
      </div>
    `;
  }

  /* 極簡 toast：呼叫 useToasts() 拿 push()，畫面自己排隊淡出。 */
  function useToasts() {
    var state = useState([]);
    var toasts = state[0];
    var setToasts = state[1];

    var push = useCallback(function (message, kind) {
      var id = Date.now() + Math.random();
      setToasts(function (prev) {
        return prev.concat([{ id: id, message: message, kind: kind || "info" }]);
      });
      setTimeout(function () {
        setToasts(function (prev) {
          return prev.filter(function (item) {
            return item.id !== id;
          });
        });
      }, 4000);
    }, []);

    return [toasts, push];
  }

  function ToastHost(props) {
    return html`
      <div class="toast-host">
        ${props.toasts.map(function (toast) {
          return html`<div key=${toast.id} class=${"toast toast-" + toast.kind}>${toast.message}</div>`;
        })}
      </div>
    `;
  }

  function CopyField(props) {
    var state = useState(false);
    var copied = state[0];
    var setCopied = state[1];

    function copy() {
      var done = function () {
        setCopied(true);
        setTimeout(function () {
          setCopied(false);
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(props.value).then(done, done);
      } else {
        done();
      }
    }

    return html`
      <div class="copy-field">
        <code>${props.value}</code>
        <button class="btn btn-ghost btn-sm" onClick=${copy}>${copied ? "已複製" : "複製"}</button>
      </div>
    `;
  }

  global.UI = {
    html: html,
    formatBytes: formatBytes,
    formatDate: formatDate,
    Spinner: Spinner,
    EmptyState: EmptyState,
    Modal: Modal,
    useToasts: useToasts,
    ToastHost: ToastHost,
    CopyField: CopyField
  };
})(window);
