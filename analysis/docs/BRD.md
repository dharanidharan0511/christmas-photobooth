# Business Requirements Document (BRD)

**Project**: ai-studio-enterprise (TP-Web Edge Client)
**Version**: 1.0
**Date**: 2026-09-17
**Status**: Draft — derived from static code analysis

---

## 1. Executive Summary

ai-studio-enterprise is an internal enterprise web application that serves as the primary user interface for the AI Studio edge engine deployed within an organization's on-premises or private-cloud cluster. It enables employees to authenticate via corporate SSO, discover and execute AI workflows ("Minds"), manage code repositories with AI-assisted review, and chat with document-aware AI agents. Administrators have additional capabilities to manage users, roles, spending caps, and audit logs.

---

## 2. Business Context

The AI Studio platform consists of two layers:
1. **AI Studio Gateway** (not in scope): The central AI Studio platform hosted externally.
2. **Edge Engine** (consumed by this client): A locally-deployed proxy and orchestration engine within the client organization's cluster.

This application is the TP-Web (Test Portal Web) client for the edge engine. It replaces direct use of the AI Studio central console for enterprise users who must access AI capabilities through their organization's edge cluster, ensuring that all network calls remain within the corporate network boundary.

---

## 3. Stakeholders

| Role               | Description                                                        |
|--------------------|--------------------------------------------------------------------|
| End User (Employee)| Corporate staff who use AI Minds for productivity tasks            |
| Admin User         | IT/platform admins who manage users, roles, and spending           |
| Platform Engineer  | DevOps/SRE who deploy and configure the edge engine                |
| AI Studio Team     | Internal team that publishes Minds and configures the gateway      |

---

## 4. Business Objectives

1. **Secure access control**: Provide SAML/SSO authentication tied to the corporate identity provider; admin-key access for service accounts.
2. **Self-service Mind execution**: Allow employees to discover and run AI Minds (workflows and chat agents) without needing to know API keys.
3. **Usage visibility**: Enable employees to view their own usage history and spending; admins to view fleet-wide usage.
4. **Code intelligence**: Allow teams to connect code repositories and receive AI-assisted analysis, review, and chat.
5. **Document intelligence**: Allow teams to create AI agents with private document corpora for knowledge Q&A.
6. **Governance**: Provide admins with complete audit trail, role assignment, and spending cap management.

---

## 5. Who Uses It

| User Type          | Key Actions                                                                     |
|--------------------|---------------------------------------------------------------------------------|
| Regular Employee   | Sign in via SSO; browse and run Minds; use Run (Execute/Chat) tab; view own sessions; upload repos; chat with DocFlo agents |
| Admin User         | All employee actions, plus: manage users (create/disable/reactivate), assign roles, manage spend caps, view audit log |
| Service Account    | Sign in with admin API key; same capabilities as Admin                          |

---

## 6. Current System Description

The current system is a React 18 single-page application (SPA) bundled with Vite. It has:
- A single network module (`src/lib/engineClient.ts`) that enforces all API calls go exclusively to the edge engine.
- Three authentication modes: SSO cookie, admin bearer key, and local password (fallback).
- Three main product suites: **Run Minds** (workflow execution), **CodeFlo+** (agentic code operations), **DocFlo+** (document-aware agents).
- Admin-only sections: Users, Roles, Credits (spend caps), Audit Log.

---

## 7. Migration Goals

The migration aims to:

1. **Upgrade React ecosystem**: Move from React 18 + Vite (SPA) to React 19 + Next.js 15 (App Router, RSC-capable) for better performance, SEO (admin dashboards) and server-side caching.
2. **Improve security posture**: Address SEC-C-001 (env var exposure) by moving API calls to Next.js Route Handlers (server-side), so `ENGINE_URL` and credentials never reach the browser.
3. **Add proper TypeScript strictness**: Upgrade to TypeScript 5.5+ with `noUncheckedIndexedAccess` and eliminate remaining `unknown` casts.
4. **Enhance testing**: Add unit tests (Vitest) and integration tests (Playwright) for the auth flows, admin actions, and SSE streaming.
5. **Improve accessibility**: Achieve WCAG 2.1 AA compliance (keyboard navigation, screen reader support, focus management in modals).
6. **Establish a design system**: Extract the current ad-hoc Tailwind utility classes into a formal component library with documented Storybook stories.
7. **Support multi-tenant routing**: Enable deployment at a path prefix (e.g., `/tp-web/`) without hardcoded origin assumptions.

---

## 8. Constraints

- The edge engine REST API wire format must not change (it is shared with other clients).
- SSO redirect flow must continue to work via `SAML/OIDC` at the engine level.
- All API calls must originate from the same organization's network (no direct-to-AI-Studio calls from the browser).
- No external payment gateways or email services; all user management is handled internally.

---

## 9. Success Criteria

- All existing end-to-end flows (SSO login, Mind execution, chat, code repo browsing, user/role management, audit log) work identically after migration.
- Production bundle no longer contains `ENGINE_URL` or any credentials.
- WCAG 2.1 AA automated scan passes (no critical/serious issues).
- Unit test coverage >= 70% for business logic modules.
- Lighthouse performance score >= 85 on the dashboard page.
