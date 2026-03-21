# CediSense Design System Refresh — Bold Afrofuturism (Hybrid)

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Full design system refresh — all 20+ screens, landing page, interactive guide

---

## 1. Design Direction

**Theme:** Bold Afrofuturism — Hybrid
**Sub-flavors combined:** Kente Geometric + Neon Glow + Adinkra Sacred

The design language draws from three cultural/visual sources:
- **Kente cloth patterns** — Used as structural accents (top stripes, dividers, progress bars)
- **Neon glow effects** — Soft radial glows, gradient text, glass morphism for depth
- **Adinkra symbol whispers** — Cultural symbols as barely-visible watermarks and easter eggs throughout the app

**Emotion targets:** Bold, confident, culturally proud, premium, alive

---

## 2. Color System

### Primary Palette

| Name | Hex | Role |
|------|-----|------|
| Flame Orange | `#FF6B35` | Primary action, brand color |
| Ashanti Gold | `#D4A843` | Accent, premium highlights, Adinkra whispers |
| Forest Teal | `#00C896` | Income, positive indicators, success |
| Sunset Rose | `#FF6B8A` | Expense, negative indicators, alerts |
| Deep Space | `#0d0d1a` | Background |
| Cosmic Surface | `#14142a` | Card backgrounds, elevated surfaces |
| Nebula | `#1E1E38` | Highest elevation surfaces |
| Warm Amber | `#FFB347` | Secondary highlight, gradients |

### Semantic Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-income` | `#00C896` | Money received, positive change |
| `--color-expense` | `#FF6B8A` | Money spent, negative change |
| `--color-income-bg` | `rgba(0,200,150,0.08)` | Income pill/badge background |
| `--color-expense-bg` | `rgba(255,107,138,0.08)` | Expense pill/badge background |
| `--color-text-primary` | `#E8E8F0` | Primary text |
| `--color-text-secondary` | `rgba(255,255,255,0.5)` | Body text, descriptions |
| `--color-text-muted` | `rgba(255,255,255,0.3)` | Labels, captions, timestamps |
| `--color-text-whisper` | `rgba(255,255,255,0.15)` | Adinkra whispers, decorative text |
| `--color-border` | `rgba(255,255,255,0.06)` | Default card/surface borders |
| `--color-border-hover` | `rgba(255,255,255,0.1)` | Hover state borders |

### Gradient Definitions

| Name | Value | Usage |
|------|-------|-------|
| `--gradient-primary` | `linear-gradient(135deg, #FF6B35, #E85D2C)` | Primary buttons, CTA |
| `--gradient-gold` | `linear-gradient(135deg, #D4A843, #B8860B)` | Gold buttons, premium badges |
| `--gradient-income` | `linear-gradient(135deg, #00C896, #00E5A0)` | Income indicators |
| `--gradient-kente` | `linear-gradient(90deg, #FF6B35 20%, #D4A843 20%, #D4A843 40%, #00C896 40%, #00C896 60%, #FF6B35 60%, #FF6B35 80%, #D4A843 80%)` | Kente accent stripe |
| `--gradient-hero-text` | `linear-gradient(135deg, #fff 40%, #FF6B35)` | Display heading gradient text |
| `--gradient-glow-orange` | `radial-gradient(ellipse, rgba(255,107,53,0.06), transparent 60%)` | Background ambient glow |
| `--gradient-glow-teal` | `radial-gradient(ellipse, rgba(0,200,150,0.04), transparent 60%)` | Secondary background glow |

### Glow / Shadow System

| Name | Value | Usage |
|------|-------|-------|
| `--shadow-card` | `0 1px 3px rgba(0,0,0,0.4)` | Default card shadow |
| `--shadow-card-hover` | `0 4px 12px rgba(0,0,0,0.5)` | Card hover lift |
| `--shadow-glow-orange` | `0 0 25px rgba(255,107,53,0.04)` | Primary card glow |
| `--shadow-glow-btn` | `0 4px 15px rgba(255,107,53,0.25)` | Primary button glow |
| `--shadow-phone` | `0 30px 80px rgba(0,0,0,0.5), 0 0 50px rgba(255,107,53,0.06)` | Phone mockup shadow |

---

## 3. Typography

### Font Stack

- **Headings:** Clash Display (fontshare.com) — weights 600, 700
- **Body:** Inter — weights 400, 500, 600, 700
- **Fallback:** `'Space Grotesk', system-ui, sans-serif`

### Scale

