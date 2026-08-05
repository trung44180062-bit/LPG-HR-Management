# Handover — Zalo Bot notification layer

> **Purpose of this document.** The Zalo bot integration is live end-to-end. This
> handover exists so the next session can pick up **message optimisation** without
> re-deriving anything. Read it top to bottom before touching code.
>
> App version: **v5.9** · Date: **2026-08-04** · Headcount: **23**
> Repo: `LPG-HR-Management` (GitHub Pages, static, Firebase Realtime DB, Spark plan)
> Read alongside `PHUONG-AN-ZALO-BOT.md`, `MA-TRAN-THONG-BAO.md`,
> `MA-TRAN-ZALO-DA-CHAY.xlsx`.

---

## 1. What is already working — do not rebuild this

```
Browser (GitHub Pages, no secrets)
        │  writes
        ▼
Firebase RTDB   shiftwork_v2/zaloQueue/<notifId>
        │  polled every 60s by a time-driven trigger
        ▼
Google Apps Script "LPGT Zalo Bot"   ← the ONLY place holding the bot token
        │  HTTPS
        ▼
Zalo Bot API  ──▶  one chat
```

| Piece | Where | State |
|---|---|---|
| Channel matrix, queue writer | `js/21-notify.js` | live |
| Hook into every notification | `js/13-portal.js:100` `newNotif()` | live |
| Sub-kind tags (`zk`) | `js/08-requests.js`, `js/13-portal.js` | live |
| Courier, batching, quiet hours | `_RIENG-TU-KHONG-UP-GITHUB/zalo-gas/Code-MOI.gs` | live, trigger on |
| Firebase rules for `zaloQueue` / `zaloStat` | `_RIENG-TU-KHONG-UP-GITHUB/firebase-rules.json` | live |

**Every notification in the app funnels through one function** — `newNotif()` at
`js/13-portal.js:100`. That single choke point is why the integration touched so
few files. Preserve that property; do not add a second path to Zalo.

`zaloEnqueue()` is wrapped in `try/catch` and returns silently on any problem.
**Zalo must never be able to break the app.** Keep it that way.

### Secrets — never put these in this repo

The bot token, the Firebase service-account JSON, the webhook URL and the target
`chat_id` all live in Apps Script only, in
`_RIENG-TU-KHONG-UP-GITHUB/zalo-gas/Code-MOI.gs` (that folder sits **outside** the
repo). `git grep -i "zapps\|private_key"` before every push.

---

## 2. Hard-won constraints — these cost hours to discover

Do not re-litigate any of these. Each was tested and confirmed.

1. **The browser cannot call the Zalo API.** `bot-api.zapps.me` returns no
   `Access-Control-Allow-Origin` header at all, so every origin is blocked by CORS.
   A server-side relay is mandatory. This is why Apps Script exists.

2. **`setWebhook` requires `secret_token`.** Omitting it returns
   `400 Bad request: The secret_token must not be empty`. Telegram treats this as
   optional; Zalo does not.

3. **`getUpdates` without `timeout: 0` long-polls for ~50s then returns `408`.**
   That 408 means "no pending messages", not an error.

4. **`getWebhookInfo` and `deleteWebhook` return 404 / 400.** They are not
   implemented by Zalo. Do not build diagnostics on them.

5. **The bot does not receive group messages.** It can be added to a group and can
   *send* there, but it never receives — so the group `chat_id` cannot be discovered
   through the bot. Only the 1-1 `chat_id` was obtainable. See §3.1.

6. **Never put the string `zalo` in a file path.** The office network proxy killed
   `js/21-zalo.js` with HTTP **499** (connection closed by proxy) while every other
   file loaded. Renaming to `js/21-notify.js` fixed it. Function names are fine —
   they never travel over the network.

7. **Base-schedule edits notify nobody.** `js/04-schedule.js` contains zero
   `newNotif` calls. Only *actual* schedule edits (`js/06-calendar.js:271`) notify.
   This is pre-existing app design, unrelated to Zalo.

8. **Creating a request notifies nobody.** Requests only generate notifications at
   approval time, and `notifyReqParties` excludes the person who just acted. An
   admin who files and approves their own request produces zero notifications.

---

## 3. The problems to solve

### 3.1 Fan-out waste — the headline issue

One calendar event with `scope: 'all'` calls `newNotif` once per employee
(`js/20-events.js:135`, looping over `evRecipients()`). At 23 people that is 23
queue rows. The courier bundles by `to | group | title`, and `to` differs on every
row, so it sends **23 identical messages into the same chat**.

The in-app behaviour is correct — 23 people each need a bell. The Zalo behaviour is
wrong — one group needs one message.

