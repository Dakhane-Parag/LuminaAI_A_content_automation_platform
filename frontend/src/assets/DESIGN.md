---
name: BrandFlow AI Core
colors:
  surface: '#fdf8f8'
  surface-dim: '#ddd9d8'
  surface-bright: '#fdf8f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f7f3f2'
  surface-container: '#f1edec'
  surface-container-high: '#ebe7e6'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#444748'
  inverse-surface: '#313030'
  inverse-on-surface: '#f4f0ef'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c9c6c5'
  secondary: '#b61722'
  on-secondary: '#ffffff'
  secondary-container: '#da3437'
  on-secondary-container: '#fffbff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1c1b1b'
  on-tertiary-container: '#858383'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c9c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474646'
  secondary-fixed: '#ffdad7'
  secondary-fixed-dim: '#ffb3ad'
  on-secondary-fixed: '#410004'
  on-secondary-fixed-variant: '#930013'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c9c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474646'
  background: '#fdf8f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  display-xl:
    fontFamily: Inter
    fontSize: 72px
    fontWeight: '800'
    lineHeight: '1.0'
    letterSpacing: -0.04em
  display-xl-mobile:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
  label-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.02em
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  container-max: 1440px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

The design system is rooted in the principles of the International Typographic Style (Swiss Design). It prioritizes clarity, objectivity, and a rigid structural hierarchy to communicate the high-performance nature of BrandFlow AI. 

The aesthetic is characterized by a "Reductionist Modernism" approach:
- **Minimalism:** Use of extreme whitespace to isolate and elevate content.
- **Precision:** Every element is placed with mathematical intent on a strict grid.
- **Impact:** High-contrast visuals using a monochrome base with strategic, aggressive hits of crimson.
- **Reliability:** The UI avoids decorative trends like shadows or gradients in favor of flat, architectural planes that suggest a stable, industrial-grade tool.

The target audience consists of elite marketing teams and brand directors who value efficiency and uncompromising precision. The emotional response should be one of total control and absolute clarity.

## Colors

The palette is strictly functional and high-contrast, designed to maximize legibility and focus.

- **Primary (#050505):** Used for primary typography, icons, and high-impact structural elements. It represents the "Ink" of the system.
- **Secondary (#EF4444):** Used sparingly as a "Signal" color. It marks active states, critical calls to action, and data alerts. 
- **Neutral/Background (#FFFFFF):** The canvas. Whitespace is treated as a physical element, not just empty space.
- **Surface (#F9FAFB):** Used to differentiate functional zones like sidebars or secondary content blocks without breaking the flat aesthetic.
- **Border (#E5E7EB):** A crisp 1px separator used to define the grid and contain information.

## Typography

This design system utilizes **Inter** for its neutral, neo-grotesque qualities and exceptional legibility at all scales.

- **Scale:** An aggressive typographic scale is used to create clear entry points. Display sizes use tight leading and negative letter-spacing for a "heavy" architectural feel.
- **Weights:** Use Bold (700) or ExtraBold (800) for headlines to create an immediate hierarchy.
- **Labels:** Small labels and metadata should often be set in uppercase with slight tracking to ensure clarity and an institutional feel.
- **Alignment:** Primarily left-aligned to maintain a strong vertical "axis" consistent with Swiss grid principles. Avoid center alignment for complex data.

## Layout & Spacing

The layout is governed by a **fixed 12-column grid** on desktop and a **4-column grid** on mobile.

- **Grid Philosophy:** All elements must align to the grid. No exceptions. Gutters are kept wide to prevent visual clutter.
- **Vertical Rhythm:** Use an 8px base unit. Component heights, padding, and margins must be multiples of 8.
- **Padding:** Generous internal padding (48px or 80px) is used for section headers to create a sense of "premium" breathing room.
- **Adaptation:** On mobile, margins tighten to 16px, but the vertical spacing between sections remains significant (at least 48px) to maintain the brand's airy, confident aesthetic.

## Elevation & Depth

This design system rejects shadows and Z-axis depth in favor of **Tonal Layering** and **Line-Work**.

- **Flat Hierarchy:** Depth is communicated through contrast, not shadows. Use the `Surface` color (#F9FAFB) to define secondary areas like sidebars or card backgrounds.
- **Outlines:** Use 1px solid borders (#E5E7EB) to define containers. In active or "hover" states, the border should transition to Primary (#050505) or Secondary (#EF4444).
- **Inertia:** Elements do not "float." They sit firmly on the background plane or within defined bordered containers.
- **Zero-Shadow Policy:** No box-shadows or drop-shadows are permitted. Depth is implied solely by the intersection of borders and the change in background values.

## Shapes

The shape language is strictly **Geometric and Sharp**.

- **Corners:** All corners are set to 0px (Sharp). This reinforces the "grid-first" mentality and aligns with the precision of an AI-driven tool.
- **Icons:** Use linear, stroke-based icons with sharp terminals. Avoid rounded icon sets. Stroke weights should match the 1px or 2px thickness used in the UI borders.
- **Dividers:** Use horizontal and vertical lines to segment information rather than boxes whenever possible, emphasizing the underlying grid.

## Components

- **Buttons:** Rectangular with 0px radius. 
    - *Primary:* Solid #050505 background with white text. 
    - *Secondary:* 1px #050505 border, no background. 
    - *Action/Accent:* Solid #EF4444 for primary conversion points.
- **Input Fields:** 1px #E5E7EB bottom border or full rectangular border. On focus, the border turns #050505 with no glow.
- **Cards:** Defined by a 1px #E5E7EB border. No background color change unless the card is "active," in which case use a subtle #F9FAFB.
- **Chips/Status:** Use uppercase `label-sm` typography. Status indicators (e.g., "Active") use a small 8px solid circle of color next to the text rather than a pill-shaped container.
- **Lists:** Separated by 1px horizontal dividers that span the full width of the container. High-density data should use monospaced numerals for alignment.
- **Data Visualization:** Use the primary #050505 for main lines and #EF4444 for highlights. Avoid fills; use stroke-based charts to maintain the "light" and technical feel.