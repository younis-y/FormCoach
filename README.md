# 🏋️ FormCoach AI

> Real-time AI personal trainer with kinetic chain analysis, fatigue prediction, and bilateral asymmetry detection.

**Built for the UCL Zero to Demo Hackathon 2025**

## What Makes This Novel

| Feature | Description |
|---|---|
| 🔗 **Kinetic Chain Root-Cause Analysis** | Traces form faults through the biomechanical chain to find the *root cause* — not just symptoms |
| 📈 **Fatigue Curve Prediction** | Fits a regression to your per-rep form scores and predicts *which rep you'll hit injury risk* |
| ↔️ **Bilateral Asymmetry Detection** | Compares left vs right side in real-time to catch muscle imbalances |
| 🎙️ **Real-Time Voice Coaching** | ElevenLabs-powered voice feedback — because you can't read a screen mid-squat |

## Tech Stack

- **MediaPipe Pose** — Client-side pose estimation (33 landmarks, ~30fps)
- **Custom Biomechanics Engine** — Joint angle calculation + exercise-specific rules
- **ElevenLabs** — Natural voice coaching with priority-based throttled queue
- **Gemini 2.0 Flash** — Post-set AI coaching summaries
- **Vite** — Zero-config dev server

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and click **Start Coaching Session**.

### API Keys (Optional)

Pass via URL parameters for enhanced features:

```
http://localhost:3000?elevenlabs=YOUR_KEY&gemini=YOUR_KEY
```

Without keys, voice coaching falls back to browser SpeechSynthesis and post-set summaries use templates.

## How It Works

```
Webcam → MediaPipe Pose (client-side WASM)
    → Joint angle calculation
    → Biomechanics rule engine (squat/push-up)
    → Kinetic chain root-cause tracing
    → Rep counter + per-rep form scoring
    → Fatigue curve prediction (linear regression)
    → Bilateral asymmetry detection
    → Canvas rendering (skeleton + risk heatmap)
    → Voice coaching (ElevenLabs / browser TTS)
    → Post-set AI summary (Gemini 2.0 Flash)
```

## Supported Exercises

- **Squat** — Knee valgus, depth, forward lean, asymmetric descent
- **Push-up** — Hip sag/pike, elbow flare, depth

## License

MIT