**Root cause:** the queue models *recipients*, but the transport currently has a
single destination. Recipient-level rows only make sense once delivery is 1-1.

**Proposed fix — collapse identical content at the courier:**

Add a content fingerprint when enqueuing, e.g.
`fp = hash(group + title + lines.join('\n'))`, stored on each queue row. In
`doTick_`, bundle by `fp` **when the destination is a group chat**, and by
`to | group | title` when destinations are per-person. One row's content is sent;
the other rows' `toName` values are folded into a recipient line.

Result for the event above: 1 message instead of 23.

Keep the collapse in the courier, not the browser. Twenty-three browsers cannot
agree on what to merge; one courier can. This is the same reasoning that put the
token there.

### 3.2 Mentioning employees in a group message

Requested: `@` the affected employee inside the group message so it pings them.

**Unknown that must be resolved first:** whether the Zalo Bot API supports
mention entities on `sendMessage`, and whether a mention can be addressed by
anything the app knows. The app stores employee codes (`vc44180062`) and display
names — it does **not** store Zalo user IDs. A mention almost certainly needs the
Zalo user ID.

Probe before designing: send a `sendMessage` from Apps Script with a `mention`,
`entities`, or `mentions` field and inspect the error. Do this in a throwaway
function, one shape per run, and record what each returns.

If mentions turn out to need Zalo user IDs, they are blocked behind per-person
account linking (§3.3) — at which point 1-1 delivery is usually the better answer
anyway, and mentions become unnecessary.

Interim measure that costs nothing: keep the plain-text `👤 <name>` line, and put
it on the **first** line for group messages so it is visible in the notification
preview.

### 3.3 One destination for everything

All 19 notification types currently land in a single chat. Two consequences:

- Approval results, shift swaps and cover requests are personal; the whole factory
  can read them.
- Nobody can tell at a glance which messages are theirs.

The original plan (`PHUONG-AN-ZALO-BOT.md` §4) specifies per-person linking: the app
issues a 6-digit OTP, the employee sends `LK <empId> <otp>` to the bot, the webhook
stores `zalo/link/<empId> = { chatId }`. **The webhook already exists and already
receives 1-1 messages**, so the hard part is done — `doPost` in `Code-MOI.gs` just
needs to parse the `LK` command.

Suggested split once linking exists:

| Content | Destination |
|---|---|
| Approval results, swaps, cover, schedule changes | 1-1 |
| Calendar events, general announcements | group |

### 3.4 Templates should be data, not code

Message wording currently lives in four const maps in `js/21-notify.js`
(`ZALO_TITLE`, `ZALO_ACTION`, `ZALO_CHANNEL`, `ZALO_INFO_CHANNEL`) plus body
assembly in `zaloLines()`. Changing a word means editing and redeploying.

Requested: an admin tab where templates can be edited.

**Proposed shape:** move the maps into `S.settings.zaloTpl`, seeded from the current
constants on first run so nothing breaks. Build an admin screen listing all 19
types with editable title / body / action / channel / group-key, a live preview
using sample data, and a "send test to me" button.

Body templates need placeholders. Keep the set small and documented:
`{name}` `{empId}` `{date}` `{oldCode}` `{newCode}` `{reqType}` `{by}` `{reason}`
`{eventTitle}` `{link}`. Render with a plain string replace; do not evaluate
anything from settings as code.

Ship the editor read-only first (show what will be sent), then make it writable.
That ordering catches template bugs before they can reach 23 people.

---

## 4. Further ideas worth considering

Ordered by value-per-effort as judged from the notification matrix. The first two
are, by a wide margin, the most valuable things left.

1. **Approver digest (E1).** The app still tells approvers nothing when a request
   arrives; they only find out by opening the Approvals tab. Two digests a day
   (11:00, 16:30) listing pending counts and the longest wait. Send nothing when the
   list is empty. Runs entirely in Apps Script — a time trigger reading
   `S.requests` and `reqNextLevel`. No app change needed.

2. **Urgent requests (E2).** Overtime or swap requests for *today or tomorrow*
   cannot wait for a digest. Send immediately to the approver whose turn it is.

3. **Daily group roster post.** Every morning at 06:00, post today's manning to the
   group: who is on D, who is on N, who is covering, headcount versus `minD`/`minN`.
   Purely derived from data the app already has, and it makes the group chat useful
   to people who never open the app.

4. **Manning shortfall alert.** When an edit or an approval drops a day below
   `S.settings.minD` / `minN` / `minO`, warn the group at once. This is the one
   notification with real operational consequences at an LPG terminal — everything
   else can wait a few minutes.

