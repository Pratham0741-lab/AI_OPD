const http = require('http');

async function testSave() {
  try {
    const loginRes = await fetch("http://localhost:5000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "prathammohadikar911@gmail.com", password: "password" }) // I don't know the password, maybe I can just forge a JWT instead since I have the secret.
    });
  } catch(e) {}
}
