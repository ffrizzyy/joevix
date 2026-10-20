# Joevix privacy policy

Joevix is a local-only browser extension. It changes how pages look on your screen and does
nothing else.

## What is stored

In `chrome.storage.local`, on this device only:

| Key               | Contents                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `joevix:meta`     | Schema version number                                                                                            |
| `joevix:settings` | "Turn off everywhere" flag, onboarding flag, default theme id                                                    |
| `joevix:themes`   | Themes you created (six colors and five font values each)                                                        |
| `joevix:sites`    | Per-site settings: site hostname, theme id, section order, hidden sections, layout, width, font size, adapter id |

## What is not stored

- Page text, including lyrics
- Browsing history or visit timestamps
- Cookies, form fields, or passwords
- Any identifier, account, or device fingerprint

## What leaves the device

Nothing. The extension contains no `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, or
beacon calls, and no remote code, fonts, or images. The generated CSS cannot contain `url()`,
`@import`, or `attr()`.

## Permissions

- `storage` — save your settings.
- `activeTab` — let the popup talk to the page you just opened it on.
- `scripting` — inject the styling script into a page you enabled.

Site access is an optional host permission granted one origin at a time, when you turn Joevix on
for that site. It can be revoked at any time from the browser's extension settings or with
**Delete all my data**.

## Diagnostics

**Copy diagnostics** writes a short report to the clipboard: version, site, adapter id and
version, section counts, and the labels of sections that did not match. It contains adapter
labels and no page text. It is never sent anywhere.

## Deleting your data

**Options → Data and privacy → Delete all my data** clears storage, revokes every optional host
permission, and unregisters all content scripts.
