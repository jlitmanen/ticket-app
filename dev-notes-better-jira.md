# "A Better Jira" — Development Notes
> **Stage:** Early Concept / Planning  
> **Last Updated:** 2026-03-12  
> **Stack:** PocketBase (backend / auth / file storage) + frontend TBD  
> **Scope:** Projects, Tickets, Users & Roles, External Reporters, Kanban Board, Notifications

---

## Table of Contents
1. [Vision & Goals](#1-vision--goals)
2. [Tech Stack & Architecture](#2-tech-stack--architecture)
3. [Core Concepts & Domain Model](#3-core-concepts--domain-model)
4. [PocketBase Collections](#4-pocketbase-collections)
5. [Feature Specs](#5-feature-specs)
   - 5.1 [Projects](#51-projects)
   - 5.2 [Tickets](#52-tickets)
   - 5.3 [Users & Roles](#53-users--roles)
   - 5.4 [External Reporter](#54-external-reporter)
   - 5.5 [Kanban Board & Views](#55-kanban-board--views)
   - 5.6 [Notifications](#56-notifications)
6. [Acceptance Criteria](#6-acceptance-criteria)
7. [PocketBase API Notes](#7-pocketbase-api-notes)
8. [Resolved Decisions](#8-resolved-decisions)
9. [Open Questions](#9-open-questions)

---

## 1. Vision & Goals

**Problem:** Jira is powerful but notoriously slow, over-engineered, and hostile to non-technical users. Ticket creation has too much friction. Reporting from external stakeholders requires full account setup.

**Goal:** A focused, single-workspace project/ticket tracker that is:
- Fast to load and use
- Opinionated enough to stay simple, flexible enough to be real
- Open to external input (reporters) without sacrificing traceability
- Kanban-first with a clear, fixed workflow
- Notifies the right people at the right time — in-app and by email

**Non-goals (v1):**
- Time tracking / billing
- Custom workflows or status configuration
- Sprint planning / iterations
- Multi-workspace / multi-tenant

---

## 2. Tech Stack & Architecture

### Backend — PocketBase
PocketBase is a single-binary backend that provides:
- **SQLite database** — all collections defined and managed via PocketBase admin UI or migrations
- **Built-in auth** — email/password for Users; custom token flow for Reporters
- **File storage** — attachments stored natively via PocketBase's file fields (local filesystem, easily swapped to S3)
- **REST + Realtime API** — auto-generated CRUD endpoints per collection; SSE-based realtime subscriptions for live board updates and in-app notifications
- **Hooks / JS extensions** — server-side logic (auto-generate `short_id`, send emails, create notification records) written in PocketBase's JS hooks (`pb_hooks/`)

### Frontend
- Communicates with PocketBase via the **PocketBase JS SDK** (`pocketbase` npm package)
- Realtime board updates via `pb.collection('tickets').subscribe()`
- In-app notifications via `pb.collection('notifications').subscribe()`

### Email
- PocketBase's built-in SMTP config handles transactional emails
- Custom emails (reporter magic links, notification digests) sent from `pb_hooks/` using `$app.newMailClient()`

### File Attachments
- Defined as a `file` field on the `tickets` collection in PocketBase
- PocketBase handles upload, storage, serving, and access control automatically
- Max file size and allowed types configured in the collection schema
- Files served via PocketBase's `/api/files/` endpoint with auth token validation

---

## 3. Core Concepts & Domain Model

```
App (single workspace)
└── Projects (1..n)
    └── Tickets (1..n)
        ├── Assignee → User
        ├── Reporter → User OR external Reporter (linked by email per project)
        ├── Comments (internal flag for team-only notes)
        ├── Attachments (PocketBase file fields)
        └── History / Audit Log

Users (PocketBase auth collection)
└── ProjectMemberships → Role per project

Reporter (external, no login)
└── One record per unique email per project
    └── Tickets (1..n)
```

### Entity Relationships

| Entity | Belongs To | Has Many |
|---|---|---|
| Project | App | Tickets, ProjectMemberships |
| Ticket | Project | Comments, Attachments (file field), TicketHistory |
| User | App (PB auth) | ProjectMemberships, assigned Tickets |
| ProjectMembership | Project + User | — |
| Reporter | Project (unique per email) | Tickets |
| Comment | Ticket | — |
| Notification | User | — |

---

## 4. PocketBase Collections

> All collections use PocketBase's auto-generated `id` (15-char string). `created` and `updated` timestamps are automatic.

---

### 4.1 `projects`

| Field | Type | Notes |
|---|---|---|
| `name` | text (required, max 100) | Display name |
| `slug` | text (required, unique) | URL-safe, auto-generated from name |
| `description` | text | Optional |
| `status` | select | `active` \| `archived` |
| `reporter_intake_enabled` | bool | Enables public reporter form |
| `reporter_intake_token` | text | Random token used in public URL, auto-generated |
| `created_by` | relation → `users` | Project creator / initial owner |

---

### 4.2 `tickets`

| Field | Type | Notes |
|---|---|---|
| `short_id` | text (unique) | e.g. `PROJ-42`, set via `pb_hooks` on create |
| `project` | relation → `projects` | Required |
| `title` | text (required, max 200) | |
| `description` | editor / text | Markdown |
| `type` | select | `bug` \| `feature` \| `task` \| `chore` \| `question` |
| `status` | select | `backlog` \| `waiting` \| `in_progress` \| `in_review` \| `done` \| `rejected` |
| `priority` | select | `none` \| `low` \| `medium` \| `high` \| `critical` |
| `assignee` | relation → `users` | Nullable |
| `reporter_user` | relation → `users` | Nullable — set when reporter is a team member |
| `reporter_ext` | relation → `reporters` | Nullable — set when reporter is external |
| `labels` | json | `string[]` — free text tags |
| `due_date` | date | Nullable |
| `position` | number | Float, for ordering within a status column |
| `attachments` | file (multiple) | PocketBase native file field, up to 10 files, 20MB each |

> **Constraint:** `reporter_user` and `reporter_ext` are mutually exclusive. Enforced in `pb_hooks` on create/update. At least one must be set.

**PocketBase hook — `short_id` generation (`pb_hooks/tickets.pb.js`):**
```js
onRecordBeforeCreateRequest((e) => {
  const project = $app.dao().findRecordById("projects", e.record.get("project"));
  const slug = project.get("slug").toUpperCase();
  // count existing tickets in this project, increment
  const count = $app.dao().findRecordsByFilter(
    "tickets", `project = "${project.id}"`, "", 0, 0
  ).length;
  e.record.set("short_id", `${slug}-${count + 1}`);
}, "tickets");
```

---

### 4.3 `users` *(PocketBase built-in auth collection)*

PocketBase's default `users` auth collection is used as-is with these additional fields:

| Field | Type | Notes |
|---|---|---|
| `name` | text (required) | Display name |
| `avatar` | file | PocketBase file field |
| `is_active` | bool | Default `true`; deactivated users cannot log in |

> Auth (email/password, JWT, password reset) is fully handled by PocketBase.

---

### 4.4 `project_memberships`

| Field | Type | Notes |
|---|---|---|
| `project` | relation → `projects` | Required |
| `user` | relation → `users` | Required |
| `role` | select | `owner` \| `admin` \| `member` \| `viewer` |

> Unique constraint on `(project, user)`.

#### Role Permission Matrix

| Permission | Owner | Admin | Member | Viewer |
|---|:---:|:---:|:---:|:---:|
| Delete project | ✅ | ❌ | ❌ | ❌ |
| Archive / restore project | ✅ | ❌ | ❌ | ❌ |
| Manage members & roles | ✅ | ✅ | ❌ | ❌ |
| Edit project settings | ✅ | ✅ | ❌ | ❌ |
| Toggle reporter intake | ✅ | ✅ | ❌ | ❌ |
| Create tickets | ✅ | ✅ | ✅ | ❌ |
| Edit any ticket | ✅ | ✅ | ✅ | ❌ |
| Delete ticket | ✅ | ✅ | ❌ | ❌ |
| Comment (including internal) | ✅ | ✅ | ✅ | ❌ |
| View tickets & comments | ✅ | ✅ | ✅ | ✅ |

---

### 4.5 `reporters` *(External / anonymous)*

One record per unique email per project.

| Field | Type | Notes |
|---|---|---|
| `project` | relation → `projects` | Required |
| `name` | text (required) | Provided at first submission |
| `email` | text (required) | Unique per project (enforced in `pb_hooks`) |
| `token_hash` | text | Hashed magic-link token for re-authentication |
| `token_expires_at` | date | Refreshed on each magic link send |

> **Reporter deduplication:** When a submission arrives, look up existing `reporters` record by `(project, email)`. If found, reuse it and generate a new magic link token. If not found, create a new record.

---

### 4.6 `comments`

| Field | Type | Notes |
|---|---|---|
| `ticket` | relation → `tickets` | Required |
| `author_user` | relation → `users` | Nullable |
| `author_reporter` | relation → `reporters` | Nullable |
| `body` | text (required) | Markdown |
| `is_internal` | bool | `true` = team-only, hidden from reporter view |

> **Constraint:** Exactly one of `author_user` or `author_reporter` must be set.

---

### 4.7 `ticket_history`

Append-only audit log. Written by `pb_hooks` on every ticket field change.

| Field | Type | Notes |
|---|---|---|
| `ticket` | relation → `tickets` | Required |
| `field` | text | Name of the changed field |
| `old_value` | text | Serialized previous value |
| `new_value` | text | Serialized new value |
| `actor_user` | relation → `users` | Nullable |
| `actor_reporter` | relation → `reporters` | Nullable |

---

### 4.8 `notifications`

| Field | Type | Notes |
|---|---|---|
| `user` | relation → `users` | Recipient |
| `type` | select | `ticket_assigned` \| `ticket_commented` \| `ticket_status_changed` \| `ticket_created` \| `mention` |
| `ticket` | relation → `tickets` | Context ticket |
| `actor_user` | relation → `users` | Who triggered it (nullable) |
| `message` | text | Pre-rendered short message |
| `read` | bool | Default `false` |
| `email_sent` | bool | Tracks whether email was dispatched |

---

## 5. Feature Specs

### 5.1 Projects

**Description:** A Project is the primary container for a body of work. It groups tickets and team members with their roles.

**Core behaviours:**
- Any authenticated user can create a project; they become its `owner` automatically
- Slug is auto-generated from the project name (lowercase, hyphens) but editable before save
- Projects can be archived (read-only mode) or restored by the owner
- Each project independently manages its member list via `project_memberships`
- The reporter intake form is toggled per project; toggling generates/invalidates the `reporter_intake_token`

**Edge cases:**
- Slug must remain unique app-wide; on conflict, append `-2`, `-3`, etc.
- Archiving a project: all tickets remain visible but no writes permitted (enforced in PocketBase collection rules)
- Deleting a project: cascades to tickets, memberships, comments, history — requires explicit owner confirmation; irreversible

---

### 5.2 Tickets

**Description:** The atomic unit of work. Tickets move through a fixed kanban workflow.

**Workflow (fixed in v1):**

```
backlog → waiting → in_progress → in_review → done
                                             ↘ rejected
```

- `backlog` — reported or created, not yet triaged
- `waiting` — acknowledged, blocked on info or dependency
- `in_progress` — actively being worked
- `in_review` — PR open / QA / stakeholder review
- `done` — completed successfully
- `rejected` — won't fix / out of scope / duplicate

**Core behaviours:**
- `short_id` is auto-assigned on creation via `pb_hooks` and never changes
- Status transitions are free-form (any → any) in v1; no enforced state machine
- Drag-and-drop on the Kanban board updates both `status` and `position`
- Reordering within a column updates `position` only
- Ticket history is written automatically by `pb_hooks` on every field change
- Attachments uploaded via PocketBase file field — served at `/api/files/tickets/{recordId}/{filename}`

**Edge cases:**
- `short_id` is never reused, even if the ticket is deleted (counter is based on total created, not current count)
- Tickets with `done` or `rejected` status are collapsed on the Kanban by default
- Unassigned tickets are valid; assigning to self should be a one-click action

---

### 5.3 Users & Roles

**Description:** Users are authenticated accounts (managed by PocketBase auth). Roles are project-scoped.

**Core behaviours:**
- Registration: email + password via PocketBase's standard auth flow
- Invitation flow:
  1. Admin/Owner enters invitee email + selects role
  2. System sends invite email with a sign-up link (pre-populated email + one-time token)
  3. On account creation, `project_membership` is created with the specified role
  4. If account already exists, the user is added directly to the project
- Role changes take immediate effect (PocketBase collection rules check `project_memberships` on every request)
- A project must always have at least one `owner` — enforced in `pb_hooks`

**Deactivation:**
- `is_active = false` prevents PocketBase login
- Historical records (comments, ticket history, created tickets) preserved with the user's name
- Open assigned tickets become unassigned

---

### 5.4 External Reporter

**Description:** An external stakeholder who submits tickets via a public form — no account required.

**Reporter deduplication (resolved):** One `reporters` record per unique email per project. On re-submission with the same email, the existing record is reused and a fresh magic link is issued.

**Submission flow:**
1. Project enables reporter intake → unique public URL generated: `/report/{reporter_intake_token}`
2. Reporter fills in the intake form (name, email, title, description, type, attachments)
3. On submit:
   - Look up `reporters` by `(project, email)` — create if not found
   - Create `ticket` record with `reporter_ext` set
   - Generate magic link token → store hashed in `reporters.token_hash`
   - Send confirmation email with magic link and ticket summary
4. Reporter accesses ticket via magic link → read-only view of their ticket and non-internal comments
5. Reporter can add comments from the magic link view (creates `comment` with `author_reporter` set)

**Magic link auth:**
- Token in the URL is validated against `token_hash` (bcrypt compare)
- Token expires after 30 days of inactivity; reporter can request a new link by entering their email
- Magic link sessions are stateless (token passed as query param or header per request)

**Intake form fields:**

| Field | Required | Notes |
|---|---|---|
| Name | ✅ | Pre-filled on return if reporter record exists |
| Email | ✅ | Used for deduplication and magic link delivery |
| Title | ✅ | max 200 chars |
| Description | ❌ | Markdown or plain text |
| Type | ❌ | `bug` \| `question` \| `other` |
| Attachments | ❌ | Up to 5 files, 20MB each (PocketBase file field) |

**Edge cases:**
- Intake disabled mid-flow: return a clear "submissions paused" page, not a generic 404
- Spam: rate-limit by IP (10 submissions/hour) and by email (3 tickets/hour per project)
- Reporter email matches a team member's email: create a normal `ticket` with `reporter_user` set instead of `reporter_ext` — the team member is notified

---

### 5.5 Kanban Board & Views

**Description:** The primary interface. Columns are fixed to the v1 workflow statuses.

**Kanban view:**
- 6 columns: `Backlog` | `Waiting` | `In Progress` | `In Review` | `Done` | `Rejected`
- `Done` and `Rejected` columns collapsed by default with a toggle to expand
- Cards are draggable between columns (status change) and within columns (position reorder)
- Realtime updates via PocketBase SSE subscription — other users' moves appear live
- Card displays: `short_id`, title, type icon, priority badge, assignee avatar, label chips, attachment count indicator

**List view:**
- Flat sortable table: ID, Title, Type, Priority, Status, Assignee, Labels, Due Date, Created
- Click row → opens ticket detail panel (slide-over or modal)

**Filtering & search:**
- Filter by: assignee, reporter, label, type, priority, status
- Text search on title + description (PocketBase `~` filter operator)
- All filters reflected in URL query params for shareable links
- Filters persist across page navigation within a project

**Edge cases:**
- 50+ cards in a column: virtual scroll within the column
- Drag conflict (two users move the same card simultaneously): last write wins; both UIs reconcile via realtime subscription
- Filtering hides cards but does not remove them from the board state

---

### 5.6 Notifications

**Description:** Users are notified in-app and by email when relevant events occur on their tickets.

**Trigger events:**

| Event | Notified Users |
|---|---|
| Ticket assigned to user | Assignee |
| Ticket unassigned | Previous assignee |
| Comment added to ticket | Assignee + ticket creator (if different) |
| Internal comment added | Assignee + ticket creator (team members only) |
| Ticket status changed | Assignee + ticket creator |
| Reporter ticket receives a team reply | Reporter (email only) |
| User mentioned in comment (`@username`) | Mentioned user |

**In-app notifications:**
- `notifications` collection records created by `pb_hooks` on trigger events
- Frontend subscribes via `pb.collection('notifications').subscribe()` for realtime badge updates
- Notification bell shows unread count; clicking opens a notification drawer
- Marking as read sets `read = true` (single or bulk)

**Email notifications:**
- Sent from `pb_hooks` using PocketBase's mail client
- Emails sent asynchronously (non-blocking) after the triggering action
- `email_sent = true` set on the notification record after dispatch to prevent duplicates
- Reporter emails always sent; team member emails respect a per-user preference (v1: always on)

**Email templates (v1 — plain text + basic HTML):**
- Ticket assigned to you
- New comment on your ticket
- Your ticket status changed
- Reporter: team replied to your submission (includes magic link)

---

## 6. Acceptance Criteria

### AC-01 · Project Creation

- [ ] Any authenticated user can create a project
- [ ] Slug is auto-generated from name; editable before save; validated (lowercase, alphanumeric + hyphens, unique)
- [ ] Creator is automatically assigned `owner` role via `project_memberships`
- [ ] New project appears in navigation immediately (realtime or optimistic)

### AC-02 · Project Archival

- [ ] Only `owner` can archive or restore a project
- [ ] Archived projects: all write operations (ticket create/edit, comments, status changes) are rejected
- [ ] Archived projects shown separately in navigation with a visual indicator
- [ ] Restore (unarchive) returns project to fully editable state

### AC-03 · Ticket Creation

- [ ] Members, admins, and owners can create tickets; viewers cannot
- [ ] Title is required; submission blocked without it
- [ ] `short_id` is auto-assigned and visible immediately after creation
- [ ] Default status is `backlog`
- [ ] Ticket appears in the correct Kanban column without page reload
- [ ] Attachments can be added at creation time via PocketBase file upload

### AC-04 · Ticket Status Update

- [ ] Status updated via drag-and-drop on Kanban or dropdown in ticket detail
- [ ] Change reflected immediately (optimistic UI) and propagated to other open sessions via realtime
- [ ] Status change recorded in `ticket_history` with actor and timestamp
- [ ] `done` and `rejected` columns collapse after a card is dropped into them (unless already expanded)
- [ ] Viewers cannot change status

### AC-05 · Ticket Workflow (Fixed Statuses)

- [ ] Exactly 6 statuses exist: `backlog`, `waiting`, `in_progress`, `in_review`, `done`, `rejected`
- [ ] Any status can transition to any other status (no enforced order)
- [ ] Status labels and column order match the defined workflow exactly
- [ ] No UI affordance to create, rename, or remove statuses in v1

### AC-06 · User Invitation & Roles

- [ ] Admin/Owner can invite by email with a specified role
- [ ] Invite email sent within 60 seconds; link expires after 7 days
- [ ] Accepting invite with existing account: user added directly to project
- [ ] Accepting invite with new email: account creation prompt, then project join
- [ ] Role changes take effect immediately
- [ ] The last `owner` cannot be removed or downgraded without assigning a new owner first

### AC-07 · External Reporter Submission

- [ ] Admin/Owner can enable/disable reporter intake per project
- [ ] Disabled intake URL returns "submissions paused" — not a generic 404
- [ ] Reporter submits with name, email, title (minimum); ticket created in `backlog`
- [ ] Confirmation email with magic link sent within 60 seconds
- [ ] Existing reporter record (same email + project) is reused; new ticket linked to it
- [ ] Submitted ticket visually marked as externally reported on the board
- [ ] Reporter can view their ticket and non-internal comments via magic link
- [ ] Reporter can add comments via magic link; these appear in the ticket's comment thread
- [ ] Internal comments (`is_internal = true`) not visible in reporter view
- [ ] Magic link token expires after 30 days of inactivity; re-request available via email form

### AC-08 · Attachments

- [ ] Files uploadable on ticket create and edit
- [ ] Up to 10 files per ticket, 20MB each (enforced by PocketBase schema)
- [ ] Attachments displayed in ticket detail with file name, size, and download link
- [ ] Attachment access requires valid auth token (PocketBase file serving rules)
- [ ] Reporters can upload attachments via intake form; access their own ticket's attachments via magic link

### AC-09 · Kanban Board

- [ ] Board loads tickets grouped into 6 status columns
- [ ] Drag-and-drop between columns updates status; within columns updates position
- [ ] Positions persist on reload
- [ ] `Done` and `Rejected` columns collapsed by default, expandable
- [ ] Realtime: another user's card move appears on the board without refresh
- [ ] Filters (assignee, priority, type, label) applied simultaneously; state in URL

### AC-10 · List View

- [ ] All tickets in a sortable table with columns: ID, Title, Type, Priority, Status, Assignee, Labels, Due Date, Created
- [ ] Click row opens ticket detail panel
- [ ] Sorting and filtering state reflected in URL

### AC-11 · In-App Notifications

- [ ] Notification bell shows unread count, updated in realtime
- [ ] Notification drawer lists recent notifications with ticket context and timestamp
- [ ] Clicking a notification navigates to the ticket and marks it as read
- [ ] Bulk "mark all as read" action available
- [ ] Notifications generated for: assignment, comment, status change, mention

### AC-12 · Email Notifications

- [ ] Team members receive email for: assignment, comment on their ticket, status change
- [ ] Reporter receives email when team adds a non-internal comment to their ticket (includes magic link)
- [ ] Emails sent within 60 seconds of trigger event
- [ ] Duplicate emails not sent (tracked via `email_sent` flag)

### AC-13 · Ticket History / Audit

- [ ] Every field change on a ticket creates a `ticket_history` record
- [ ] History shows: field, old value, new value, actor (user name or "External Reporter"), timestamp
- [ ] History displayed chronologically in ticket detail view
- [ ] History records cannot be edited or deleted

---

## 7. PocketBase API Notes

PocketBase auto-generates REST endpoints for every collection. The frontend uses the PocketBase JS SDK rather than raw HTTP.

### Key SDK patterns

```js
// Auth
await pb.collection('users').authWithPassword(email, password);

// List tickets with filters
await pb.collection('tickets').getList(1, 50, {
  filter: `project = "${projectId}" && status = "in_progress"`,
  sort: 'position',
  expand: 'assignee,reporter_user,reporter_ext'
});

// Realtime board updates
pb.collection('tickets').subscribe('*', (e) => {
  // e.action: 'create' | 'update' | 'delete'
  // e.record: the changed ticket
  updateBoardState(e);
});

// Realtime notifications
pb.collection('notifications').subscribe(`user = "${currentUser.id}"`, (e) => {
  incrementBadgeCount();
});

// Upload attachment
const formData = new FormData();
formData.append('attachments', file);
await pb.collection('tickets').update(ticketId, formData);

// Reporter magic link auth (custom endpoint via pb_hooks)
const res = await fetch('/api/reporter/auth', {
  method: 'POST',
  body: JSON.stringify({ token: magicLinkToken })
});
```

### Custom `pb_hooks` required

| Hook | Trigger | Purpose |
|---|---|---|
| `short_id` assignment | `onRecordBeforeCreateRequest` → `tickets` | Generate `PROJ-N` identifier |
| Reporter deduplication | `onRecordBeforeCreateRequest` → `tickets` | Upsert `reporters` by email+project |
| Ticket history | `onRecordAfterUpdateRequest` → `tickets` | Write changed fields to `ticket_history` |
| Notification fanout | `onRecordAfterUpdateRequest` → `tickets`, `onRecordAfterCreateRequest` → `comments` | Create `notifications` records + send emails |
| Reporter magic link auth | Custom route `/api/reporter/auth` | Validate token, return short-lived session token |
| Reporter email magic link | `onRecordAfterCreateRequest` → `tickets` (when `reporter_ext` set) | Send confirmation email with magic link |
| Owner guard | `onRecordBeforeDeleteRequest` → `project_memberships` | Block removal of last owner |
| Last-owner downgrade guard | `onRecordBeforeUpdateRequest` → `project_memberships` | Block role change if last owner |

### PocketBase collection rules (summary)

- `tickets` list/view: require authenticated user with `project_memberships` record for the ticket's project
- `tickets` create/update: require `member`, `admin`, or `owner` role
- `tickets` delete: require `admin` or `owner`
- `notifications` list: restrict to `user = @request.auth.id`
- `reporters`: no direct client access — all operations via `pb_hooks`
- `ticket_history`: read-only for authenticated members; no client writes

---

## 8. Resolved Decisions

| # | Decision | Resolution |
|---|---|---|
| 1 | Reporter deduplication | One `reporters` record per unique email per project. Re-submissions reuse the record and get a fresh magic link. |
| 2 | Workspace model | Single app, single workspace. No multi-tenancy in v1. |
| 3 | Custom statuses | Fixed statuses in v1: `backlog`, `waiting`, `in_progress`, `in_review`, `done`, `rejected`. |
| 4 | Magic link expiry | 30-day rolling expiry. Re-request available via email form. |
| 5 | File storage | PocketBase native file fields. Local filesystem in v1; S3 config available if needed later. |
| 6 | Notifications | Both in-app (realtime via PocketBase SSE) and email in v1. |
| 7 | Sprint / iterations | Not in v1. Backlog column serves triage/prioritisation purpose. |

---

## 9. Open Questions

| # | Question | Notes |
|---|---|---|
| 1 | **Frontend framework** — React, Vue, Svelte? | PocketBase JS SDK is framework-agnostic |
| 2 | **Mention detection** — parse `@username` in comment body client-side or server-side in `pb_hooks`? | Hook approach is more reliable but adds complexity |
| 3 | **Reporter re-request link UX** — dedicated page at `/report/{token}/resend` or inline on the expired magic link page? | |
| 4 | **Notification preferences** — all-on in v1, but should the schema support per-user opt-out now? | Easier to add later if `notifications` table already exists |
| 5 | **PocketBase deployment** — Docker on VPS, or managed? | Affects backup strategy and file storage config |

---

*These notes are a living document. Mark items resolved in §8 as they are confirmed and move resolved items out of §9.*
