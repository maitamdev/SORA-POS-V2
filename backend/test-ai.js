const fetch = require('node-fetch');
async function test() {
  const res = await fetch('http://localhost:3001/api/ai/suggest-category-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryName: 'cơm chiên' })
  });
  console.log(await res.text());
}
test();
