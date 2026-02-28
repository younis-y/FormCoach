/**
 * FormCoach AI — Kinetic Chain Root-Cause Analysis
 * Maps symptoms (form faults) → upstream biomechanical causes → corrective exercises.
 * This is the core novelty feature.
 */

/**
 * Kinetic chain rules database.
 * Each rule: when a form fault is detected, trace upstream to find the root cause.
 */
const KINETIC_CHAINS = {
    // ===== SQUAT CHAINS =====
    knee_valgus: {
        symptom: 'Knee Valgus (Caving Inward)',
        chain: [
            {
                rootCause: 'Weak Hip Abductors (Gluteus Medius)',
                explanation: 'Hip abductors fail to stabilise the femur → internal rotation → knee caves inward',
                corrective: 'Banded lateral walks, clamshells, single-leg glute bridges',
                muscleGroup: 'hip',
            },
            {
                rootCause: 'Tight Adductors',
                explanation: 'Overactive inner thigh muscles pull the knee inward under load',
                corrective: 'Foam roll adductors, seated butterfly stretch',
                muscleGroup: 'hip',
            },
            {
                rootCause: 'Weak VMO (Inner Quad)',
                explanation: 'Underdeveloped vastus medialis cannot stabilise the patella during flexion',
                corrective: 'Terminal knee extensions, wall sits with ball squeeze',
                muscleGroup: 'knee',
            },
        ],
    },

    forward_lean: {
        symptom: 'Excessive Forward Lean',
        chain: [
            {
                rootCause: 'Tight Ankle Dorsiflexion',
                explanation: 'Limited ankle mobility forces the torso forward to maintain balance → excessive hip hinge',
                corrective: 'Heel-elevated squats, wall ankle stretches, banded ankle mobilisation',
                muscleGroup: 'ankle',
            },
            {
                rootCause: 'Weak Thoracic Extensors',
                explanation: 'Upper back muscles cannot maintain an upright torso position under load',
                corrective: 'Thoracic foam rolling, face pulls, prone Y-raises',
                muscleGroup: 'back',
            },
            {
                rootCause: 'Weak Core / Anterior Chain',
                explanation: 'Core cannot resist flexion forces → spine rounds forward',
                corrective: 'Dead bugs, Pallof presses, front-loaded goblet squats',
                muscleGroup: 'core',
            },
        ],
    },

    asymmetric: {
        symptom: 'Asymmetric Descent (Lateral Shift)',
        chain: [
            {
                rootCause: 'Unilateral Hip Mobility Deficit',
                explanation: 'One hip has less range of motion → body shifts to the more mobile side',
                corrective: '90/90 hip switches, pigeon stretch on the tight side',
                muscleGroup: 'hip',
            },
            {
                rootCause: 'Unilateral Glute Weakness',
                explanation: 'Weaker glute on one side cannot control the descent evenly',
                corrective: 'Single-leg Romanian deadlifts, Bulgarian split squats (weak side first)',
                muscleGroup: 'hip',
            },
        ],
    },

    // ===== PUSH-UP CHAINS =====
    hip_sag: {
        symptom: 'Hip Sag (Anterior Pelvic Tilt)',
        chain: [
            {
                rootCause: 'Weak Core (Transverse Abdominis)',
                explanation: 'Deep core cannot maintain spinal neutrality against gravity → hips drop',
                corrective: 'Planks, dead bugs, hollow body holds',
                muscleGroup: 'core',
            },
            {
                rootCause: 'Weak Glutes',
                explanation: 'Glutes fail to posteriorly tilt the pelvis → lower back hyperextends',
                corrective: 'Glute bridges before push-ups, squeeze glutes throughout the set',
                muscleGroup: 'hip',
            },
        ],
    },

    elbow_flare: {
        symptom: 'Elbow Flare (>75° from body)',
        chain: [
            {
                rootCause: 'Weak Serratus Anterior',
                explanation: 'Serratus fails to protract and stabilise the scapula → shoulder compensates by flaring elbows',
                corrective: 'Scapular push-ups, serratus wall slides',
                muscleGroup: 'shoulder',
            },
            {
                rootCause: 'Tight Pec Minor',
                explanation: 'Shortened pec minor pulls the shoulder forward → default elbow path widens',
                corrective: 'Doorway pec stretch, foam roll pec minor',
                muscleGroup: 'chest',
            },
        ],
    },
};

/**
 * Given a list of form checks (from exercises.js), trace the kinetic chain
 * for any faults and return root-cause analyses.
 *
 * @param {Array} checks - Form checks from analyseForm()
 * @returns {Array<{ symptom: string, rootCause: string, explanation: string, corrective: string, muscleGroup: string }>}
 */
export function traceKineticChain(checks) {
    const results = [];

    for (const check of checks) {
        if (check.severity === 'success') continue;

        const chain = KINETIC_CHAINS[check.id];
        if (!chain) continue;

        // Return the most likely root cause (first in the chain)
        // In a full system, we'd use additional signals to narrow down
        const primaryCause = chain.chain[0];
        results.push({
            symptom: chain.symptom,
            rootCause: primaryCause.rootCause,
            explanation: primaryCause.explanation,
            corrective: primaryCause.corrective,
            muscleGroup: primaryCause.muscleGroup,
            allCauses: chain.chain,
        });
    }

    return results;
}
