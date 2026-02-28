/**
 * FormCoach AI — Exercise Definitions & Biomechanics Rules
 * Each exercise defines form checks that return alerts with severity.
 */

import { calculateAngle, angleFromVertical, midpoint, distance } from './angles.js';
import { LANDMARKS } from './pose.js';

/**
 * @typedef {Object} FormCheck
 * @property {string} id - Unique check identifier
 * @property {string} name - Human-readable name
 * @property {'danger'|'warning'|'success'} severity
 * @property {string} message - Alert message
 * @property {number} score - 0 (worst) to 100 (perfect) for this check
 * @property {string[]} affectedJoints - Landmark indices that should be highlighted
 */

/**
 * Analyse squat form from a single frame of landmarks.
 * @param {Array} lm - MediaPipe landmarks (33 points, normalized coords)
 * @returns {{ checks: FormCheck[], overallScore: number, phase: string, jointAngles: Object }}
 */
export function analyseSquat(lm) {
    const checks = [];

    // Key joint angles
    const leftKneeAngle = calculateAngle(lm[LANDMARKS.LEFT_HIP], lm[LANDMARKS.LEFT_KNEE], lm[LANDMARKS.LEFT_ANKLE]);
    const rightKneeAngle = calculateAngle(lm[LANDMARKS.RIGHT_HIP], lm[LANDMARKS.RIGHT_KNEE], lm[LANDMARKS.RIGHT_ANKLE]);
    const leftHipAngle = calculateAngle(lm[LANDMARKS.LEFT_SHOULDER], lm[LANDMARKS.LEFT_HIP], lm[LANDMARKS.LEFT_KNEE]);
    const rightHipAngle = calculateAngle(lm[LANDMARKS.RIGHT_SHOULDER], lm[LANDMARKS.RIGHT_HIP], lm[LANDMARKS.RIGHT_KNEE]);

    const avgKneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
    const avgHipAngle = (leftHipAngle + rightHipAngle) / 2;

    // Determine squat phase based on knee angle
    let phase = 'standing';
    if (avgKneeAngle < 100) phase = 'bottom';
    else if (avgKneeAngle < 150) phase = 'descending';

    // Torso lean angle
    const midShoulder = midpoint(lm[LANDMARKS.LEFT_SHOULDER], lm[LANDMARKS.RIGHT_SHOULDER]);
    const midHip = midpoint(lm[LANDMARKS.LEFT_HIP], lm[LANDMARKS.RIGHT_HIP]);
    const torsoLean = angleFromVertical(midShoulder, midHip);

    // ----- CHECK 1: Knee Valgus (Caving Inward) -----
    const leftKnee = lm[LANDMARKS.LEFT_KNEE];
    const leftAnkle = lm[LANDMARKS.LEFT_ANKLE];
    const leftHip = lm[LANDMARKS.LEFT_HIP];
    const rightKnee = lm[LANDMARKS.RIGHT_KNEE];
    const rightAnkle = lm[LANDMARKS.RIGHT_ANKLE];
    const rightHip = lm[LANDMARKS.RIGHT_HIP];

    // Knee should track over ankle — check if knee collapses inward
    const leftKneeValgus = (leftKnee.x - leftAnkle.x) > 0.03; // left knee too far inward (left side of body)
    const rightKneeValgus = (rightAnkle.x - rightKnee.x) > 0.03; // right knee too far inward
    const kneeValgus = leftKneeValgus || rightKneeValgus;

    if (kneeValgus && phase !== 'standing') {
        checks.push({
            id: 'knee_valgus',
            name: 'Knee Valgus',
            severity: 'danger',
            message: 'Knees caving inward — injury risk!',
            score: 30,
            affectedJoints: [LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE],
        });
    } else if (phase !== 'standing') {
        checks.push({
            id: 'knee_valgus',
            name: 'Knee Tracking',
            severity: 'success',
            message: 'Knees tracking well over ankles',
            score: 100,
            affectedJoints: [LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE],
        });
    }

    // ----- CHECK 2: Squat Depth -----
    if (phase === 'bottom' || phase === 'descending') {
        const depthScore = avgKneeAngle < 90 ? 100 : Math.max(0, 100 - (avgKneeAngle - 90) * 2);
        checks.push({
            id: 'depth',
            name: 'Squat Depth',
            severity: avgKneeAngle < 100 ? 'success' : 'warning',
            message: avgKneeAngle < 100 ? 'Good depth — hip crease below knee' : 'Go deeper for full range of motion',
            score: depthScore,
            affectedJoints: [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
        });
    }

    // ----- CHECK 3: Forward Lean -----
    if (phase !== 'standing') {
        const leanScore = torsoLean < 30 ? 100 : torsoLean < 45 ? 70 : 30;
        checks.push({
            id: 'forward_lean',
            name: 'Torso Position',
            severity: torsoLean > 45 ? 'danger' : torsoLean > 30 ? 'warning' : 'success',
            message: torsoLean > 45
                ? 'Excessive forward lean — back injury risk'
                : torsoLean > 30
                    ? 'Slight forward lean — engage core more'
                    : 'Good torso position',
            score: leanScore,
            affectedJoints: [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER],
        });
    }

    // ----- CHECK 4: Asymmetric Descent -----
    const kneeAngleDiff = Math.abs(leftKneeAngle - rightKneeAngle);
    if (phase !== 'standing' && kneeAngleDiff > 12) {
        checks.push({
            id: 'asymmetric',
            name: 'Asymmetric Squat',
            severity: 'warning',
            message: `Uneven descent — ${kneeAngleDiff.toFixed(0)}° difference between sides`,
            score: Math.max(0, 100 - kneeAngleDiff * 3),
            affectedJoints: kneeAngleDiff > 0
                ? [LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE]
                : [],
        });
    }

    // Overall score
    const activeChecks = checks.filter(c => c.id !== 'depth' || phase === 'bottom');
    const overallScore = activeChecks.length > 0
        ? Math.round(activeChecks.reduce((sum, c) => sum + c.score, 0) / activeChecks.length)
        : 100;

    return {
        checks,
        overallScore,
        phase,
        jointAngles: {
            leftKnee: leftKneeAngle,
            rightKnee: rightKneeAngle,
            leftHip: leftHipAngle,
            rightHip: rightHipAngle,
            torsoLean,
            kneeAngleDiff,
        },
    };
}

/**
 * Analyse push-up form.
 */
export function analysePushup(lm) {
    const checks = [];

    const leftElbowAngle = calculateAngle(lm[LANDMARKS.LEFT_SHOULDER], lm[LANDMARKS.LEFT_ELBOW], lm[LANDMARKS.LEFT_WRIST]);
    const rightElbowAngle = calculateAngle(lm[LANDMARKS.RIGHT_SHOULDER], lm[LANDMARKS.RIGHT_ELBOW], lm[LANDMARKS.RIGHT_WRIST]);
    const avgElbowAngle = (leftElbowAngle + rightElbowAngle) / 2;

    // Phase
    let phase = 'up';
    if (avgElbowAngle < 100) phase = 'bottom';
    else if (avgElbowAngle < 150) phase = 'descending';

    // Shoulder-Hip-Ankle alignment (hip sag / pike)
    const midShoulder = midpoint(lm[LANDMARKS.LEFT_SHOULDER], lm[LANDMARKS.RIGHT_SHOULDER]);
    const midHip = midpoint(lm[LANDMARKS.LEFT_HIP], lm[LANDMARKS.RIGHT_HIP]);
    const midAnkle = midpoint(lm[LANDMARKS.LEFT_ANKLE], lm[LANDMARKS.RIGHT_ANKLE]);
    const bodyLineAngle = calculateAngle(midShoulder, midHip, midAnkle);

    // CHECK 1: Hip Sag
    if (bodyLineAngle < 160) {
        const sagOrPike = midHip.y > midpoint(midShoulder, midAnkle).y ? 'sag' : 'pike';
        checks.push({
            id: 'hip_sag',
            name: sagOrPike === 'sag' ? 'Hip Sag' : 'Hip Pike',
            severity: bodyLineAngle < 145 ? 'danger' : 'warning',
            message: sagOrPike === 'sag'
                ? 'Hips dropping — engage your core!'
                : 'Hips too high — lower them into a straight line',
            score: Math.max(0, (bodyLineAngle - 120) * 2.5),
            affectedJoints: [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
        });
    } else {
        checks.push({
            id: 'hip_sag',
            name: 'Body Line',
            severity: 'success',
            message: 'Good body alignment — straight line from head to heels',
            score: 100,
            affectedJoints: [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
        });
    }

    // CHECK 2: Elbow Flare
    // Measure how far elbows go outward from the torso
    const leftElbowFlare = Math.abs(lm[LANDMARKS.LEFT_ELBOW].x - lm[LANDMARKS.LEFT_SHOULDER].x);
    const rightElbowFlare = Math.abs(lm[LANDMARKS.RIGHT_ELBOW].x - lm[LANDMARKS.RIGHT_SHOULDER].x);
    const avgFlare = (leftElbowFlare + rightElbowFlare) / 2;

    if (phase !== 'up' && avgFlare > 0.12) {
        checks.push({
            id: 'elbow_flare',
            name: 'Elbow Flare',
            severity: avgFlare > 0.18 ? 'danger' : 'warning',
            message: 'Elbows flaring out — shoulder injury risk',
            score: Math.max(0, 100 - (avgFlare - 0.12) * 500),
            affectedJoints: [LANDMARKS.LEFT_ELBOW, LANDMARKS.RIGHT_ELBOW],
        });
    }

    // CHECK 3: Depth
    if (phase === 'bottom' || phase === 'descending') {
        const depthScore = avgElbowAngle < 95 ? 100 : Math.max(0, 100 - (avgElbowAngle - 95) * 2.5);
        checks.push({
            id: 'depth',
            name: 'Push-up Depth',
            severity: avgElbowAngle < 100 ? 'success' : 'warning',
            message: avgElbowAngle < 100 ? 'Full range of motion' : 'Go deeper for better activation',
            score: depthScore,
            affectedJoints: [LANDMARKS.LEFT_ELBOW, LANDMARKS.RIGHT_ELBOW],
        });
    }

    const activeChecks = checks.filter(c => c.score !== undefined);
    const overallScore = activeChecks.length > 0
        ? Math.round(activeChecks.reduce((sum, c) => sum + c.score, 0) / activeChecks.length)
        : 100;

    return {
        checks,
        overallScore,
        phase,
        jointAngles: {
            leftElbow: leftElbowAngle,
            rightElbow: rightElbowAngle,
            bodyLine: bodyLineAngle,
            elbowFlare: avgFlare,
        },
    };
}

/**
 * Route to correct exercise analyser.
 */
export function analyseForm(exercise, landmarks) {
    if (exercise === 'squat') return analyseSquat(landmarks);
    if (exercise === 'pushup') return analysePushup(landmarks);
    return { checks: [], overallScore: 100, phase: 'standing', jointAngles: {} };
}
