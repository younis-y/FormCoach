/**
 * FormCoach AI — ElevenLabs Voice Coaching
 * Throttled voice queue with priority system.
 * Uses the ElevenLabs TTS API for natural-sounding coaching.
 */

const ELEVENLABS_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // "George" — clear, authoritative
const MIN_INTERVAL_MS = 4500; // Don't speak more than once every 4.5 seconds

let apiKey = '';
let lastSpeakTime = 0;
let isSpeaking = false;
let voiceQueue = [];

/**
 * Initialise the voice module with an ElevenLabs API key.
 */
export function initVoice(key) {
    apiKey = key;
    console.log('[FormCoach] Voice coaching initialised');
}

/**
 * Priority levels for voice cues.
 */
const PRIORITY = {
    CRITICAL: 3,  // Injury risk
    FORM: 2,      // Form correction
    ENCOURAGE: 1, // Encouragement
    INFO: 0,      // General info
};

/**
 * Queue a voice cue. Higher priority cues replace lower ones.
 * @param {string} text - Text to speak
 * @param {'CRITICAL'|'FORM'|'ENCOURAGE'|'INFO'} priority
 */
export function queueVoiceCue(text, priority = 'FORM') {
    const pVal = PRIORITY[priority] || 0;

    // Replace lower priority items in the queue
    voiceQueue = voiceQueue.filter(q => q.priority >= pVal);
    voiceQueue.push({ text, priority: pVal });

    // Try to speak immediately
    processQueue();
}

async function processQueue() {
    if (isSpeaking || voiceQueue.length === 0) return;

    const now = Date.now();
    if (now - lastSpeakTime < MIN_INTERVAL_MS) return;

    // Pick highest priority item
    voiceQueue.sort((a, b) => b.priority - a.priority);
    const cue = voiceQueue.shift();

    await speak(cue.text);
}

async function speak(text) {
    if (!apiKey) {
        // Fallback to browser TTS if no API key
        fallbackSpeak(text);
        return;
    }

    isSpeaking = true;
    lastSpeakTime = Date.now();
    showVoiceIndicator(true);

    try {
        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
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
            fallbackSpeak(text);
            return;
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.onended = () => {
            isSpeaking = false;
            showVoiceIndicator(false);
            URL.revokeObjectURL(audioUrl);
            // Process next item in queue
            setTimeout(processQueue, 500);
        };

        audio.onerror = () => {
            isSpeaking = false;
            showVoiceIndicator(false);
        };

        await audio.play();
    } catch (e) {
        console.warn('[Voice] Error:', e.message);
        isSpeaking = false;
        showVoiceIndicator(false);
        fallbackSpeak(text);
    }
}

function fallbackSpeak(text) {
    isSpeaking = true;
    lastSpeakTime = Date.now();
    showVoiceIndicator(true);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 0.95;
    utterance.onend = () => {
        isSpeaking = false;
        showVoiceIndicator(false);
        setTimeout(processQueue, 500);
    };
    speechSynthesis.speak(utterance);
}

function showVoiceIndicator(show) {
    const el = document.getElementById('voice-indicator');
    if (el) {
        el.classList.toggle('hidden', !show);
    }
}

/**
 * Generate voice cues based on form analysis results.
 */
export function generateFormCues(checks, chainResults, fatigueData, repData) {
    // Priority 1: Injury-level form issues
    const dangerChecks = checks.filter(c => c.severity === 'danger');
    if (dangerChecks.length > 0) {
        const check = dangerChecks[0];
        // Find root cause if available
        const chain = chainResults.find(r => r.symptom.toLowerCase().includes(check.id.replace('_', ' ')));
        if (chain) {
            queueVoiceCue(`${check.message}. Root cause: ${chain.rootCause}. ${chain.corrective}.`, 'CRITICAL');
        } else {
            queueVoiceCue(check.message, 'CRITICAL');
        }
        return;
    }

    // Priority 2: Fatigue prediction warning
    if (fatigueData && fatigueData.predictedInjuryRep !== null && repData.repCompleted) {
        queueVoiceCue(
            `Form degrading. I predict injury risk at rep ${fatigueData.predictedInjuryRep}. Consider stopping after rep ${fatigueData.predictedInjuryRep - 1}.`,
            'CRITICAL'
        );
        return;
    }

    // Priority 3: Form corrections
    const warningChecks = checks.filter(c => c.severity === 'warning');
    if (warningChecks.length > 0 && repData.repCompleted) {
        queueVoiceCue(warningChecks[0].message, 'FORM');
        return;
    }

    // Priority 4: Rep completion encouragement
    if (repData.repCompleted) {
        if (repData.repScore > 85) {
            queueVoiceCue(`Good rep. Form score ${repData.repScore}.`, 'ENCOURAGE');
        } else if (repData.repScore > 65) {
            queueVoiceCue(`Rep ${repData.repNumber} complete. Watch your form.`, 'ENCOURAGE');
        }
    }
}
