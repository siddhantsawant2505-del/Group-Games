---
name: Group-Games Soothing Neo-Brutalism
version: 1.0.0
tokens:
  colors:
    background:
      canvas: "#FAF8F5"
      canvas-subtle: "#F3EFEA"
      surface: "#FFFFFF"
      surface-card: "#FFFFFF"
      surface-elevated: "#FFFFFF"
      dark-canvas: "#18181B"
      dark-surface: "#27272A"
    text:
      primary: "#18181B"
      secondary: "#52525B"
      muted: "#71717A"
      inverse: "#FAF8F5"
    border:
      default: "#18181B"
      subtle: "rgba(24, 24, 27, 0.18)"
    shadow:
      hard: "#18181B"
    accents:
      butter-yellow: "#FEF08A"
      bubblegum-coral: "#FDA4AF"
      sky-blue: "#93C5FD"
      pistachio-mint: "#86EFAC"
      lavender-grape: "#C4B5FD"
      tangerine-sorbet: "#FDBA74"
    player:
      p1: "#FDA4AF"
      p2: "#93C5FD"
      p3: "#FEF08A"
      p4: "#86EFAC"
      p5: "#C4B5FD"
      p6: "#FDBA74"
    semantic:
      success: "#86EFAC"
      warning: "#FDBA74"
      danger: "#FCA5A5"
      info: "#93C5FD"
  typography:
    display: "'Plus Jakarta Sans', 'Fredoka', system-ui, sans-serif"
    body: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
    mono: "'JetBrains Mono', 'Fira Code', monospace"
    scale:
      h1: { size: "32px", weight: "800", lineHeight: "1.15", tracking: "-0.02em" }
      h2: { size: "24px", weight: "800", lineHeight: "1.25", tracking: "-0.01em" }
      h3: { size: "18px", weight: "700", lineHeight: "1.3", tracking: "0em" }
      body-lg: { size: "18px", weight: "600", lineHeight: "1.4" }
      body: { size: "16px", weight: "500", lineHeight: "1.5" }
      caption: { size: "13px", weight: "700", lineHeight: "1.3", tracking: "0.04em" }
      code: { size: "18px", weight: "800", lineHeight: "1.2", tracking: "0.1em" }
  borders:
    width: "2.5px"
    radius:
      sm: "10px"
      md: "14px"
      lg: "18px"
      xl: "24px"
      full: "9999px"
  shadows:
    sm: "2px 2px 0px #18181B"
    md: "4px 4px 0px #18181B"
    lg: "6px 6px 0px #18181B"
    active: "1px 1px 0px #18181B"
  motion:
    spring-press: "transform 100ms cubic-bezier(0.2, 0, 0, 1), box-shadow 100ms cubic-bezier(0.2, 0, 0, 1)"
    card-pop: "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)"
---

# Design System Specification: Soothing Neo-Brutalism for Party Games

## 1. Design Vision & Philosophy
Group-Games is a real-time, phone-as-controller multiplayer social gaming platform.
The design adopts **Soothing Neo-Brutalism** ("Pastel Chubby Brutalism"):
- **Bold & Playful**: High-contrast 2.5px solid dark borders, cheerful pastel block fills, tactile offset drop-shadows with no blur, and expressive chunky typography.
- **Eye-Comfortable & Soothing**: Replaces harsh pure white (#FFFFFF) and eye-straining high-saturation neons with a warm oat/cream backdrop (`#FAF8F5`) and mellow pastel tones (Butter Yellow `#FEF08A`, Bubblegum Coral `#FDA4AF`, Pistachio Mint `#86EFAC`, Sky Blue `#93C5FD`, Lavender Grape `#C4B5FD`).
- **Tactile Physicality (Emil Kowalski Philosophy)**: Components react mechanically like physical buttons. Pressing a button translates it down and right (`translate(2px, 2px)`) while compressing its hard shadow into the canvas.

## 2. Layout & Wireframe Architecture (Mobile-First Controller)
- **Max Width**: 480px centered mobile viewport with clean side gutters on desktop.
- **Thumb Zone Friendly**: Primary action buttons (Join, Submit Answer, Vote, Buzz) are sticky or anchored in the bottom 25% of the viewport.
- **Three Core Surface Zones**:
  1. **Top Bar**: Pill badges showing room code, connectivity state, game phase badge, and mute toggle.
  2. **Main Stage**: High-impact interactive cards (Prompt Card, Player Avatar Grid, Vote Options).
  3. **Bottom Action Deck**: Large chunky tactile action button with minimum 52px height for thumb hit area.

## 3. Component System
- **NeoButton**:
  - Border: 2.5px solid `#18181B`
  - Shadow: `4px 4px 0px #18181B`
  - Hover: `transform: translate(-1px, -1px); box-shadow: 5px 5px 0px #18181B`
  - Active: `transform: translate(2px, 2px); box-shadow: 1px 1px 0px #18181B`
  - Radius: 16px
- **NeoCard**:
  - White or pastel background, 2.5px solid `#18181B` outline, `4px 4px 0px #18181B` drop shadow, 20px radius.
- **NeoInput**:
  - 16px+ font size (prevents iOS auto-zoom), 2.5px border, generous 14px 18px padding, bold placeholder.
- **PlayerChip & Avatar**:
  - Dual-tone pastel background, thick outline, playful status ring (ready checkmark or thinking ellipsis).

## 4. Accessibility & Web Quality Compliance
- **Contrast**: All dark `#18181B` text on pastel backgrounds achieves > 8:1 contrast (WCAG AAA).
- **Touch Target**: Minimum 48px x 48px hit area for all interactive controls.
- **Focus States**: High-contrast outline ring `outline: 3px solid #18181B; outline-offset: 3px`.
- **Reduced Motion**: Disables transforms when `prefers-reduced-motion: reduce` is detected.
