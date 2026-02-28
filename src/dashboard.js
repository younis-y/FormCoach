/**
 * FormCoach AI — Dashboard UI Updates
 * Updates the sidebar panels: alerts, kinetic chain, fatigue chart, asymmetry.
 */

import { predictFatigue } from './fatiguePredictor.js';

/**
 * Update the alerts panel with current form checks.
 */
export function updateAlerts(checks) {
    const list = document.getElementById('alerts-list');
    if (!list) return;

    const activeChecks = checks.filter(c => c.severity !== 'success');

    if (activeChecks.length === 0) {
        list.innerHTML = '<div class="alert-item success">✅ Form looks good</div>';
        return;
    }

    list.innerHTML = activeChecks
        .map(c => `<div class="alert-item ${c.severity}">${c.severity === 'danger' ? '🔴' : '🟡'} ${c.message}</div>`)
        .join('');
}

/**
 * Update the kinetic chain panel with root cause analysis.
 */
export function updateKineticChain(chainResults) {
    const container = document.getElementById('kinetic-chain');
    if (!container) return;

    if (chainResults.length === 0) {
        container.innerHTML = '<div class="chain-placeholder">No form issues detected ✅</div>';
        document.getElementById('kinetic-panel')?.classList.remove('highlight');
        return;
    }

    document.getElementById('kinetic-panel')?.classList.add('highlight');

    container.innerHTML = chainResults
        .map(r => `
      <div class="chain-item">
        <div class="chain-symptom">⚠️ ${r.symptom}</div>
        <div class="chain-arrow">↓ Root Cause</div>
        <div class="chain-cause">💪 ${r.rootCause}</div>
        <div class="chain-fix">💡 Fix: ${r.corrective}</div>
      </div>
    `)
        .join('');
}

/**
 * Update the fatigue chart with rep scores.
 */
export function updateFatigueChart(repScores) {
    const canvas = document.getElementById('fatigue-chart');
    const predictionEl = document.getElementById('fatigue-prediction');
    if (!canvas || !predictionEl) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.offsetWidth * 2;
    const h = canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    const dw = canvas.offsetWidth;
    const dh = canvas.offsetHeight;

    ctx.clearRect(0, 0, dw, dh);

    if (repScores.length === 0) {
        ctx.fillStyle = '#555';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Complete reps to see fatigue curve', dw / 2, dh / 2);
        predictionEl.textContent = '';
        return;
    }

    const fatigue = predictFatigue(repScores);
    const padding = { top: 10, right: 15, bottom: 25, left: 35 };
    const chartW = dw - padding.left - padding.right;
    const chartH = dh - padding.top - padding.bottom;

    // Draw injury threshold line
    const thresholdY = padding.top + chartH * (1 - 55 / 100);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255, 82, 82, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, thresholdY);
    ctx.lineTo(dw - padding.right, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255, 82, 82, 0.5)';
    ctx.font = '9px Inter';
    ctx.textAlign = 'left';
    ctx.fillText('Injury threshold', padding.left + 4, thresholdY - 4);

    // Draw Y axis labels
    ctx.fillStyle = '#666';
    ctx.font = '9px Inter';
    ctx.textAlign = 'right';
    for (let score = 0; score <= 100; score += 25) {
        const y = padding.top + chartH * (1 - score / 100);
        ctx.fillText(score.toString(), padding.left - 5, y + 3);
    }

    // Max reps to show (include predicted)
    const maxReps = Math.max(repScores.length + 3, fatigue.predictedInjuryRep || repScores.length + 3);

    // Plot rep scores as bars
    const barWidth = Math.min(20, chartW / maxReps * 0.7);
    for (let i = 0; i < repScores.length; i++) {
        const x = padding.left + (i + 0.5) * (chartW / maxReps) - barWidth / 2;
        const barH = (repScores[i] / 100) * chartH;
        const y = padding.top + chartH - barH;

        const color = repScores[i] > 75 ? '#00e676' : repScores[i] > 55 ? '#ffab40' : '#ff5252';
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barH, 3);
        ctx.fill();

        // Rep number label
        ctx.fillStyle = '#888';
        ctx.font = '9px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`R${i + 1}`, padding.left + (i + 0.5) * (chartW / maxReps), dh - 5);
    }

    // Draw trend line
    if (fatigue.trendLine.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = fatigue.trend === 'critical' ? '#ff5252' : fatigue.trend === 'declining' ? '#ffab40' : '#6c5ce7';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);

        for (let i = 0; i < Math.min(maxReps, repScores.length + 5); i++) {
            const trendVal = Math.max(0, Math.min(100, fatigue.trendLine[0] + fatigue.slope * i));
            const x = padding.left + (i + 0.5) * (chartW / maxReps);
            const y = padding.top + chartH * (1 - trendVal / 100);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Prediction text
    if (fatigue.predictedInjuryRep !== null) {
        predictionEl.className = 'fatigue-prediction danger';
        predictionEl.textContent = `⚠️ Predicted injury threshold at rep ${fatigue.predictedInjuryRep} — form degradation ${fatigue.degradationPct}%`;
    } else if (fatigue.degradationPct > 8) {
        predictionEl.className = 'fatigue-prediction';
        predictionEl.textContent = `📉 Form declining ${fatigue.degradationPct}% — monitor closely`;
    } else {
        predictionEl.className = 'fatigue-prediction';
        predictionEl.textContent = repScores.length > 0 ? `✅ Form stable — ${fatigue.degradationPct}% variation` : '';
    }
}

/**
 * Update the asymmetry panel.
 */
export function updateAsymmetry(asymmetryResults) {
    const container = document.getElementById('asymmetry-bars');
    if (!container) return;

    container.innerHTML = asymmetryResults
        .map(r => {
            const color = r.severity === 'significant' ? '#ff5252'
                : r.severity === 'mild' ? '#ffab40'
                    : '#00e676';

            // Bar position: center = symmetric, left/right = asymmetric
            const offset = r.direction.includes('Left') ? -r.asymmetryPct : r.asymmetryPct;
            const barLeft = 50 + Math.min(offset, 40) * 0.8;
            const barWidth = Math.max(4, Math.abs(offset) * 1.5);

            return `
        <div class="asymmetry-row">
          <div class="asymmetry-label">
            <span>${r.name}</span>
            <span style="color:${color}">${r.asymmetryPct}% ${r.severity !== 'normal' ? '⚠️' : '✓'}</span>
          </div>
          <div class="asymmetry-bar-track">
            <div class="asymmetry-bar-center"></div>
            <div class="asymmetry-bar-fill" style="left:${Math.min(barLeft, 50)}%;width:${barWidth}%;background:${color}"></div>
          </div>
        </div>
      `;
        })
        .join('');
}

/**
 * Update the overlay displays (rep count, form score).
 */
export function updateOverlays(repCount, formScore) {
    const repEl = document.querySelector('.rep-count');
    const scoreEl = document.querySelector('.score-value');

    if (repEl) repEl.textContent = repCount;
    if (scoreEl) {
        scoreEl.textContent = formScore;
        scoreEl.className = 'score-value' +
            (formScore < 55 ? ' danger' : formScore < 75 ? ' warning' : '');
    }
}
