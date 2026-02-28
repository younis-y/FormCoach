-- TechnIQ: Daily 30-second check-in data
-- Stores user mood, soreness, energy, and sleep data from voice check-ins

CREATE TABLE IF NOT EXISTS check_ins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,

    -- Check-in responses
    mood TEXT CHECK (mood IN ('great', 'good', 'okay', 'tired', 'bad')),
    soreness_areas TEXT,           -- Free-text description of sore areas
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 10),
    sleep_quality TEXT CHECK (sleep_quality IN ('great', 'good', 'fair', 'poor')),
    notes TEXT,                    -- Any additional notes from the conversation

    -- Constraint: one check-in per user per day
    UNIQUE (user_id, date)
);

-- RLS policies
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own check-ins"
    ON check_ins FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own check-ins"
    ON check_ins FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own check-ins"
    ON check_ins FOR UPDATE
    USING (auth.uid() = user_id);
