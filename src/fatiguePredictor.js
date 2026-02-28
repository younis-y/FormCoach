/**
 * FormCoach AI — Fatigue Predictor
 * Fits a polynomial to per-rep form scores and predicts
 * the "injury rep" — when form will cross the danger threshold.
 * This is the second core novelty feature.
 */

const INJURY_THRESHOLD = 55; // Form score below this = injury risk

/**
 * Predict the rep at which form will cross the injury threshold.
 * Uses simple quadratic regression (least squares).
 *
 * @param {number[]} repScores - Array of form scores per rep
 * @returns {{ predictedInjuryRep: number|null, trend: 'stable'|'declining'|'critical', degradationPct: number, trendLine: number[] }}
 */
export function predictFatigue(repScores) {
    if (repScores.length < 2) {
        return {
            predictedInjuryRep: null,
            trend: 'stable',
            degradationPct: 0,
            trendLine: [...repScores],
        };
    }

    // Calculate degradation percentage (first rep vs latest)
    const first = repScores[0];
    const last = repScores[repScores.length - 1];
    const degradationPct = first > 0 ? Math.round(((first - last) / first) * 100) : 0;

    // Determine trend
    let trend = 'stable';
    if (degradationPct > 20) trend = 'critical';
    else if (degradationPct > 8) trend = 'declining';

    // Fit a linear regression (simple and robust for few data points)
    const n = repScores.length;
    const xs = repScores.map((_, i) => i + 1);

    // y = mx + b
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = repScores.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((sum, x, i) => sum + x * repScores[i], 0);
    const sumX2 = xs.reduce((sum, x) => sum + x * x, 0);

    const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const b = (sumY - m * sumX) / n;

    // Generate trend line
    const trendLine = xs.map(x => Math.round(m * x + b));

    // Predict injury rep: solve m*x + b = INJURY_THRESHOLD
    let predictedInjuryRep = null;
    if (m < -0.5) {
        // Form is declining
        const injuryX = (INJURY_THRESHOLD - b) / m;
        if (injuryX > n && injuryX < n + 20) {
            predictedInjuryRep = Math.ceil(injuryX);
        } else if (injuryX <= n) {
            predictedInjuryRep = n; // Already at/past injury threshold
        }
    }

    return {
        predictedInjuryRep,
        trend,
        degradationPct,
        trendLine,
        slope: m,
    };
}
