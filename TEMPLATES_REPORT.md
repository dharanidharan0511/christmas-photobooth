# Enhanced Christmas Photo Booth - Premium Template UI Experience

## Project Overview
Create a **visually stunning** Christmas photo booth with a focus on **exceptional template browsing experience**, smooth animations, and delightful micro-interactions that make users say "wow!"

---

## 🎨 PREMIUM TEMPLATE UI SYSTEM

### Core Philosophy
The template selector should feel like browsing a luxury catalog - smooth, responsive, visually rich, and satisfying to interact with. Every interaction should have purposeful animation that guides the user and provides delightful feedback.

---

## 1. ENHANCED TEMPLATE GALLERY LAYOUT

### Desktop Experience (≥1024px)

#### Option A: Carousel Spotlight (RECOMMENDED)
```
┌─────────────────────────────────────────────────────────────────┐
│                    🎄 Choose Your Magic Frame ✨                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  [<]  ┌────┐  ┌─────────┐  ┌────┐  ┌────┐  ┌────┐  [>]         │
│       │ T7 │  │   T0    │  │ T1 │  │ T2 │  │ T3 │               │
│       └────┘  │FEATURED │  └────┘  └────┘  └────┘               │
│      (small)  │ (large) │ (medium)(medium)(medium)              │
│               └─────────┘                                         │
│               "Santa's                                            │
│               Workshop"                                           │
│                                                                   │
│               ┌─────────────────────────┐                        │
│               │                         │                        │
│               │    Camera Preview       │                        │
│               │    with Selected        │                        │
│               │    Template Overlay     │                        │
│               │                         │                        │
│               └─────────────────────────┘                        │
│                                                                   │
│               [Control Buttons]                                   │
│                                                                   │
│               • • • • • • • •  (pagination dots)                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Center spotlight**: Selected template is large and prominent
- **3D perspective**: Templates on sides appear smaller (perspective effect)
- **Smooth carousel**: Drag or arrow keys to navigate
- **Auto-center**: Click any template to smoothly scroll it to center
- **Peek previews**: See templates on both sides to encourage browsing
- **Pagination dots**: Visual indicator of position in template list

#### Option B: Floating Grid with Preview Modal
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│               ┌─────────────────────────┐    ┌──────────┐       │
│               │                         │    │ T0   T1  │       │
│               │    Camera Preview       │    ├──────────┤       │
│               │    with Template        │    │ T2   T3  │       │
│               │                         │    ├──────────┤       │
│               └─────────────────────────┘    │ T4   T5  │       │
│                                              ├──────────┤       │
│               [Control Buttons]              │ T6   T7  │       │
│                                              └──────────┘       │
│                                                                   │
│  [When template hovered - Modal pops up]                        │
│               ┌────────────────────┐                             │
│               │  ┌──────────────┐  │                             │
│               │  │   Template   │  │                             │
│               │  │   Preview    │  │                             │
│               │  │  (animated)  │  │                             │
│               │  └──────────────┘  │                             │
│               │ "Winter Wonderland"│                             │
│               │   [Select This]    │                             │
│               └────────────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

### Mobile Experience (<1024px)

#### Horizontal Scroll Gallery with Snap
```
┌─────────────────────────┐
│  Choose Your Template   │
├─────────────────────────┤
│                         │
│   ← Swipe to Browse →   │
│  ┌─────┬─────┬─────┐   │
│  │ T0  │ T1  │ T2  │   │
│  │(big)│(med)│(sm) │   │
│  └─────┴─────┴─────┘   │
│     •   ○   ○   ○       │
│                         │
│  ┌───────────────────┐  │
│  │  Camera Preview   │  │
│  │  with Template    │  │
│  └───────────────────┘  │
│                         │
│  [Control Buttons]      │
└─────────────────────────┘
```

**Mobile-Specific Features:**
- **Swipe navigation**: Natural touch gestures
- **Snap scrolling**: Templates snap to center position
- **Large center card**: Selected template is prominent
- **Momentum scrolling**: Feels fluid and natural
- **Active indicator**: Dots show current position

---

## 2. ADVANCED ANIMATION SYSTEM

### Template Selection Animations

#### Entrance Animations (On Load)
```javascript
// Staggered fade-in cascade
Template 0: delay 0ms    - slides in from left
Template 1: delay 100ms  - slides in from left  
Template 2: delay 200ms  - slides in from left
... (50-100ms stagger between each)

