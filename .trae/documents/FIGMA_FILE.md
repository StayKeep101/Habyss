Habyss Figma Implementation Guide
1. Figma Style Guide Setup
File Structure
Create a new Figma file called "Habyss Design System" with these pages:
​

text
📄 Cover Page
📄 Color Tokens
📄 Typography
📄 Component Library
📄 Layouts & Grids
📄 Prototypes (Hexagonal vs Traditional)
📄 Depth Visualization Concepts
📄 Gradient Tests (A/B)
📄 Documentation
Step 1: Color Tokens Setup
​
Create Color Styles (Variables) in Figma:

Light Mode Variables
text
Primitives/
├── Blue/
│   ├── Blue-900: #2A4470 (Deep Blue)
│   ├── Blue-700: #3A5A8C (Brand Deep Blue)
│   ├── Blue-500: #5B7FB8 (Brand Mid Blue)
│   ├── Blue-300: #8BADD6 (Brand Light Blue)
│   └── Blue-100: #C8D9ED
├── Accent/
│   ├── Teal-500: #4ECDC4 (Success Green)
│   ├── Coral-500: #FF6B6B (Energetic Coral)
│   ├── Gold-500: #FFD93D (Warm Gold)
│   └── Purple-500: #A78BFA (Soft Purple)
├── Neutral/
│   ├── Gray-50: #F8F9FA (Background Light)
│   ├── Gray-100: #E5E7EB (Border Light)
│   ├── Gray-400: #9CA3AF (Text Tertiary)
│   ├── Gray-600: #6B7280 (Text Secondary)
│   └── Gray-900: #1F2937 (Text Primary)
└── Semantic/
    ├── Error: #EF4444
    ├── Warning: #F59E0B
    ├── Info: #3B82F6
    └── Success: #10B981
Dark Mode Variables
text
Dark/
├── Background-Primary: #1A1D2E
├── Surface-Elevated: #252A3D
├── Text-Primary: #FFFFFF (87% opacity)
├── Text-Secondary: #FFFFFF (60% opacity)
└── Text-Tertiary: #FFFFFF (38% opacity)
Action: Create each as a Figma Variable, then create a "Light Mode" collection and "Dark Mode" collection.
​

Step 2: Typography Styles
​
Text Styles to Create:

text
Habyss/Typography/
├── Display/
│   └── Dongle-Bold-32: Dongle Bold, 32px, LH 40px
├── Heading/
│   ├── H1: Inter Bold, 32px, LH 40px
│   ├── H2: Inter Bold, 24px, LH 32px
│   └── H3: Inter SemiBold, 20px, LH 28px
├── Body/
│   ├── Body-Large: Inter Regular, 18px, LH 28px
│   ├── Body: Inter Regular, 16px, LH 24px
│   └── Body-Small: Inter Regular, 14px, LH 20px
└── Utility/
    ├── Caption: Inter Medium, 12px, LH 16px
    └── Micro: Inter Medium, 10px, LH 14px
Important: Link each text style to your color variables (e.g., Text-Primary) for automatic theme switching.

2. Component Library Build
​
Priority Component List (Build in this order):
Phase 1: Foundation (Week 1)
1. Button Component

text
Component Properties:
├── Type: Primary | Secondary | Ghost | Destructive
├── Size: Large (52px) | Medium (44px) | Small (36px)
├── State: Default | Hover | Pressed | Disabled | Loading
├── Icon: None | Left | Right | Only
└── Width: Hug | Fill
Variant Examples:

Primary/Large/Default → Gradient background (Blue-700 to Blue-500)

Secondary/Large/Default → Transparent + 2px Blue-700 border

Ghost/Medium/Default → Blue-100 background (10% opacity)

2. Input Field Component

text
Component Properties:
├── State: Default | Focus | Error | Disabled | Success
├── Size: Large (52px) | Medium (44px)
├── Icon: None | Left | Right
├── Label: True | False
└── Helper Text: True | False
3. Card Component
​

text
Component Properties:
├── Elevation: None | Low (2dp) | Medium (4dp) | High (8dp)
├── Padding: Compact (16px) | Default (24px) | Spacious (32px)
├── Border Radius: 16px (default) | 12px | 8px
└── Background: Default | Gradient | Transparent
Phase 2: Habit-Specific (Week 2)
4. Habit Card Component

