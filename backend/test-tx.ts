import { StockService } from './src/services/stock.service';

const test = async () => {
  try {
    const res = await StockService.transactions({});
    console.log('Transactions works!');
  } catch (err) {
    console.error('Transactions error:', err);
  }
};
test();
