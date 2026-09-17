# Signed-links URL form — resolved for the employee signing page

wm-demo HEAD `39c44bb`. `wm-demo/docs/SIGNED-LINKS.md` says the recipient
URL form is `/l/<token>`, "served by the static shell (page routing is the
client/shell's job, not this module's)". Verified against the actual
server, not assumed:

```
$ grep -n '"/l/' wmdemo/server.py
2474:  if self.path.startswith("/l/") and engage_serve.handle_head(...)
3811:  elif (self.path.startswith("/l/") and engage_serve.handle_get(...))
```

`/l/<token>` in `wmdemo/server.py` is wired to `wmdemo/engage/serve.py`,
which is Engage's own PUBLIC landing-page click-tracker (ENGAGE-BUILD-
CONTRACT.md §2) — a completely different `links` module (`wmdemo/engage/
links.py`, 10-character tokens minted by `links.mint`/`TOKEN_LEN=10`) from
`wmdemo/signed_links.py` (the module SIGNED-LINKS.md itself documents,
tokens shaped `<link id>.<32 random urlsafe bytes>`). Nothing in wm-demo
serves a `signed_links.py` token at `/l/<token>` — that path 404s for one
today (a `signed_links` token doesn't parse as an engage-links token, and
`engage_serve.handle_get` answers "not found" for anything it can't
resolve).

**Decision:** the employee-facing signing page lives at `POS-Admin/sign.html`
(shared/hw-sign-page.jsx + shared/hw-link-client.js), and the URL form for a
`wmdemo/signed_links.py` token is:

```
<origin>/sign.html#<token>
```

A hash fragment, not a query param or path segment — the token never
appears in a request line, is never sent to any server (fragments are
client-side only), and never lands in server access logs or a Referer
header. `shared/hw-sign-page.jsx` reads it once off `location.hash` and
immediately strips it via `history.replaceState` (same reasoning
`shared/hw-live.js`'s own `takeTokenFromURL()` gives for its `?hwtoken=`
query param), holding it in memory only for the life of the tab — it is
never written to `localStorage`/`sessionStorage` anywhere in this page's
own code (see shared/hw-link-client.js's header comment).

**Action for the wm-demo side:** whichever caller builds the recipient URL
for a `signature` link (`writeups/send.py`'s approve-and-send today; the
onboarding document-ack flow whenever it is built) should construct
`<POS-Admin origin>/sign.html#<token>`, not `/l/<token>`. `docs/
SIGNED-LINKS.md`'s own "URL form" line should be updated to name this
concretely instead of "served by the static shell" — the shell's own
answer is now on record here.
