# Tripcholic Design System — Mobile

This file documents the visual and style decisions implemented on the **Planner entry screen** as a concrete, reusable design reference. All values here are derived directly from the implemented code. Use this as the source of truth when extending the design language to other screens.

---

## 1. Typography

All type uses **Plus Jakarta Sans**, loaded via `@expo-google-fonts/plus-jakarta-sans`. The full token set lives in `constants/typography.ts`.

### Type scale

| Token | Family | Size | Weight | Line height | Letter spacing | Usage |
|-------|--------|------|--------|-------------|----------------|-------|
| `displayLg` | Bold | 40 | 700 | 44 (×1.1) | −0.8 (−0.02em) | Hero headline |
| `headlineLg` | Bold | 28 | 700 | 34 (×1.2) | — | Card titles |
| `headlineMd` | SemiBold | 20 | 600 | 26 (×1.3) | — | Base token; Planner CTAs override to 15px (see §8) |
| `bodyLg` | Regular | 16 | 400 | 26 (×1.6) | — | Hero subtitle |
| `bodySm` | Regular | 14 | 400 | 21 (×1.5) | — | Card body copy |
| `labelCaps` | Bold | 12 | 700 | 12 (×1.0) | 1.2 (0.1em) | Base token; Planner badges override to 11px (see §6) |
| `metadata` | Medium | 13 | 500 | 18 (×1.4) | — | Supporting metadata (not yet used on this screen) |

### Font weight aliases (from `constants/typography.ts`)

```
font.regular   → PlusJakartaSans_400Regular
font.medium    → PlusJakartaSans_500Medium
font.semiBold  → PlusJakartaSans_600SemiBold
font.bold      → PlusJakartaSans_700Bold
```

### Notes
- `lineHeight` values are absolute pixels in React Native. The multipliers above show the original design-token ratio.
- `letterSpacing` values are absolute pixels. Derive them as `em × fontSize` when adding new tokens.
- `textTransform: 'uppercase'` is baked into `labelCaps`. Do not add uppercase manually elsewhere — always use the `labelCaps` token.
- Never hardcode font weights (e.g. `fontWeight: '700'`) without also setting the correct `fontFamily`. React Native does not synthesise weights from a single font face.

---

## 2. Color

All semantic colors come from `constants/theme.ts`. Raw hex values are only used where the semantic token does not yet exist.

| Role | Token / Value | Usage |
|------|--------------|-------|
| Brand primary | `theme.colors.primary` (`#0EA5A4`) | Eyebrow dot, eyebrow text, primary button background, FAB (where teal is appropriate) |
| **Primary text** | `theme.colors.primaryDark` (`#0B3B4A`) | **All important dark text — hero titles, card titles, section headers, trip names** |
| Primary dark (structural) | `theme.colors.primaryDark` (`#0B3B4A`) | Shadow color on cards, FAB background |
| Background | `theme.colors.background` (`#F7FAFC`) | Screen background |
| Surface | `theme.colors.surface` (`#FFFFFF`) | Card background |
| Text secondary | `theme.colors.textSecondary` (`#64748B`) | Subtitles, descriptions, muted metadata, secondary labels |
| Border | `theme.colors.border` (`#E2E8F0`) | Card border stroke |
| Recommended accent | `#006A69` | Recommended badge icon + text |
| Disabled surface | `#F1F5F9` | Secondary / coming-soon CTA button background |
| Badge glass | `rgba(255,255,255,0.92)` | Recommended badge background (overlaid on image) |
| Badge glass muted | `rgba(255,255,255,0.88)` | Coming-soon badge background (overlaid on image) |
| Image veil | `rgba(255,255,255,0.26)` | Subtle overlay on the coming-soon card image to signal unavailability |

> **Primary text color rule:** Use `theme.colors.primaryDark` (`#0B3B4A`) — not `theme.colors.text` (`#0F172A`) or raw black — for all primary UI text including headlines, titles, section headers, and card labels. `theme.colors.text` exists in `theme.ts` but is not the Tripcholic visual standard. `#0B3B4A` provides strong contrast while feeling warmer and more on-brand than near-black.

---

## 3. Spacing

Based on the design system spacing unit (4px base).

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Micro gaps |
| `sm` | 8px | Tight inline gaps (badge icon → text: `gap: 5`) |
| `md` | 16px | Standard margin between hero elements; gap between cards |
| `lg` | 24px | — |
| `xl` | 40px | Hero bottom padding |
| `container-padding` | 20px | Horizontal screen edge padding (hero, cards wrapper, card content) |
| `stack-gap` | 12px | `gap` inside card content (between title, desc, and CTA) |