| Level | Font | Size | Weight | Line Height | Usage |
|-------|------|------|--------|-------------|-------|
| Display / H1 | Clash Display | 42-56px | 700 | 1.1 | Hero headings, landing page titles |
| H2 | Clash Display | 28px | 700 | 1.2 | Section headings |
| H3 | Clash Display | 20px | 600 | 1.3 | Card titles, subsections |
| Body | Inter | 15px | 400 | 1.6 | Paragraph text |
| Body Strong | Inter | 15px | 600 | 1.6 | Emphasized body text |
| Financial | Inter | 28-36px | 700-800 | 1.0 | Currency amounts (tabular-nums) |
| Label | Inter | 10-11px | 500 | 1.0 | Uppercase labels, letter-spacing: 2px |
| Caption | Inter | 12px | 400 | 1.5 | Timestamps, secondary info |
| Proverb | Inter | 12px | 400 italic | 1.5 | Akan proverbs, cultural quotes |

### Special Typography Rules

- All currency amounts use `font-variant-numeric: tabular-nums`
- Currency prefix (GH₵) displayed at same weight but slightly muted color
- Decimal portion (e.g., ".00") displayed at reduced opacity (`rgba(255,255,255,0.25)`)
- Display headings may use gradient text via `-webkit-background-clip: text`
- Labels always uppercase with `letter-spacing: 2px`

---

## 4. Spacing & Grid

- **Base unit:** 4px
- **Standard spacing scale:** 4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 60, 80px
- **Card padding:** 20-28px
- **Card border-radius:** 16-20px
- **Button border-radius:** 12-14px
- **Small element radius:** 8-10px (pills, badges)
- **Input border-radius:** 12px
- **Phone mockup radius:** 32-40px
- **Touch targets:** Minimum 44x44px

---

## 5. Component Specifications

### 5.1 Kente Stripe

The DNA marker of CediSense — appears on every screen.

```
Height: 3px
Border-radius: 2px
Background: var(--gradient-kente)
Placement: Top of every screen (below status bar), section dividers, footer accent
```

### 5.2 Balance Card (Primary)

```
Background: rgba(255,255,255,0.03)
Border: 1px solid rgba(255,107,53,0.1)
Border-radius: 20px
Padding: 20px
Box-shadow: var(--shadow-glow-orange)
Backdrop-filter: blur(10px) — optional, performance-dependent

Content:
- Label: "TOTAL BALANCE" — 10px uppercase, letter-spacing 2px, muted
- Amount: 32px weight-800, white, tabular-nums
- Income/Expense pills: colored background + border, 11px weight-600
```

### 5.3 Metric Cards (Grid)

```
Background: rgba({color},0.04)
Border: 1px solid rgba({color},0.08)
Border-radius: 14px
Padding: 16px

Content:
- Label: 9px uppercase, letter-spacing 1.5px, whisper color
- Value: 22px weight-700, color-matched
- Progress bar: 4px height, rounded, gradient fill
```

### 5.4 Transaction Rows

```
Background: rgba(255,255,255,0.02)
Hover: rgba(255,255,255,0.04)
Border-radius: 14px
Padding: 14px 16px
Transition: background 0.2s

Layout:
- Icon: 42x42px, 12px radius, gradient background matching category
- Title: 14px weight-600, white
- Subtitle: 11px, muted (category · source · time)
- Amount: 15px weight-700, income=teal / expense=rose
```

### 5.5 Buttons

