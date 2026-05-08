# Design

## Theme

Scene: a developer is reviewing an AI run on a laptop, with generated documents, screenshots, and website previews arranged on a canvas beside structured operation logs.

The interface should feel like a precise studio surface: sparse controls, stable node geometry, thin rules, clear focus, and enough texture from the artifacts themselves. Avoid decorative gradients, fake depth, glass panels, and oversized marketing composition.

## Color

Use OKLCH colors. The strategy is restrained: tinted neutrals, quiet ink, hairline rules, and one muted accent for selection and active controls.

Core roles:

- Canvas: `oklch(0.985 0.004 255)`
- Surface: `oklch(0.995 0.003 255)`
- Ink: `oklch(0.21 0.007 255)`
- Muted ink: `oklch(0.49 0.008 255)`
- Hairline: `oklch(0.84 0.006 255)`
- Accent: `oklch(0.38 0.04 188)`
- Accent soft: `oklch(0.93 0.025 188)`

## Typography

Use the system font stack. Controls should be compact and native-feeling. Nodes may use stronger hierarchy, but content should remain scannable at 80-120% zoom.

## Components

- Full-viewport canvas with pan, wheel zoom, fit, and reset.
- Compact toolbar with icon buttons and tooltips.
- Stable rectangular nodes for documents, media, websites, text, and groups.
- Inspector rail for selected-node metadata and agent-readable context.
- Demo operation console showing how an AI would add, update, focus, and summarize nodes.

## Motion

Use subtle transform transitions only for selection and toolbar state. Respect reduced motion.

## Layout

Desktop-first but responsive. The canvas remains the primary surface; inspector and operation controls become compact strips on narrower screens.
