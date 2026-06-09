const test = async () => {
  const ordersRes = await fetch('http://localhost:3001/api/orders?page=1');
  console.log('Orders Status:', ordersRes.status);
  console.log('Orders Response:', await ordersRes.text());
};
test().catch(console.error);