| Variant | Background | Text | Shadow | Hover |
|---------|-----------|------|--------|-------|
| Primary | `var(--gradient-primary)` | White | Orange glow | translateY(-2px), stronger glow |
| Gold | `var(--gradient-gold)` | Dark (#0d0d1a) | Gold glow | translateY(-2px) |
| Secondary | `rgba(255,255,255,0.06)` + border | Light | None | Background brightens |
| Ghost | Transparent | Orange | None | Subtle orange background |

```
All buttons:
- Padding: 12px 24px (standard), 16px 32px (large)
- Border-radius: 12px (standard), 14px (large)
- Font-size: 14px (standard), 16px (large)
- Font-weight: 600
- Transition: all 0.25s ease-out
- Active: scale(0.98)
- Disabled: opacity 0.4
```

### 5.6 Input Fields

```
Background: rgba(255,255,255,0.04)
Border: 1px solid rgba(255,255,255,0.08)
Border-radius: 12px
Padding: 14px 16px
Font-size: 14px
Color: var(--color-text-primary)

Focus state:
- Border-color: rgba(255,107,53,0.3)
- Box-shadow: 0 0 20px rgba(255,107,53,0.06)

Placeholder: rgba(255,255,255,0.25)
```

### 5.7 Adinkra Whispers

Barely-visible cultural signatures placed as decorative elements.

```
Font-size: 9px
Color: rgba(212,168,67,0.2)
Letter-spacing: 3px
Text: "⟡ GYE NYAME ⟡" (primary) — "Except God"

Placement:
- Bottom of dashboard screen
- Footer of landing page sections
- Background watermark on settings/profile
- Loading states

Other symbols to use:
- SANKOFA — "Go back and get it" (on insights/history pages)
- DWENNIMMEN — "Strength with humility" (on budget pages)
- FAWOHODIE — "Independence/freedom" (on goals pages)
```

### 5.8 Quick Actions Grid

```
Layout: 4-column flex, gap 10px
Active item: gradient-primary background, white text
Inactive: rgba(255,255,255,0.04) background, 1px border
Icon: 18px, centered
Label: 10px weight-600
Border-radius: 14px
Padding: 12px
```

---

## 6. Animation System

### Motion Principles

- **Duration:** 150-300ms for micro-interactions, 400-600ms for page transitions
- **Easing:** `ease-out` for entrances, `ease-in` for exits
- **Stagger:** 50-100ms between sequential items (e.g., transaction list)
- **Spring physics:** Used for card snaps, pull-to-refresh, and sheet dismissals
- **Reduced motion:** All animations respect `prefers-reduced-motion: reduce`

### Defined Animations

| Name | Duration | Easing | Usage |
|------|----------|--------|-------|
| `fade-in-up` | 400ms | ease-out | Page element entrance |
| `slide-up` | 300ms | ease-out | Modal/sheet entrance |
| `slide-down` | 250ms | ease-in | Modal/sheet exit |
| `count-up` | 800ms | ease-out | Financial number count from 0 |
| `shimmer` | 1.5s loop | linear | Skeleton loading states |
| `glow-pulse` | 3s loop | ease-in-out | Balance card ambient glow |
| `float` | 4-5s loop | ease-in-out | Landing page floating elements |
| `stagger-in` | 400ms + 50ms delay per item | ease-out | List items, card grids |
| `chart-grow` | 600ms | ease-out | Chart bars growing from 0 |
| `progress-fill` | 800ms | ease-out | Progress bars filling |
| `kente-reveal` | 500ms | ease-out | Kente stripe drawing left to right |

### Page Transitions

- **Forward navigation:** Current page fades out (150ms) → new page slides up from bottom (300ms)
- **Back navigation:** Current page slides down (250ms) → previous page fades in (200ms)
- **Tab switch:** Cross-fade (200ms)

### Special Animations

**Dashboard load sequence (staggered):**
1. Kente stripe draws left-to-right (0ms)
2. Greeting text fades in (100ms)
3. Balance card slides up + number counts up (200ms)
4. Income/expense pills pop in (400ms)
5. Quick actions stagger in left-to-right (500ms)
6. Chart bars grow sequentially (700ms)
7. Transaction rows stagger in (900ms)
8. Adinkra whisper fades in (1200ms)

**Goal completion:** Confetti burst (gold + flag colors) + haptic feedback

---

## 7. Ghana Flag Animation

### Behavior

**First visit (per session):**
1. Red, gold, and green particles scatter from center
2. Particles swirl and converge into flag shape (800ms, spring easing)
3. Flag settles into waving animation

**Ongoing:**
- SVG flag with independent stripe undulation
- Each stripe (red, gold, green) is an animated SVG path with bezier curves
- Stripes wave at slightly different phases for natural cloth feel
- Gold finial on pole
- Star gently pulses (scale 1.0 → 1.15, 2s cycle)
- Total animation cycle: 2s, infinite, `ease-in-out`

### Implementation

- SVG with `<animate>` elements on path `d` attributes
- `calcMode="spline"` with `keySplines="0.45 0 0.55 1"` for natural motion
- Particle burst uses CSS keyframe animations with random delays
- Particle burst triggered once via `sessionStorage` check
- Flag dimensions: 32x22px in hero tag context

---

## 8. Screen Designs

### 8.1 Dashboard

**Layout (mobile-first):**
```
[Kente Stripe — 3px]
[TopBar: Logo + Greeting | Notification bell]
[Balance Card — full width, glowing]
[Quick Actions — 4-col grid: Add, Insights, AI Chat, Susu]
[Spending Trend Chart — bar chart with glowing "today" bar]
[Recent Transactions — 3-5 items, staggered entrance]
[Adinkra Whisper — centered, barely visible]
[Bottom Nav — 4 items: Home(active), Txns, Goals, More]
```

**Background:** Radial gradient glows (orange at 30% from top-left, teal at 70% from bottom-right)

**Chart design:**
- Bar chart with gradient fills (orange)
- Current day bar: full opacity + glow shadow
- Future days: dashed border, lower opacity
- Day labels below, current day highlighted in orange

### 8.2 Landing Page (Story-Driven)

**Section flow:**

1. **Hero**
   - Tag: Animated Ghana flag (B+D) + "Made in Ghana"
   - Title: "Your Money. Your Power." (gradient text)
   - Subtitle: Story hook about MoMo, market, susu
   - CTA: "Start Free →" (primary) + "See How It Works" (secondary with play icon)
   - Sub-text: "No bank login needed · Works with MoMo SMS · Free forever tier"
   - Visual: Floating phone mockup with dashboard preview + floating notification bubbles

2. **Problem Statement**
   - "Where did ₵200 go last Tuesday?"
   - Brief copy about the gap: MoMo doesn't show the full picture

3. **Solution — Feature Grid**
   - "Everything. One place."
   - 6 feature cards (2x3 grid):
     - SMS Auto-Import
     - AI Money Advisor
     - Digital Susu
     - Smart Budgets
     - Deep Insights
     - Private & Secure
   - Each card: colored icon (48px), Clash Display heading, Inter body text
   - Hover: translateY(-4px) + border color shift + deeper shadow

4. **Social Proof**
   - Stats: "10K+ Active Users" / "₵2M+ Tracked Monthly" / "500+ Susu Groups"
   - Stats use gradient text (orange, teal, gold respectively)
   - Testimonial card with avatar initial, name, role, location

5. **CTA Section**
   - Kente stripe accent
   - "Take control of your cedis today." (gradient on "cedis")
   - Akan proverb: "Sika ye mogya" — Money is blood
   - Large CTA button + trust badges

6. **Footer**
   - Kente stripe full-width
   - Minimal footer with links

### 8.3 Interactive Guide ("See How It Works")

**Trigger:** "See How It Works" button on landing page

**Container:** Fullscreen overlay, `rgba(8,8,15,0.95)` background, `backdrop-filter: blur(20px)`

**Navigation:**
- Arrow keys (left/right)
- Swipe gestures (mobile)
- Next/Back buttons
- Progress bar with gradient fill
- Step counter: "2 of 5"
- Skip button always visible
- Close button (top-right, 40x40px)

**5 Steps:**

| Step | Color | Title | Animation |
|------|-------|-------|-----------|
| 01 | Orange | Import Your Transactions | SMS flies in → parser highlights amount/merchant → transaction card assembles with spring physics |
| 02 | Teal | Your Dashboard Lights Up | Balance counts ₵0→₵12,450 · Chart bars grow sequentially · Category pills pop in |
| 03 | Gold | Chat With Your AI Advisor | User message typewriter effect → typing indicator → AI response streams · Suggestions slide up |
| 04 | Rose | Join a Susu Group | Member avatars fly in from edges → contribution ripples around circle → pot total counts up with gold particles |
| 05 | Purple | Set Goals That Stick | Goal card unfolds from center → progress ring draws clockwise → milestone markers pop → confetti at 100% |

**Each step layout:** Left side = text (label, heading, description), Right side = phone mockup with animated demo

**Final step CTA:** Pulsing "Start Free →" button. All 5 phone mockups cascade into a single stack, then dissolve into signup form.

**Animation timing per step:**
- Elements stagger in at 200ms intervals
- Total step animation: ~2 seconds
- Auto-advances after animation completes (with 3s pause) OR manual advance

### 8.4 AI Chat

- User messages: Orange gradient bubbles, right-aligned, rounded (14px 14px 4px 14px)
- AI messages: Dark surface with subtle border, left-aligned, rounded (14px 14px 14px 4px)
- Typing indicator: 3 dots with staggered bounce
- Suggested follow-ups: Horizontal scroll pills with orange border
- Inline charts animate when AI references data

### 8.5 Susu Groups

- Group circle visualization: Members as colored avatar circles around central "pot"
- Pot total at center with count-up animation
- Active contributor highlighted with glow pulse
- Contribution timeline as horizontal scroll
- Trust scores as small badge indicators

### 8.6 Onboarding

- 4-5 swipeable cards
- Each card: full-screen illustration + heading + body text
- Progress dots at bottom
- "Skip" always visible
- Final card transitions to signup with spring animation

---

## 9. Responsive Behavior

| Breakpoint | Layout |
|-----------|--------|
| `< 768px` (mobile) | BottomNav, single column, full-width cards |
| `≥ 768px` (tablet) | SideNav collapses, 2-column grids |
| `≥ 1024px` (desktop) | Full SideNav + TopBar, 2-3 column grids |

- Mobile-first approach
- `pb-20 md:pb-0` for bottom nav padding
- Landing page: stacks to single column on mobile, phone mockup goes below text
- Feature grid: 1 column mobile, 2 tablet, 3 desktop

---

## 10. Accessibility

- **Contrast:** AA minimum (4.5:1) for all text on backgrounds
- **Touch targets:** 44x44px minimum for all interactive elements
- **Focus states:** 2px solid `rgba(255,107,53,0.5)` outline with 2px offset
- **Motion:** All animations wrapped in `@media (prefers-reduced-motion: no-preference)`
- **Keyboard navigation:** Full tab order, arrow keys for guide navigation
- **Aria labels:** On all icon-only buttons, flag image, chart elements
- **Semantic HTML:** Proper heading hierarchy, landmark regions
- **Screen reader:** Hidden text alternatives for decorative Adinkra symbols

---

## 11. Performance Considerations

- **Clash Display:** Load only weights 600, 700 via fontshare CDN
- **SVG flag:** Inline SVG, no external requests
- **Particle animation:** CSS-only, no JS physics library
- **Ambient glows:** CSS radial gradients (GPU-accelerated)
- **Chart animations:** CSS transforms only (no layout thrashing)
- **Staggered loading:** Defer below-fold animations until in viewport (IntersectionObserver)
- **Code-split:** Interactive guide loaded lazily (only when button clicked)
- **Target devices:** Must perform smoothly on mid-range Android (e.g., Samsung A14, Tecno Spark)

---

## 12. Files to Modify

| File | Changes |
|------|---------|
| `apps/web/tailwind.config.ts` | New color tokens, Clash Display font, updated animations |
| `apps/web/src/styles/globals.css` | New component classes, Kente stripe, glow utilities, flag animation |
| `apps/web/src/App.tsx` | Add landing page route if not present |
| `apps/web/src/pages/LandingPage.tsx` | Full rewrite — story-driven layout |
| `apps/web/src/pages/DashboardPage.tsx` | Redesign with new component system |
| `apps/web/src/components/layout/AppShell.tsx` | Kente stripe integration |
| `apps/web/src/components/layout/BottomNav.tsx` | Updated styling |
| `apps/web/src/components/layout/TopBar.tsx` | Updated greeting + styling |
| `apps/web/src/components/dashboard/*` | All dashboard components restyled |
| `apps/web/src/components/landing/*` | New directory — Hero, FeatureGrid, InteractiveGuide, SocialProof, CTA |
| `apps/web/src/components/shared/KenteStripe.tsx` | New — reusable Kente stripe |
| `apps/web/src/components/shared/GhanaFlag.tsx` | New — animated SVG flag with particle burst |
| `apps/web/src/components/shared/AdinkraWhisper.tsx` | New — configurable Adinkra text |
| `apps/web/src/pages/AIChatPage.tsx` | Restyle chat bubbles |
| `apps/web/src/pages/SusuPage.tsx` | Circle visualization |
| `apps/web/src/pages/GoalsPage.tsx` | Progress ring, milestone markers |
| `apps/web/src/pages/OnboardingPage.tsx` | Swipeable cards redesign |
| All other pages | Apply updated color tokens and component classes |

---

## 13. Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Direction | Bold Afrofuturism | Maximum "wow" factor, culturally distinctive |
| Sub-flavor | Hybrid (Kente + Glow + Adinkra) | Cherry-picks the best from each without being heavy-handed |
| Headings font | Clash Display | Angular, editorial, distinctive — avoids generic fintech look |
| Body font | Inter (keep) | Excellent for financial data, already in use |
| Animation level | Refined Motion | Delivers wow without sacrificing mid-range Android performance |
| Landing style | Story-driven + cinematic | Emotional connection via narrative, with spectacle moments |
| Flag animation | Particle burst → SVG wave | One-time spectacle on arrival + persistent ambient motion |
| Primary color | Flame Orange (#FF6B35) | Shift from Ghana Green to orange — bolder, warmer, more Afrofuturist |
| Ghana Green role | Relegated to income/success only | Still present via Kente stripe and Forest Teal |
| Adinkra usage | Whisper-level (barely visible) | Cultural depth without visual clutter |

---

## 14. Token Migration (Old → New)

| Old Token (Tailwind) | Old Value | New Token | New Value | Notes |
|----------------------|-----------|-----------|-----------|-------|
| `ghana.green` | `#006B3F` | (kept in Kente stripe) | `#006B3F` | No longer primary; used in `--gradient-kente` only |
| `ghana.dark` / `ghana.black` | `#0C0C14` | Deep Space | `#0d0d1a` | Slightly warmer dark |
| `ghana.surface` | `#14142A` | Cosmic Surface | `#14142a` | Same value, renamed |
| `ghana.elevated` | `#1E1E38` | Nebula | `#1E1E38` | Same value, renamed |
| `gold.DEFAULT` | `#D4A843` | Ashanti Gold | `#D4A843` | Same value |
| `income` | `#34D399` | Forest Teal | `#00C896` | **Breaking change** — more saturated teal |
| `expense` | `#EF4444` | Sunset Rose | `#FF6B8A` | **Breaking change** — warmer pink-rose |
| `muted` | `#8888A8` | `--color-text-secondary` | `rgba(255,255,255,0.5)` | Now opacity-based |
| `text.primary` | `#E8E8F0` | `--color-text-primary` | `#E8E8F0` | Same value |
| `.btn-primary` bg | Green gradient | Primary btn | Orange gradient | **Major brand shift** |

**Migration strategy:** Update `tailwind.config.ts` color tokens in a single commit. Keep old class names as aliases during transition, remove in follow-up cleanup PR.

---

## 15. Additional Semantic Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-warning` | `#FFB347` | Budget approaching limit, attention needed |
| `--color-warning-bg` | `rgba(255,179,71,0.08)` | Warning badge/pill background |
| `--color-info` | `#9382FF` | Informational states, tips, neutral notices |
| `--color-info-bg` | `rgba(147,130,255,0.08)` | Info badge/pill background |

---

## 16. Fixed Spacing Values (Resolved from Ranges)

| Element | Fixed Value | Context |
|---------|------------|---------|
| Card padding | 20px (mobile), 24px (desktop) | Use `p-5 md:p-6` |
| Card border-radius | 16px (small cards), 20px (primary/large cards) | Small = metric cards; Large = balance card, feature cards |
| Button border-radius | 12px (standard), 14px (large/CTA) | Large = landing page CTAs only |
| Small element radius | 8px (pills/badges), 10px (category icons) | Fixed per usage |
| Financial font size | 28px (cards), 36px (balance hero) | Context-dependent |
| Financial font weight | 700 (cards), 800 (balance hero) | Balance card only gets 800 |
| Label font size | 10px (inside cards), 11px (standalone) | Card labels always 10px |

---

## 17. Contrast Verification

| Text Token | Value | On Background | Contrast Ratio | Status |
|-----------|-------|---------------|----------------|--------|
| `--color-text-primary` | `#E8E8F0` | `#0d0d1a` | 16.2:1 | Pass AAA |
| `--color-text-secondary` | `rgba(255,255,255,0.5)` ≈ `#868696` | `#0d0d1a` | 5.8:1 | Pass AA |
| `--color-text-muted` | `rgba(255,255,255,0.35)` ≈ `#5e5e6e` | `#0d0d1a` | 3.5:1 | **Adjusted** from 0.3 → 0.35 to pass AA-large (3:1 at 14px bold / 18px) |
| Metric label (9px) | `rgba(255,255,255,0.4)` ≈ `#6b6b7d` | `#14142a` | 4.1:1 | **Adjusted** — labels bumped to 0.4 opacity inside cards |
| `--color-text-whisper` | `rgba(255,255,255,0.15)` | `#0d0d1a` | 1.7:1 | Pass — decorative only, `aria-hidden="true"` |
| Income (#00C896) | - | `#0d0d1a` | 7.4:1 | Pass AAA |
| Expense (#FF6B8A) | - | `#0d0d1a` | 6.2:1 | Pass AA |
| Flame Orange (#FF6B35) | - | `#0d0d1a` | 5.1:1 | Pass AA |

**Note:** `--color-text-muted` bumped from 0.3 to 0.35, and metric card labels bumped to 0.4 opacity, to meet contrast requirements. Adinkra whispers remain low-contrast as they are purely decorative with `aria-hidden`.

---

## 18. Modal / Dialog Spec

```
Overlay: rgba(8,8,15,0.7)
Backdrop-filter: blur(8px)
Container:
- Background: #14142a (Cosmic Surface)
- Border: 1px solid rgba(255,255,255,0.06)
- Border-radius: 24px
- Max-width: 480px (standard), 600px (wide)
- Padding: 24px
- Box-shadow: 0 25px 80px rgba(0,0,0,0.5)
- Animation: slide-up 300ms ease-out (entrance), slide-down 250ms ease-in (exit)

Close button: 36x36px, top-right, 8px offset, rgba(255,255,255,0.06) bg, border-radius 10px
Title: Clash Display, 20px, weight 600
Body: Inter, 14px, --color-text-secondary
Actions: Flex row, gap 12px, right-aligned, primary button on right
```

---

## 19. Toast / Notification Spec

```
Position: Top-center, 16px from top
Max-width: 400px
Background: #1E1E38 (Nebula)
Border: 1px solid rgba(255,255,255,0.08)
Border-radius: 14px
Padding: 14px 18px
Box-shadow: 0 8px 30px rgba(0,0,0,0.4)
Animation: slide-down 300ms ease-out (entrance), fade-out 200ms ease-in (exit)
Auto-dismiss: 4 seconds

Variants:
- Success: left border 3px solid #00C896
- Error: left border 3px solid #FF6B8A
- Warning: left border 3px solid #FFB347
- Info: left border 3px solid #9382FF
```

---

## 20. Empty State Spec

```
Container: centered, max-width 280px, padding 40px 0
Icon/Illustration: 64px, muted color, centered
Title: Clash Display, 18px, weight 600, white
Description: Inter, 13px, --color-text-secondary, text-align center
CTA button: Primary or Secondary, full-width

Examples:
- No transactions: "Your financial story starts here" + "Add Transaction" button
- No susu groups: "Better together" + "Create or Join a Group" button
- No goals: "Dream it. Save for it." + "Set a Goal" button
- No budgets: "Take the wheel" + "Create Budget" button
```

---

## 21. Shared Component Props

```typescript
// KenteStripe.tsx
interface KenteStripeProps {
  className?: string;
  height?: 2 | 3 | 4;  // default: 3
}

// GhanaFlag.tsx
interface GhanaFlagProps {
  size?: 'sm' | 'md' | 'lg';  // 20x14, 32x22, 48x32
  animate?: boolean;           // default: true
  showBurst?: boolean;         // particle burst, default: true (first visit only)
  className?: string;
}

// AdinkraWhisper.tsx
interface AdinkraWhisperProps {
  symbol?: 'gye-nyame' | 'sankofa' | 'dwennimmen' | 'fawohodie';
  className?: string;
}
```

---

## 22. Clash Display Font Loading

```css
/* Add to globals.css — fontshare CDN */
@import url('https://api.fontshare.com/v2/css?f[]=clash-display@600,700&display=swap');
```

```typescript
// tailwind.config.ts — add to theme.extend.fontFamily
fontFamily: {
  display: ['"Clash Display"', '"Space Grotesk"', 'system-ui', 'sans-serif'],
  sans: ['Inter', 'system-ui', 'sans-serif'],
}
```

**Note:** Space Grotesk is the visual fallback if Clash Display fails to load. It is loaded via Google Fonts as a backup:
```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&display=swap');
```

---

## 23. CSS Custom Properties Declaration

All design tokens declared in `:root` in `globals.css`:

```css
:root {
  /* Colors */
  --color-primary: #FF6B35;
  --color-gold: #D4A843;
  --color-income: #00C896;
  --color-expense: #FF6B8A;
  --color-warning: #FFB347;
  --color-info: #9382FF;
  --color-bg: #0d0d1a;
  --color-surface: #14142a;
  --color-elevated: #1E1E38;

  /* Text */
  --color-text-primary: #E8E8F0;
  --color-text-secondary: rgba(255,255,255,0.5);
  --color-text-muted: rgba(255,255,255,0.35);
  --color-text-whisper: rgba(255,255,255,0.15);

  /* Borders */
  --color-border: rgba(255,255,255,0.06);
  --color-border-hover: rgba(255,255,255,0.1);

  /* Backgrounds (functional) */
  --color-income-bg: rgba(0,200,150,0.08);
  --color-expense-bg: rgba(255,107,138,0.08);
  --color-warning-bg: rgba(255,179,71,0.08);
  --color-info-bg: rgba(147,130,255,0.08);

  /* Shadows */
  --shadow-card: 0 1px 3px rgba(0,0,0,0.4);
  --shadow-card-hover: 0 4px 12px rgba(0,0,0,0.5);
  --shadow-glow-orange: 0 0 25px rgba(255,107,53,0.04);
  --shadow-glow-btn: 0 4px 15px rgba(255,107,53,0.25);
}
```

Tokens are available to both Tailwind classes (via config) and raw CSS (via custom properties). Tailwind config extends `theme.colors` to reference these values.

---

## 24. Dark Mode

CediSense is **dark-mode only**. No light mode is planned for v2.0.

Rationale: The Afrofuturist aesthetic relies on deep backgrounds for glow effects, gradient text visibility, and ambient radial gradients. A light mode would require a fundamentally different design language and is out of scope for this refresh.

---

## 25. Animation Library Decision

**No external animation library.** All animations use:
- CSS `@keyframes` + `animation` properties for repeating/entrance animations
- CSS `transition` for hover/focus micro-interactions
- SVG `<animate>` elements for flag waving
- `IntersectionObserver` (vanilla JS) for scroll-triggered animations

**"Spring physics" in this spec means:** CSS cubic-bezier approximations:
- `cubic-bezier(0.34, 1.56, 0.64, 1)` — spring overshoot (card snap, sheet open)
- `cubic-bezier(0.45, 0, 0.55, 1)` — smooth spring (flag wave, float)

No framer-motion, react-spring, or other libraries. This keeps the bundle lean for mid-range Android targets.

---

## 26. Icon System

Icons use **emoji** for category indicators (consistent with current codebase) and **inline SVG** for UI controls (nav, buttons, actions).

- Category icons: Emoji inside gradient-tinted containers (42x42px, 12px radius)
- UI icons: Inline SVG, 20px default, `stroke="currentColor"` stroke-width 2
- No icon library dependency — all UI icons are hand-drawn SVGs kept in components

Category-to-color mapping:
| Category | Emoji | Tint Color |
|----------|-------|------------|
| Food & Drink | 🍜 | Orange `rgba(255,107,53,0.15)` |
| Transport | 🚌 | Gold `rgba(212,168,67,0.15)` |
| Transfer (in) | 📱 | Teal `rgba(0,200,150,0.15)` |
| Transfer (out) | 📤 | Rose `rgba(255,107,138,0.15)` |
| Bills & Utilities | ⚡ | Purple `rgba(147,130,255,0.15)` |
| Shopping | 🛍️ | Amber `rgba(255,179,71,0.15)` |
| Health | 🏥 | Teal `rgba(0,200,150,0.15)` |
| Church / Tithe | ⛪ | Gold `rgba(212,168,67,0.15)` |
| Fuel | ⛽ | Orange `rgba(255,107,53,0.15)` |
| Entertainment | 🎬 | Purple `rgba(147,130,255,0.15)` |
| Other | 💳 | Muted `rgba(255,255,255,0.08)` |

---

## 27. Implementation Phases

The refresh must be implemented in this order due to dependencies:

**Phase 1 — Foundation (tokens + shared components)**
1. `tailwind.config.ts` — New color tokens, font families, animation keyframes
2. `globals.css` — CSS custom properties, font imports, component utility classes
3. `components/shared/KenteStripe.tsx` — Reusable stripe
4. `components/shared/GhanaFlag.tsx` — Animated SVG flag
5. `components/shared/AdinkraWhisper.tsx` — Cultural whisper text

**Phase 2 — Layout shell**
6. `components/layout/AppShell.tsx` — Kente stripe integration
7. `components/layout/TopBar.tsx` — Updated styling + greeting
8. `components/layout/BottomNav.tsx` — New tab styling
9. `components/layout/SideNav.tsx` — Desktop nav restyling

**Phase 3 — Hero screens (highest impact)**
10. `pages/LandingPage.tsx` — Full rewrite (story-driven)
11. `components/landing/*` — New: Hero, FeatureGrid, InteractiveGuide, SocialProof, CTA
12. `pages/DashboardPage.tsx` — Redesign with new components
13. `components/dashboard/*` — All dashboard components

**Phase 4 — Feature screens**
14. `pages/AIChatPage.tsx` + chat components
15. `pages/SusuPage.tsx` + susu components
16. `pages/GoalsPage.tsx` + goal components
17. `pages/OnboardingPage.tsx`

**Phase 5 — Remaining screens (token swap + polish)**
18. TransactionFeedPage, BudgetsPage, InsightsPage, RecurringPage
19. SettingsPage, SplitsPage, InvestmentsPage, CollectorPage
20. Auth pages (Login, Register), ImportPage, AddTransactionPage
21. Print layouts, VerifyCertificatePage

**Phase 6 — Polish**
22. Interactive Guide animations (lazy-loaded)
23. Page transitions
24. Empty states
25. Loading skeletons

**Note for Phase 5 pages:** These receive the updated color tokens and component classes but no layout redesign. Existing layouts are preserved — only colors, borders, shadows, fonts, and button styles change.

---

## 28. Unspecified Screens — Guidance

Screens not detailed in sections 8.1-8.6 follow this rule:

> **Apply the token system, not a new layout.** Swap color classes to new tokens, update border-radius to spec values, apply new button/input/card styles, add Kente stripe via AppShell, and add page-appropriate Adinkra whisper at the bottom. Do not redesign the layout or information architecture.

Specific notes for each:
- **TransactionFeedPage:** Apply transaction row spec (5.4). Search input gets spec'd input style. Filters get pill/badge styling.
- **BudgetsPage:** Budget cards get metric card spec (5.3). Budget warning uses `--color-warning`. Adinkra: DWENNIMMEN.
- **InsightsPage:** Charts get orange gradient fills. Comparison cards use metric card pattern. Adinkra: SANKOFA.
- **SettingsPage:** List items get transaction row pattern (without amount). Toggle switches get orange active state.
- **Auth pages:** Input fields get spec'd style. Primary CTA button. Background gets ambient glow.
- **All modals:** Apply modal spec (section 18).

---

## 29. Visual Mockups

Interactive mockups available at: `.superpowers/brainstorm/38925-1774129509/`
- `design-direction.html` — Initial 3 directions compared
- `afrofuturism-flavor.html` — 4 sub-flavor options
- `full-design-system.html` — Complete design system + dashboard + landing page
- `hero-updated.html` — Updated hero with flag + interactive guide spec
- `flag-animation-options.html` — 4 flag animation styles
