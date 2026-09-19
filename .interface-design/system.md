# CodeBroo Interface Design System

## Direction
**Personality:** Warmth & Approachability, adapted for a developer-learning product  
**Foundation:** warm parchment / ink neutrals  
**Depth:** subtle single shadows + clear borders  
**Primary interaction:** warm coral  
**Secondary learning state:** teal / moss  
**Shape language:** soft 12–16px cards; 10–12px controls; full only for pills  
**Motion:** fast micro-interactions (100–180ms), short state transitions (200–350ms), reduced-motion fallback

## Product intent

CodeBroo is a programming-learning environment for students who are actively studying, not a generic SaaS dashboard.

Primary job on each lesson screen:
1. Understand the current concept.
2. Do something with it.
3. See the consequence.
4. Get useful feedback from the study buddy.
5. Know what to do next.

The code experiment is the focal point. The buddy is the emotional anchor. Progress is the orientation layer.

## Composition

Desktop:
- left: journey/navigation
- center: concept + interactive runtime visualization + code lab
- right: persistent buddy/tutor
- keep one obvious primary action in each interaction area
- never allow progress metrics to compete with the current lesson

Mobile:
- journey collapses first
- concept + code remain primary
- buddy becomes a compact tutor sheet/inline companion
- primary action remains thumb reachable

## Tokens

Use semantic tokens rather than raw component-specific colors.

Spacing:
4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64

Typography:
- display: editorial serif for lesson identity
- UI: system / humanist sans for controls and body
- code: ui-monospace
- dense text: 14px
- comfortable body: 16px
- large headings: fluid clamp()

Colors:
- text primary: warm near-black
- text secondary: warm brown-gray
- surface base: warm parchment
- surface raised: warm white
- border: low-contrast warm neutral
- accent: coral
- success: moss
- learning/visualization: teal
- warning/destructive: dark warm red

## Interaction rules

Buttons:
- one primary action per local area
- 44px target for major actions
- ghost/secondary actions must remain visibly secondary
- keyboard focus must always remain visible

Learning:
- alternate reading and doing
- do not place more than one dense decision cluster in a viewport
- provide immediate feedback after prediction
- progressive hints; do not reveal the answer immediately

Buddy:
- buddy is persistent, expressive and contextual
- state changes correspond to actual learner/system events
- never use the buddy as decorative noise
- buddy selection is reversible

## Motion

- hover: 120–150ms
- button press: ~100ms
- panel/state changes: 180–300ms
- buddy reactions: 300–550ms
- never make motion required to understand the lesson
- honor prefers-reduced-motion

## Accessibility

Target WCAG 2.2 AA:
- body text contrast >= 4.5:1
- large text >= 3:1
- controls and meaningful graphics >= 3:1
- all actions keyboard reachable
- no hover-only functionality
- visible focus ring
- native buttons/inputs for interactions
- reduced motion supported

## Deliberate anti-patterns

Do not use:
- generic purple AI gradients
- glassmorphism as the default surface treatment
- card grids where a spatial learning interaction would be clearer
- decorative metrics with no learner meaning
- an oversized chatbot panel disconnected from the lesson
- endless badges/XP clutter
- copied visual assets, copy or layouts from competitor products
