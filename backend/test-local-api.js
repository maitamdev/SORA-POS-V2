fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: '909881', password: 'password' })
}).then(res => Promise.all([res.status, res.text()]))
  .then(console.log).catch(console.error);
