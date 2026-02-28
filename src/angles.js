/**
 * TechnIQ AI — Joint Angle Calculations
 * All angle math uses atan2 for robustness.
 */

/**
 * Calculate the angle (in degrees) at point B, formed by points A→B→C.
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @param {{ x: number, y: number }} c
 * @returns {number} Angle in degrees (0–180)
 */
export function calculateAngle(a, b, c) {
    const radians =
        Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180) / Math.PI);
    if (angle > 180) angle = 360 - angle;
    return angle;
}

/**
 * Calculate the horizontal displacement between two points (X-axis).
 * Positive = second point is to the right.
 */
export function horizontalDisplacement(a, b) {
    return b.x - a.x;
}

/**
 * Calculate the vertical displacement between two points (Y-axis).
 * In MediaPipe, Y increases downward.
 */
export function verticalDisplacement(a, b) {
    return b.y - a.y;
}

/**
 * Calculate the angle of a segment from vertical (0 = perfectly upright).
 * @param {{ x: number, y: number }} top
 * @param {{ x: number, y: number }} bottom
 * @returns {number} Angle in degrees from vertical
 */
export function angleFromVertical(top, bottom) {
    const dx = bottom.x - top.x;
    const dy = bottom.y - top.y;
    const angle = Math.abs(Math.atan2(dx, dy) * (180 / Math.PI));
    return angle;
}

/**
 * Midpoint between two landmarks.
 */
export function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Distance between two landmarks (normalized coordinates).
 */
export function distance(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
