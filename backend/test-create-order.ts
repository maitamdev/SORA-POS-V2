import { OrderService } from './src/services/order.service';

const test = async () => {
  try {
    const order = await OrderService.create({
      items: [{ product_id: '16cf0dc9-8581-45bc-9db0-ce5bc29c159f', quantity: 1 }], // Fake ID, I need a real product ID!
      payment: { method: 'cash' }
    }, 'b34df4e2-63cb-4672-bdc4-6c0b396ebdd5'); // Fake user ID!
    console.log(order);
  } catch (err) {
    console.error(err);
  }
};
test();
