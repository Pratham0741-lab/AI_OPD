// Authentication utility functions

export const isAuthenticated = () => {
  const token = localStorage.getItem("token");
  if (!token) return false;
  
  try {
    // Decode JWT payload (base64) to check expiry
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Check if token is expired (exp is in seconds)
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      console.warn("Token expired, clearing auth data");
      localStorage.removeItem("token");
      localStorage.removeItem("doctor");
      return false;
    }
    return true;
  } catch (error) {
    console.error("Invalid token format:", error);
    return false;
  }
};

export const getToken = () => {
  return localStorage.getItem("token");
};

export const getDoctorInfo = () => {
  const doctorStr = localStorage.getItem("doctor");
  if (doctorStr) {
    try {
      return JSON.parse(doctorStr);
    } catch (error) {
      console.error("Error parsing doctor info:", error);
      return null;
    }
  }
  return null;
};

export const logout = () => {
  // Clear all user-specific data from localStorage
  localStorage.removeItem("token");
  localStorage.removeItem("doctor");
  localStorage.removeItem("doctorProfile");
  localStorage.removeItem("profilePicture");
  localStorage.clear(); // Clear everything to ensure no data persists
  window.location.href = "/";
};

export const setAuthData = (token, doctor) => {
  localStorage.setItem("token", token);
  localStorage.setItem("doctor", JSON.stringify(doctor));
};
