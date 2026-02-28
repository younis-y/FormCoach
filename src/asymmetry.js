/**
 * TechnIQ AI — Bilateral Asymmetry Detection
 * Compares left vs right side landmarks to detect muscle imbalances.
 * Core novelty feature #3.
 */

import { LANDMARKS } from './pose.js';

/**
 * Symmetric landmark pairs to compare.
 */
const SYMMETRIC_PAIRS = [
    {
        name: 'Shoulder',
        left: LANDMARKS.LEFT_SHOULDER,
        right: LANDMARKS.RIGHT_SHOULDER,
        threshold: 0.03,
        concern: 'Possible rotator cuff imbalance or scoliotic tendency',
    },
    {
        name: 'Hip',
        left: LANDMARKS.LEFT_HIP,
        right: LANDMARKS.RIGHT_HIP,
        threshold: 0.025,
        concern: 'Pelvic tilt — possible unilateral glute or hip flexor tightness',
    },
    {
        name: 'Knee',
        left: LANDMARKS.LEFT_KNEE,
        right: LANDMARKS.RIGHT_KNEE,
        threshold: 0.035,
        concern: 'Uneven load distribution — risk of unilateral knee injury',
    },
    {
        name: 'Ankle',
        left: LANDMARKS.LEFT_ANKLE,
        right: LANDMARKS.RIGHT_ANKLE,
        threshold: 0.03,
        concern: 'Ankle mobility asymmetry — may cause compensatory movement upstream',
    },
];

/**
 * Analyse bilateral asymmetry from landmarks.
 * @param {Array} landmarks - MediaPipe landmarks
 * @returns {Array<{ name: string, asymmetryPct: number, direction: string, concern: string, severity: 'normal'|'mild'|'significant' }>}
 */
export function detectAsymmetry(landmarks) {
    const results = [];

    for (const pair of SYMMETRIC_PAIRS) {
        const left = landmarks[pair.left];
        const right = landmarks[pair.right];

        // Compare Y position (vertical asymmetry — the most clinically relevant)
        const yDiff = left.y - right.y;
        const absYDiff = Math.abs(yDiff);

        // Normalise as a percentage of the body height (nose to ankle)
        const bodyHeight = Math.abs(landmarks[LANDMARKS.NOSE].y - landmarks[LANDMARKS.LEFT_ANKLE].y);
        const asymmetryPct = bodyHeight > 0 ? Math.round((absYDiff / bodyHeight) * 100) : 0;

        const direction = yDiff > 0 ? 'Left side lower' : 'Right side lower';

        let severity = 'normal';
        if (absYDiff > pair.threshold * 2) severity = 'significant';
        else if (absYDiff > pair.threshold) severity = 'mild';

        results.push({
            name: pair.name,
            asymmetryPct,
            direction,
            concern: pair.concern,
            severity,
            rawDiff: absYDiff,
        });
    }

    return results;
}
