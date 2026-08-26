# Design System Guidelines

This document outlines the visual foundation primitives and token systems for KnowYourPit.

## Semantic Token System (colors.ts)

The app defaults to a dark-first semantic token system tailored for a serious native cooking companion:
- **Ember Orange** (`primary`, `accent`, `tint`): Reserved for actions, heat, urgency.
- **Warm Charcoal** (`background`, `card`, `muted`): The deep, rugged background of the app.
- **Plain White** (`primaryForeground`, `foreground`): Used for readable text on top of dark charcoal and orange backgrounds.
- **Status** (`success`, `warning`, `info`, `destructive`): Reserved for semantic feedback and paired with dedicated foreground tokens.

## Mobile scales (`constants/theme.ts`)

Typography, spacing, radii, border widths, elevation, icon sizes, touch targets, and motion durations are exported as named scales. Use these tokens instead of introducing one-off values. Body copy starts at 15pt, interactive controls use a 44pt minimum target, and motion stays between 150–350ms.

## Primitives (`components/ui/`)

Always use these shared primitives over raw `View` or `Text` when assembling layouts.
They support accessible interactions, standard minimal touch targets (44pt), dynamic text scaling, and platform-specific safe area insets natively.

### 1. `Screen`
Base layout container for any route. Handles iOS/Android safe area insets and web edge cases automatically.
Supports fixed scrolling or non-scrolling configurations, with preset paddings (`preset="centered" | "form"`).

### 2. `AppHeader` / `Section`
- `AppHeader`: Top navigation bar. Upgraded to handle absolute positioning offsets and fluid gradient/native styles without hardcoded colors.
- `Section`: Structured content block with a title, subtitle, and an optional trailing action (e.g. "Edit" button).

### 3. `Button`
Interactive primitive featuring minimal 44pt touch targets (`minHeight`), varied sizes (`sm`, `default`, `lg`, `icon`), and semantic states (`default`, `secondary`, `outline`, `ghost`, `destructive`). Automatically dims when `disabled` or `loading`.

### 4. `Card`
Enclosed data container leveraging the semantic `card` token and global `radius`. Supports `outline` and `ghost` variants.

### 5. `Field`
Consistent input block embedding an optional `label`, `error` message, or `hint`. Uses standard 48pt heights for accessible typing areas and semantic border color feedback on focus/error.

### 6. `Badge` (Chip)
Compact visual tag (`primary`, `secondary`, `outline`, `destructive`) suitable for statuses, alert flags, and temperature milestones.

### 7. `ListRow`
Standard full-width row optimized for list and settings layouts. Provides `leftIcon`, `rightIcon`, and generic `rightComponent` injection alongside unified typography and `ChevronRight` navigation indicators.

### 8. `StateViews` (`EmptyState`, `ErrorState`, `LoadingState`)
Consolidated fallback states. Ensure missing data, backend errors, or fetch delays don't present a broken application UI. Standardizes on Feather icons and standard typography.

### 9. `Sheet`
Structural frame for `formSheet` and `modal` overlays. Embeds safe-area bottom padding and a standard close header.

## Guardrails
- **No Emojis:** Rely on `@expo/vector-icons` (Feather or standard SF Symbols via `expo-symbols`) for professional telemetry icons.
- **Touch Targets:** Any custom interactive element outside `Button` or `ListRow` MUST implement a 44x44 minimal layout.
- **Token Only:** Do not hardcode hex or rgb values in any components. Access the token palette via `useColors()`.