### Applied spacing on this screen

```
Screen edges:         paddingHorizontal: 20  (both hero and cards wrapper)
Hero top padding:     paddingTop: 32
Hero bottom padding:  paddingBottom: 40  (xl)
Between eyebrow and title:  marginBottom: 16  (md)
Between title and subtitle: marginBottom: 16  (md)
Card-to-card gap:     gap: 16  (md)
Card content padding: padding: 20  (container-padding, all sides)
Card content stack:   gap: 12  (stack-gap, between title / desc / CTA)
CTA top offset:       marginTop: 4  (xs, visual breathing room above button)
Badge overlay:        top: 12, left: 12
```

---

## 4. Border radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 4px | — |
| default | 8px | — |
| `md` | 12px | — |
| `lg` | 16px | CTA buttons |
| `xl` | 24px | Cards |
| `full` | 9999px | Badges (pill shape) |

Cards use `borderRadius: 24` (`xl`) with `overflow: 'hidden'` so the image band respects the rounded corners at the top.

---

## 5. Hero section

### Layout
- Container alignment: `alignItems: 'center'` (all children horizontally centered)
- Text alignment: `textAlign: 'center'` on both title and subtitle
- `maxWidth: 300` on the subtitle prevents over-wide lines on large screens; the constraint is intentional

### Eyebrow
- A 6×6px circular dot (`borderRadius: 3`) in `theme.colors.primary`, followed by the eyebrow label in `labelCaps`
- Both sit in a row with `gap: 8`
- Eyebrow text is sentence-case in the label caps style (e.g. "Istanbul") — do not use all-uppercase strings in JSX; `textTransform: 'uppercase'` handles the visual casing

### Title
- Uses `type.displayLg` (40px / 700 / lh 44 / ls −0.8)
- Color: `theme.colors.primaryDark` (`#0B3B4A`) — the standard Tripcholic primary text color
- Two lines, split with `{'\n'}` — keep the line break intentional, not word-wrapped

### Subtitle
- Uses `type.bodyLg` (16px / 400 / lh 26)
- Color: `theme.colors.textSecondary`
- Should be calm, readable, and one conceptual idea — not a feature list

---

## 6. Card treatment

### Card shell
```
backgroundColor:  theme.colors.surface   (#FFFFFF)
borderRadius:     24  (xl)
overflow:         hidden   ← required for image corners
borderWidth:      1
borderColor:      theme.colors.border
shadowColor:      #0B3B4A
shadowOpacity:    0.08
shadowRadius:     20
shadowOffset:     { width: 0, height: 6 }
elevation:        3  (Android)
```

### Image band
- Fixed height: **180px**
- `expo-image` with `contentFit: 'cover'`
- Full card width, no padding — sits flush against all sides of the image band area
- Use screen-specific assets (e.g. `planner-optimized-trip.png`), not generic placeholders
- `overflow: 'hidden'` on the card shell clips the image to the card's rounded corners

### Badge overlay on image
- Absolute positioned top-left (`top: 12, left: 12`)
- Pill shape (`borderRadius: 9999`)
- Frosted white background (`rgba(255,255,255,0.92)` for primary, `rgba(255,255,255,0.88)` for muted)
- Icon + label in a row with `gap: 5`
- Text uses `labelCaps` token with `fontSize` overridden to **11px** — the base 12px felt slightly heavy at this scale

### Card content area
- `padding: 20` on all sides
- Internal elements use `gap: 12` (stack-gap) — do not use `marginBottom` on individual elements; rely on the gap
- Order: title → description → CTA button

### Card title
- Base: `type.headlineLg` (28px / 700 / lh 34), `fontSize` overridden to **22px** on the Planner entry screen for better visual balance
- Color: `theme.colors.primaryDark` (`#0B3B4A`)
- This is the most important text element on the card — it must read at headline scale, not body scale

### Card description
- `type.bodySm` (14px / 400 / lh 21)
- Color: `theme.colors.textSecondary`
- 2–3 lines maximum; describe the outcome, not the mechanics

---

## 7. Visual hierarchy across the two cards

### Primary card — "Smart trip planner"
- Full-fidelity image, no overlay
- `Recommended` badge in teal accent (`#006A69` text/icon, white glass background)
- Primary solid CTA button (teal fill, white text)
- Press state: `opacity: 0.93`

