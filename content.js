/**
 * Swagger UI — "Copy Full Details" Extension
 * Manifest V3 · content.js
 *
 * Features:
 * 1. Per-endpoint copy button (📋 Copy) on each .opblock row
 * 2. Per-tag copy button (📋 Copy All) on each tag/section header
 *    — copies every endpoint under that tag as one Markdown doc
 * 3. Auto-expand: if a block is collapsed, it is temporarily expanded
 *    to let Swagger render its DOM, then collapsed again after scraping
 */

(() => {
  "use strict";

  /* ─── constants ─────────────────────────────────────────────── */
  const BLOCK_BTN_CLASS   = "scfd-copy-btn";
  const TAG_BTN_CLASS     = "scfd-tag-copy-btn";
  const PROCESSED_ATTR    = "data-scfd-injected";
  const TAG_PROCESSED_ATTR = "data-scfd-tag-injected";
  const TOOLTIP_MS        = 2000;
  const EXPAND_WAIT_MS    = 400; // ms to wait after clicking expand

  /* ─── helpers ────────────────────────────────────────────────── */
  const text = (el) => (el ? el.textContent.trim() : "");
  const q    = (scope, sel) => scope.querySelector(sel);
  const qa   = (scope, sel) => [...scope.querySelectorAll(sel)];

  /* ─── check if a block is expanded ──────────────────────────── */
  function isExpanded(block) {
    // Swagger adds .is-open to .opblock when expanded
    // Also check if opblock-body is present and visible
    if (block.classList.contains("is-open")) return true;
    const body = q(block, ".opblock-body");
    if (body && body.offsetParent !== null) return true;
    return false;
  }

  /* ─── expand a block, wait for render, return collapse fn ────── */
  function expandBlock(block) {
    return new Promise((resolve) => {
      if (isExpanded(block)) {
        resolve(null); // already open, no-op collapser
        return;
      }
      // Click the summary control to expand
      const control = q(block, ".opblock-summary-control") ||
                      q(block, ".opblock-summary");
      if (!control) {
        resolve(null);
        return;
      }
      control.click();
      // Wait for Swagger to render the body
      setTimeout(() => {
        // Return a function that collapses the block again
        resolve(() => {
          if (isExpanded(block)) {
            control.click();
          }
        });
      }, EXPAND_WAIT_MS);
    });
  }

  /* ─── scraping ────────────────────────────────────────────────── */

  function scrapeBlock(block) {
    /* ── 1. Method ── */
    const method = text(q(block, ".opblock-summary-method")).toUpperCase() || "UNKNOWN";

    /* ── 2. Path ── */
    const pathEl = q(block, ".opblock-summary-path");
    const path   = (pathEl && pathEl.getAttribute("data-path")) ||
                   text(pathEl) ||
                   "UNKNOWN";

    /* ── 3. Short description ── */
    const shortDesc = text(q(block, ".opblock-summary-description"));

    /* ── 4. Long description ── */
    const longDescEl = q(block, ".opblock-description-wrapper .renderedMarkdown") ||
                       q(block, ".opblock-description-wrapper");
    const longDesc   = text(longDescEl);

    const descParts = [shortDesc, longDesc]
      .map(s => s.trim())
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    const combinedDesc = descParts.join("\n\n");

    /* ── 5. Parameters ── */
    const paramRows = qa(block, "table.parameters tbody tr[data-param-name]");
    let parametersSection = "";

    if (paramRows.length) {
      const header  = "| Name | In | Type | Required | Description |";
      const divider = "|------|------|------|----------|-------------|";

      const rows = paramRows.map((row) => {
        const nameCell = q(row, ".parameter__name");
        let name = "";
        if (nameCell) {
          const firstText = nameCell.childNodes[0]?.textContent?.trim();
          name = firstText || text(nameCell);
        }
        if (!name) name = row.getAttribute("data-param-name") || "—";
        name = name.replace(/\s*\*\s*$/, "").trim();

        let location = text(q(row, ".parameter__in")) || row.getAttribute("data-param-in") || "—";
        location = location.replace(/[()]/g, "").trim();

        const type = text(q(row, ".parameter__type")) || "—";

        const required = (nameCell && nameCell.classList.contains("required")) ||
                         row.classList.contains("required")
          ? "Yes" : "No";

        const descCell = q(row, "td.parameters-col_description");
        let desc = "";
        if (descCell) {
          const markdownEl = q(descCell, ".renderedMarkdown p") ||
                             q(descCell, ".markdown p") ||
                             q(descCell, "p");
          desc = text(markdownEl);
          if (!desc) {
            const input = q(descCell, "input[placeholder]");
            if (input) desc = input.getAttribute("placeholder");
          }
          if (!desc) desc = text(descCell);
        }
        if (!desc) desc = "—";

        return `| ${name} | ${location} | ${type} | ${required} | ${desc} |`;
      });

      parametersSection = `## Parameters\n\n${header}\n${divider}\n${rows.join("\n")}`;
    }

    /* ── 6. Request body schema ── */
    // Swagger renders request body inside .body-param or .opblock-body
    const bodyEl = q(block, ".body-param .body-param__text") ||
                   q(block, ".opblock-body-param-description");
    const bodyText = text(bodyEl);

    /* ── 7. Response examples ── */
    const seenExamples = new Set();
    const exampleBlocks = [];

    qa(block, ".highlight-code code.language-json").forEach((codeEl) => {
      const raw = text(codeEl);
      if (raw && !seenExamples.has(raw)) {
        seenExamples.add(raw);
        exampleBlocks.push(raw);
      }
    });

    qa(block, "textarea.curl, .body-param__example").forEach((el) => {
      const raw = text(el);
      if (raw && !seenExamples.has(raw)) {
        seenExamples.add(raw);
        exampleBlocks.push(raw);
      }
    });

    /* ── 8. Response codes ── */
    const responseSections = [];
    qa(block, "table.responses-table tbody tr.response[data-code]").forEach((row) => {
      const code = row.getAttribute("data-code") ||
                   text(q(row, ".response-col_status")) ||
                   text(q(row, "td:first-child"));

      const descEl = q(row, ".response-col_description .renderedMarkdown p") ||
                     q(row, ".response-col_description p") ||
                     q(row, "td.response-col_description");
      const desc = text(descEl);

      if (code) responseSections.push(`- **${code}** — ${desc || "—"}`);
    });

    /* ── 9. Assemble Markdown ── */
    const lines = [];
    lines.push(`# \`${method}\` ${path}`);
    lines.push("");

    if (combinedDesc) {
      lines.push("## Description");
      lines.push("");
      lines.push(combinedDesc);
      lines.push("");
    }

    if (parametersSection) {
      lines.push(parametersSection);
      lines.push("");
    }

    if (bodyText) {
      lines.push("## Request Body");
      lines.push("");
      lines.push("```json");
      lines.push(bodyText);
      lines.push("```");
      lines.push("");
    }

    if (exampleBlocks.length) {
      lines.push("## Request/Response Examples");
      lines.push("");
      const [first, ...rest] = exampleBlocks;
      lines.push("### Example Response (200)");
      lines.push("");
      lines.push("```json");
      lines.push(first);
      lines.push("```");
      lines.push("");
      rest.forEach((ex, i) => {
        lines.push(`### Example Response (${i + 2})`);
        lines.push("");
        lines.push("```json");
        lines.push(ex);
        lines.push("```");
        lines.push("");
      });
    }

    if (responseSections.length) {
      lines.push("## Response Codes");
      lines.push("");
      responseSections.forEach((s) => lines.push(s));
      lines.push("");
    }

    return lines.join("\n").trimEnd();
  }

  /* ─── scrape with auto-expand ────────────────────────────────── */

  async function scrapeBlockWithExpand(block) {
    const collapse = await expandBlock(block);
    const md = scrapeBlock(block);
    if (collapse) collapse(); // restore collapsed state
    return md;
  }

  /* ─── scrape entire tag section ─────────────────────────────── */

  async function scrapeTagSection(tagSection) {
    // tagSection is the .opblock-tag-section element
    // Get tag name from the h4 inside
    const tagName = text(q(tagSection, "h4.opblock-tag span")) ||
                    text(q(tagSection, "h4.opblock-tag")) ||
                    "Endpoints";

    // Find all .opblock children
    const blocks = qa(tagSection, ".opblock");

    if (!blocks.length) {
      return `# ${tagName}\n\n_No endpoints found._`;
    }

    // Expand all blocks, scrape, then collapse
    const collapseCallbacks = [];
    for (const block of blocks) {
      const collapse = await expandBlock(block);
      if (collapse) collapseCallbacks.push(collapse);
    }

    const sections = blocks.map((block, i) => {
      const md = scrapeBlock(block);
      return md;
    });

    // Collapse all that we opened
    collapseCallbacks.forEach(fn => fn());

    const lines = [];
    lines.push(`# Tag: ${tagName}`);
    lines.push("");
    lines.push(`_${blocks.length} endpoint(s)_`);
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push(sections.join("\n\n---\n\n"));

    return lines.join("\n").trimEnd();
  }

  /* ─── copy to clipboard helper ──────────────────────────────── */

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0;pointer-events:none;top:0;left:0;";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand("copy"); } catch {}
      ta.remove();
    }
  }

  /* ─── set button feedback ────────────────────────────────────── */

  function setButtonState(btn, state) {
    if (state === "loading") {
      btn.textContent = "⏳ Copying…";
      btn.disabled = true;
      btn.classList.add("scfd-loading");
    } else if (state === "success") {
      btn.disabled = false;
      btn.classList.remove("scfd-loading");
      btn.classList.add("scfd-copied");
    } else {
      btn.disabled = false;
      btn.classList.remove("scfd-loading", "scfd-copied");
    }
  }

  /* ─── endpoint copy button ───────────────────────────────────── */

  function createBlockCopyButton(block) {
    const btn = document.createElement("button");
    btn.className = BLOCK_BTN_CLASS;
    btn.setAttribute("type", "button");
    btn.setAttribute("aria-label", "Copy endpoint details as Markdown");
    btn.setAttribute("title", "Copy full endpoint details (auto-expands to capture all data)");
    btn.textContent = "📋 Copy";

    let timer = null;

    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();

      setButtonState(btn, "loading");

      const md = await scrapeBlockWithExpand(block);
      await copyToClipboard(md);

      setButtonState(btn, "success");
      btn.textContent = "✅ Copied!";
      clearTimeout(timer);
      timer = setTimeout(() => {
        btn.textContent = "📋 Copy";
        setButtonState(btn, "idle");
      }, TOOLTIP_MS);
    });

    return btn;
  }

  /* ─── tag-level copy button ──────────────────────────────────── */

  function createTagCopyButton(tagSection) {
    const btn = document.createElement("button");
    btn.className = TAG_BTN_CLASS;
    btn.setAttribute("type", "button");
    btn.setAttribute("aria-label", "Copy all endpoints in this tag as Markdown");
    btn.setAttribute("title", "Copy all endpoints in this section (auto-expands each one)");
    btn.textContent = "📋 Copy All";

    let timer = null;

    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();

      setButtonState(btn, "loading");
      btn.textContent = "⏳ Copying…";

      const md = await scrapeTagSection(tagSection);
      await copyToClipboard(md);

      setButtonState(btn, "success");
      btn.textContent = "✅ All Copied!";
      clearTimeout(timer);
      timer = setTimeout(() => {
        btn.textContent = "📋 Copy All";
        setButtonState(btn, "idle");
      }, TOOLTIP_MS);
    });

    return btn;
  }

  /* ─── inject endpoint button ─────────────────────────────────── */

  function injectBlockButton(block) {
    if (block.hasAttribute(PROCESSED_ATTR)) return;
    block.setAttribute(PROCESSED_ATTR, "1");

    const summary = q(block, ".opblock-summary");
    if (!summary) return;

    const btn = createBlockCopyButton(block);
    const control = q(summary, ".opblock-summary-control");

    if (control && control.nextSibling) {
      summary.insertBefore(btn, control.nextSibling);
    } else if (control) {
      control.parentNode.insertBefore(btn, control.nextSibling);
    } else {
      summary.appendChild(btn);
    }
  }

  /* ─── inject tag button ──────────────────────────────────────── */

  function injectTagButton(tagSection) {
    if (tagSection.hasAttribute(TAG_PROCESSED_ATTR)) return;
    tagSection.setAttribute(TAG_PROCESSED_ATTR, "1");

    // The tag header is an <h4 class="opblock-tag"> (or its wrapper)
    const tagHeader = q(tagSection, "h4.opblock-tag") ||
                      q(tagSection, ".opblock-tag");
    if (!tagHeader) return;

    const btn = createTagCopyButton(tagSection);

    // Insert the button into the tag header row
    // h4.opblock-tag contains: <a> (tag name), small (description), <button> (expand arrow)
    // We want to insert before the last child (arrow button) or just append
    const arrow = q(tagHeader, "button") || q(tagHeader, ".expand-operation");
    if (arrow) {
      tagHeader.insertBefore(btn, arrow);
    } else {
      tagHeader.appendChild(btn);
    }
  }

  /* ─── inject all ─────────────────────────────────────────────── */

  function injectAll(root = document) {
    // Inject into individual endpoint blocks
    qa(root, ".opblock:not([data-scfd-injected])").forEach(injectBlockButton);

    // Inject into tag sections
    // Swagger wraps each tag group in .opblock-tag-section
    qa(root, ".opblock-tag-section:not([data-scfd-tag-injected])").forEach(injectTagButton);
  }

  /* ─── MutationObserver ───────────────────────────────────────── */

  let debounce = null;

  function scheduleInject() {
    clearTimeout(debounce);
    debounce = setTimeout(injectAll, 300);
  }

  function startObserver(swaggerRoot) {
    new MutationObserver((mutations) => {
      const relevant = mutations.some(
        (m) =>
          (m.type === "childList" && m.addedNodes.length > 0) ||
          (m.type === "attributes" &&
            m.attributeName === "class" &&
            m.target.classList?.contains("opblock"))
      );
      if (relevant) scheduleInject();
    }).observe(swaggerRoot, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  /* ─── entry point ────────────────────────────────────────────── */

  function init() {
    const root = document.querySelector(".swagger-ui");
    if (!root) return;
    injectAll(root);
    startObserver(root);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    let tries = 0;
    const poll = setInterval(() => {
      if (document.querySelector(".swagger-ui") || ++tries > 40) {
        clearInterval(poll);
        init();
      }
    }, 250);
  }
})();