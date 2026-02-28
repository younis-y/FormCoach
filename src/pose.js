/**
 * FormCoach AI — Pose Detection Module
 * Uses MediaPipe PoseLandmarker (Vision Tasks) for real-time pose estimation.
 * Loaded from CDN — runs entirely client-side via WASM + WebGL.
 */

// MediaPipe Vision Tasks CDN
const VISION_TASKS_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';

let poseLandmarker = null;
let lastTimestamp = -1;

/**
 * Initialize the PoseLandmarker.
 * Must be called before detect().
 */
export async function initPose() {
    const { PoseLandmarker, FilesetResolver } = await import(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/+esm'
    );

    const vision = await FilesetResolver.forVisionTasks(VISION_TASKS_URL);

    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
    });

    console.log('[FormCoach] PoseLandmarker initialized');
    return poseLandmarker;
}

/**
 * Detect pose landmarks from a video frame.
 * @param {HTMLVideoElement} video
 * @returns {{ landmarks: Array, worldLandmarks: Array } | null}
 */
export function detect(video) {
    if (!poseLandmarker) return null;

    const timestamp = performance.now();
    if (timestamp === lastTimestamp) return null;
    lastTimestamp = timestamp;

    try {
        const results = poseLandmarker.detectForVideo(video, timestamp);
        if (results.landmarks && results.landmarks.length > 0) {
            return {
                landmarks: results.landmarks[0],
                worldLandmarks: results.worldLandmarks?.[0] || null,
            };
        }
    } catch (e) {
        // Silently skip frame errors
    }

    return null;
}

/**
 * MediaPipe landmark indices for convenience.
 */
export const LANDMARKS = {
    NOSE: 0,
    LEFT_EYE_INNER: 1,
    LEFT_EYE: 2,
    LEFT_EYE_OUTER: 3,
    RIGHT_EYE_INNER: 4,
    RIGHT_EYE: 5,
    RIGHT_EYE_OUTER: 6,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    MOUTH_LEFT: 9,
    MOUTH_RIGHT: 10,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    LEFT_PINKY: 17,
    RIGHT_PINKY: 18,
    LEFT_INDEX: 19,
    RIGHT_INDEX: 20,
    LEFT_THUMB: 21,
    RIGHT_THUMB: 22,
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
    LEFT_HEEL: 29,
    RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31,
    RIGHT_FOOT_INDEX: 32,
};

/**
 * Skeleton connections for drawing.
 */
export const CONNECTIONS = [
    // Torso
    [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER],
    [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_HIP],
    [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_HIP],
    [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
    // Left arm
    [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW],
    [LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_WRIST],
    // Right arm
    [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW],
    [LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_WRIST],
    // Left leg
    [LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE],
    [LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE],
    // Right leg
    [LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE],
    [LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE],
];
