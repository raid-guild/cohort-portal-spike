# Cohort Landing Redesign Brief

## Project
RaidGuild Cohort Portal: Cohort Hub landing page redesign.

## Purpose
Redesign the cohort landing experience into a modern dashboard that supports:
- Public discovery for prospective participants.
- Day-to-day navigation for enrolled cohort members.

The page should preserve RaidGuild visual identity while improving clarity, scannability, and engagement.

## Scope
This brief covers:
- UX and visual direction for the cohort landing page.
- Section-level information architecture and component requirements.
- CMS-driven data contracts for rendering each section.
- Implementation phases, acceptance criteria, and task split.

This brief does not cover:
- Back-office CMS UI redesign.
- Non-cohort modules unrelated to the cohort hub landing page.

## Product Goals
1. Make the cohort purpose and next action obvious within the first viewport.
2. Improve section discoverability and reduce navigation friction.
3. Shift from document-like page structure to dashboard-style composition.
4. Keep core content dynamic and sourced from CMS-managed data.
5. Maintain accessible, performant, mobile-friendly interactions.

## Design Direction
Tone: modern, minimal, technical, with subtle fantasy flavor.

Palette:
- `Moloch 800`: `#29100A`
- `Moloch 500`: `#BD482D`
- `Scroll 100`: `#F9F7E7`
- `Scroll 700`: `#534A13`

UI guidance:
- Rounded cards, soft shadows, warm surfaces.
- Serif headings and clean sans-serif body text.
- Generous spacing and breathable section rhythm.
- Subtle motion only (hover lift, fade/slide, accordion transitions, skeleton states).

Design token source:
- Follow [`RG_BRAND_AGENTS.md`](../RG_BRAND_AGENTS.md) and [`src/app/globals.css`](../src/app/globals.css) semantic tokens first.
- Use the approved Moloch/Scroll palette for cohort dashboard components.
- Must support both light and dark mode via existing theme infrastructure.

## Information Architecture
1. Top nav (replace left sidebar):
- Brand: `RaidGuild Cohort Portal`
- Links: `Dashboard`, `Schedule`, `Projects`, `Resources`, `Participants`, `Partners`
- Right controls: `Profile`, theme toggle

2. Vertical full-width sections:
- Hero
- Cohort stats
- Schedule
- Quests/onboarding
- Projects
- Resources
- Participants
- Partners

## Section Requirements

### 1) Hero
Purpose: orient users immediately to the active cohort.

Requirements:
- CMS-controlled hero image with subtle gradient overlay.
- Cohort title and short description.
- CTA state by user context:
  - Public/prospective: `Join Cohort` opens signup modal/flow.
  - Enrolled/authenticated users: show a welcome note and `Go to Profile` CTA linking to `/me`.

### 2) Cohort Stats
Purpose: quick operational summary.

Minimum cards:
- Participants
- Projects
- Resources
- Duration

Optional cards:
- Mentors
- Sessions completed
- Upcoming events

### 3) Schedule
Purpose: make timeline and next events easy to understand.

MVP:
- Timeline view sorted by date.
- Event title, date, type, short description.

Enhancements:
- Calendar toggle view.
- Event-type color tokens.
- Upcoming event highlight.
- Progress indicator (example: `Week 2 of 6`).

### 4) Quests / Onboarding
Purpose: guide member setup and activation.

If quest data exists:
- Checklist UI (e.g., join Discord, intro post, project idea, working group).

If not yet implemented:
- Placeholder card: `Quests coming soon`.

Implementation requirement:
- Quest board ships in MVP as a reusable/shared component with a fallback placeholder state.

### 5) Projects
Purpose: showcase active cohort work.

Data per project:
- Title
- Description
- Links
- Notes

UI:
- Grid cards for MVP.
- Carousel is included in MVP as a shared component for reuse.
- Detail expansion may include contributors/demo/repo/notes when available.

### 6) Resources
Purpose: make large resource sets easier to browse.

Data per resource:
- Title
- Description
- Link
- Type (`article`, `YouTube`, `repo`, `document`, `tool`)
- Category

UI:
- Group by category.
- Accordion or file-browser-style layout.
- Type badges for quick scanning.
- Optional embedded preview for YouTube links.

### 7) Participants
Purpose: make people and roles discoverable.

Data per participant:
- Name
- Avatar
- Role
- Status

UI:
- Avatar card grid.
- Filters: `All`, `Hosts`, `Mentors`, `Participants` (and `Partners` if represented in this section).
- Optional hover detail: bio and social links if present.

### 8) Partners
Purpose: acknowledge organizations and support discovery.

Data per partner:
- Name
- Logo
- Description
- Link

UI:
- Logo-first card grid with outbound links.

## CMS Data Contract
The landing dashboard should be rendered from structured cohort data with these entities:

1. Cohort:
- `title`
- `description`
- `hero_image`
- `start_date`
- `end_date`

2. Schedule:
- `title`
- `description`
- `date`
- `type`

3. Projects:
- `title`
- `description`
- `links`
- `notes`

4. Resources:
- `title`
- `description`
- `link`
- `type`
- `category`

5. Participants:
- `name`
- `avatar`
- `role`
- `status`

6. Partners:
- `name`
- `logo`
- `description`
- `link`

## Current Data Reality (v1 Mapping)
Current storage uses JSONB content blobs plus separate `participants` and `partners` tables. Keep this model for v1.

