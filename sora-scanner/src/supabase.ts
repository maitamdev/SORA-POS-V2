import { createClient } from '@supabase/supabase-js';

// Supabase credentials — same as SORA-POS-V2 frontend
const SUPABASE_URL = 'https://vblwctnivnfnzsmcoifd.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZibHdjdG5pdm5mbnpzbWNvaWZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMTE0ODYsImV4cCI6MjA5NTc4NzQ4Nn0.A1AHK7wE30aR5fOim8Y-HyPMwXW7otju805bzYKqgWw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Channel name must match the one in SORA-POS-V2 frontend ScannerPage
export const SCANNER_CHANNEL = 'scanner-events';
export const SCANNER_EVENT = 'barcode_scanned';
