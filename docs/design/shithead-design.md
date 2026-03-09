# SHITHEAD — Online Card Game Design Document

> *"The card game. No mercy."*

---

## 1. Concept & Identity

**SHITHEAD** is an online multiplayer card game built around the feel of a late-night pub session — chaotic, social, and unapologetically fun. The design leans into the game's cheeky personality without being over-polished. Think: a neon-lit hole-in-the-wall bar that's actually a vibe.

**Design Direction: Grimy Tavern Arcade**

Not corporate. Not sterile. Slightly rough around the edges — but intentionally so. The visual language borrows from classic card tables, neon bar signs, and arcade game aesthetics.

---

## 2. Color Palette

| Role | Hex | Usage |
|---|---|---|
| Background | `#0e0e18` | Deep navy-black base |
| Table felt | `#16402a` | Card table green for game screen |
| Neon accent | `#f72585` | Primary CTA buttons, highlights, your player color |
| Purple accent | `#7209b7` | Secondary gradients, depth |
| Gold | `#ffbe0b` | Room codes, "your turn" indicators, start button |
| Cream | `#fdf6e3` | Card face background |
| Ink | `#1a1a1a` | Dark suit text on cards |
| Text primary | `#e8e8e8` | General UI text |
| Muted | `#666666` | Labels, hints, secondary text |
| Red | `#e63946` | Red suits on cards, loser state |

---

## 3. Typography

| Role | Font | Notes |
|---|---|---|
| Headings / titles | **Bebas Neue** | Bold, chunky, all-caps. Used for logo, section titles, card values, button labels |
| UI text | **DM Sans** | Clean and readable for inputs, labels, small text |
| Flavor / handwritten | **Caveat** | Used for subtitles, hints, snarky loading messages |

---

## 4. Visual Details

### Texture & Atmosphere
- A subtle **noise grain overlay** is applied across all screens via an SVG filter at low opacity — gives the UI a tactile, slightly worn quality.
- **Radial gradient backgrounds** create soft glowing pools of color (green from below on the lobby, felt-green flooding the game screen center).
- Cards use a **crosshatch pattern** on their backs via repeating CSS gradients.

### Panels & Surfaces
- All UI panels use `rgba(255,255,255,0.025)` backgrounds with `1px` borders at `rgba(255,255,255,0.07)` — dark glass effect.
- `border-radius: 14px` on panels; `8–10px` on buttons and cards.
- Panels use `backdrop-filter: blur(12px)` where layered over backgrounds.

---

## 5. Screens

### 5.1 Lobby Screen

The entry point. Full-screen, centered layout.

**Layout:**
- Large logo centered at the top — "SHIT**HEAD**" in Bebas Neue, with "HEAD" in neon pink
- Tagline below in Caveat: *"The card game. No mercy."*
- A frosted glass card below the logo contains the join form

**Form elements:**
- "Your Name" text input
- "Room Code" text input (uppercase, wide letter-spacing)
- **Join Room** — full-width neon pink primary button
- Divider with "or"
- **Create New Room** — outline secondary button

**Background:**
- Radial gradient rising from the bottom in dark felt-green
- Faint pink and purple glows in opposite corners

---

### 5.2 Waiting Room

A clean, functional pre-game lobby. Two-column layout. No table graphic — just clear information.

**Header row (full width):**
- Left: "Waiting Room" label in Bebas Neue
- Right: Room code block with the code in large gold Bebas Neue + a **Copy** button
  - Copy button turns green with "Copied!" feedback for 2 seconds on click

**Left column — Players Panel:**
- Panel header: "Players" title + `3 / 6` badge (current / max)
- Each player row contains:
  - Avatar circle (initial letter) with colored border
  - Name + badge row (Host / You / Ready / Not ready)
  - **Kick button** for non-host players (host-only, right-aligned, subtle red on hover)
- Empty slots shown with dashed border avatar and italic "Waiting for player..." text
- Avatar border colors:
  - **Gold** = host
  - **Neon pink** = you
  - **Default** = other players

**Right column:**

