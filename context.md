# Christmas Photo Booth Application - Development Prompt

## Project Overview
Create a festive Christmas-themed photo booth web application that allows users to select from multiple holiday templates, capture photos using their device camera, and apply beautiful Christmas overlays to create memorable holiday pictures.

## Core Requirements

### 1. Technical Stack
- **Framework**: React component (`application/vnd.ant.react`)
- **Styling**: Tailwind CSS utility classes only
- **Camera Access**: Use `navigator.mediaDevices.getUserMedia()` for webcam access
- **State Management**: React hooks (useState, useEffect, useRef)
- **Icons**: Lucide-react library for UI icons

### 2. User Interface Design

#### Color Scheme & Aesthetics
- **Primary Colors**: Rich reds (#DC2626, #991B1B), forest greens (#047857, #065F46), gold accents (#F59E0B)
- **Secondary Colors**: Snow white (#FFFFFF), warm cream (#FEF3C7)
- **Background**: Festive gradient or pattern (snowflakes, subtle holiday motifs)
- **Typography**: Warm, friendly fonts that evoke holiday cheer

#### Layout Structure
1. **Header Section**
   - App title: "🎄 Christmas Photo Booth 🎅"
   - Festive tagline (e.g., "Capture Your Holiday Magic!")
   - Subtle snowfall animation or Christmas lights decoration

2. **Main Content Area**
   - Large camera preview/captured photo display (center stage)
   - Template selector below or beside the camera view
   - Clear, intuitive controls

3. **Control Panel**
   - Camera toggle button (switch between front/back camera on mobile)
   - Capture photo button (large, prominent, festive)
   - Retake button (if photo captured)
   - Download button (save final photo with template)

### 3. Christmas Templates (Minimum 6-8)

Each template should be a semi-transparent PNG overlay or SVG design that frames the photo. Include:

1. **Santa's Workshop Frame**
   - Red and white candy cane borders
   - "Ho Ho Ho!" text
   - Small Santa hat decorations in corners

2. **Winter Wonderland**
   - Snowflake borders
   - Ice blue and silver tones
   - "Season's Greetings" or "Let it Snow" text

3. **Christmas Tree Frame**
   - Green pine garland border with ornaments
   - Star or angel topper decoration
   - "Merry Christmas" greeting

4. **Gingerbread House**
   - Brown cookie-textured frame
   - Candy decorations, icing details
   - "Sweet Holidays" text

5. **Mistletoe & Holly**
   - Elegant green leaves and red berries
   - Gold ribbon accents
   - "Joy to the World" or "Peace & Love"

6. **Santa Hat & Beard**
   - Fun overlay that adds Santa hat on top
   - Optional beard overlay at bottom
   - "Believe in the Magic" text

7. **Reindeer Antlers**
   - Playful antlers and red nose overlay
   - "Have a Jolly Christmas"
   - Cute cartoon style

8. **Festive Lights Border**
   - Colorful string lights around the edge
   - Glowing effect
   - "Light Up the Season" text

### 4. User Experience Flow

#### Step 1: Welcome Screen
- Festive landing view with app title
- "Start Photo Booth" button
- Brief instructions or feature highlights

#### Step 2: Camera Permission
- Request camera access with friendly message
- Handle permission denial gracefully
- Provide troubleshooting tips if needed

#### Step 3: Template Selection
- Display all templates as thumbnails in a scrollable gallery
- Clear visual preview of each template
- Highlight selected template
- Allow template change before and after photo capture

#### Step 4: Photo Capture
- Live camera preview with selected template overlay in real-time
- Countdown timer (3-2-1) before capture (optional but fun)
- Flash effect or festive animation on capture
- Instant preview of captured photo with template

#### Step 5: Review & Save
- Show final photo with template applied
- Options: Retake photo, Change template, Download image
- Download as PNG with good quality (template baked in)
- Optional: Add festive confetti animation on successful capture

### 5. Special Features to Enhance Experience

#### Animation & Interactivity
- Gentle snowfall animation in background
- Hover effects on buttons (scale, glow)
- Smooth transitions between states
- Loading states with Christmas-themed spinners

#### Responsive Design
- Works perfectly on mobile, tablet, and desktop
- Camera switches to mobile device cameras on phones
- Touch-friendly interface
- Vertical and horizontal orientations supported

#### Accessibility
- High contrast for readability
- Clear button labels
- Keyboard navigation support
- Screen reader friendly

#### Polish & Details
- Add subtle background Christmas music toggle (optional, user-controlled)
- Share button to save to device gallery
- "Happy Holidays from [Your Name/Company]" watermark option
- Template previews show actual example

### 6. Technical Implementation Notes

#### Camera Handling
```javascript
// Request camera with proper constraints
const stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: 'user', width: 1280, height: 720 }
});
```

#### Photo Capture Process
- Use HTML Canvas to merge camera frame + template overlay
- Export as high-quality PNG or JPEG
- Ensure template graphics are crisp and well-aligned

#### State Management
- Track: cameraActive, photoTaken, selectedTemplate, imageData
- Handle: camera permission, errors, loading states

#### Performance
- Lazy load template images
- Optimize camera stream (don't keep running when not needed)
- Clean up resources properly (stop camera stream on unmount)

### 7. Error Handling & Edge Cases
- Camera not available: Show friendly error message
- Permission denied: Explain how to enable camera
- Template loading failure: Provide fallback
- Download issues: Clear instructions for user

### 8. Christmas Messages & Copy Ideas
Throughout the app, use warm, festive language:
- "Say Cheese! 🧀✨"
- "Looking Merry & Bright!"
- "Your Holiday Memory Awaits!"
- "Snap Your Christmas Spirit!"
- "Spread Holiday Cheer!"

### 9. Final Deliverables
- Fully functional React component
- All 6-8 templates designed and integrated
- Responsive, mobile-ready interface
- Download functionality working
- Festive, polished user experience
- No external dependencies beyond allowed libraries

## Success Criteria
✅ User can easily select templates
✅ Camera works on first try with clear permissions
✅ Photos capture cleanly with templates applied
✅ Download produces high-quality images
✅ Interface feels festive, fun, and intuitive
✅ Works across devices and browsers
✅ No bugs or broken functionality

---

**Note to AI Assistant**: Please create this as a single React artifact. Focus on making it feel magical and festive. The user experience should be delightful, with smooth interactions and a warm holiday atmosphere. Prioritize functionality over complex animations, but add festive touches that make users smile. Use CSS/SVG for templates rather than requiring external images.