// With these effects:
- Opacity: 0 → 1
- Transform: translateY(20px) → translateY(0)
- Scale: 0.9 → 1
- Blur: blur(4px) → blur(0)
```

#### Hover/Focus Animations (Desktop)
```javascript
On Hover:
1. Scale up: 1 → 1.15 (150ms ease-out)
2. Lift effect: translateY(0) → translateY(-8px)
3. Glow ring: opacity 0 → 1, scale 1 → 1.1
4. Background: brightness 100% → 110%
5. Template preview: Subtle rotation (-2deg → 2deg) back and forth
6. Border: Animated gradient border that flows around edges
7. Shadow: Small → Large dramatic shadow with color tint

Optional: Parallax effect - inner content shifts slightly opposite to mouse position
```

#### Selection Animation (Click/Tap)
```javascript
On Click:
1. Quick scale down: 1 → 0.95 (100ms) - "press" effect
2. Spring back: 0.95 → 1.08 → 1 (300ms spring easing)
3. Confetti burst: Small festive particles emit from template
4. Success pulse: Golden ring expands outward and fades
5. Haptic feedback (mobile): Gentle vibration
6. Sound effect (optional): Soft "ding" or jingle bell

Deselection (when switching):
- Fade out effect on previous selection
- Scale down slightly: 1.05 → 1
- Glow fades away
```

#### Carousel/Scroll Animations
```javascript
Center Focus Animation:
1. Selected template scales to 1.2x (large)
2. Adjacent templates scale to 0.9x (medium)
3. Far templates scale to 0.7x and reduce opacity to 0.5
4. Smooth 500ms cubic-bezier transition
5. 3D perspective: rotateY(-15deg) for left, rotateY(15deg) for right

Scrolling Between Templates:
- Smooth scroll with easing curve
- Templates transform smoothly through size/opacity changes
- Blur effect on templates moving out of focus
- Focus template has subtle glow aura
```

### Camera Preview Template Overlay Animations

#### Template Switch Animation
```javascript
Old Template Exit:
- Opacity: 1 → 0 (200ms)
- Scale: 1 → 1.1 (200ms)
- Blur: 0 → 4px (200ms)
- Transform: rotateX(0) → rotateX(90deg) - "flip away"

New Template Enter (after 150ms delay):
- Opacity: 0 → 1 (300ms)
- Scale: 0.9 → 1 (300ms)
- Blur: 4px → 0 (300ms)
- Transform: rotateX(-90deg) → rotateX(0) - "flip in"
- Additional: Sparkle particles around edges during entry

Total transition: ~450ms with overlap for smoothness
```

#### Living Template Effects
```javascript
While Template is Active:
1. Gentle breathing animation on borders (scale 1 → 1.02 → 1, 3s cycle)
2. Subtle shimmer effect across metallic elements
3. Twinkling lights/sparkles in random positions
4. Soft pulsing glow on decorative elements
5. Snowflakes drifting down (for winter templates)
6. Gentle rotation on ornaments (±2deg, 4s cycle)

These effects should be SUBTLE - not distracting from the photo
```

### Button & Control Animations

#### Capture Button
```javascript
Idle State:
- Continuous gentle pulse: scale 1 → 1.05 → 1 (2s cycle)
- Soft glowing ring around button
- Text shadow pulses in sync

Hover State:
- Scale: 1 → 1.1 (200ms)
- Glow intensifies
- Button lifts: translateY(0) → translateY(-4px)
- Shadow grows

Pressed State:
- Quick press: scale 1.1 → 0.95 (100ms)
- Color shift: red → darker red

