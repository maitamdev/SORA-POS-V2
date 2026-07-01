import dotenv from 'dotenv';
dotenv.config();
import { supabase } from '../config/supabase';

async function check() {
  const { data: logs, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching audit logs:', error);
    return;
  }

  console.log('--- LATEST AUDIT LOGS IN DB ---');
  console.log(JSON.stringify(logs, null, 2));
}

check();
