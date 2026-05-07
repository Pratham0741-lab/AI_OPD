import React, { useState } from "react";
import "../styles/modal.css";

function PreferencesModal({ onClose }) {
  const [preferences, setPreferences] = useState({
    language: "english",
    theme: "light",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12h",
    autoSave: true,
    soundEffects: true
  });
  const [loading, setLoading] = useState(false);

  // Load preferences from localStorage on mount
  React.useEffect(() => {
    const savedPreferences = localStorage.getItem('userPreferences');
    if (savedPreferences) {
      setPreferences(JSON.parse(savedPreferences));
    }
  }, []);

  const handleChange = (key, value) => {
    setPreferences({
      ...preferences,
      [key]: value
    });
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      // Save to localStorage
      localStorage.setItem('userPreferences', JSON.stringify(preferences));
      
      alert("Preferences saved successfully!");
      onClose();
    } catch (err) {
      console.error("Save preferences error:", err);
      alert("Failed to save preferences. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-medium" onClick={(e) => e.stopPropagation()}>
        
        <div className="modal-header">
          <h2>Preferences</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          
          <div className="settings-section">
            <h3>General Settings</h3>
            
            <div className="form-group">
              <label>Default Language</label>
              <select
                value={preferences.language}
                onChange={(e) => handleChange('language', e.target.value)}
              >
                <option value="english">English</option>
                <option value="hindi">हिंदी (Hindi)</option>
                <option value="kannada">ಕನ್ನಡ (Kannada)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Theme</label>
              <select
                value={preferences.theme}
                onChange={(e) => handleChange('theme', e.target.value)}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto (System)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Date Format</label>
              <select
                value={preferences.dateFormat}
                onChange={(e) => handleChange('dateFormat', e.target.value)}
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>

            <div className="form-group">
              <label>Time Format</label>
              <select
                value={preferences.timeFormat}
                onChange={(e) => handleChange('timeFormat', e.target.value)}
              >
                <option value="12h">12 Hour (AM/PM)</option>
                <option value="24h">24 Hour</option>
              </select>
            </div>
          </div>

          <div className="settings-section">
            <h3>Application Settings</h3>
            
            <div className="setting-toggle-item">
              <div className="setting-info">
                <h4>Auto-save Consultations</h4>
                <p>Automatically save consultation drafts</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.autoSave}
                  onChange={(e) => handleChange('autoSave', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-toggle-item">
              <div className="setting-info">
                <h4>Sound Effects</h4>
                <p>Play sounds for notifications and actions</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={preferences.soundEffects}
                  onChange={(e) => handleChange('soundEffects', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Preferences"}
          </button>
        </div>

      </div>
    </div>
  );
}

export default PreferencesModal;
