import { OrderService } from '../services/order.service';

async function run() {
  try {
    console.log('--- Testing OrderService.list with cashier role ---');
    const result = await OrderService.list({ page: 1, limit: 10 }, {
      userId: 'b2d1973b-5d86-4c48-b003-dab0307ef1ba',
      role: 'cashier',
      email: '842679'
    });
    console.log('Success! Result count:', result.items.length);
  } catch (error) {
    console.error('Error running OrderService.list:', error);
  }
}

run();
