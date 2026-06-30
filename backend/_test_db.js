const { supabase } = require('./src/config/supabase');
require('dotenv').config();

async function run() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_number, final_amount, created_at, status')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error(error);
    return;
  }
  console.log(JSON.stringify(orders, null, 2));
}

run();
