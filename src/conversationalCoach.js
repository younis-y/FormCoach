/**
 * TechnIQ AI — ElevenLabs Conversational AI Coach
 * Two-way real-time voice coaching that can see your form data and respond.
 * Falls back to the legacy one-way TTS when no agentId is configured.
 *
 * Requires: npm install @elevenlabs/client
 *
 * ElevenLabs Dashboard Setup:
 *  1. Create a Conversational AI Agent at https://elevenlabs.io/app/conversational-ai
 *  2. Set the system prompt (see COACH_SYSTEM_PROMPT below for guidance)
 *  3. Register the client tools listed in buildClientTools()
 *  4. Copy the Agent ID and pass it to initConversationalCoach()
 */

import { Conversation } from '@elevenlabs/client';

// ── Configuration ──────────────────────────────────────────────────────
const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // "George" — clear, authoritative
const PROACTIVE_INTERVAL_MS = 6000; // Coach speaks proactively every 6s max
const CONTEXT_UPDATE_INTERVAL_MS = 2000; // Push form data context every 2s

// ── State ──────────────────────────────────────────────────────────────
let conversation = null;
let apiKey = '';
let agentId = '';
let isConnected = false;
let isSpeaking = false;
let isMuted = false;

// Form analysis state — continuously updated from main loop
let currentFormState = {
    exercise: 'squat',
    formScore: 0,
    repCount: 0,
    alerts: [],
    rootCauses: [],
    fatigueData: null,
    asymmetries: [],
};

// Proactive coaching state
let lastProactiveSpeakTime = 0;
let proactiveInterval = null;
let contextUpdateInterval = null;

// Legacy TTS fallback variables
let legacyVoiceQueue = [];
let legacyIsSpeaking = false;
let legacyLastSpeakTime = 0;
const LEGACY_MIN_INTERVAL_MS = 4500;

// ── System Prompt (for reference when creating the agent on ElevenLabs) ──
export const COACH_SYSTEM_PROMPT = `You are TechnIQ, an expert sports physiotherapist and strength & conditioning coach.

ROLE:
- You are watching the user exercise in real-time through pose estimation data
- You give brief, actionable form corrections and encouragement
- You trace biomechanical root causes — don't just describe symptoms
- You are encouraging but honest about form issues

RULES:
- Keep responses SHORT (1-2 sentences max) during active exercise
- For injury-risk alerts (severity: danger), be URGENT and direct
- Use the client tools to get real-time form data before speaking
- When the user asks a question, give a thorough but concise answer
- Reference specific joints and angles when giving corrections
- Factor in fatigue prediction — warn them before they hit injury risk
- If asymmetry is detected, suggest unilateral corrective exercises

PERSONALITY:
- Professional but warm — like a supportive coach, not a drill sergeant
- Use phrases like "Nice rep", "Watch your...", "Focus on...", "Let's correct..."
- Celebrate good form genuinely`;

// ── Priority System (matches legacy voice.js) ──
const PRIORITY = {
    CRITICAL: 3,
    FORM: 2,
    ENCOURAGE: 1,
    INFO: 0,
};

// ────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ────────────────────────────────────────────────────────────────────────

/**
 * Initialise the conversational coach.
 * @param {string} elevenLabsApiKey - ElevenLabs API key
 * @param {string} elevenLabsAgentId - Conversational AI Agent ID (from dashboard)
 */
export function initConversationalCoach(elevenLabsApiKey, elevenLabsAgentId = '') {
    apiKey = elevenLabsApiKey;
    agentId = elevenLabsAgentId;
    console.log('[TechnIQ] Conversational coach initialised', agentId ? '(Conversational AI)' : '(Legacy TTS)');
}

/**
 * Start a conversational coaching session.
 * Opens the WebSocket/WebRTC connection to the ElevenLabs agent.
 */
export async function startCoachingSession(exercise = 'squat') {
    currentFormState.exercise = exercise;

    if (agentId && apiKey) {
        await startConversationalSession();
    } else if (apiKey) {
        console.log('[TechnIQ] No Agent ID — using legacy one-way TTS');
        startProactiveCoaching();
    } else {
        console.log('[TechnIQ] No API key — using browser TTS fallback');
        startProactiveCoaching();
    }
}

/**
 * End the coaching session and disconnect.
 */
export async function endCoachingSession() {
    stopProactiveCoaching();

    if (conversation) {
        try {
            await conversation.endSession();
        } catch (e) {
            console.warn('[TechnIQ] Error ending session:', e.message);
        }
        conversation = null;
        isConnected = false;
    }

    showVoiceIndicator(false);
    updateCoachStatus('disconnected');
}

