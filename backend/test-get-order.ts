import { supabase } from './src/config/supabase';

const test = async () => {
  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(*), users!orders_user_id_fkey(id, full_name, email), order_details(*), payments(*)')
    .limit(1);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', data);
  }
};
test().catch(console.error);
