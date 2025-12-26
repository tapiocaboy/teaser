This is a great stack for audio visualization. The architecture will be: Python handles audio capture, MFCC extraction, and UMAP projection, then streams coordinates to TouchDesigner via OSC for real-time rendering.Audio UMAP VisualizerCode """
Audio UMAP Visualizer - Streams MFCC-based coordinates to TouchDesigner via OSC
"""

import numpy as np
import librosa
import sounddevice as sd
from umap import UMAP
from pythonosc import udp_client
from collections import deque
import threading
Now here's the TouchDesigner setup:TouchDesigner Setup GuideDocument # TouchDesigner Setup for Audio UMAP Visualization

## Network Architecture
```
Python Script → OSC (port 7000) → TouchDesigner → Real-time 3D Render
```

## Step 1: OSC Input Setup

1. **Add OSC In CHOP**
   - Create: `oscin1`
   - Parameters:
     Install dependencies:
bashpip install librosa numpy sounddevice umap-learn python-osc
How it works:

Feature Extraction: Each audio chunk (100ms) gets converted to a ~82-dimensional feature vector containing MFCCs (capturing timbre), their temporal derivatives (capturing how sound evolves), plus spectral centroid, rolloff, RMS energy, and zero-crossing rate.
UMAP Training: The system first collects ~15 seconds of varied audio to "learn" your acoustic space. Make different sounds during training so UMAP can map the full range of timbres you'll use.
Real-time Projection: New audio gets projected into the trained 3D space. Similar sounds cluster together, so speaking will occupy a different region than whistling or clapping.
OSC Messages: Three channels stream to TouchDesigner:

/umap/coords — the 3D position (normalized 0-1)
/audio/rms — loudness (for scaling/glow effects)
/audio/centroid — brightness of sound (for color mapping)



Key tuning parameters:
ParameterEffectbuffer_secondsLower = more responsive, higher = smoother featuressmooth_factor0.1 = very smooth, 0.5 = responsiven_mfccMore = finer timbral detail, but higher dimensionalitytraining durationLonger = better UMAP coverage


TouchDesigner Setup for Audio UMAP Visualization
Network Architecture
Python Script → OSC (port 7000) → TouchDesigner → Real-time 3D Render
Step 1: OSC Input Setup

Add OSC In CHOP

Create: oscin1
Parameters:

Network Port: 7000
Active: On




Add Select CHOPs to extract channels:

   select1: Pattern = "umap/coords*"  → gives coords0, coords1, coords2
   select2: Pattern = "audio/rms"
   select3: Pattern = "audio/centroid"
Step 2: Point Geometry

Add Point SOP (for single moving point)

Or use Add SOP → Copy SOP with instancing for particle trails


Add CHOP to SOP to drive position:

CHOP: select1
Map: coords0 → tx, coords1 → ty, coords2 → tz



Step 3: Trail Effect (Optional)
python# In a Script SOP - creates a trail of past positions
import numpy as np

# Store history in extension
if not hasattr(me, 'history'):
    me.history = []
    
coords = [
    op('select1')['coords0'].eval(),
    op('select1')['coords1'].eval(),
    op('select1')['coords2'].eval()
]

me.history.append(coords)
if len(me.history) > 100:  # Trail length
    me.history.pop(0)

# Output points
scriptOp = me
scriptOp.clear()
for i, pos in enumerate(me.history):
    p = scriptOp.appendPoint()
    p.x, p.y, p.z = pos
    # Fade alpha based on age
    # (use in MAT with point color)
Step 4: Visual Rendering
Basic Setup

Geometry COMP: Contains your point/trail geometry
Camera COMP: Position at (0.5, 0.5, 2) looking at (0.5, 0.5, 0.5)
Light COMP: Point light
Render TOP: Render the scene

Enhanced Visuals with Instancing

Sphere SOP (small, e.g., radius 0.02)
Geometry COMP with instancing:

Instance CHOP: Your trail data
Scale by RMS for reactive sizing



GLSL Material (Phong MAT or GLSL MAT)
glsl// Fragment shader addition for glow based on audio
uniform float uRMS;
uniform float uCentroid;

// Vary color by spectral centroid (brightness = energy)
vec3 baseColor = mix(vec3(0.2, 0.4, 1.0), vec3(1.0, 0.3, 0.5), uCentroid);
color.rgb = baseColor * (1.0 + uRMS * 2.0);
Step 5: Parameter Bindings
Create a Parameter CHOP to drive materials:
bind1: audio/rms → MAT uniform uRMS
bind2: audio/centroid → MAT uniform uCentroid
Complete Node Network
oscin1 (CHOP)
    ├── select1 [coords] → chopTo1 (SOP) → geo1 (COMP) → render1 (TOP)
    ├── select2 [rms]    → math1 (scale) → bind to material
    └── select3 [centroid] → math2 (normalize) → bind to material

camera1 + light1 → render1
render1 → bloom1 (TOP) → out1 (TOP)
Post-Processing Chain

Bloom TOP: Glow effect
Feedback TOP: Motion trails
Composite TOP: Layer effects
Level TOP: Final color grading

Troubleshooting
IssueSolutionNo OSC dataCheck firewall, verify port 7000Jittery motionIncrease smooth_factor in Python or add Lag CHOPOut of boundsVerify normalization (should be 0-1 range)Low framerate