5. **Period-close reminder (E4).** Days 18–19 of the 21→20 cycle, list per person
   how many worked overtime days still have no request filed. High value, low noise,
   once a month.

6. **Stale-request nudge (E3) and unanswered-cover nudge (E6).** Once each, never
   repeated. Cheap to add on top of the digest trigger.

7. **Meal-count summary.** `js/19-meal.js` already computes overtime meal portions.
   A short daily post to the group ("tomorrow: 7 extra dinners") saves the kitchen a
   phone call. Nothing new to compute.

8. **Weekly quota report.** `zaloStat/<YYYY-MM>` is already being written by the
   courier. Post a weekly line: messages sent, share of the 3 000 free quota, top
   categories. Keeps the channel honest and catches runaway loops early.

9. **Print-run confirmations.** `S.printLog` exists but nobody is told when forms
   are printed. A one-line group post closes the loop for the office.

Items 3, 4, 7, 8 need no per-person linking — they are group-appropriate by nature,
so they can ship before §3.3.

---

## 5. Rules to keep

- **Message budget: ~16 messages per person per month.** The free tier (3 000/month,
  50 users) is not the constraint — channel credibility is. A bot that pings 25
  times a month with trivia gets muted, and then the "request rejected" message goes
  unread too.
- **One event, one message.** Merging is always preferable to a second message.
- **First line is the conclusion.** The reader must understand it at a glance in the
  notification preview.
- **Every actionable message ends with the action.** No action means the message
  probably should not have been sent.
- **Good news that needs no response stays in the app.** See the ⚪ rows in the
  matrix — `swapOk`, `coverOk`, `fe`, `provapproved`.
- **Intermediate states never go to Zalo** (rule R1). This is the single largest
  saving: it removes roughly 135 messages a month.

---

## 6. Still missing from the anti-spam rules

| Rule | State | What is needed |
|---|---|---|
| R3 — cancel if already read in-app | not built | app must record a per-person `lastSeen` timestamp |
| R4 — quiet hours | half built | 21:30–06:30 blocks 🟡 messages; night-shift staff (N, 20:00–08:00) are **not** exempt. Question Q1 was never answered |
| R5 — never send an empty digest | n/a | no digest exists yet |

`R1`, `R2` and `R6` are built and working.

---

## 7. How to test a change

1. Push to GitHub, open the app, hard-reload (`Ctrl+Shift+R`).
2. Console check: `typeof zaloEnqueue` must return `"function"`. If it returns
   `"undefined"`, the file did not load — check for HTTP 499 (see constraint 6).
3. Perform an action that **actually** notifies. The reliable single-person test is
   editing another employee's **actual** schedule cell to a code different from the
   standard one. Not your own row, not back to standard, not the same code, not
   clearing the cell — all four are silently skipped by design
   (`js/06-calendar.js:257–272`).
4. Apps Script → `B4_XEM_HANG_DOI` shows the queue.
5. `B5_GUI_NGAY` sends immediately, bypassing the batch window and quiet hours.
6. Apps Script → Executions for courier errors.

The trigger runs every minute, so 🔴 messages arrive within 60 seconds without any
manual step. 🟡 messages wait `BATCH_WAIT_MIN` (currently 8 minutes) — a quiet Zalo
right after creating an event is expected, not a fault.

---

## 8. Files

| Path | Role |
|---|---|
| `js/21-notify.js` | channel matrix, message assembly, queue writer |
| `js/13-portal.js:100` | `newNotif()` — the single hook |
| `js/06-calendar.js:257` | actual-schedule edits; note the four skip conditions at 257–272 |
| `js/08-requests.js:867` | `notifyReqParties()` — approval results |
| `js/20-events.js:126` | `evSendNotifs()` — the fan-out described in §3.1 |
| `MA-TRAN-ZALO-DA-CHAY.xlsx` | all 19 live notification types, rules, backlog |
| `_RIENG-TU-KHONG-UP-GITHUB/zalo-gas/Code-MOI.gs` | courier — **holds all secrets** |
| `_RIENG-TU-KHONG-UP-GITHUB/firebase-rules.json` | rules for `zaloQueue`, `zaloStat` |

---

## 9. Suggested order of work

1. **§3.1 fan-out collapse** — biggest waste, courier-only change, no app deploy.
2. **§4.1 approver digest** — biggest unmet need, Apps Script only.
3. **§4.4 manning shortfall alert** — highest operational value.
4. **§3.4 template tab** — makes everything after it cheaper to tune.
5. **§3.3 per-person linking** — unlocks privacy, and probably mentions (§3.2) too.

Steps 1–3 need no changes to the app at all. That is deliberate: each deploy to
GitHub Pages is a manual folder upload, and the office proxy has already eaten one
file.
