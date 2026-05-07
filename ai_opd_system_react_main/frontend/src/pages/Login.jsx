import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isAuthenticated } from "../utils/auth";
import "../styles/global.css";
import "../styles/medical-colors.css";

function Login(){

const navigate = useNavigate();

const [email,setEmail] = useState("");
const [password,setPassword] = useState("");
const [showPassword,setShowPassword] = useState(false);
const [loading,setLoading] = useState(false);
const [error,setError] = useState("");

// Redirect if already logged in
useEffect(() => {
  if (isAuthenticated()) {
    navigate("/dashboard");
  }
}, [navigate]);

const handleSubmit = async (e) => {
  e.preventDefault();
  
  setError("");
  
  if (!email || !password) {
    setError("Please fill all fields");
    return;
  }
  
  setLoading(true);
  
  try {
    const response = await fetch("http://localhost:5000/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (data.success && data.token) {
      // Save token and doctor info
      localStorage.setItem("token", data.token);
      localStorage.setItem("doctor", JSON.stringify(data.doctor));
      
      // Navigate to dashboard
      navigate("/dashboard");
    } else {
      setError(data.message || "Invalid credentials");
    }
  } catch (error) {
    console.error("Login error:", error);
    setError("Login failed. Please try again.");
  } finally {
    setLoading(false);
  }
};

return(

<div className="auth-page">

<div className="auth-header">

<h1>VocabOPD</h1>
<p>AI Powered Multilingual OPD Assistant</p>

</div>

<div className="auth-container">

<div className="auth-box">

<h2>Doctor Login</h2>

{error && <div className="error-box">{error}</div>}

<form onSubmit={handleSubmit}>

<input
type="email"
placeholder="Doctor Email"
value={email}
onChange={(e)=>setEmail(e.target.value)}
/>

<div className="password-field">

<input
type={showPassword ? "text":"password"}
placeholder="Password"
value={password}
onChange={(e)=>setPassword(e.target.value)}
/>

<span
className="toggle-pass"
onClick={()=>setShowPassword(!showPassword)}

>

{showPassword ? "🙈" : "👁"}

</span>

</div>

<button className="login-btn" disabled={loading}>

{loading ? "Logging in..." : "Login"}

</button>

</form>

<div className="divider">OR</div>

<button className="google-btn">

<img
src="https://cdn-icons-png.flaticon.com/512/2991/2991148.png"
alt="google"
/>

Login with Google

</button>

<button className="facebook-btn">

<img
src="https://cdn-icons-png.flaticon.com/512/733/733547.png"
alt="facebook"
/>

Login with Facebook

</button>

<p className="auth-link">

Don't have an account? <Link to="/register">Register</Link>

</p>

</div>

</div>

</div>

);

}

export default Login;
