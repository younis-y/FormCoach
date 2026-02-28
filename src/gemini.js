/**
 * FormCoach AI — Gemini Integration
 * Post-set AI coaching summary using Gemini 2.0 Flash.
 */

let geminiKey = '';

export function initGemini(key) {
    geminiKey = key;
}

/**
 * Generate a post-set coaching summary.
 * @param {Object} sessionData
 * @returns {Promise<string>}
 */
export async function generateCoachingSummary(sessionData) {
    if (!geminiKey) {
        return generateFallbackSummary(sessionData);
    }

    const prompt = `You are an expert sports physiotherapist and strength coach. Analyse this exercise set data and give a brief, actionable coaching summary (3-4 sentences max).

Exercise: ${sessionData.exercise}
Total reps: ${sessionData.totalReps}
Per-rep form scores: ${JSON.stringify(sessionData.repScores)}
Form degradation: ${sessionData.degradationPct}%
${sessionData.predictedInjuryRep ? `Predicted injury threshold at rep: ${sessionData.predictedInjuryRep}` : 'No injury prediction triggered'}

Key form issues detected:
${sessionData.formIssues.map(i => `- ${i.symptom}: Root cause = ${i.rootCause}`).join('\n')}

Bilateral asymmetries:
${sessionData.asymmetries.map(a => `- ${a.name}: ${a.asymmetryPct}% ${a.direction} (${a.severity})`).join('\n')}

Focus on: 1) Most critical corrective action, 2) What they did well, 3) Specific recommendation for next set. Be encouraging but honest.`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
                }),
            }
        );

        if (!response.ok) {
            console.warn('[Gemini] API error, using fallback');
            return generateFallbackSummary(sessionData);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || generateFallbackSummary(sessionData);
    } catch (e) {
        console.warn('[Gemini] Error:', e.message);
        return generateFallbackSummary(sessionData);
    }
}

function generateFallbackSummary(data) {
    const parts = [];
    parts.push(`**Set Complete** — ${data.totalReps} reps of ${data.exercise}.`);

    if (data.degradationPct > 15) {
        parts.push(`Your form degraded ${data.degradationPct}% over the set. Consider reducing weight or resting longer between sets.`);
    } else {
        parts.push(`Form remained consistent throughout the set. Good control.`);
    }

    if (data.formIssues.length > 0) {
        const issue = data.formIssues[0];
        parts.push(`**Key issue:** ${issue.symptom} — likely caused by ${issue.rootCause}. Try: ${issue.corrective}`);
    }

    if (data.asymmetries.filter(a => a.severity !== 'normal').length > 0) {
        parts.push(`Bilateral asymmetry detected — consider unilateral exercises to address imbalances.`);
    }

    return parts.join('\n\n');
}
