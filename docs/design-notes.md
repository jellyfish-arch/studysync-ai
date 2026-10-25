# Design notes: avoiding "AI slop"

"AI slop" is what people call websites that look machine-made: the tool's
defaults were never changed, so every site comes out the same. Before this
redesign we looked at what makes a site read that way, and checked our own
effects against it.

## What gives a site away

Sources: 925 Studios' guides to [AI slop web design](https://www.925studios.co/blog/ai-slop-web-design-guide) and [the visual tells](https://www.925studios.co/blog/ai-slop-design-tells), prg.sh's essay [Why your AI keeps building the same purple gradient website](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website), Superdesign's [Why AI design looks generic](https://www.superdesign.dev/blog/why-ai-design-looks-generic) and Impeccable's pattern list.

- **Colour:** purple and indigo gradients, used for decoration rather than meaning (traced to Tailwind's old `indigo-500` default), and timid palettes spread evenly.
- **Type:** Inter, Roboto or system fonts with no deliberate pairing, and hierarchy that is only "bigger text".
- **Layout:** a centred hero with a vague headline and one button, then three identical feature cards with icons in tinted squares. Every corner has the same radius and every shadow is the same soft shadow.
- **Effects:** glassmorphism, neon glow, glowing or "electric" borders, shimmer text, gradient blobs, 3D tilt cards, magnetic buttons, cursor-following blobs, scroll-jacking, and the same fade-in on every element.
- **Copy:** "Transform your workflow", "Build the future", invented testimonials and hedging words.
- **Overdoing the fix:** piling on parallax, gradients and custom cursors is called out as noise too. The cursor here was asked for, so it is kept deliberately small (see below).

## What we removed

| Effect | Why it went |
|---|---|
| Magnet buttons (they followed the pointer) | Moving buttons; a textbook tell, and harder to click |
| StarBorder (light orbiting the Focus button) | Decorative glow |
| ElectricBorder on urgent exams | Neon glow; urgency is now a rose border and a pulse dot |
| ShinyText on "Up next" | Shimmer text; now a small live dot in the subject colour |
| SpotlightCard glow under the pointer | Cursor-following glow |
| 3D Tilt cards | Listed as a tell; also made text wobble |
| LightRays (hero, focus mode) | Glowing beams; focus mode now has a slow breathing ring and Yuuki at her desk |
| DotGrid shock-wave background | Decorative; replaced by a static dot-paper texture |
| BlurText titles | The default "text generate" reveal; titles now rise word by word with a drawn underline |
| Click sparks on every click | Decoration on every click; sparks now appear only when you tick something off |
| Duotone icons and icons in filled tiles | The icon-in-a-square pattern; all icons are now single-weight outline drawings |
| One dominant brand colour (saffron) | One colour everywhere; colour now carries meaning |

## What we kept or added, and why it is not slop

- **One colour per meaning.** Each section has its own accent: Today lime, Planner mint, Calendar teal, Subjects gold, Assignments coral, Exams rose, Analytics peach. Each subject has its own colour too. The overview is neutral, and each card takes the colour of what it shows, so no single hue dominates. There are no decorative gradients.
- **Line art as the identity.** The icons are outline drawings that redraw themselves stroke by stroke on hover. The logo is the StudySync book-and-orbit icon (vector master in `design/brand/studysync-icon.svg`). Doodles on the landing page draw themselves in. Page titles get a hand-drawn underline.
- **Yuuki.** An original character gives the product a personality that no template has. She is how the app talks: the first-login intro, the tour, remarks when you finish things, and tips.
- **Motion that reports something.** It is used for:
  - numbers that count to their new value, rings and bars that fill, and a flip-board exam countdown;
  - a spark only when you tick a topic, block or assignment;
  - confetti only for a whole day, unit or assignment;
  - spring checkboxes, drag and drop, and shared-layout highlights in navigation and settings.
- **The cursor.** It is an outline arrow with a second line offset behind it, like a two-colour print slightly out of register. That second line takes the colour of whatever you point at. It sits exactly on the pointer with no trail or lag, so it never hurts accuracy. It is off on touch screens and can be switched off in Settings.
- **Real content in previews.** The landing page shows working mini versions of the app (a tickable syllabus, a live timer, the countdown), not fake screenshots or invented numbers.
- **Typography:** Bricolage Grotesque for display, Onest for text, JetBrains Mono for timers and codes.

## Rules for anything new

1. New colour only if it means something (a section, a subject, a status).
2. Outline icons only, from `src/components/icons.jsx`.
3. Motion must report a change or show where something went. No idle decoration except Yuuki's gentle bob.
4. No glass, glow, gradient text, tilt or magnetic hover.
5. Respect reduced motion. Settings > Look and feel > Motion, and the system setting.
