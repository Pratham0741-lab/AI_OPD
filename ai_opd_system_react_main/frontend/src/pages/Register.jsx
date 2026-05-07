import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/global.css";
import "../styles/medical-colors.css";

function Register() {

const navigate = useNavigate();

const [formData,setFormData] = useState({
name:"",
email:"",
hospital:"",
password:"",
confirmPassword:""
});

const [loading,setLoading] = useState(false);
const [error,setError] = useState("");

const handleChange = (e)=>{
setFormData({
...formData,
[e.target.name]: e.target.value
});
};

const handleSubmit = async (e)=>{

e.preventDefault();

setError("");

if(formData.password !== formData.confirmPassword){
setError("Passwords do not match");
return;
}

if(formData.password.length < 6){
setError("Password must be at least 6 characters");
return;
}

setLoading(true);

try {
const response = await fetch("http://localhost:5000/api/register", {
method: "POST",
headers: {
"Content-Type": "application/json"
},
body: JSON.stringify({
name: formData.name,
email: formData.email,
hospital: formData.hospital,
password: formData.password
})
});

const data = await response.json();

if (data.success) {
alert("Registration successful! Please login.");
navigate("/");
} else {
setError(data.message || "Registration failed");
}
} catch (error) {
console.error("Registration error:", error);
setError("Registration failed. Please check if backend is running.");
} finally {
setLoading(false);
}

};

return(

<div className="auth-page">

{/* HEADER */}

<div className="auth-header">

<h1>VocabOPD</h1>
<p>AI Powered Multilingual OPD Assistant</p>

</div>

{/* FORM */}

<div className="auth-container">

<div className="auth-box">

<h2>Create Doctor Account</h2>

{error && <div className="error-box">{error}</div>}

<form onSubmit={handleSubmit}>

<input
type="text"
name="name"
placeholder="Doctor Name"
onChange={handleChange}
required
/>

<input
type="email"
name="email"
placeholder="Email"
onChange={handleChange}
required
/>

<input
type="text"
name="hospital"
placeholder="Hospital / Clinic Name"
onChange={handleChange}
required
/>

<input
type="password"
name="password"
placeholder="Password"
onChange={handleChange}
required
/>

<input
type="password"
name="confirmPassword"
placeholder="Confirm Password"
onChange={handleChange}
required
/>

<button className="login-btn" disabled={loading}>

{loading ? "Creating Account..." : "Create Account"}

</button>

</form>

<div className="divider">OR</div>

<button className="google-btn">

<img
src="https://cdn-icons-png.flaticon.com/512/2991/2991148.png"
alt="google"
/>

Sign up with Google

</button>

<button className="facebook-btn">

<img
src="https://cdn-icons-png.flaticon.com/512/733/733547.png"
alt="facebook"
/>

Sign up with Facebook

</button>

<p className="auth-link">

Already have an account? <Link to="/">Login</Link>

</p>

</div>

</div>

</div>

);

}

export default Register;