text
Structure:
├── [Icon Area - 48x48px rounded]
├── [Title - Body-Large]
├── [Subtitle - Caption, Text-Secondary]
├── [Progress Indicator - See below]
└── [Action Button - Ghost/Small]

Variants:
├── Layout: Hexagonal | Rectangular
├── Status: Active | Completed | Missed | Resting
└── Size: Small | Medium | Large
5. Progress Ring Component
​

text
Component Properties:
├── Progress: 0-100 (numeric)
├── Size: 40px | 60px | 80px | 120px
├── Stroke Width: 4px | 6px | 8px
├── Color: Primary | Success | Warning | Custom
└── Inner Content: None | Percentage | Icon | Count

Animation: Stroke-dashoffset animates from 0 to circumference
6. Streak Counter Component

text
Structure:
├── [Fire Icon - 24px]
├── [Number - H2 or Display]
├── [Label "Day Streak" - Caption]

Variants:
├── Milestone: None | Bronze (7) | Silver (30) | Gold (100) | Diamond (365)
├── Size: Compact | Standard | Hero
└── Animation State: Static | Counting | Celebrating
Phase 3: Navigation & Layout (Week 3)
7. Bottom Navigation Bar

text
5 Items:
├── Home (hexagon icon)
├── Habits (grid icon)
├── Add (+, elevated FAB)
├── Stats (chart icon)
└── Profile (avatar)

States per item: Inactive | Active | Pressed
Active state: Icon fills with gradient, label becomes Text-Primary
8. Header Component

text
Types:
├── Screen Title (H2 + optional back button)
├── Search (input field + filter icon)
└── Profile (avatar + greeting + notification bell)
3. Hexagonal vs Traditional Layout Testing
​
Prototype A: Hexagonal Grid Layout
Design Specifications:

text
Hexagon Tile Specs:
├── Width: 100px (diagonal)
├── Height: 115px (point to point)
├── Spacing: 8px between tiles
├── Arrangement: Offset rows (honeycomb pattern)
└── Touch Target: 110x125px (10px padding around visible hex)
Implementation Pattern:
​

Row 1: 3 hexagons, aligned left

Row 2: 2.5 hexagons, offset 50px right

Row 3: 3 hexagons, aligned left

Continue pattern

Content Inside Each Hex:

Icon (32px) - centered

Habit name (Caption, 2 line max) - centered below icon

Small progress ring (24px) - top right corner

Completion checkmark - overlays when complete

User Flow to Test:

Can users quickly identify their habits?

Is tapping accuracy acceptable? (measure mis-taps)

Does the hexagonal pattern feel cohesive with the logo?

How do users react to scrolling behavior?

Prototype B: Traditional Rectangular Layout
Design Specifications:

text
Card Specs:
├── Width: Screen width - 40px (20px margins)
├── Height: 88px (compact) | 120px (comfortable)
├── Border Radius: 16px
├── Spacing: 12px vertical gap
└── Layout: Full-width list, vertical scroll
Content Structure:

Left: Icon (48x48px circle) + Title (Body) + Subtitle (Caption)

Right: Progress ring (60px) + Arrow/Chevron

Background: White/Surface with subtle shadow

User Flow to Test:

Scrolling speed vs hexagonal (faster/slower?)

Information density preference

Ease of quick habit checking

Visual appeal vs hexagonal

A/B Test Setup in Figma
Create Prototype Flows:

text
Frame Structure:
├── Prototype-A (Hexagonal)
│   ├── Home-Screen-Hex
│   ├── Habit-Detail-Hex
│   └── Add-Habit-Hex
└── Prototype-B (Traditional)
    ├── Home-Screen-Rect
    ├── Habit-Detail-Rect
    └── Add-Habit-Rect
Testing Metrics to Track:

Task completion time (add new habit)

Tap accuracy rate (hexagonal concerns)
​

User preference survey (5-point scale)

Visual appeal rating (separate from usability)

Brand alignment perception ("Does this feel like Habyss?")

Recommendation: Test with 20-30 beta users, split 50/50. Use Maze.design or UserTesting for remote testing.

