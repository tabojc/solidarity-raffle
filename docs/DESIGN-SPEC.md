# Rifa Solidaria — Design Specification

## Image Reference
- **Source**: `docs/428e6286-8456-4bd2-9ab7-67b798e632ac.jpeg`
- **Dimensions**: 540x960px (9:16 story format)
- **Format**: Mobile-first, social media optimized

---

## Color Palette

| Role | Hex | RGB | Usage |
|------|-----|-----|-------|
| Background Primary | `#FCE7EE` | rgb(252, 231, 238) | Page background, cards |
| Background Secondary | `#FBEBF1` | rgb(251, 235, 241) | Alt sections, hover states |
| Text Primary | `#725057` | rgb(114, 80, 87) | Headings, body text |
| Text Dark | `#562C29` | rgb(86, 44, 41) | Strong emphasis, titles |
| Accent Primary | `#DA2B4D` | rgb(218, 43, 77) | CTAs, active states, price |
| Accent Secondary | `#D23554` | rgb(210, 53, 84) | Buttons, highlights |
| Rose Muted | `#D8A4A7` | rgb(216, 164, 167) | Borders, dividers, secondary elements |
| Rose Medium | `#956267` | rgb(149, 98, 103) | Subtitles, secondary text |
| Rose Dark | `#724454` | rgb(114, 68, 84) | Matrix selected state |
| Rose Light | `#BD7887` | rgb(189, 120, 135) | Tertiary accents |

---

## Typography (Estimated)

| Element | Font | Weight | Size | Color |
|---------|------|--------|------|-------|
| Title "RIFA SOLIDARIA" | Sans-serif (likely Montserrat or similar) | Bold | 28-32px | `#562C29` |
| Subtitle | Sans-serif | Regular | 16-18px | `#725057` |
| Price/Prize | Sans-serif | Bold | 24-28px | `#DA2B4D` |
| Number Grid | Monospace or Sans-serif | Medium | 14-16px | `#725057` |
| Footer Text | Sans-serif | Regular | 12-14px | `#956267` |

---

## Layout Structure

### 1. Hero Section (Top)
```
┌─────────────────────────────────┐
│  [Photo圆形]  RIFA SOLIDARIA    │
│  Persona      Para ayudar a...  │
│  (izq)        (der)             │
└─────────────────────────────────┘
```
- **Photo**: Circular crop, left-aligned, ~120px diameter
- **Title**: Right of photo, bold, dark brown
- **Subtitle**: Below title, lighter weight
- **Background**: `#FCE7EE`

### 2. Prize Section
```
┌─────────────────────────────────┐
│  Primer premio    Dos únicos    │
│  600$             premios      │
│                   Valor del     │
│  Segundo premio   ticle: 20$   │
│  400$                           │
└─────────────────────────────────┘
```
- **Layout**: Two columns
- **Left**: Prize amounts (Primer/Segundo premio)
- **Right**: "Dos únicos premios" + ticket price
- **Price highlight**: `#DA2B4D`, bold, larger

### 3. Number Matrix (Core Component)
```
┌─────────────────────────────────┐
│  00  01  02  03  ●  05  06  ●  08  09 │
│  10  ●  12  ●  ●  15  ●  ●  18  ●  │
│  20  ●  ●  ●  24  25  26  ●  28  29 │
│  30  31  32  33  34  35  36  37  38  39 │
│  40  ●  42  43  44  45  ●  ●  ●  49 │
│  50  51  52  53  ●  55  ●  57  58  59 │
│  60  61  62  63  64  65  66  67  68  ● │
│  70  71  72  73  74  75  76  ●  78  79 │
│  80  81  82  83  84  85  86  87  88  89 │
│  90  91  92  93  94  95  96  ●  98  99 │
└─────────────────────────────────┘
```

**Grid Specs**:
- **Columns**: 10 numbers per row
- **Rows**: 10 rows (00-99)
- **Cell size**: ~45x45px on mobile
- **Gap**: 4-6px between cells
- **Available state**: Light background, dark text
- **Selected state**: Filled circle `#DA2B4D` or `#D23554`
- **Unavailable state**: Grayed out or red dot overlay

### 4. Payment Methods
```
┌─────────────────────────────────┐
│  Método de pago:                │
│  • Dólares                      │
│  • Pago móvil                   │
│  • Pesos                        │
└─────────────────────────────────┘
```
- **Layout**: Left-aligned list
- **Style**: Bullet points or icons
- **Color**: `#725057` text

### 5. Event Details
```
┌─────────────────────────────────┐
│  Juega el 26/07/2026            │
│  Por lotería Táchira A y B      │
│  A las 10:30 PM                 │
└─────────────────────────────────┘
```
- **Layout**: Right-aligned or centered
- **Emphasis**: Date in bold or accent color

### 6. Footer
```
┌─────────────────────────────────┐
│  Responsable: Beneficiaria      │
└─────────────────────────────────┘
```
- **Style**: Smaller text, centered
- **Color**: `#956267` or `#725057`

---

## Components to Build

### 1. `NumberGrid` Component
```html
<div class="number-grid">
  <div class="number-cell available" data-number="00">00</div>
  <div class="number-cell available" data-number="01">01</div>
  <div class="number-cell selected" data-number="04">●</div>
  <!-- ... 00-99 -->
</div>
```

**States**:
- `.available` — Can be selected
- `.selected` — Already chosen by someone
- `.unavailable` — Sold out

### 2. `PrizeCard` Component
```html
<div class="prize-card">
  <div class="prize-item">
    <span class="prize-label">Primer premio</span>
    <span class="prize-amount">600$</span>
  </div>
</div>
```

### 3. `HeroSection` Component
```html
<div class="hero">
  <img src="photo.jpg" alt="Responsable" class="hero-photo" />
  <div class="hero-text">
    <h1>RIFA SOLIDARIA</h1>
    <p>Para ayudar con una operación ocular</p>
  </div>
</div>
```

---

## CSS Variables

```css
:root {
  --bg-primary: #FCE7EE;
  --bg-secondary: #FBEBF1;
  --text-primary: #725057;
  --text-dark: #562C29;
  --accent-primary: #DA2B4D;
  --accent-secondary: #D23554;
  --rose-muted: #D8A4A7;
  --rose-medium: #956267;
  --rose-dark: #724454;
  --rose-light: #BD7887;
  
  --font-primary: 'Montserrat', sans-serif;
  --font-mono: 'Roboto Mono', monospace;
  
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 50%;
  --shadow-card: 0 2px 8px rgba(114, 80, 87, 0.1);
}
```

---

## Responsive Breakpoints

| Breakpoint | Width | Grid Columns | Cell Size |
|------------|-------|--------------|-----------|
| Mobile | < 480px | 5 | 45px |
| Tablet | 480-768px | 10 | 50px |
| Desktop | > 768px | 10 | 55px |

---

## Extracted Assets

### Hero Photo
- **File**: `docs/hero-photo.png`
- **Size**: 200x200px
- **Format**: PNG with transparency (circular)
- **Source Region**: Original image cropped from ~40,40 to 220,220

### Original Image
- **File**: `docs/428e6286-8456-4bd2-9ab7-67b798e632ac.jpeg`
- **Dimensions**: 540x960px

---

## Implementation Notes

1. **Hero Photo**: Extract from original image using `convert` crop or ask user for separate photo
2. **Number Grid**: Build as CSS Grid, not table — better for interaction
3. **Selected Numbers**: Store in array, toggle on click
4. **Payment Icons**: Use SVG or emoji for payment methods
5. **Font Loading**: Google Fonts CDN for Montserrat + Roboto Mono
