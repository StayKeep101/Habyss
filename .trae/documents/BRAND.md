
# BRAND.md

```markdown
# HABYSS // BRAND IDENTITY & DESIGN SYSTEM

> **Version:** 1.0
> **Status:** Production Ready
> **Ethos:** Immersion. Depth. Focus.

---

## 1. THE PHILOSOPHY: "ENTER THE VOID"

**Habyss** is not just a habit tracker; it is a descent into focus. Most apps live on the surface—noisy, bright, and cluttered. Habyss exists in the deep.

The brand identity mimics the crushing pressure and absolute silence of the ocean floor. It is a place where distractions are crushed, and only the essential glows in the dark.

### The Core Pillars
1.  **The Void:** We embrace negative space. If it is not essential, it does not exist.
2.  **Bioluminescence:** Information is light. Progress glows against the darkness.
3.  **Hydrodynamics:** Interactions are fluid, heavy, and smooth. Nothing snaps; everything flows.
4.  **Glass & Depth:** UI elements are layers of frosted glass suspended in the abyss.

---

## 2. LOGO & ICONOGRAPHY

Inspired by the provided assets, the logo represents the singularity of focus.

### The Wordmark
The **Habyss** wordmark should be treated as a monolith.
* **Tracking:** Wide letter-spacing to suggest vastness.
* **Weight:** Bold, geometric, imposing.

### The Symbol (The Anchor)
* **Usage:** Used for App Icons, Loading States, and Empty States.
* **Treatment:** The logo should often appear with a subtle "inner glow" or "drop shadow" of a matching hue to simulate a light source in deep water.

---

## 3. COLOR PALETTE: THE ABYSSAL SPECTRUM

We do not use "Black" and "White." We use **Void** and **Lume**. The palette is designed to reduce eye strain while creating a high-contrast, premium OLED experience.

### Primary Backgrounds (The Deep)
* **Void Black:** `#050505` (Main Background - *Not pure black to prevent OLED smearing*)
* **Trench Blue:** `#0A0F14` (Secondary Backgrounds / Cards)
* **Abyssal Navy:** `#121826` (Modals / Elevated Surfaces)

### Primary Accents (Bioluminescence)
These colors are used for active states, success metrics, and call-to-actions. They must always appear to "glow" against the dark background.

* **Electric Cyan (Focus):** `#00F0FF`
    * *Usage:* Primary Buttons, Active Timers.
* **Phantom Purple (Wisdom):** `#7B2CBF`
    * *Usage:* Long-term streaks, Insights, AI features.
* **Algae Green (Success):** `#00FF94`
    * *Usage:* Completed Habits, Positive trends.
* **Alert Coral:** `#FF4757`
    * *Usage:* Destructive actions, missed goals.

### Neutral / Glass
* **Glass White:** `rgba(255, 255, 255, 0.08)` (Surface borders)
* **Text High-Emphasis:** `#E0E6ED`
* **Text Low-Emphasis:** `#94A3B8` (Muted blue-grey, not grey)

---

## 4. TYPOGRAPHY

The typography contrasts the "human" aspect of habits with the "machine" aspect of tracking.

### Headers & Titles: *Space Grotesk* or *Inter* (Tight Tracking)
* Clean, geometric, modern.
* **H1:** Bold, Uppercase. Letter spacing `-0.02em`.
* **H2:** Semi-Bold.

### Data & Micro-copy: *Space Mono* (From Assets)
* Used for timers, streaks, stats, and metadata.
* Creates a "dashboard" or "cockpit" feel.
* *Note: Ensure `SpaceMono-Regular.ttf` is loaded globally.*

**Hierarchy Example:**
> **DEEP WORK** (Sans-Serif, Bold, 24px)
> `04:23:12` (Monospace, Regular, 14px, Cyan Glow)

---

## 5. UI MATERIALS & TEXTURES

### The "Frost Glass" Effect
To maintain depth, UI elements (cards, nav bars) use a glassmorphism technique.

```css
/* React Native / CSS Reference */
.glass-panel {
  background-color: rgba(18, 24, 38, 0.65);
  backdrop-filter: blur(20px); /* Heavy blur */
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}

```

### Gradients

