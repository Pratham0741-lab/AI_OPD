// Generate default avatar with initials (Instagram style)
export const getDefaultAvatar = (name) => {
  if (!name) return null;
  
  // Get initials (first letter of first and last name)
  const nameParts = name.trim().split(' ');
  const initials = nameParts.length > 1 
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
    : nameParts[0][0];
  
  // Generate a consistent color based on name
  const colors = [
    { bg: '#FF6B6B', text: '#FFFFFF' }, // Red
    { bg: '#4ECDC4', text: '#FFFFFF' }, // Teal
    { bg: '#45B7D1', text: '#FFFFFF' }, // Blue
    { bg: '#FFA07A', text: '#FFFFFF' }, // Orange
    { bg: '#98D8C8', text: '#FFFFFF' }, // Mint
    { bg: '#F7DC6F', text: '#2C3E50' }, // Yellow
    { bg: '#BB8FCE', text: '#FFFFFF' }, // Purple
    { bg: '#85C1E2', text: '#FFFFFF' }, // Sky Blue
    { bg: '#F8B739', text: '#FFFFFF' }, // Gold
    { bg: '#52B788', text: '#FFFFFF' }  // Green
  ];
  
  // Use name to consistently pick a color
  const colorIndex = name.charCodeAt(0) % colors.length;
  const color = colors[colorIndex];
  
  // Create SVG avatar
  const svg = `
    <svg width="120" height="120" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="60" r="60" fill="${color.bg}"/>
      <text 
        x="50%" 
        y="50%" 
        dominant-baseline="central" 
        text-anchor="middle" 
        font-family="Arial, sans-serif" 
        font-size="48" 
        font-weight="600" 
        fill="${color.text}"
      >${initials.toUpperCase()}</text>
    </svg>
  `;
  
  // Convert SVG to data URL
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

// Get profile picture with fallback to default avatar
export const getProfilePicture = (customPicture, doctorName) => {
  if (customPicture) {
    return customPicture;
  }
  return getDefaultAvatar(doctorName || 'Doctor');
};
