import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { isAuthenticated } from "./utils/auth";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import RecordConsultation from "./pages/RecordConsultation";
import PatientHistory from "./pages/PatientHistory";
import Reports from "./pages/Reports";
import Profile from "./pages/Profile";
import PhoneCalls from "./pages/PhoneCalls";

// Private Route Component
function PrivateRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/" replace />;
}

function App() {

return (

<Router>

<Routes>

<Route path="/" element={<Login />} />
<Route path="/register" element={<Register />} />

{/* Protected Routes */}
<Route 
  path="/dashboard" 
  element={
    <PrivateRoute>
      <Dashboard />
    </PrivateRoute>
  } 
/>
<Route 
  path="/record" 
  element={
    <PrivateRoute>
      <RecordConsultation />
    </PrivateRoute>
  } 
/>
<Route 
  path="/patients" 
  element={
    <PrivateRoute>
      <PatientHistory />
    </PrivateRoute>
  } 
/>
<Route 
  path="/reports" 
  element={
    <PrivateRoute>
      <Reports />
    </PrivateRoute>
  } 
/>
<Route 
  path="/profile" 
  element={
    <PrivateRoute>
      <Profile />
    </PrivateRoute>
  } 
/>
<Route 
  path="/phone-calls" 
  element={
    <PrivateRoute>
      <PhoneCalls />
    </PrivateRoute>
  } 
/>

</Routes>

</Router>

);

}

export default App;
