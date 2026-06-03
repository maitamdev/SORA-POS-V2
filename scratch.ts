import { supabase } from './backend/src/config/supabase';
async function run() { 
  const {data} = await supabase.from('products').select('id, categories(name)').limit(2); 
  console.log(JSON.stringify(data)); 
} 
run();
