import { createProject, generateScreen } from './stitch-client.js';

const MASTER_PROMPT = `
Redesign the "Group-Games" party game application interface from scratch into a "Soothing Neo-Brutalist" mobile-first web app.

1. AESTHETIC & THEME:
- Style: Playful, Soothing Neo-Brutalism ("Chubby Neo-Brutalism").
- Background Canvas: Warm oat/cream rice-paper (#FAF8F5) with subtle card troughs (#F3EFEA). Avoid harsh pure white and blinding neon yellows.
- Outlines: Solid 2.5px dark charcoal border (#18181B) on all cards, buttons, badges, and modals.
- Shadows: Zero-blur hard offset shadows (4px 4px 0px #18181B).
- Rounded Corners: Friendly 16px–20px radii (rounded-2xl) across all cards and buttons to balance brutalism with approachable playfulness.
- Pastel Accent Palette:
  * Butter Yellow (#FEF08A) for featured elements & badges
  * Bubblegum Coral (#FDA4AF) for Player 1 & buzzers
  * Sky Blue (#93C5FD) for Player 2 & prompts
  * Pistachio Mint (#86EFAC) for Player 3, ready states & success actions
  * Lavender Grape (#C4B5FD) for Player 4 & special roles
  * Tangerine Sorbet (#FDBA74) for Player 5 & timer warnings

2. WIREFRAME & LAYOUT (PHONE-AS-CONTROLLER):
- Viewport: Max-width 480px centered mobile app shell with comfortable side gutters.
- Three Core Zones:
  1. Top Pill Header: Room Code pill badge (copyable with 1-click), Wi-Fi connection indicator, Game Phase tag, and Mute sound toggle.
  2. Central Interactive Stage: Game prompt card, player avatar grid (2 columns of chunky cards with status indicators), or voting choices.
  3. Anchored Bottom Action Deck: Thumb-friendly oversized CTA button (minimum height 52px) and input bar positioned in the lower ergonomic reach zone.

3. TYPOGRAPHY & DATA DISPLAY:
- Headlines: 'Plus Jakarta Sans' / 'Fredoka' ExtraBold (800 weight) with tight line-height (1.15) and playful character.
- Body & Controls: 'Plus Jakarta Sans' Medium (500) and SemiBold (600).
- Room PIN & Timers: 'JetBrains Mono' 800 weight with wide character spacing.
- Text inputs must maintain a minimum 16px font size to prevent mobile browser auto-zoom.

4. COMPONENT ARCHITECTURE & SHADCN INTEGRATION:
- NeoButton: 2.5px border, 4px hard shadow, 16px radius. On :active, translate(2px, 2px) and reduce shadow to 1px for physical spring tactility.
- Game Cards: Chunky white cards with pastel top headers, illustrated game icons, player count pill, and "Select" action.
- Player Avatar Chips: Dual-tone circular icons with 2.5px borders, status badges (ready checkmark / thinking ellipsis), and player nickname.
- Settings Sheet: Radix/Shadcn bottom sheet with grab handle, sliders for round timer, and toggles for family-safe mode.

5. ACCESSIBILITY & ERGONOMICS:
- WCAG 2.2 AA compliant with high-contrast text (#18181B text on all pastels gives > 8:1 contrast).
- All clickable elements have a minimum 48px touch hit area.
- Multi-signal feedback: All gameplay states use both color and distinctive iconography.
- Visible 3px outline on keyboard focus. Full support for prefers-reduced-motion.
`;

async function main() {
  console.log('1. Creating Stitch project...');
  const projRes = await createProject('Group Games - Soothing Neo Brutalism');
  console.log('Project response:', JSON.stringify(projRes, null, 2));

  // Extract project ID or name
  let projectId = null;
  if (projRes.content) {
    for (const c of projRes.content) {
      try {
        const parsed = JSON.parse(c.text);
        if (parsed.name) {
          projectId = parsed.name.replace('projects/', '');
        } else if (parsed.projectId) {
          projectId = parsed.projectId;
        }
      } catch (e) {}
    }
  }

  if (!projectId) {
    console.error('Could not extract project ID from response');
    return;
  }

  console.log(`2. Project created with ID: ${projectId}. Generating screen with Master Prompt...`);
  const screenRes = await generateScreen(projectId, MASTER_PROMPT);
  console.log('Screen generation response:', JSON.stringify(screenRes, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