*Game Settings panel:*
- Header: "Game Settings" + "Host only" label in Caveat
- **Deck Mode toggle** — two side-by-side options:
  - **Normal** — 52 cards, 2–6 players
  - **Double** — 104 cards, 4–8 players
  - Selected option gets a neon pink border, tinted background, and a small glowing dot in the corner
- Footer note in Caveat italic: *"Changes can only be made before the game starts."*

*Start panel:*
- Status line: *"2 of 3 players ready"* in Caveat
- **Start Game** — full-width gold button with pulsing glow animation
- Button only visible/active for the host

---

### 5.3 Game Table

The main gameplay screen. Felt-green radial gradient floods the center, fading to dark navy at the edges.

**Top — Opponents row:**
- Each opponent shown as a compact column:
  - Name tag (small caps, dark background pill)
  - Row of 3 face-down mini cards (blue crosshatch back)
  - Row of 3 face-up mini cards (cream with suit/rank)
  - Hand count ("5 cards") in large muted Bebas Neue

**Center — Action area:**
- **Your Turn** banner — gold text, gold glowing border, subtle pulse animation
- Two piles side by side with labels:
  - **Draw deck** — 3 stacked face-down cards, labelled "Draw (18)"
  - **Discard pile** — 3 slightly rotated face-up cards, labelled "Discard"
    - Special cards (2, 7, 10) get a neon pink glow shadow

**Bottom — Your area:**
- Your name in neon pink Bebas Neue with subtle glow
- Row of 3 face-down cards (medium size)
- Row of 3 face-up cards (medium size)
- **Hand** — cards fanned out with natural rotation and vertical arc
  - Cards lift on hover with a pink glow
  - Clicking a card plays it: the card animates up and slaps down onto the discard pile

---

## 6. Animations

| Trigger | Animation |
|---|---|
| Page load | Elements fade up with staggered `animation-delay` |
| Card play | Card slides up, rotates, and slaps onto the discard pile with a squish bounce |
| Pick up pile | Pile fans out and flies into hand (future implementation) |
| Start button | Pulsing gold glow on idle; lifts on hover |
| Kick player | Row fades out and slides right on removal |
| Copy room code | Button briefly turns green with "Copied!" text |
| Game over | Card rain — suit symbols and ranks fall from the top of the screen |
| Loser declared | Full-screen dark overlay, bold "SHITHEAD" title, "[LOSER]" header in red |

---

## 7. End-of-Game Screen (Loser Overlay)

Triggered when a player is declared the shithead.

- Full-screen dark overlay (`rgba(0,0,0,0.85)`) fades in
- `[ LOSER ]` header in large red Bebas Neue with red glow
- `SHITHEAD` in massive cream Bebas Neue
- Player name in Caveat: *"Marco is the Shithead"*
- **Play Again** — neon pink button
- **Card rain** — 40 suit symbols and ranks fall across the screen with randomized size, speed, rotation, and color

---

## 8. Navigation

A fixed top nav bar persists across all screens:

- Left: `SHIT`**`HEAD`** logo (cream + neon pink)
- Right: Tab buttons to switch screens (for prototype navigation; in production, these would be replaced by game state routing)
- Nav bar background: semi-transparent dark navy with `backdrop-filter: blur(12px)`

---

## 9. Loading / Flavor Text

Snarky messages to display during loading states (using Caveat font):

- *"Shuffling the deck..."*
- *"Finding the biggest shithead..."*
- *"Bribing the dealer..."*
- *"Counting cards... for you."*
- *"Dealing out your fate..."*

---

## 10. Responsive Considerations

- All screens use `max-width` containers (420px for lobby card, 860px for waiting room)
- Waiting room collapses from 2-column grid to single column on narrow screens
- Card hand in game view uses absolute positioning with calculated offsets — recalculates on resize
- Nav bar stacks or compresses on mobile

---

## 11. Tech Stack (Suggested)

| Layer | Choice |
|---|---|
| Frontend framework | React or plain HTML/CSS/JS |
| Fonts | Google Fonts (Bebas Neue, DM Sans, Caveat) |
| Real-time multiplayer | WebSockets (Socket.io) |
| Animations | CSS keyframes + JS for card physics |
| Hosting | Vercel / Netlify (frontend), Railway / Fly.io (backend) |