Known content patterns:
- `schedule`: array items like `{ day, date, agenda, notes }`
- `projects`: array items like `{ name, description, links?, notes? }`
- `resources`: array items like `{ title, url, type, category? }`
- `notes`: array items like `{ title, body }`

Normalization strategy in the data layer:
1. Parse JSON arrays defensively and default to `[]`.
2. Map aliases:
- project `name -> title`
- resource `url -> link`
- schedule `agenda -> title`
- schedule `notes` or `description -> description`
3. Normalize `type` values case-insensitively (for example `YouTube`, `youtube`, `Hackmd`).
4. Derive categories when missing using type/title heuristics.
5. Preserve unknown fields in passthrough metadata for future schema upgrades.

## Suggested Component Architecture
Target components for modular implementation:
- `HeroSection`
- `StatsCards`
- `ScheduleTimeline`
- `ScheduleCalendar`
- `QuestBoard`
- `ProjectsGrid`
- `ProjectsCarousel`
- `ResourceBrowser`
- `ParticipantsGrid`
- `PartnersGrid`

Implementation note:
- Keep server/client boundaries explicit in Next.js App Router.
- Ensure each section has loading, empty, and error states.
- Calendar, carousel, and quest board should be shared components reusable in other modules.

## Interaction + Motion
Use restrained animation only:
- Card hover elevation.
- Section fade-in on scroll.
- Skeleton loading states.
- Progress bar animation for timeline progress.
- Accordion expand/collapse transitions.

Do not introduce flashy transitions or heavy animation dependencies unless justified.

## Accessibility Requirements
- Semantic HTML landmarks and heading hierarchy.
- Full keyboard navigation for interactive components.
- ARIA labels for controls and toggle states.
- Contrast compliance for text and UI states.
- Visible focus indicators.

## Responsiveness
- Desktop: full dashboard composition.
- Tablet: two-column card layouts where appropriate.
- Mobile: single-column stacked sections and swipe-friendly carousels.

## Implementation Phases

### Phase 0: Discovery + Alignment (1-2 days)
- Audit current cohort hub landing implementation and data shape.
- Confirm section prioritization for public vs member contexts.
- Finalize wireframe-level layout and content contracts.

Deliverables:
- Approved IA/wireframe.
- Confirmed CMS field mapping list.

### Phase 1: Dashboard Foundation (3-4 days)
- Implement full-width layout and top nav.
- Build hero, stats cards, and schedule timeline MVP.
- Add baseline loading skeletons and hover/focus states.

Deliverables:
- Working dashboard shell rendering real cohort data.

### Phase 2: Content Modules (4-6 days)
- Implement projects (including carousel), resources, participants, and partners sections.
- Add filtering/grouping behaviors (participants/resources).
- Validate rendering for sparse and dense datasets.
- Implement quest board with checklist + placeholder fallback.

Deliverables:
- All primary sections implemented and CMS-driven.

### Phase 3: Enhancements + Polish (2-3 days)
- Add schedule calendar toggle and timeline/calendar interaction polish.
- Refine motion and transitions.
- Improve empty/error states and edge case handling.

Deliverables:
- Interaction-complete dashboard with polished UX.

### Phase 4: QA + Accessibility + Release (2-3 days)
- Accessibility pass and keyboard/screen-reader checks.
- Responsive QA across desktop/tablet/mobile.
- Performance pass (image optimization, render/load tuning).

Deliverables:
- Release-ready cohort landing page.

## Acceptance Criteria
1. Left sidebar is removed from cohort landing and replaced by top navigation.
2. Core sections render from CMS data with graceful loading/empty/error states.
3. The page supports both public and enrolled user experiences.
4. The layout is responsive and usable on desktop, tablet, and mobile.
5. Accessibility requirements are met for semantics, keyboard flow, and contrast.
6. Visual style matches RaidGuild brand palette and dashboard design goals.

## Engineering Task Breakdown
1. Layout shell + top navigation.
2. Hero section + CTA state logic.
3. Stats cards + metric mapping.
4. Shared schedule components: timeline + calendar.
5. Shared quest board with checklist + placeholder state.
6. Projects section + shared carousel.
7. Resources browser/grouping.
8. Participants grid + role filters.
9. Partners grid.
10. Motion/loading/empty/error polish.
11. Accessibility/performance QA and release hardening.

## Risks and Mitigations
- Risk: CMS data is currently file-list oriented and lacks normalized fields.
  - Mitigation: add defensive mapping layer with defaults and empty-state handling.
- Risk: visual complexity impacts maintainability.
  - Mitigation: section component boundaries and strict prop contracts.
- Risk: animation regressions/perf overhead on low-end devices.
  - Mitigation: prefer CSS transitions, reduce JS-driven animation, test mobile early.

## Locked Decisions
1. `ScheduleCalendar`, `ProjectsCarousel`, and `QuestBoard` are in scope and should be implemented as shared components.
2. Public CTA opens signup modal/flow; authenticated users see a welcome note and `/me` profile CTA.
3. Data source remains current JSONB content + participants/partners tables for v1.
4. Brand/design tokens follow `RG_BRAND_AGENTS.md` and existing semantic theming with light/dark support.

## Definition of Done
- Brief is approved by product/design/engineering stakeholders.
- Engineering tickets are created from the task breakdown.
- Delivery sequence is agreed and mapped to milestone dates.
