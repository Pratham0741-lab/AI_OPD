import React, { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/global.css";

function ForgotPassword(){

const [email,setEmail] = useState("");
const [message,setMessage] = useState("");

const handleSubmit=(e)=>{
e.preventDefault();

if(!email){
setMessage("Please enter your registered email");
return;
}

setMessage("Password reset link sent to your email.");
};

return(

<div className="login-page">

<div className="login-left">

<div className="brand">

<h1>VocabOPD</h1>
<p>AI Powered Multilingual OPD Assistant</p>

</div>

<img
src="https://images.unsplash.com/photo-1582750433449-648ed127bb54"
alt="doctor"
className="doctor-image"
/>

</div>

<div className="login-right">

<div className="login-box">

<h2>Forgot Password</h2>

{message && <div className="info-box">{message}</div>}

<form onSubmit={handleSubmit}>

<input
type="email"
placeholder="Enter your registered email"
value={email}
onChange={(e)=>setEmail(e.target.value)}
/>

<button className="login-btn">
Send Reset Link
</button>

</form>

<p className="auth-link">

Remember password?

<Link to="/"> Login</Link>

</p>

</div>

</div>

</div>

);
}

export default ForgotPassword;
