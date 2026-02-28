/**
 * FormCoach AI — Main Application Entry Point
 * Wires together all modules: pose detection → analysis → rendering → voice.
 */

import { initPose, detect } from './pose.js';
import { analyseForm } from './exercises.js';
import { traceKineticChain } from './kineticChain.js';
import { RepCounter } from './repCounter.js';
import { predictFatigue } from './fatiguePredictor.js';
import { detectAsymmetry } from './asymmetry.js';
import { renderPose } from './renderer.js';
import { updateAlerts, updateKineticChain, updateFatigueChart, updateAsymmetry, updateOverlays } from './dashboard.js';
import { initVoice, generateFormCues } from './voice.js';
import { initGemini, generateCoachingSummary } from './gemini.js';

// ── State ──
let selectedExercise = 'squat';
let isRunning = false;
let animationId = null;
const repCounter = new RepCounter();

// Smoothing: keep recent analyses to avoid flicker
let recentFormScores = [];
let lastChainResults = [];
let lastAsymmetryResults = [];
let frameCount = 0;

// ── Setup Screen Logic ──
document.addEventListener('DOMContentLoaded', () => {
    // Exercise buttons
    document.querySelectorAll('.exercise-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.exercise-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedExercise = btn.dataset.exercise;
        });
    });

    // Start button
    document.getElementById('start-btn').addEventListener('click', startSession);

    // Stop button
    document.getElementById('stop-btn').addEventListener('click', endSession);
});

// ── Session Management ──
async function startSession() {
    const startBtn = document.getElementById('start-btn');
    startBtn.textContent = 'Loading AI model...';
    startBtn.disabled = true;

    try {
        // Init MediaPipe
        await initPose();

        // Init voice (check for API keys in URL params or localStorage)
        const params = new URLSearchParams(window.location.search);
        const elevenLabsKey = params.get('elevenlabs') || localStorage.getItem('elevenlabs_key') || '';
        const geminiKey = params.get('gemini') || localStorage.getItem('gemini_key') || '';

        if (elevenLabsKey) {
            initVoice(elevenLabsKey);
            localStorage.setItem('elevenlabs_key', elevenLabsKey);
        } else {
            initVoice(''); // Will use browser TTS fallback
        }

        if (geminiKey) {
            initGemini(geminiKey);
            localStorage.setItem('gemini_key', geminiKey);
        }

        // Start webcam
        const video = document.getElementById('webcam');
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
            audio: false,
        });
        video.srcObject = stream;
        await video.play();

        // Configure rep counter
        repCounter.configure(selectedExercise);
        repCounter.reset();

        // Update exercise label
        document.getElementById('exercise-label').textContent = selectedExercise.toUpperCase();

        // Switch screens
        document.getElementById('setup-screen').classList.remove('active');
        document.getElementById('coach-screen').classList.add('active');

        // Size canvas to match video
        const canvas = document.getElementById('pose-canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        isRunning = true;
        frameCount = 0;
        recentFormScores = [];
        lastChainResults = [];
        lastAsymmetryResults = [];

        // Start the main loop
        mainLoop(video, canvas);

    } catch (error) {
        console.error('[FormCoach] Init error:', error);
        startBtn.textContent = 'Error: ' + error.message;
        startBtn.disabled = false;
    }
}

function endSession() {
    isRunning = false;
    if (animationId) cancelAnimationFrame(animationId);

    // Stop webcam
    const video = document.getElementById('webcam');
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(t => t.stop());
        video.srcObject = null;
    }

    // Show AI summary
    showPostSetSummary();

    // Switch back to setup after summary
    setTimeout(() => {
        document.getElementById('coach-screen').classList.remove('active');
        document.getElementById('setup-screen').classList.add('active');
        document.getElementById('start-btn').textContent = '📷 Start Coaching Session';
        document.getElementById('start-btn').disabled = false;
        document.getElementById('summary-panel').classList.add('hidden');
    }, 15000); // Keep summary visible for 15 seconds
}

async function showPostSetSummary() {
    const summaryPanel = document.getElementById('summary-panel');
    const summaryContent = document.getElementById('ai-summary');
    summaryPanel.classList.remove('hidden');

    const repScores = repCounter.getRepScores();
    const fatigue = predictFatigue(repScores);

    summaryContent.innerHTML = '<em>Generating AI coaching summary...</em>';

    const sessionData = {
        exercise: selectedExercise,
        totalReps: repCounter.repCount,
        repScores,
        degradationPct: fatigue.degradationPct,
        predictedInjuryRep: fatigue.predictedInjuryRep,
        formIssues: lastChainResults,
        asymmetries: lastAsymmetryResults,
    };

    const summary = await generateCoachingSummary(sessionData);
    summaryContent.innerHTML = summary.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

// ── Main Analysis Loop ──
function mainLoop(video, canvas) {
    if (!isRunning) return;

    const ctx = canvas.getContext('2d');
    const result = detect(video);

    if (result && result.landmarks) {
        const landmarks = result.landmarks;
        frameCount++;

        // 1. Analyse form
        const analysis = analyseForm(selectedExercise, landmarks);

        // 2. Determine primary angle for rep counting
        let primaryAngle;
        if (selectedExercise === 'squat') {
            primaryAngle = (analysis.jointAngles.leftKnee + analysis.jointAngles.rightKnee) / 2;
        } else {
            primaryAngle = (analysis.jointAngles.leftElbow + analysis.jointAngles.rightElbow) / 2;
        }

        // 3. Update rep counter
        const repData = repCounter.update(primaryAngle, analysis.overallScore);

        // 4. Render skeleton with risk heatmap
        renderPose(ctx, landmarks, analysis.checks, canvas.width, canvas.height);

        // 5. Update overlays
        updateOverlays(repCounter.repCount, analysis.overallScore);

        // 6. Update alerts (throttled to every 5 frames)
        if (frameCount % 5 === 0) {
            updateAlerts(analysis.checks);
        }

        // 7. Kinetic chain analysis (on form issues, throttled)
        if (frameCount % 10 === 0) {
            const chainResults = traceKineticChain(analysis.checks);
            if (chainResults.length > 0) lastChainResults = chainResults;
            updateKineticChain(chainResults);
        }

        // 8. Update fatigue chart on rep completion
        if (repData.repCompleted) {
            const repScores = repCounter.getRepScores();
            updateFatigueChart(repScores);
        }

        // 9. Bilateral asymmetry (throttled to every 15 frames)
        if (frameCount % 15 === 0) {
            const asymmetryResults = detectAsymmetry(landmarks);
            lastAsymmetryResults = asymmetryResults;
            updateAsymmetry(asymmetryResults);
        }

        // 10. Voice coaching (on key events)
        const fatigueData = predictFatigue(repCounter.getRepScores());
        generateFormCues(analysis.checks, lastChainResults, fatigueData, repData);
    }

    animationId = requestAnimationFrame(() => mainLoop(video, canvas));
}