### Secondary / coming-soon card — "Build your own trip"
- Image with a subtle white veil overlay (`rgba(255,255,255,0.26)`) — visually present but softly de-prioritised
- `Coming soon` badge in muted grey, with a clock icon
- Secondary flat CTA (light grey background, muted text, lock icon)
- No `opacity` applied to the whole card — the card must look attractive, not disabled; only the CTA signals unavailability
- `onPress` fires `Alert.alert` only — no navigation, no state changes

**Rule:** A "coming soon" feature should never make a card look dead. Reduce the CTA affordance, not the card's visual presence.

---

## 8. CTA hierarchy

### Primary button
```
backgroundColor:  theme.colors.primary  (#0EA5A4)
borderRadius:     16  (lg)
paddingVertical:  15
Layout:           flexDirection: 'row', justifyContent: 'center', gap: 8
Label:            type.headlineMd + fontSize override → 15px / 600 / Plus Jakarta Sans SemiBold, color #fff
Icon:             arrow-forward, size 15, color #fff
```

### Secondary / disabled button
```
backgroundColor:  #F1F5F9
borderRadius:     16  (lg)
paddingVertical:  15
Layout:           flexDirection: 'row', justifyContent: 'center', gap: 8
Label:            type.headlineMd + fontSize override → 15px / 600 / Plus Jakarta Sans SemiBold, color theme.colors.textSecondary
Icon:             lock-closed-outline, size 14, color theme.colors.textSecondary
```

> **Why 15px, not 20px:** The `headlineMd` token (20px) is correct as a base token for headlines. For button labels at this padding/height, 20px felt heavy and unbalanced relative to the card content. 15px keeps the SemiBold weight and the font family while sitting at a conventional button-label scale.

**Rules:**
- CTA buttons are always full-width within their card content area — no fixed widths, no `alignSelf`
- Label + arrow icon always centered together via `justifyContent: 'center'`
- The primary button is the card's primary action; the card `onPress` and the button visual are one and the same — do not nest a `Pressable` inside a `Pressable`
- `marginTop: 4` separates the CTA from the description above it, in addition to the `gap: 12` already set on the card content container

---

## 9. Interaction states

| State | Treatment |
|-------|-----------|
| Card press (active) | `opacity: 0.93` on the card container |
| Coming-soon card press | `Alert.alert` only; no `pressed` visual state needed since the card is intentionally non-interactive |
| No disabled prop | React Native's `disabled` prop is not used — the visual treatment communicates state instead |

---

## 10. Screen-level layout rules

```
Safe area edges:  ['top', 'left', 'right']  — bottom handled by tab bar
ScrollView:       flexGrow: 1, paddingBottom: 48
Section order:    Hero → Cards
No dividers:      Sections are separated by spacing only, no ruled lines
Background:       theme.colors.background (#F7FAFC) — light warm grey, not pure white
```

---

## 11. Implementation files

| File | Role |
|------|------|
| `constants/typography.ts` | Type scale tokens (font family aliases + all 7 type styles) |
| `constants/theme.ts` | Color, spacing, and radius tokens |
| `app/_layout.tsx` | Font loading via `useFonts` + `SplashScreen` gate |
| `app/(tabs)/_layout.tsx` | Tab navigator — mounts `AppHeader` globally via `header` in `screenOptions` |
| `app/(tabs)/planner.tsx` | Planner entry screen (canonical reference for this design system) |
| `app/(tabs)/index.tsx` | Home screen — implements hero pattern, trip carousel, FAB |
| `components/ui/AppHeader.tsx` | Global app shell header (hamburger · wordmark · avatar) |
| `components/trip/TripSnapshotCard.tsx` | Image-first trip tile used in Home carousel |
| `assets/images/planner/planner-optimized-trip.png` | Card image — optimised trip |
| `assets/images/planner/planner-own-trip.png` | Card image — manual trip |

---

## 12. Global app header (AppHeader)

The tab navigator mounts a single `AppHeader` component for all tab screens via `header: () => <AppHeader />` in `app/(tabs)/_layout.tsx`. This replaces the Expo Router default title header.

### Structure
```
[ hamburger icon ]   [ TRIPCHOLIC wordmark ]   [ avatar ]
     44 px wide          flex: 1, centered          44 px wide
```

Container height: `paddingTop: insets.top` (from `useSafeAreaInsets`) + inner row `height: 52`.
Background: `theme.colors.surface`. Bottom edge: `StyleSheet.hairlineWidth` in `theme.colors.border`.

### Hamburger (left)
- `Ionicons name="menu"`, size 22, color `theme.colors.primaryDark`
- Non-functional placeholder — no `onPress`. Will connect to a drawer in a future pass.
- Sits inside a 36×36 touch-target `View`.