During Countdown:
- Button pulses faster with each countdown number
- Color transitions through gradient
- Final countdown: Intense glow and shake
```

#### Camera Switch Button
```javascript
On Click:
- Rotation animation: rotateY(0) → rotateY(180deg) (600ms)
- Icon flips during rotation
- Mid-rotation: Brief scale up (1.2x)
- Smooth easing curve

During Transition:
- Loading spinner appears if camera switch takes time
- Smooth fade between old/new camera feed
```

### Advanced Micro-Interactions

#### Template Card Interactions
```javascript
1. Magnetic Snap Effect:
   - When hovering near a template (50px proximity)
   - Template "pulls" cursor slightly toward center
   - Creates sticky, intentional feeling

2. Ripple Effect on Click:
   - Circular ripple emanates from click point
   - Festive color (gold/red/green)
   - Fades out while expanding

3. Dynamic Shadow:
   - Shadow follows mouse position
   - Creates depth and 3D effect
   - Stronger shadow on hovered side

4. Preview Zoom on Long Press (Mobile):
   - Hold template for 500ms
   - Full-screen preview modal slides up
   - Shows template details and larger preview
   - Tap to select, swipe down to dismiss
```

---

## 3. VISUAL EFFECTS & POLISH

### Background Enhancements

#### Animated Background
```javascript
Options:
1. Falling Snowflakes:
   - Multiple layers at different speeds
   - Blur layers in background
   - Gentle wind effect (slight horizontal drift)
   - Opacity variation

2. Aurora Borealis Effect:
   - Gradient animation in background
   - Soft, dreamy colors (purple, green, blue)
   - Slow wave animation

3. Floating Bokeh Lights:
   - Circular light orbs
   - Different sizes
   - Gentle float animation
   - Blur effect for depth
   - Christmas colors (red, green, gold, white)

4. Starfield with Twinkling:
   - Small stars in background
   - Random twinkling animation
   - Different brightness levels
   - Occasional shooting star
```

#### Dynamic Lighting
```javascript
- Ambient light glow around selected template
- Light rays emanating from capture button
- Soft spotlight effect on active template
- Color shift based on selected template theme
  (warm gold for Santa, cool blue for Winter, etc.)
```

### Template Preview Enhancements

#### Smart Preview Generation
```javascript
Template Thumbnails Show:
1. Miniature version of actual template design
2. Sample photo inside (festive stock image or gradient)
3. Animated preview when hovered (subtle animation plays)
4. Template name with elegant typography
5. Category badge (Playful, Elegant, Classic)
6. Quick-view icon that expands to full preview
```

#### Preview Modal Features
```javascript
When Template is Clicked for Preview:
1. Modal slides up with blur backdrop
2. Large template preview (600x600px)
3. Sample photo inside showing how it looks
4. Template name and description
5. "Try This Template" button
6. Left/Right arrows to browse other templates
7. Animated decorative elements specific to template
8. Close button (X) or tap outside to dismiss
```

---

## 4. GESTURE & INTERACTION ENHANCEMENTS

### Touch Gestures (Mobile/Tablet)

#### Swipe Navigation
```javascript
Horizontal Swipe:
- Swipe left/right to browse templates
- Momentum scrolling with snap-to-center
- Rubber band effect at start/end
- Visual feedback: Template cards move with finger
- Release velocity determines snap speed

Vertical Swipe on Template:
- Swipe up on template: Quick-select and go to camera
- Swipe down: Dismiss if in preview mode

Long Press:
- Long press template (600ms): Preview mode
- Haptic feedback when preview activates
- Quick tap: Instant select
```

#### Pinch & Zoom
```javascript
On Camera Preview:
- Pinch to zoom camera feed (if supported)
- Template overlay scales with zoom
- Smooth, responsive gesture tracking
```

### Keyboard Navigation (Desktop)

```javascript
Arrow Keys:
- Left/Right: Navigate between templates
- Enter/Space: Select template
- Number keys (1-8): Quick select template
- Escape: Close preview modal