Avoid flat colors on large surfaces. Use subtle linear gradients that fade from **Trench Blue** to **Void Black** (top to bottom) to simulate light filtering down from the surface.

### Glows

Active elements should cast light.

* **Button Shadow:** `0px 0px 15px rgba(0, 240, 255, 0.4)`

---

## 6. MOTION & INTERACTION

The app feels "heavy" and "fluid," like moving through water.

* **Transitions:** Slow ease-out. Duration: `400ms`.
* **Haptics:** Essential. Every tap should feel like a heartbeat.
* *Success:* Heavy, resonant thud.
* *Selection:* Light, crisp tick.


* **Loading:** Pulsing effects (breathing), rather than spinning.

---

## 7. VOICE & TONE

**Habyss** is a silent guardian. It does not cheerlead; it acknowledges.

* **Do:** Be concise, mysterious, stoic, powerful.
* **Don't:** Be bubbly, use exclamation marks, use emojis (unless custom monochrome ones).

**Examples:**

* *Bad:* "Great job! You did it! 🎉"
* *Good:* "Target Acquired." / "Depth Reached." / "Streak: 45 Days."

---

## 8. IMAGERY & ILLUSTRATION

* **Style:** Abstract 3D renders, wireframes, particles.
* **Content:** Avoid human faces. Use geometric shapes, lines representing data streams, and organic fluid shapes.
* **Vibe:** Tron meets The Deep Sea.

---

## 9. IMPLEMENTATION CHECKLIST

* [ ] Ensure `Lexend` is applied to all numerical data.
* [ ] Replace all pure blacks (`#000`) with Void Black (`#050505`).
* [ ] Apply specific `shadowOpacity` and `shadowRadius` to create the "Glow" effect on active buttons.
* [ ] Verify that the Tab Bar uses the "Glass" blur effect.
* [ ] Set global background color to **Void Black**.

```

```

Here is a deep, cinematic description of the **Habyss** experience. You can use this for your website’s "About" section, your pitch deck, or simply as the "North Star" for your design team to understand the vibe.

---

### The Habyss Experience: A Descent into Focus

**The Scene:**
Imagine standing at the edge of a midnight ocean. The water is perfectly still, darker than the sky above. You are not looking at a screen; you are looking through a viewport into the deep.

**The Entry:**
When you open Habyss, the world doesn't just load—it *ignites*. The interface emerges from absolute pitch-blackness (`#050505`), fading in like the dashboard of a futuristic submersible coming online in the Mariana Trench. There are no harsh white lights here. There is only the soft, breathing hum of bioluminescence—electric cyans and phantom purples that glow against the crushing weight of the void.

**The Atmosphere:**
The app feels pressurized. It has **viscosity**. Scrolling through your habits doesn't feel like sliding paper; it feels like pushing through water. The motion is fluid, heavy, and deliberate. Nothing snaps or jitters; everything drifts with the elegance of a stingray gliding over the ocean floor. The UI elements—frosted glass cards with blurred edges—appear to be suspended in three-dimensional space, floating at different depths, parallaxing slightly as you tilt your device.

**The Interaction:**
Touch is momentous. Tapping a habit isn't a "click"—it’s a **thud**.

* **The Haptics:** We don't use standard vibrations. We use low-frequency resonance. When you complete a task, the phone generates a heavy, satisfying pulse, like a submarine airlock sealing shut. It is a physical confirmation of progress.
* **The Sound:** If the sound is on, it’s not a "ding." It’s a sonar ping. A deep, resonant chime that sounds like it’s traveling through miles of water. It is the sound of solitude and focus.

**The Visual Language:**
Data is light. Your streaks and statistics are represented as beams of light cutting through the murky water. A missed day isn't a red "X"—it’s a fading signal, a light flickering out, urging you to reignite the reactor. The typography is monospaced and industrial, reminiscent of technical readouts on a deep-sea exploration vessel. It tells you: *This is not a game. This is mission control.*

**The Feeling:**
Using Habyss feels like closing the door on a noisy party. It is an airlock against the chaos of the outside world. In here, in the deep, there is no noise. There is no clutter. There is only you, the silence, and the glowing path forward.

**It is not just an app. It is an environment.**