/**
 * Update the form analysis state (called from main loop every frame).
 */
export function updateFormState(newState) {
    currentFormState = { ...currentFormState, ...newState };
}

/**
 * Generate voice cues based on form analysis results.
 * Drop-in replacement for the legacy generateFormCues function.
 */
export function generateFormCues(checks, chainResults, fatigueData, repData) {
    // Update shared state
    updateFormState({
        formScore: repData.repScore || currentFormState.formScore,
        repCount: repData.repNumber || currentFormState.repCount,
        alerts: checks,
        rootCauses: chainResults,
        fatigueData,
    });

    // In conversational mode, the agent handles proactive speaking via context
    if (isConnected && conversation) {
        // Send a contextual message to the agent on critical events
        if (repData.repCompleted) {
            sendContextToAgent();
        }
        return;
    }

    // Legacy mode: generate cues the old way
    generateLegacyCues(checks, chainResults, fatigueData, repData);
}

/**
 * Toggle microphone mute for the conversational session.
 */
export function toggleMute() {
    if (!conversation) return;

    isMuted = !isMuted;
    if (isMuted) {
        conversation.setVolume({ volume: 0 });
    } else {
        conversation.setVolume({ volume: 1 });
    }
    updateMuteUI(isMuted);
    return isMuted;
}

/**
 * Send a user-initiated message/question to the coach.
 * Used when user clicks "Ask Coach" button.
 */
export async function askCoach(question) {
    if (conversation && isConnected) {
        // The conversational agent will hear the user via microphone.
        // For text-based questions, we can send a message.
        try {
            await conversation.sendMessage({ text: question });
        } catch (e) {
            console.warn('[TechnIQ] Error sending message:', e.message);
        }
    } else {
        // Legacy: just speak the answer using template
        legacyQueueCue(`I heard your question. Let me focus on your form for now.`, 'INFO');
    }
}

// ────────────────────────────────────────────────────────────────────────
// CONVERSATIONAL AI SESSION
// ────────────────────────────────────────────────────────────────────────

async function startConversationalSession() {
    try {
        // Request microphone access
        await navigator.mediaDevices.getUserMedia({ audio: true });

        updateCoachStatus('connecting');

        // Build client tools that expose form data to the agent
        const clientTools = buildClientTools();

        // Start the conversational session
        conversation = await Conversation.startSession({
            agentId: agentId,
            connectionType: 'websocket',
            clientTools,
            onConnect: () => {
                isConnected = true;
                updateCoachStatus('connected');
                console.log('[TechnIQ] Conversational AI connected');
            },
            onDisconnect: () => {
                isConnected = false;
                updateCoachStatus('disconnected');
                console.log('[TechnIQ] Conversational AI disconnected');
            },
            onMessage: (message) => {
                // Agent is speaking or has spoken
                if (message.type === 'audio' || message.source === 'ai') {
                    showVoiceIndicator(true);
                    isSpeaking = true;
                }
            },
            onStatusChange: (status) => {
                if (status.status === 'speaking') {
                    isSpeaking = true;
                    showVoiceIndicator(true);
                } else if (status.status === 'listening') {
                    isSpeaking = false;
                    showVoiceIndicator(false);
                }
            },
            onError: (error) => {
                console.error('[TechnIQ] Conversational AI error:', error);
                // Fall back to legacy mode
                isConnected = false;
                conversation = null;
                updateCoachStatus('fallback');
                startProactiveCoaching();
            },
        });

        // Start periodic context updates
        startContextUpdates();

    } catch (error) {
        console.error('[TechnIQ] Failed to start conversational session:', error);
        updateCoachStatus('fallback');
        startProactiveCoaching();
    }
}

/**
 * Build client tools that the ElevenLabs agent can call to get form data.
 * These must also be registered in the ElevenLabs dashboard agent config.
 */
