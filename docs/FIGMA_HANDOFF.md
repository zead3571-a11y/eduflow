# Figma → Frontend implementation handoff

## 1. Figma file structure
1. `00 — Foundations`: colors, typography, spacing, radius, elevation, grid, RTL/LTR rules.
2. `01 — Components`: buttons, inputs, selects, dialogs, tables, badges, pagination, sidebar, topbar, charts, empty/loading/error states.
3. `02 — Authentication`: login, forgot password, reset password.
4. `03 — Onboarding`: create center, center profile, trial confirmation.
5. `04 — Dashboard`: desktop, tablet, mobile.
6. `05 — Students & Guardians`.
7. `06 — Teachers & Groups`.
8. `07 — Schedule & Sessions`.
9. `08 — Attendance`.
10. `09 — Payments & Receipts`.
11. `10 — Reports & Settings`.

## 2. Design tokens
Create Figma Variables for:
- `color/brand/primary`, `color/brand/primary-hover`
- `color/text/primary`, `color/text/secondary`
- `color/surface/page`, `color/surface/card`, `color/border/default`
- `color/status/success`, `warning`, `danger`, `info`
- `space/1..12`, `radius/sm|md|lg|xl`, `shadow/card`

Create typography styles for Arabic and English separately. Use a consistent Arabic UI font (e.g. IBM Plex Sans Arabic) and a matching Latin font (e.g. Inter). Define both `RTL` and `LTR` component behavior rather than mirroring arbitrary icons.

## 3. Component naming
Use names that map directly to code:
- `Button/Primary/Default`, `Button/Secondary/Default`, `Button/Danger/Default`
- `Input/Text/Default`, `Input/Search/Default`, `Select/Default`
- `Badge/Success`, `Badge/Warning`, `Badge/Danger`
- `Table/Default`, `Table/Empty`, `Table/Loading`
- `Sidebar/Expanded`, `Sidebar/Collapsed`, `Topbar/Default`
- `Dialog/Confirm`, `Dialog/Form`

Use Auto Layout, component properties, and variants. Avoid detached duplicate components.

## 4. Responsive breakpoints
- Desktop: 1440 px design frame; sidebar expanded.
- Laptop: 1280 px; preserve key table columns and allow horizontal overflow only where necessary.
- Tablet: 768 px; sidebar becomes drawer, cards become two columns.
- Mobile: 390 px; sidebar becomes drawer, dashboard cards stack, tables become card/list views, forms become single-column.

## 5. Figma → code mapping
| Figma artifact | Frontend implementation |
|---|---|
| Color/text variables | CSS variables / Tailwind theme tokens |
| Typography styles | Global font setup and semantic text classes |
| Button variants | Reusable `Button` component |
| Input/select variants | Controlled form components + React Hook Form + Zod |
| Sidebar/topbar | Shared dashboard layout components |
| Table variants | TanStack Table + reusable table shell |
| Dialog variants | Shared modal/dialog components |
| Page frames | Next.js route segments |
| Prototype flows | Playwright user-flow tests; prototype is not a substitute for functional code |

## 6. Required handoff from designer
For every screen provide:
- Desktop, tablet, and mobile frames.
- Default, hover, focus, disabled, loading, empty, error, and success states where relevant.
- Exact text labels in Arabic and English.
- Component variants and interaction notes.
- Table column behavior at each breakpoint.
- Form validation and confirmation behavior.
- Exported assets as SVG where possible; avoid rasterizing icons and text.

## 7. Development sequence
1. Extract tokens and fonts from Figma.
2. Build shared primitives and app shell.
3. Build auth and center onboarding.
4. Implement one vertical slice end-to-end (Students list → create student → database → RLS test).
5. Reuse the same patterns for teachers, groups, attendance, and payments.
6. Compare implementation against Figma at the specified breakpoints and run accessibility checks.
