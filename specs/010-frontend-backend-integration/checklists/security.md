# Security Checklist: Frontend-Backend Integration

**Purpose**: Verify the client handles credentials and other users' data safely
**Created**: 2026-09-18
**Feature**: [spec.md](../spec.md)

## Credential handling

- [ ] The token is never placed in a URL, query string, or route parameter (NFR-002)
- [ ] The token is never written to `console` or any log, including error paths
- [ ] The token is never rendered into the DOM or included in an error message shown to the user
- [ ] Logout removes the token from storage, not only from React state
- [ ] A rejected token (401) is cleared immediately rather than retried
- [ ] No password is stored anywhere after the login request completes
- [ ] Password fields use `type="password"` and are excluded from any state that gets persisted

## Data isolation

- [ ] No ledger data (categories, transactions, summary) remains in browser storage after logout (SC-006)
- [ ] Cached data in memory is dropped on logout, so a second account signing in on the same browser never sees the first one's rows
- [ ] No screen renders data fetched before the current session's token was set

## Transport and origin

- [ ] The API base URL comes from configuration, not a hard-coded production host
- [ ] The app sends the bearer header only to the configured API origin
- [ ] CORS is satisfied by the backend's existing `CORS_ORIGINS`; the client does not attempt to disable or work around it

## Input and output safety

- [ ] Server error text is rendered as text, never as HTML
- [ ] Server-supplied strings (category names, descriptions) are rendered as text, never via `dangerouslySetInnerHTML`
- [ ] Client-side validation is treated as convenience only; the server remains the authority and its rejections are surfaced

## Known accepted risk

- [ ] The token lives in `localStorage` and is therefore readable by any script running on the origin. Accepted in this feature (spec Clarifications Q1 and Assumptions) because the app has no server session layer. Revisit if a backend-for-frontend is introduced.