function buildClientTools() {
    return {
        getFormScore: {
            description: 'Get the current real-time form score (0-100)',
            parameters: {},
            handler: async () => {
                return JSON.stringify({
                    formScore: currentFormState.formScore,
                    exercise: currentFormState.exercise,
                    repCount: currentFormState.repCount,
                });
            },
        },

        getCurrentAlerts: {
            description: 'Get active form alerts/warnings detected by the pose engine',
            parameters: {},
            handler: async () => {
                const alerts = currentFormState.alerts
                    .filter(c => c.severity === 'danger' || c.severity === 'warning')
                    .map(c => ({ id: c.id, message: c.message, severity: c.severity, score: c.score }));
                return JSON.stringify({ alerts, count: alerts.length });
            },
        },

        getRootCause: {
            description: 'Get kinetic chain root cause analysis for current form issues',
            parameters: {},
            handler: async () => {
                return JSON.stringify({
                    rootCauses: currentFormState.rootCauses.map(r => ({
                        symptom: r.symptom,
                        rootCause: r.rootCause,
                        corrective: r.corrective,
                        chain: r.chain,
                    })),
                });
            },
        },

        getFatigueData: {
            description: 'Get fatigue curve prediction data — predicts which rep hits injury risk',
            parameters: {},
            handler: async () => {
                const fd = currentFormState.fatigueData;
                return JSON.stringify({
                    degradationPct: fd?.degradationPct || 0,
                    predictedInjuryRep: fd?.predictedInjuryRep || null,
                    repCount: currentFormState.repCount,
                });
            },
        },

        getAsymmetry: {
            description: 'Get bilateral asymmetry data comparing left vs right side',
            parameters: {},
            handler: async () => {
                return JSON.stringify({
                    asymmetries: currentFormState.asymmetries.map(a => ({
                        name: a.name,
                        asymmetryPct: a.asymmetryPct,
                        direction: a.direction,
                        severity: a.severity,
                    })),
                });
            },
        },

        logCheckIn: {
            description: 'Log a daily check-in with mood, soreness, energy, and sleep data',
            parameters: {
                type: 'object',
                properties: {
                    mood: { type: 'string', description: 'User mood: great, good, okay, tired, bad' },
                    soreness: { type: 'string', description: 'Soreness areas described by user' },
                    energy: { type: 'number', description: 'Energy level 1-10' },
                    sleep: { type: 'string', description: 'Sleep quality: good, fair, poor' },
                },
            },
            handler: async ({ mood, soreness, energy, sleep }) => {
                // Dispatch a custom event for the check-in page to handle
                window.dispatchEvent(new CustomEvent('formcoach:checkin', {
                    detail: { mood, soreness, energy, sleep, timestamp: new Date().toISOString() },
                }));
                console.log('[TechnIQ] Check-in logged:', { mood, soreness, energy, sleep });
                return JSON.stringify({ success: true, message: 'Check-in recorded' });
            },
        },
    };
}

/**
 * Periodically send form analysis context to the agent so it can
 * proactively coach without waiting for the user to speak.
 */
function startContextUpdates() {
    contextUpdateInterval = setInterval(() => {
        if (isConnected && conversation) {
            sendContextToAgent();
        }
    }, CONTEXT_UPDATE_INTERVAL_MS);
}

function sendContextToAgent() {
    if (!conversation || !isConnected) return;

    const now = Date.now();
    if (now - lastProactiveSpeakTime < PROACTIVE_INTERVAL_MS) return;
    lastProactiveSpeakTime = now;

    // Build a concise context string
    const dangerAlerts = currentFormState.alerts.filter(c => c.severity === 'danger');
    const warningAlerts = currentFormState.alerts.filter(c => c.severity === 'warning');

    let context = `[FORM UPDATE] Exercise: ${currentFormState.exercise} | Rep: ${currentFormState.repCount} | Score: ${currentFormState.formScore}/100`;

    if (dangerAlerts.length > 0) {
        context += ` | ⚠️ DANGER: ${dangerAlerts.map(a => a.message).join('; ')}`;
    }
    if (warningAlerts.length > 0) {
        context += ` | Warning: ${warningAlerts.map(a => a.message).join('; ')}`;
    }
    if (currentFormState.rootCauses.length > 0) {
        const rc = currentFormState.rootCauses[0];
        context += ` | Root cause: ${rc.rootCause} → ${rc.corrective}`;
    }
    if (currentFormState.fatigueData?.predictedInjuryRep) {
        context += ` | Fatigue: injury predicted at rep ${currentFormState.fatigueData.predictedInjuryRep}`;
    }

    try {
        conversation.sendMessage({ text: context });
    } catch (e) {
        // Silent fail — context updates are best-effort
    }
}

// ────────────────────────────────────────────────────────────────────────
// PROACTIVE COACHING (legacy TTS fallback)
// ────────────────────────────────────────────────────────────────────────

function startProactiveCoaching() {
    // No-op if conversational mode is active
    if (isConnected) return;
}

function stopProactiveCoaching() {
    if (proactiveInterval) clearInterval(proactiveInterval);
    if (contextUpdateInterval) clearInterval(contextUpdateInterval);
    proactiveInterval = null;
    contextUpdateInterval = null;
}

// ────────────────────────────────────────────────────────────────────────
// LEGACY TTS SYSTEM (fallback when no Agent ID)
// ────────────────────────────────────────────────────────────────────────

