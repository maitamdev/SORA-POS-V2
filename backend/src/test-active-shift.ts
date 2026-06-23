import { supabase } from './config/supabase';

async function main() {
  try {
    const employeeId = '392777c3-3ace-4cc2-9612-4aceb39e9ec4'; // Mai Trần Thiện Tâm
    const { data: shifts, error } = await supabase
      .from('shift_sessions')
      .select('*')
      .eq('employee_id', employeeId)
      .in('status', ['opened', 'checked_in']);
    
    console.log('Active shifts for employee:', shifts, 'Error:', error);
  } catch (err: any) {
    console.error('Error:', err);
  }
}

main();
