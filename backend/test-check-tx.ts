import { supabase } from './src/config/supabase';

const test = async () => {
  const { data: txs, error } = await supabase
    .from('stock_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) console.error('Error fetching txs:', error);
  else console.log('Recent transactions:', txs);
};
test().catch(console.error);