function generateLegacyCues(checks, chainResults, fatigueData, repData) {
    const dangerChecks = checks.filter(c => c.severity === 'danger');
    if (dangerChecks.length > 0) {
        const check = dangerChecks[0];
        const chain = chainResults.find(r => r.symptom.toLowerCase().includes(check.id.replace('_', ' ')));
        if (chain) {
            legacyQueueCue(`${check.message}. Root cause: ${chain.rootCause}. ${chain.corrective}.`, 'CRITICAL');
        } else {
            legacyQueueCue(check.message, 'CRITICAL');
        }
        return;
    }

    if (fatigueData && fatigueData.predictedInjuryRep !== null && repData.repCompleted) {
        legacyQueueCue(
            `Form degrading. I predict injury risk at rep ${fatigueData.predictedInjuryRep}. Consider stopping after rep ${fatigueData.predictedInjuryRep - 1}.`,
            'CRITICAL'
        );
        return;
    }

    const warningChecks = checks.filter(c => c.severity === 'warning');
    if (warningChecks.length > 0 && repData.repCompleted) {
        legacyQueueCue(warningChecks[0].message, 'FORM');
        return;
    }

    if (repData.repCompleted) {
        if (repData.repScore > 85) {
            legacyQueueCue(`Good rep. Form score ${repData.repScore}.`, 'ENCOURAGE');
        } else if (repData.repScore > 65) {
            legacyQueueCue(`Rep ${repData.repNumber} complete. Watch your form.`, 'ENCOURAGE');
        }
    }
}

function legacyQueueCue(text, priority = 'FORM') {
    const pVal = PRIORITY[priority] || 0;
    legacyVoiceQueue = legacyVoiceQueue.filter(q => q.priority >= pVal);
    legacyVoiceQueue.push({ text, priority: pVal });
    legacyProcessQueue();
}

async function legacyProcessQueue() {
    if (legacyIsSpeaking || legacyVoiceQueue.length === 0) return;

    const now = Date.now();
    if (now - legacyLastSpeakTime < LEGACY_MIN_INTERVAL_MS) return;

    legacyVoiceQueue.sort((a, b) => b.priority - a.priority);
    const cue = legacyVoiceQueue.shift();
    await legacySpeak(cue.text);
}

async function legacySpeak(text) {
    if (!apiKey) {
        legacyFallbackSpeak(text);
        return;
    }

    legacyIsSpeaking = true;
    legacyLastSpeakTime = Date.now();
    showVoiceIndicator(true);

    try {
        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    model_id: 'eleven_turbo_v2_5',
                    voice_settings: {
                        stability: 0.6,
                        similarity_boost: 0.75,
                        speed: 1.1,
                    },
                }),
            }
        );

        if (!response.ok) {
            console.warn('[Voice] ElevenLabs API error, falling back to browser TTS');
            legacyFallbackSpeak(text);
            return;
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.onended = () => {
            legacyIsSpeaking = false;
            showVoiceIndicator(false);
            URL.revokeObjectURL(audioUrl);
            setTimeout(legacyProcessQueue, 500);
        };

        audio.onerror = () => {
            legacyIsSpeaking = false;
            showVoiceIndicator(false);
        };

        await audio.play();
    } catch (e) {
        console.warn('[Voice] Error:', e.message);
        legacyIsSpeaking = false;
        showVoiceIndicator(false);
        legacyFallbackSpeak(text);
    }
}

function legacyFallbackSpeak(text) {
    legacyIsSpeaking = true;
    legacyLastSpeakTime = Date.now();
    showVoiceIndicator(true);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 0.95;
    utterance.onend = () => {
        legacyIsSpeaking = false;
        showVoiceIndicator(false);
        setTimeout(legacyProcessQueue, 500);
    };
    speechSynthesis.speak(utterance);
}

// ────────────────────────────────────────────────────────────────────────
// UI HELPERS
// ────────────────────────────────────────────────────────────────────────

function showVoiceIndicator(show) {
    const el = document.getElementById('voice-indicator');
    if (el) el.classList.toggle('hidden', !show);
}

function updateCoachStatus(status) {
    const el = document.getElementById('coach-status');
    if (!el) return;

    const labels = {
        connecting: '🔄 Connecting to AI coach...',
        connected: '🟢 AI Coach Active — Listening',
        disconnected: '⚫ Coach Disconnected',
        fallback: '🟡 Voice-only mode (no conversation)',
    };

    el.textContent = labels[status] || status;
    el.className = `coach-status coach-status--${status}`;
}

function updateMuteUI(muted) {
    const el = document.getElementById('mute-btn');
    if (!el) return;
    el.textContent = muted ? '🔇 Unmute' : '🎤 Mute';
    el.classList.toggle('muted', muted);
}
