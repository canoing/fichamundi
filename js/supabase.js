import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config.js';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
        'Configura SUPABASE_URL y SUPABASE_ANON_KEY en js/supabase-config.js antes de usar Supabase.'
    );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
