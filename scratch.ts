import { supabase } from './backend/src/config/supabase';
async function run() { 
  const {data, error} = await supabase.from('categories').select('*, products(count)').limit(5); 
  console.log("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2)); 
} 
run();
