import React, { useState } from "react";
import "../styles/modal.css";

function NotificationSettings({ onClose }) {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    appointmentReminders: true,
    reportGenerated: true,
    patientMessages: true,
    systemUpdates: false
  });
  const [loading, setLoading] = useState(false);

  // Load settings from localStorage on mount
  React.useEffect(() => {
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleToggle = (key) => {
    setSettings({
      ...settings,
      [key]: !settings[key]
    });
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      // Save to localStorage
      localStorage.setItem('notificationSettings', JSON.stringify(settings));
      
      // In future, can add backend API call here
      // const token = localStorage.getItem("token");
      // const response = await fetch('http://localhost:5000/api/settings/notifications', {
      //   method: 'PUT',
      //   headers: { 
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${token}`
      //   },
      //   body: JSON.stringify(settings)
      // });
      
      alert("Notification settings saved successfully!");
      onClose();
    } catch (err) {
      console.error("Save settings error:", err);
      alert("Failed to save settings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-medium" onClick={(e) => e.stopPropagation()}>
        
        <div className="modal-header">
          <h2>Notification Settings</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          
          <div className="settings-section">
            <h3>Notification Channels</h3>
            
            <div className="setting-toggle-item">
              <div className="setting-info">
                <h4>Email Notifications</h4>
                <p>Receive notifications via email</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={() => handleToggle('emailNotifications')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-toggle-item">
              <div className="setting-info">
                <h4>SMS Notifications</h4>
                <p>Receive notifications via SMS</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.smsNotifications}
                  onChange={() => handleToggle('smsNotifications')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-toggle-item">
              <div className="setting-info">
                <h4>Push Notifications</h4>
                <p>Receive push notifications in browser</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.pushNotifications}
                  onChange={() => handleToggle('pushNotifications')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="settings-section">
            <h3>Notification Types</h3>
            
            <div className="setting-toggle-item">
              <div className="setting-info">
                <h4>Appointment Reminders</h4>
                <p>Get reminded about upcoming appointments</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.appointmentReminders}
                  onChange={() => handleToggle('appointmentReminders')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-toggle-item">
              <div className="setting-info">
                <h4>Report Generated</h4>
                <p>Notify when reports are generated</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.reportGenerated}
                  onChange={() => handleToggle('reportGenerated')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-toggle-item">
              <div className="setting-info">
                <h4>Patient Messages</h4>
                <p>Notify about patient messages</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.patientMessages}
                  onChange={() => handleToggle('patientMessages')}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-toggle-item">
              <div className="setting-info">
                <h4>System Updates</h4>
                <p>Notify about system updates and maintenance</p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.systemUpdates}
                  onChange={() => handleToggle('systemUpdates')}
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
            {loading ? "Saving..." : "Save Settings"}
          </button>
        </div>

      </div>
    </div>
  );
}

export default NotificationSettings;
