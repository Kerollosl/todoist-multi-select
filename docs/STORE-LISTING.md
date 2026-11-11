# Chrome Web Store listing: Todoist Task Toolkit

Placeholders to replace before submitting: `TODO_PRIVACY_URL`, `TODO_SUPPORT_URL`, `TODO_AUTHOR_NAME`
(also `homepage_url` in manifest.json, currently `https://todo-support-url.invalid/`, and the links in popup.html / options.html).

## Short description (132 chars max)
Copy selected Todoist tasks as a clean list, with an optional board-grouping helper. Unofficial; not affiliated with Todoist.

## Long description
Todoist Task Toolkit adds two things to Todoist in your browser.

Copy selected tasks (on by default)
Select several tasks, then press Ctrl/Cmd + Shift + C or use the floating button. The tasks are copied as a numbered list with their descriptions and links, and you are asked whether to mark them complete (the default answer is Keep). It also adds a Priority shortcut next to Todoist's own Labels button in the selection toolbar.

Groups + Work (optional, off by default)
Turn it on in the extension options. On a board it adds a sidebar button that creates any missing Group 1, Group 2 and Group 3 sections and then opens chatgpt.com with a drafted sorting request for ChatGPT Work, which you are signed in to. It needs access to chatgpt.com, which Chrome asks you to approve when you switch the option on. If ChatGPT's page has changed or any check fails, the extension stops and lets you copy the request instead. Requires a ChatGPT plan with Work and the Todoist connector. The model and settings it asks for are set inside ChatGPT's own page and may change.

Unofficial. Not affiliated with, endorsed by or sponsored by Todoist (Doist) or OpenAI. Todoist and ChatGPT are trademarks of their owners. Todoist and ChatGPT change their pages often; if something stops working after an update, please contact support (TODO_SUPPORT_URL).

## Single purpose
Make selecting and organizing tasks on the Todoist web app faster: copy selected tasks as text and, if enabled, prepare board sections for a sorting request.

## Permission justifications
- clipboardWrite: place the copied task list on the clipboard when the user clicks Copy or uses the shortcut.
- storage: remember the two on/off options (sync) and hold a one-time, ten-minute hand-off for the ChatGPT draft (session storage, deleted when used).
- scripting: register the ChatGPT hand-off script only while Groups + Work is on and chatgpt.com access is granted.
- Host access app.todoist.com and todoist.com (content script): read the selection and add the Copy button and sidebar button.
- Optional host access chatgpt.com: requested only when the user turns on Groups + Work; used to draft the sorting request. Removed again when the option is turned off.
- No remote code. No analytics.

## Privacy answers
- Data collected: none by the developer. No servers, no tracking, no account.
- Copied tasks go only to the user's clipboard.
- Groups + Work (if enabled by the user): the extension passes a fixed sorting prompt and the current Todoist project link to chatgpt.com in the user's own browser session. It does not read the user's task contents for this. Once the user (or the extension, after its checks) sends the draft, ChatGPT and its Todoist connector handle the data under OpenAI's and Todoist's terms.
- Settings (two on/off flags) are stored in Chrome sync storage.
- Certify: not sold or shared, not used for unrelated purposes, not used for creditworthiness.

## Privacy policy text (host at TODO_PRIVACY_URL)
Todoist Task Toolkit does not collect, store on a server, sell or share personal data. Everything runs in your browser. Copying tasks places text on your clipboard only. Two settings are kept in Chrome storage. If you turn on Groups + Work, the extension opens chatgpt.com in your browser and drafts a request containing fixed instructions and your Todoist project link; once sent, ChatGPT and its Todoist connector process it under their own policies. You can turn the feature off any time, which also removes the extension's access to chatgpt.com. Contact: TODO_SUPPORT_URL.

## Assets (owner follow-up)
Screenshots 1280x800 and promo tile 440x280 are to be made by the owner. The store icon is icons/icon128.png.
