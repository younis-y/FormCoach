/**
 * FormCoach AI — Canvas Renderer
 * Draws skeleton overlay with colour-coded joint risk heatmap.
 */

import { CONNECTIONS, LANDMARKS } from './pose.js';

const COLORS = {
    success: '#00e676',
    warning: '#ffab40',
    danger: '#ff5252',
    default: '#6c5ce7',
    bone: 'rgba(108, 92, 231, 0.6)',
};

/**
 * Render the pose skeleton and risk heatmap on the canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} landmarks - MediaPipe normalised landmarks
 * @param {Array} checks - Form checks with affectedJoints and severity
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
export function renderPose(ctx, landmarks, checks, width, height) {
    ctx.clearRect(0, 0, width, height);

    if (!landmarks || landmarks.length === 0) return;

    // Build joint severity map
    const jointSeverity = {};
    for (const check of checks) {
        if (!check.affectedJoints) continue;
        for (const jointIdx of check.affectedJoints) {
            // Keep the worst severity
            if (!jointSeverity[jointIdx] || severityRank(check.severity) > severityRank(jointSeverity[jointIdx])) {
                jointSeverity[jointIdx] = check.severity;
            }
        }
    }

    // Draw connections (bones)
    for (const [startIdx, endIdx] of CONNECTIONS) {
        const start = landmarks[startIdx];
        const end = landmarks[endIdx];
        if (!start || !end) continue;

        // Color the bone based on connected joints
        const startSev = jointSeverity[startIdx];
        const endSev = jointSeverity[endIdx];
        const boneSev = severityRank(startSev) > severityRank(endSev) ? startSev : endSev;

        ctx.beginPath();
        ctx.moveTo(start.x * width, start.y * height);
        ctx.lineTo(end.x * width, end.y * height);
        ctx.strokeStyle = boneSev ? COLORS[boneSev] : COLORS.bone;
        ctx.lineWidth = boneSev && boneSev !== 'success' ? 4 : 3;
        ctx.lineCap = 'round';
        ctx.globalAlpha = boneSev && boneSev !== 'success' ? 1 : 0.7;
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // Draw joints
    const BODY_JOINTS = [
        LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER,
        LANDMARKS.LEFT_ELBOW, LANDMARKS.RIGHT_ELBOW,
        LANDMARKS.LEFT_WRIST, LANDMARKS.RIGHT_WRIST,
        LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP,
        LANDMARKS.LEFT_KNEE, LANDMARKS.RIGHT_KNEE,
        LANDMARKS.LEFT_ANKLE, LANDMARKS.RIGHT_ANKLE,
    ];

    for (const idx of BODY_JOINTS) {
        const lm = landmarks[idx];
        if (!lm) continue;

        const x = lm.x * width;
        const y = lm.y * height;
        const sev = jointSeverity[idx];
        const color = sev ? COLORS[sev] : COLORS.default;
        const radius = sev && sev !== 'success' ? 9 : 6;

        // Glow effect for problem joints
        if (sev === 'danger' || sev === 'warning') {
            ctx.beginPath();
            ctx.arc(x, y, radius + 8, 0, 2 * Math.PI);
            ctx.fillStyle = sev === 'danger' ? 'rgba(255,82,82,0.25)' : 'rgba(255,171,64,0.2)';
            ctx.fill();
        }

        // Joint circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();

        // White inner dot
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff';
        ctx.fill();
    }
}

function severityRank(sev) {
    if (sev === 'danger') return 3;
    if (sev === 'warning') return 2;
    if (sev === 'success') return 1;
    return 0;
}