4. Abyss Depth Visualization Prototype
​
Concept Overview
A vertical visualization showing users descending deeper into habit mastery. The deeper they go, the darker/richer the colors become.

Design Specification
Visual Structure:

text
┌─────────────────────┐
│   Surface (Day 1)   │  ← Light Blue (#8BADD6)
├─────────────────────┤
│    Shallow (7d)     │  ← Mid Blue (#5B7FB8)
├─────────────────────┤
│     Deep (30d)      │  ← Deep Blue (#3A5A8C)
├─────────────────────┤
│  Very Deep (100d)   │  ← Deeper Blue (#2A4470)
├─────────────────────┤
│   Abyss (365d)      │  ← Near Black with Purple (#1A1D2E + Purple glow)
└─────────────────────┘

Current Position: ◆ (diamond marker with pulse animation)
Implementation in Figma:

Create Depth Meter Component:

text
Component Structure:
├── Background gradient (vertical: Light → Dark)
├── Depth markers (lines + labels every 10m metaphor)
├── Current position indicator (diamond shape)
├── Achievement badges (unlock icons at milestones)
└── Particle effects (simulate underwater bubbles/lights)
Depth Levels & Metaphors:

text
├── 0m - Surface: "Starting your journey" (Days 1-6)
├── 10m - Committed: "Building momentum" (Days 7-13)
├── 25m - Deep Dive: "Habit forming" (Days 14-29)
├── 50m - Established: "In the zone" (Days 30-66)
├── 100m - Master: "Unconscious competence" (Days 67-99)
├── 200m - Elite: "Peak performance" (Days 100-364)
└── 300m - The Abyss: "Transformed" (Days 365+)
Interactive States:

On scroll: Depth meter follows user scroll, revealing deeper levels

On milestone: Celebration animation (light burst from depth marker)

Daily progress: Smooth descent animation each completion

Historical view: Tap to see all past achievements at each depth

Alternative Visualization: Circular Abyss
For more compact screens:

text
Concentric Rings (like a whirlpool looking down):
├── Outer Ring (Light Blue): Days 1-7
├── Ring 2 (Mid Blue): Days 8-30
├── Ring 3 (Deep Blue): Days 31-100
├── Ring 4 (Deeper Blue): Days 101-365
└── Center Vortex (Abyss): 365+ (glowing, animated)

User's Position: Marker moves along spiral path inward
Figma Prototype:

Use circular progress component as base

Multiple overlapping rings with gaps

Animated marker follows circular path

Add rotation animation for "vortex" center

Prototype User Testing Questions:
Does the depth metaphor make intuitive sense?

Is the visualization motivating or overwhelming?

Do users understand how to "descend deeper"?

Does it create FOMO/urgency to continue streaks?

Would you show this to friends?

5. Gradient Intensity A/B Testing
​
Test Setup: Three Gradient Variants
Variant A: Vibrant (High Energy)
text
Primary Gradient:
├── Start: #2563EB (Bright Blue)
├── End: #7C3AED (Vibrant Purple)
├── Angle: 135deg
└── Use Case: Buttons, CTAs, celebrations

Accent Gradient (Success):
├── Start: #10B981 (Emerald)
├── End: #06B6D4 (Cyan)

Accent Gradient (Energy):
├── Start: #F59E0B (Amber)
├── End: #EF4444 (Red)
Visual Impact: Bold, eye-catching, youthful energy. May feel less "professional" to corporate users.

Variant B: Subtle Professional (Low Saturation)
text
Primary Gradient:
├── Start: #3A5A8C (Brand Deep Blue)
├── End: #5B7FB8 (Brand Mid Blue)
├── Angle: 135deg
├── Saturation: -20%
└── Use Case: Buttons, cards, progress

Accent Gradient (Success):
├── Start: #3A8A78 (Muted Teal)
├── End: #4ECDC4 (Success Green, slightly desaturated)

Accent Gradient (Warm):
├── Start: #D4A849 (Muted Gold)
├── End: #E89A5B (Soft Orange)
Visual Impact: Sophisticated, calming, enterprise-ready. May lack excitement for younger users.

Variant C: Balanced (Recommended Starting Point)
text
Primary Gradient:
├── Start: #3A5A8C (Brand Deep Blue)
├── End: #5B7FB8 (Brand Mid Blue)
├── Angle: 135deg
├── Saturation: Original
└── Use Case: Main brand touchpoints

Accent Gradient (Success):
├── Start: #4ECDC4 (Full saturation)
├── End: #34D399 (Vibrant green)

Accent Gradient (Energy):
├── Start: #FF6B6B (Coral)
├── End: #FFD93D (Gold)
└── Use Case: Achievements, celebrations only
Visual Impact: Professional baseline with energetic accents for key moments. Best of both worlds.

Figma A/B Test Framework
Create Three Versions of Key Screens:

text
Test-Gradient-A (Vibrant)/
├── Home-Screen-A
├── Habit-Card-A
├── Progress-Detail-A
└── Achievement-Modal-A

Test-Gradient-B (Subtle)/
├── Home-Screen-B
├── Habit-Card-B
├── Progress-Detail-B
└── Achievement-Modal-B

Test-Gradient-C (Balanced)/
├── Home-Screen-C
├── Habit-Card-C
├── Progress-Detail-C
└── Achievement-Modal-C
Apply Gradients Consistently:

Vibrant: All buttons, progress rings, cards use high-saturation gradients

Subtle: Muted tones throughout, gradients only hint direction

Balanced: Gradients on primary elements, flat colors for secondary

Testing Methodology
Qualitative Questions:

"Which version feels most professional?" (A/B/C)

"Which would you trust for daily habit tracking?" (A/B/C)

"Which makes you most excited to use the app?" (A/B/C)

"Which feels most modern/current?" (A/B/C)

"Which matches the Habyss brand best?" (show logo)

Quantitative Metrics:

First impression rating (1-10 scale)

Willingness to pay ($0-$9.99/month estimation)

Brand perception score (professional vs playful 1-7 scale)

Age correlation (do younger users prefer vibrant?)

Sample Size: Minimum 60 users (20 per variant) for statistical significance.

Implementation Roadmap
Week 1-2: Foundation
 Set up Figma file structure with all 8 pages

 Create color variables (light + dark mode)
​

 Build typography styles system

 Design Phase 1 components (Button, Input, Card)

Week 3: Component Library
 Design Phase 2 habit-specific components

 Create progress indicators and animations
​

 Build navigation components

 Document each component with usage guidelines
​

Week 4: Layout Prototypes
 Design Prototype A (Hexagonal grid)
​

 Design Prototype B (Traditional layout)

 Create interactive prototypes with Figma prototype tool

 Set up user testing framework (Maze/UserTesting)

Week 5: Depth Visualization
 Design vertical depth meter concept

 Create alternative circular visualization

 Add milestone animations and effects
​

 Build prototype with scroll interactions

Week 6: Gradient Testing
 Create three gradient variant files

 Apply variants to key screens consistently
​

 Set up A/B test methodology

 Recruit 60 beta testers

Week 7-8: Testing & Iteration
 Run hexagonal vs traditional tests (20-30 users)

 Run gradient intensity tests (60 users)

 Analyze depth visualization feedback

 Compile results and recommendations

Week 9-10: Finalization
 Choose winning layout approach

 Select final gradient intensity

 Refine depth visualization based on feedback

 Complete full design system documentation
​

 Prepare developer handoff

Figma Best Practices
​
Naming Conventions
text
Components: Component-Name/Variant/State
├── Example: Button/Primary/Large/Hover
├── Example: Card/Habit/Hexagonal/Active

Frames: Screen-Name-Version
├── Example: Home-Screen-Hex-v2
├── Example: Settings-Profile-A

Layers: Element-Description
├── Example: Icon-Checkmark
├── Example: Progress-Ring-Stroke
Auto Layout Usage
All components must use Auto Layout for responsiveness
​

Set minimum/maximum constraints for text fields

Use "Hug" for buttons, "Fill" for cards

Consistent spacing tokens (4, 8, 12, 16, 24, 32, 40px)

Component Properties
​
Use boolean properties for optional elements (icon, label)

Use variant properties for state changes (default, hover, pressed)

Create component sets for related variants

Add descriptions to each property for developer clarity

