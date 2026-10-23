# IdeaPulse Master Design Brief: The Workshop Ledger

A cohesive design system synthesizing the best principles of world-class digital products into an original, authentic brand identity for early idea evaluation.

---

## 1. Brand Identity & Emotional Persona
**IdeaPulse is "The Workshop Ledger"**: a place for independent builders, hackers, and craftsmen to stress-test early concepts before building. It feels like an independent architectural atelier or letterpress studio: quiet, literate, tactile, engineered with surgical precision, and completely devoid of corporate fluff.

* **Core Spirit**: *Warm Editorial + Engineered Precision*.
* **Anti-patterns strictly banned**:
  1. No generic SaaS look (no purple/indigo gradients, floating neon pills, or generic 3-column feature cards).
  2. No AI landing page look (no glowing gradient blobs, center-aligned buzzwords, or stock floating meshes).
  3. No sterile grey minimalism (no washed-out borders, unreadable low-contrast text, or corporate monotony).

---

## 2. The Reference Map (Principles Borrowed, Not Pixels Copied)

| Reference Product | Design Principle Borrowed | Concrete Implementation in IdeaPulse |
| :--- | :--- | :--- |
| **Linear** (`linear.app`) | Speed, keyboard-first precision, layered surfaces | Global Command Palette (`Cmd/Ctrl+K`), quick navigation (`N` for post, `/` for search), instant optimistic UI, crisp typography, and 1px hairline borders. |
| **Stripe** (`stripe.com`) | Form craftsmanship & hierarchy | Post/edit forms with clear labels, inline real-time error messages, smooth focus rings, and zero confusing fields. |
| **Product Hunt** | Ranked community voting mechanics | Idea score as the visual anchor, one-tap instant voting with animated score feedback, and Week/Month/All-Time leaderboard tabs. |
| **Hacker News & Reddit** | Information-dense, scannable lists | Feed density toggle (**Comfortable** vs **Compact** mode), high signal-to-noise ratio, and clean metadata lines (score, author, timestamp, comment count). |
| **Airbnb** | Card scannability & forgiving search | Cards that parse under 2 seconds; sticky horizontal filter chips with distinct active states; search input with clear button. |
| **Notion** | Calm writing experience & friendly warmth | Post-idea distraction-free drafting desk with guiding placeholders; charming SVG empty states; warm paper tones. |
| **Are.na & Read.cv** | Typographic personality & restraint | Distinctive serif display typography paired with crisp sans-serif; minimal chrome so user ideas are the centerpiece. |
| **Apple** | Whitespace & single-minded focus | Landing hero with generous breathing room, large confident headline, zero visual clutter, and asymmetric balance. |
| **Duolingo & Strava** | Micro-delight & personal recognition | Satisfying tactile ink stamp animation with spark feedback upon rating; profile stats reflecting author impact and evaluation consensus. |
| **Raycast & Arc** | Power-user responsiveness | Fluid command palette with instant keyboard filtering, category jumping, and dark/light mode toggles. |

---

## 3. Design Tokens (CSS & Tailwind System)

### Typography Scale
* **Display Font**: `Fraunces` (variable optical size serif, editorial authority).
* **Body Font**: `Instrument Sans` (high-legibility humanist grotesque, clean metrics).
* **Code / Numerical Font**: Monospace tabular numbers for scores, dates, and ranks.
* **Scale**:
  - `72px` / `4.5rem`: Landing hero headline (`leading-none`).
  - `48px` / `3.0rem`: Page titles on desktop.
  - `32px` / `2.0rem`: Section and modal titles.
  - `24px` / `1.5rem`: Modal headers, card titles on detail view.
  - `20px` / `1.25rem`: Feed card titles.
  - `14px` / `0.875rem`: Standard body text, pitches, and comments (`leading-relaxed`).
  - `13px` / `0.8125rem`: UI controls, subheads, and navigation items.
  - `12px` / `0.75rem`: Form field labels (uppercase tracked), metadata lines.
  - `11px` / `0.6875rem`: Micro-badges, category dots, keyboard shortcut pills.

### Color Tokens & WCAG AA/AAA Contrast
* **Paper Light Theme**:
  - `background`: `hsl(38 28% 97%)` (warm cream linen)
  - `surface` (cards & modals): `hsl(40 25% 99%)` (clean archival paper)
  - `surface-alt` (code/muted): `hsl(36 15% 93%)`
  - `ink` (foreground text): `hsl(24 10% 12%)` (deep carbon ink, **13.8:1 contrast**)
  - `ink-muted` (secondary text): `hsl(24 10% 28%)` (aged ink, **7.2:1 contrast**)
  - `border`: `hsl(34 16% 82%)` (1px subtle hairline rule)
  - `primary` / `secondary` (accent): `hsl(12 70% 41%)` (warm terracotta/ember, **4.8:1 contrast**)
  - `stamp`: `hsl(38 88% 34%)` (deep amber-ochre mark, **5.6:1 contrast**)
  - `accent` (warning/destruction): `hsl(4 82% 38%)` (crimson red mark, **5.8:1 contrast**)

* **Dark Ledger Theme**:
  - `background`: `hsl(24 8% 9%)` (deep slate carbon)
  - `surface`: `hsl(24 7% 13%)` (layered charcoal plate)
  - `surface-alt`: `hsl(24 6% 17%)`
  - `ink`: `hsl(36 20% 92%)` (warm ivory ink, **13.2:1 contrast**)
  - `ink-muted`: `hsl(36 16% 76%)` (soft silver-grey, **7.5:1 contrast**)
  - `border`: `hsl(24 6% 22%)` (subtle dark line)
  - `primary` / `secondary`: `hsl(12 75% 58%)` (terracotta ember adjusted for dark backgrounds)
  - `stamp`: `hsl(38 85% 52%)` (bright golden stamp)

### Spatial Grid & Elevation
* **Base Grid**: 8px spatial rhythm with 4px half-steps (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`).
* **Radius Hierarchy**:
  - `rounded-[6px]`: micro-tags, badges, inner buttons.
  - `rounded-[8px]`: inputs, primary buttons, menu items.
  - `rounded-[14px]`: content cards, dialogs, modals.
* **Elevation**: Single soft natural shadow (`shadow-workshop`: `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`), paired with crisp 1px borders. Never heavy dropshadows or blur halos.

---

## 4. Signature UX Elements

1. **The Field Stamp Rating Notch**: Custom geometric ink mark with active state, hover fill, stamp-press animation, optimistic local score increment, and keyboard arrow accessibility.
2. **Global Command Palette (`Cmd+K` / `Ctrl+K`)**: Fast power-user interface to search ideas across all categories, jump to routes, toggle themes, and trigger submissions.
3. **Density Switcher (Comfortable vs Compact)**: Allows quick scanning of ideas on the feed page like Hacker News/Reddit without sacrificing readability.
4. **Live Drafting Desk with Real-Time Card Preview**: Post an idea form with inline character counters, category chips, and a live card preview that updates as the author types.
5. **Notion-Style 680px Reading Column**: Idea detail view with optimal line-lengths, sticky appraisal panel, and threaded remarks.