Tab Navigation:
- Tab through all interactive elements
- Clear focus indicators with festive styling
- Focus ring with animated glow
```

### Mouse Interactions (Desktop)

```javascript
Advanced Cursor Effects:
1. Custom Cursor:
   - Festive cursor (snowflake, star)
   - Cursor leaves trail of sparkles
   - Changes on hover (pointer → festive icon)

2. Parallax Mouse Follow:
   - Template cards tilt slightly toward cursor
   - 3D depth effect
   - Smooth interpolation

3. Magnetic Buttons:
   - Buttons slightly move toward cursor when nearby
   - Creates "sticky" intentional feel
   - Radius: 40px

4. Hover Preview:
   - Delay 300ms: Show tooltip with template name
   - Delay 800ms: Show expanded preview
   - Cancel on mouse leave
```

---

## 5. TRANSITION SYSTEM

### Page/Screen Transitions

#### Camera Start Transition
```javascript
From Welcome Screen → Camera Screen:
1. Welcome content scales down and fades (300ms)
2. Background crossfades to new pattern (400ms)
3. Camera preview fades in and scales up from 0.9 → 1 (500ms)
4. Template selector slides in from bottom (400ms, delay 200ms)
5. Controls fade in (300ms, delay 400ms)
6. Staggered template card entrance (as described earlier)

Total smooth transition: ~800ms
```

#### Photo Capture Transition
```javascript
Capture Moment:
1. Flash effect: White overlay fades in/out (200ms total)
2. Camera freezes on frame
3. Shutter sound effect (optional)
4. Polaroid-style effect: Photo slides down from top
5. Photo "develops": Starts slightly faded, brightens
6. Template overlay merges with photo (visible process)
7. Confetti explosion around photo
8. Buttons animate in: Retake, Download, Share

Total experience: ~1200ms
```

#### Template Change on Camera
```javascript
Smooth Cross-Fade with 3D Flip:
- Old template: rotateY(0 → 90deg), opacity 1 → 0 (250ms)
- Brief pause (50ms)
- New template: rotateY(-90deg → 0), opacity 0 → 1 (300ms)
- Add sparkle trail during flip
- Very smooth, not jarring

Alternative: Dissolve with Scale
- Old: scale 1 → 1.2, opacity 1 → 0 (300ms)
- New: scale 0.8 → 1, opacity 0 → 1 (300ms)
- Overlap transition for smoothness
```

---

## 6. PERFORMANCE OPTIMIZATIONS

### Smooth 60 FPS Animations

```javascript
Critical Techniques:
1. Use transform & opacity only (GPU accelerated)
2. will-change: transform on animated elements
3. Use CSS transforms instead of position changes
4. RequestAnimationFrame for custom animations
5. Debounce resize/scroll events
6. Lazy load template previews (render on-demand)
7. Use React.memo for template components
8. IntersectionObserver for entrance animations
9. Reduce motion for users with prefers-reduced-motion
10. Hardware acceleration: translate3d(0,0,0)
```

### Progressive Enhancement

```javascript
Feature Detection:
- Check for touch support → Enable swipe gestures
- Check for hover support → Enable hover effects  
- Check for WebGL → Enable advanced effects
- Fallback to simple animations if performance is low
- Respect user's reduced-motion preferences
```

---

## 7. LOADING & STATE ANIMATIONS

### Loading States

#### Template Loading Skeleton
```javascript
While templates load:
1. Shimmer effect skeleton cards
2. Gradient animation moving left to right
3. Smooth fade-in when templates ready
4. Stagger appearance of each template
```

#### Camera Loading
```javascript
Before camera access granted:
1. Camera icon with pulsing animation
2. "Requesting camera access..." text
3. Loading spinner with festive colors
4. Smooth transition when camera starts
```

### Error States

#### Permission Denied
```javascript
Friendly Error Animation:
1. Camera icon shakes (gentle, not aggressive)
2. Sad emoji appears with fade-in
3. Error message types in character by character
4. "Try Again" button pulses gently
5. Link to help guide
```

---

## 8. SOUND DESIGN (Optional but Recommended)

### Subtle Audio Feedback

```javascript
Sound Effects (all very soft, ~20% volume):
1. Template Selection: Gentle "pop" or bell chime
2. Template Hover: Very soft "whoosh" 
3. Photo Capture: Camera shutter click
4. Countdown: Gentle beep for each number
5. Success: Cheerful jingle when photo captured
6. Background: Very soft, optional looping Christmas ambience

