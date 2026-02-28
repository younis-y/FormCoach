/**
 * TechnIQ AI — Rep Counter & Per-Rep Form Scoring
 * State machine for detecting repetitions + storing per-rep data for fatigue analysis.
 */

export class RepCounter {
    constructor() {
        this.phase = 'idle';       // idle | descending | bottom | ascending
        this.repCount = 0;
        this.repScores = [];       // form score per completed rep
        this.currentRepMinAngle = 180;
        this.currentRepScores = []; // scores sampled during the rep
        this.framesSincePhaseChange = 0;
        this.bottomFrames = 0;

        // Thresholds (will be set per exercise)
        this.descendThreshold = 140;  // below this = descending
        this.bottomThreshold = 110;   // below this = at bottom
        this.ascendThreshold = 150;   // above this after bottom = ascending complete
    }

    /**
     * Configure thresholds for a specific exercise.
     */
    configure(exercise) {
        if (exercise === 'squat') {
            this.descendThreshold = 145;
            this.bottomThreshold = 115;
            this.ascendThreshold = 155;
        } else if (exercise === 'pushup') {
            this.descendThreshold = 140;
            this.bottomThreshold = 105;
            this.ascendThreshold = 150;
        } else if (exercise === 'lateral_raise') {
            // Shoulder abduction: ~20° at rest, ~80-90° at top
            // "Descend" = raising up (angle increases), "bottom" = top of move
            this.descendThreshold = 40;  // above this = arm is raising
            this.bottomThreshold = 65;   // above this = near top
            this.ascendThreshold = 30;   // below this after top = back to rest
        }
    }

    /**
     * Update the rep counter with a new frame's primary angle and form score.
     * @param {number} primaryAngle - The key angle for rep detection (knee angle for squat, elbow for pushup)
     * @param {number} formScore - Overall form score for this frame (0-100)
     * @returns {{ repCompleted: boolean, repNumber: number, repScore: number }}
     */
    update(primaryAngle, formScore) {
        this.framesSincePhaseChange++;
        this.currentRepMinAngle = Math.min(this.currentRepMinAngle, primaryAngle);

        let repCompleted = false;
        let repScore = 0;

        switch (this.phase) {
            case 'idle':
                if (primaryAngle < this.descendThreshold) {
                    this.phase = 'descending';
                    this.framesSincePhaseChange = 0;
                    this.currentRepScores = [];
                    this.currentRepMinAngle = primaryAngle;
                }
                break;

            case 'descending':
                this.currentRepScores.push(formScore);
                if (primaryAngle < this.bottomThreshold) {
                    this.phase = 'bottom';
                    this.framesSincePhaseChange = 0;
                    this.bottomFrames = 0;
                } else if (primaryAngle > this.ascendThreshold && this.framesSincePhaseChange > 10) {
                    // Went back up without hitting bottom — partial rep, reset
                    this.phase = 'idle';
                    this.framesSincePhaseChange = 0;
                }
                break;

            case 'bottom':
                this.currentRepScores.push(formScore);
                this.bottomFrames++;
                if (primaryAngle > this.bottomThreshold + 15) {
                    this.phase = 'ascending';
                    this.framesSincePhaseChange = 0;
                }
                break;

            case 'ascending':
                this.currentRepScores.push(formScore);
                if (primaryAngle > this.ascendThreshold) {
                    // Rep complete!
                    this.repCount++;
                    repScore = this.currentRepScores.length > 0
                        ? Math.round(this.currentRepScores.reduce((a, b) => a + b, 0) / this.currentRepScores.length)
                        : 100;
                    this.repScores.push(repScore);
                    repCompleted = true;

                    this.phase = 'idle';
                    this.framesSincePhaseChange = 0;
                    this.currentRepScores = [];
                    this.currentRepMinAngle = 180;
                }
                break;
        }

        return { repCompleted, repNumber: this.repCount, repScore };
    }

    /**
     * Get all rep scores for fatigue analysis.
     */
    getRepScores() {
        return [...this.repScores];
    }

    /**
     * Reset for a new set.
     */
    reset() {
        this.phase = 'idle';
        this.repCount = 0;
        this.repScores = [];
        this.currentRepMinAngle = 180;
        this.currentRepScores = [];
        this.framesSincePhaseChange = 0;
    }
}
