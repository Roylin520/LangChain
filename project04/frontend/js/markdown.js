/* Markdown 渲染：wiki link 轉成站內連結，輸出一律過 DOMPurify。 */
(function (global) {
  "use strict";

  marked.setOptions({ gfm: true, breaks: true, headerIds: false, mangle: false });

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function stripFrontmatter(text) {
    var match = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text || "");
    return match ? text.slice(match[0].length) : text || "";
  }

  /* [[目標|顯示文字]] → 站內連結；![[附件]] 目前沒有檔案儲存，降級成純文字標示。 */
  function replaceWikiLinks(text) {
    return text.replace(/(!?)\[\[([^\]\n]+)\]\]/g, function (_all, bang, inner) {
      var parts = inner.split("|");
      var target = parts[0].trim();
      var label = (parts[1] || target).trim();
      var anchor = target.split(/[#^]/)[0].trim();
      if (bang) return "`📎 " + label + "`";
      return '<a class="wikilink" href="#" data-wikilink="' + escapeHtml(anchor) + '">' + escapeHtml(label) + "</a>";
    });
  }

  function render(text) {
    var body = replaceWikiLinks(stripFrontmatter(text));
    var html = marked.parse(body);
    return DOMPurify.sanitize(html, { ADD_ATTR: ["data-wikilink", "target"] });
  }

  global.Markdown = {
    render: render,
    stripFrontmatter: stripFrontmatter
  };
})(window);