Important:
- All sounds must be SHORT (< 300ms)
- Volume must be SUBTLE (don't startle user)
- Must have mute/unmute toggle
- Respect user's sound preferences
- Load sounds asynchronously (don't block UI)
```

---

## 9. ACCESSIBILITY WITH STYLE

### Inclusive Animations

```javascript
Respect prefers-reduced-motion:
@media (prefers-reduced-motion: reduce) {
  // Disable complex animations
  // Keep essential feedback (selection state)
  // Use simple fades instead of complex transforms
  // Reduce animation duration to 0ms or very short
  // Keep functional transitions only
}

But still provide feedback:
- Selection state still visible (different color, not animation)
- Focus states still clear
- State changes still obvious
- Just without motion
```

### Keyboard Focus Styling

```javascript
Focus Indicators:
- Thick, high-contrast outline (3px solid)
- Festive color (gold/yellow)
- Animated glow pulse
- Visible against all backgrounds
- Never removed (only styled)
- Offset from element for clarity
```

---

## 10. IMPLEMENTATION CODE EXAMPLES

### Carousel Implementation (React)

```javascript
const TemplateCarousel = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const carouselRef = useRef(null);

  const scrollToIndex = (index) => {
    // Smooth scroll to center the selected template
    const element = carouselRef.current;
    const templateWidth = 200; // width of each template card
    const offset = (element.offsetWidth - templateWidth) / 2;
    const scrollPosition = (index * templateWidth) - offset;
    
    element.scrollTo({
      left: scrollPosition,
      behavior: 'smooth'
    });
    
    setSelectedIndex(index);
  };

  return (
    <div 
      ref={carouselRef}
      className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth"
      style={{ scrollbarWidth: 'none' }} // Hide scrollbar
    >
      {templates.map((template, index) => {
        const distance = Math.abs(index - selectedIndex);
        const scale = distance === 0 ? 1.2 : distance === 1 ? 0.9 : 0.7;
        const opacity = distance === 0 ? 1 : distance === 1 ? 0.7 : 0.4;
        
        return (
          <button
            key={template.id}
            onClick={() => scrollToIndex(index)}
            className="snap-center shrink-0 transition-all duration-500 ease-out"
            style={{
              transform: `scale(${scale}) ${distance !== 0 ? `rotateY(${index < selectedIndex ? '15deg' : '-15deg'})` : ''}`,
              opacity,
              transformStyle: 'preserve-3d'
            }}
          >
            {/* Template content */}
          </button>
        );
      })}
    </div>
  );
};
```

### Advanced Hover Effect (CSS + React)

```javascript
// In your component
const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

const handleMouseMove = (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width - 0.5;
  const y = (e.clientY - rect.top) / rect.height - 0.5;
  setMousePos({ x, y });
};

<div
  onMouseMove={handleMouseMove}
  onMouseLeave={() => setMousePos({ x: 0, y: 0 })}
  style={{
    transform: `perspective(1000px) rotateY(${mousePos.x * 10}deg) rotateX(${-mousePos.y * 10}deg)`
  }}
  className="transition-transform duration-300 ease-out"
>
  {/* Template card content */}
</div>
```

### Confetti Effect on Selection

```javascript
const createConfetti = (element) => {
  const colors = ['#DC2626', '#059669', '#F59E0B', '#FFFFFF'];
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  for (let i = 0; i < 20; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-particle';
    confetti.style.cssText = `
      position: fixed;
      left: ${centerX}px;
      top: ${centerY}px;
      width: 8px;
      height: 8px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: 50%;
      pointer-events: none;
      z-index: 1000;
    `;
    
    document.body.appendChild(confetti);
    
    const angle = (Math.PI * 2 * i) / 20;
    const velocity = 3 + Math.random() * 2;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;
    
    // Animate using requestAnimationFrame or CSS animation
    confetti.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${vx * 50}px, ${vy * 50 + 100}px) scale(0)`, opacity: 0 }
    ], {
      duration: 800,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
    }).onfinish = () => confetti.remove();
  }
};
```

---

## 11. DESIGN TOKENS

### Animation Timing

```javascript
const animations = {
  // Durations
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
  slower: 800,
  
  // Easing functions
  easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)', // Smooth deceleration
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Bouncy
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)', // Material Design
  
  // Delays (stagger)
  stagger: 50, // Between sequential animations
  groupDelay: 100 // Between groups of elements
};
```

### Color Palette

```javascript
const festiveColors = {
  // Primary
  red: { light: '#FCA5A5', main: '#DC2626', dark: '#991B1B' },
  green: { light: '#6EE7B7', main: '#059669', dark: '#047857' },
  gold: { light: '#FDE68A', main: '#F59E0B', dark: '#D97706' },
  
  // Accent
  silver: '#E5E7EB',
  white: '#FFFFFF',
  
  // Selection/Focus
  highlight: '#FBBF24', // Bright gold
  focusRing: '#60A5FA', // Accessible blue
  
  // Shadows & Glows
  shadowColor: 'rgba(0, 0, 0, 0.3)',
  glowRed: 'rgba(220, 38, 38, 0.5)',
  glowGreen: 'rgba(5, 150, 105, 0.5)',
  glowGold: 'rgba(245, 158, 11, 0.5)'
};
```

---

## 12. FINAL UX PRINCIPLES

### Golden Rules

1. **Feedback Before Action**: Show what will happen before user commits
2. **Smooth Transitions**: Never snap instantly, always animate
3. **Clear State**: User always knows what's selected and what's active
4. **Forgiving Interface**: Easy to undo, change mind, try different options
5. **Performance First**: Animations must be 60fps, no jank
6. **Accessible by Default**: Works with keyboard, screen readers, reduced motion
7. **Mobile-First**: Touch interactions feel natural and responsive
8. **Delight in Details**: Small surprises and polish everywhere
9. **Consistent Language**: Similar interactions work the same way
10. **Fast & Responsive**: Perceived performance through optimistic updates

---

## SUCCESS METRICS

The template UI is successful when:
- ✅ Users say "Wow!" when they first see it
- ✅ All animations run at 60 FPS
- ✅ Template selection feels instant and responsive
- ✅ Users browse all templates (high engagement)
- ✅ Zero confusion about which template is selected
- ✅ Mobile swipe feels natural and smooth
- ✅ Works perfectly with keyboard and screen readers
- ✅ Users want to try multiple templates before capturing
- ✅ The experience feels premium and polished
- ✅ Loading states are smooth, never jarring

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Core Animations
- [ ] Template entrance stagger animation
- [ ] Hover scale and lift effects
- [ ] Selection pulse and glow
- [ ] Template overlay smooth transition

### Phase 2: Carousel/Gallery
- [ ] Smooth scroll snap
- [ ] Center focus with scaling
- [ ] Touch swipe gestures
- [ ] Keyboard navigation

### Phase 3: Polish
- [ ] Confetti on selection
- [ ] Background effects (snowflakes/bokeh)
- [ ] Loading skeletons
- [ ] Error state animations

### Phase 4: Advanced
- [ ] Parallax mouse follow
- [ ] Preview modal
- [ ] Custom cursor effects
- [ ] Sound effects (optional)

### Phase 5: Optimization
- [ ] Performance testing (60fps)
- [ ] Reduced motion support
- [ ] Touch gesture refinement
- [ ] Cross-browser testing

---

**Give this to your AI assistant with the instruction:**

> "Create a Christmas Photo Booth with THIS template UI system. Focus on making the template browsing experience feel PREMIUM with smooth 60fps animations, delightful micro-interactions, and a carousel or gallery layout that makes users excited to explore all templates. Every interaction should feel polished and satisfying. Use the animation specifications and code examples provided."