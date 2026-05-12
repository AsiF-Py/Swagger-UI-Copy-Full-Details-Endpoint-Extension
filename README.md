# Swagger UI — Copy Full Details Extension

A Chrome extension that adds **Copy** buttons to every endpoint and tag section in Swagger UI, letting you grab full API details as clean Markdown in one click — no manual expanding required.

![Chrome](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)

---

## Features
![Preview](https://i.imgur.com/azC84fM.png)

- **📋 Copy** button on every endpoint row — copies method, path, description, parameters, request body, response codes, and JSON examples
- **📋 Copy All** button on every tag/section header — copies every endpoint under that section as one combined Markdown document
- **Auto-expand** — collapsed endpoints are automatically opened, scraped, then closed again; you never have to manually expand anything
- Output is clean **Markdown** — paste directly into Notion, Obsidian, GitHub issues, or any docs tool
- Works on any page running Swagger UI (local dev servers, hosted API docs, etc.)

---

## Preview

~~~markdown
# `POST` /api/v2/auth/register

## Description
Register User V2

## Parameters

| Name     | In   | Type   | Required | Description      |
|----------|------|--------|----------|------------------|
| username | body | string | Yes      | Unique username  |
| password | body | string | Yes      | Min 8 characters |

## Response Codes

- **200** — Success
- **422** — Validation Error

## Request/Response Examples

### Example Response (200)

```json
{ "access_token": "...", "token_type": "bearer" }
```
~~~

---

## Installation

### From Source (Developer Mode)

> No Chrome Web Store listing yet — load it manually in seconds.

1. **Download or clone this repo**

   ```bash
   git clone https://github.com/your-username/swagger-copy-extension.git
   ```

   Or click **Code → Download ZIP** and extract it.

2. **Open Chrome Extensions page** — go to `chrome://extensions` in your browser.

3. **Enable Developer Mode** — toggle **Developer mode** on (top-right corner).

4. **Load the extension** — click **Load unpacked** → select the folder you cloned/extracted.

5. **Done** — open any Swagger UI page and the Copy buttons will appear automatically.

---

## File Structure

```
swagger-copy-extension/
├── manifest.json       # Extension manifest (Manifest V3)
├── content.js          # Main script — injects buttons and scrapes DOM
├── styles.css          # Button styles
└── README.md
```

---

## Usage

### Copy a single endpoint

Click the **📋 Copy** button on any endpoint row.

- If the endpoint is collapsed, it will **auto-expand**, copy the data, then collapse back.
- The button briefly shows **✅ Copied!** as confirmation.

### Copy all endpoints in a section

Click the **📋 Copy All** button on a tag header (e.g. "Authentication V2", "Health").

- Every endpoint under that tag is expanded one by one, scraped, then collapsed.
- The button shows **⏳ Copying…** while working, then **✅ All Copied!** when done.
- Output is one Markdown document with all endpoints separated by `---`.

### Paste anywhere

The copied Markdown works in:

- **Notion** — paste as plain text or use a code block
- **Obsidian / Markdown editors** — renders natively
- **GitHub** — issues, PRs, wikis
- **Confluence** — use the Markdown macro
- **Slack / Discord** — paste as a code snippet

---

## How It Works

1. A `MutationObserver` watches the Swagger UI root for new `.opblock` and `.opblock-tag-section` elements as Swagger renders dynamically.
2. On detection, Copy buttons are injected into the DOM — one per endpoint summary row, one per tag header.
3. On click, if the target block is collapsed, the extension programmatically clicks the accordion toggle and waits ~400ms for Swagger to render the full body (parameters table, response codes, JSON examples).
4. The scraper reads the rendered DOM and assembles a Markdown string.
5. The Markdown is written to the clipboard via `navigator.clipboard.writeText()` with a `textarea` fallback for strict CSP environments.

---

## Compatibility

| Environment | Status |
|---|---|
| Swagger UI (CDN / self-hosted) | ✅ Supported |
| FastAPI `/docs` | ✅ Supported |
| Django REST Framework (drf-yasg, drf-spectacular) | ✅ Supported |
| ReDoc | ❌ Not supported (different DOM) |
| Postman / Insomnia embedded docs | ❌ Not supported |

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-change`)
3. Commit your changes (`git commit -m 'add: my change'`)
4. Push and open a Pull Request

---
