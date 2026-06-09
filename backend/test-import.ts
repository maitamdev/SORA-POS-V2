import { StockService } from './src/services/stock.service';
import { supabase } from './src/config/supabase';

const test = async () => {
  try {
    // 1. Get a valid product ID
    const { data: product } = await supabase.from('products').select('id').limit(1).single();
    if (!product) {
      console.log('No product found');
      return;
    }

    // 2. Get a valid user ID
    const { data: user } = await supabase.from('users').select('id').limit(1).single();
    if (!user) {
      console.log('No user found');
      return;
    }

    console.log('Testing import for product:', product.id, 'by user:', user.id);
    const result = await StockService.importStock(product.id, 10, user.id, 'Test import');
    console.log('Success:', result);
  } catch (err) {
    console.error('Test Failed:', err);
  }
};
test().catch(console.error);