### Wordmark (center)
```
text:          TRIPCHOLIC
fontFamily:    font.bold
fontSize:      15
letterSpacing: 3
color:         theme.colors.primaryDark
textAlign:     center
flex:          1
```

### Avatar (right)
```
Shape:      34 × 34 circle (borderRadius: 17)
Background: theme.colors.primaryDark  (#0B3B4A)
Content:    up to 2 initials — from displayName split, or email[0], or 'T' fallback
Text:       font.bold, 13px, color #FFFFFF
onPress:    router.push('/(tabs)/profile')
```

### Rules
- This header is mounted at the navigator level, not inside individual screens. Do not add a second header inside tab screen components.
- `SafeAreaView` inside tab screens should use `edges={['left', 'right']}` only — top inset is already consumed by `AppHeader`.
- The hamburger icon must remain non-functional until a drawer navigator is wired up.

---

## 13. Home screen specifics

### Hero — same pattern as Planner, adapted for Home
The Home hero follows the same centered-alignment + dot-eyebrow + `displayLg` title pattern. The hero button is `alignSelf` implicit (centered by parent `alignItems: 'center'`), using `theme.colors.primary` fill, 16px radius, 15px/`font.semiBold` label.

### Section titles
All section headers (e.g. "Get started", "My Recent Trips") use:
```
fontFamily: font.bold
fontSize:   18
lineHeight: 24
color:      theme.colors.primaryDark  (#0B3B4A)
letterSpacing: -0.2
```
This sits just below `headlineMd` (20px) — intentionally slightly smaller so section headers feel contextual rather than dominant.

### Trip carousel item (TripSnapshotCard)
Image-first tile with no card box:
```
Card:       width 216, no background, no border, no shadow
ImageWrap:  height 259, borderRadius 16, overflow hidden
             → Artwork component handles image / placeholder
Info:       paddingTop 8, paddingHorizontal 2, gap 3
Title:      font.bold, 15px, lh 20, color theme.colors.primaryDark
Meta row:   font.regular, 12px, color textSecondary
             → "Mar 15 · 6 stops" — date and stop count separated by "·"
```

The tile is intentionally frameless — the rounded image IS the visual anchor, not a card border.

### "All trips" ghost tile
Matches `TripSnapshotCard` image dimensions exactly (`width: 216, height: 260, borderRadius: 16`) so the horizontal carousel row stays flush. Uses `theme.colors.surface` background with a `theme.colors.border` stroke.

### Floating action button (FAB)
```
Position:        absolute, bottom: 24, right: 20
                 (sibling of ScrollView inside a flex: 1 container — NOT inside ScrollView)
Size:            56 × 56, borderRadius: 28
Background:      theme.colors.primaryDark  (#0B3B4A)
Icon:            Ionicons "add", size 28, color #fff
Shadow:          shadowColor primaryDark, opacity 0.28, radius 12, offset {0, 4}
Press state:     opacity 0.88 + scale 0.96
```
`scrollContent` `paddingBottom` is set to 40; `carousel.marginBottom: 28` provides additional buffer before the FAB.

---

## 14. Extending this system to other screens

When applying this design language elsewhere:

1. **Import `type` from `constants/typography.ts`** and spread the relevant token into your `StyleSheet` entry. Do not hardcode font sizes or weights.
2. **Use `theme.colors.*` for all semantic colors.** Only reach for raw hex values when adding a new semantic role, and add it to `theme.ts` at the same time.
   - For primary dark text (headlines, titles, section headers): use `theme.colors.primaryDark` — never `'#0F172A'` or raw black.
   - For secondary/muted text: use `theme.colors.textSecondary`.
   - For brand accent text or interactive elements: use `theme.colors.primary`.
3. **Hero sections on other screens** should follow the same centered-alignment + dot-eyebrow + `displayLg` title pattern unless the screen context specifically requires left-alignment (e.g. a list-heavy screen).
4. **Full cards** (Planner entry style) use `borderRadius: 24`, `overflow: 'hidden'`, and the shadow spec. **Tile cards** (Home carousel style) are frameless — the image itself is the visual anchor.
5. **Badges** always use `labelCaps` and the pill shape (`borderRadius: 9999`). Never create a badge with a raw font size.
6. **CTAs** must always be one of: primary (teal fill) or secondary (light grey fill). Do not create outlined/border-only buttons without a design decision.
7. **Coming-soon states** should dim only the CTA, not the whole card.
8. **FABs** follow the spec in §13 — always positioned as a sibling of `ScrollView`, never nested inside it.
9. **Do not add a header inside individual tab screens.** The global `AppHeader` is mounted at the navigator level and covers all tab screens.
