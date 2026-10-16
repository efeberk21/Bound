# BOUND interface

Implemented 16 October 2026. Local preview: http://localhost:5174/. This design change has not been deployed to production.

## Visual direction

The workspace uses a true black canvas (`#000000`), near-black surfaces (`#080808`, `#0d0d0d`), warm neutral text and a citrus accent (`#c9f46b`). Lime marks the main action and selected context. Red denotes denial or failure; amber denotes uncertainty. Transaction confirmation remains distinct from a tool's last permission check.

System typography uses a 100% root size and rem-based text and spacing. At the checked default browser setting, body text is 16px and preview/primary-button text is 15px. Mobile grant, revoke and run controls have 44px minimum heights. The browser's text-size preference can scale the interface.

The desktop workspace groups project permissions, the affected document and the two tool decisions. Both projects stay visible; only the selected project's controls expand. The original content, boundary experiments and chain evidence use disclosures. The expiry experiment's separate-grant warning appears before its actions.

## Interaction and Apple Design principles

- **Purpose:** the first screen leads to Start, Grant, Run and Revoke. Evidence and advanced experiments remain available one level deeper.
- **Agency:** project selection works through native buttons, keyboard activation and a draggable selector. Appearance has dark, system and light choices, retained locally when storage is available.
- **Responsibility:** there is no optimistic ALLOW or transaction confirmation. Loading, completion, warnings and errors have separate feedback. Hidden controls are inert and excluded from keyboard navigation.
- **Familiarity:** the sidebar, segmented selector, document surface and disclosures follow familiar workspace patterns. Selecting a task updates its controls, preview and decision context together.
- **Flexibility:** narrow screens use one column and retain the two project choices. Reduced motion, reduced transparency and increased contrast receive explicit treatments.
- **Simplicity:** the repeated task controls and full source text no longer compete with the preview. UI text preserves the distinction between a synthetic example and stored data.
- **Craft:** shared spacing, system fonts, visible focus rings, restrained materials, semantic status colors and immediate pointer-down feedback provide consistency.
- **Delight:** responsive motion follows the user's action. No ambient animation or automatic audio competes with the authorization task.

Motion uses the official `motion` React package, pinned at 14.3.0. Disclosure and task controls retarget critically damped springs (stiffness 420, damping 41, mass 1) from their current presentation. Preview and decision changes use small spring transitions. Inputs are not locked while a visual transition settles; consequential actions are disabled while their real request is in progress.

The project selector records pointer position and recent velocity, starts a horizontal drag after an 8px intent threshold, captures the pointer, preserves the grab offset, resists overscroll and projects its resting position with the .998 deceleration model. Release velocity is passed to the settling spring. Cancelled gestures return to the selected project. Dragging only navigates; it cannot grant, revoke or execute. Native buttons provide a non-gesture alternative. Reduced motion removes spring travel while retaining direct pointer tracking and state feedback.

## Verification

- Node 22.23.3: TypeScript check and production Vite build passed.
- Existing deterministic suite: 68 tests passed. These are regression checks, not a claim that every animation was unit tested.
- Chrome at the normal desktop size and 390×844: no horizontal overflow; checked mobile action targets were 44px high.
- Real browser interaction: project selection by mouse and keyboard, source disclosure, and Boreal-to-Atlas pointer drag passed.
- Real local HTTP with Arkiv/Neon: Start, Atlas grant, deterministic read/write, then revoke. Both tools allowed before revoke, both denied afterward, and preview revision stayed 1 on denial.
- Computed canvas and sidebar colors were both `rgb(0, 0, 0)`; the primary action was `rgb(201, 244, 107)`.
- Desktop/mobile screenshots and inspection notes are local artifacts in `.local/audit/`. Dark mode was visually inspected; alternate device accessibility preferences are implemented but were not all manually simulated.

## References

- The `apple-design` skill informed the interaction and typography approach.
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/).
- [Linear product reference](https://linear.app/features): workspace hierarchy and restraint; no assets or source code copied.
- [Motion layout](https://motion.dev/docs/react-layout-animations), [springs](https://motion.dev/docs/react-use-spring), [accessibility](https://motion.dev/docs/react-accessibility).

The interface uses 480 Design's [Solar Figma Community set](https://www.figma.com/community/file/1166831539721848736/solar-icons-set), distributed through `@solar-icons/react@2.3.2`. Bold Duotone icons replace the initial generic outline glyphs, including appearance and notification controls. Individual icon entry points avoid importing the complete catalogue. Attribution is retained in `THIRD_PARTY_NOTICES.md` and linked from the README. No editable Figma design file was created. The result is the working React interface in this repository.
