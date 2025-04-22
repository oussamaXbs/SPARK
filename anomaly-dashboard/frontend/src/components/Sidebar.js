// src/components/Sidebar.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { logout } from '../api';
import './Sidebar.css';

const Sidebar = ({ user, setUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDevicesOpen, setIsDevicesOpen] = useState(location.pathname.startsWith('/devices'));

  useEffect(() => {
    setIsDevicesOpen(location.pathname.startsWith('/devices'));
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      localStorage.removeItem('user');
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const toggleDevicesMenu = () => setIsDevicesOpen(!isDevicesOpen);
  const isActive = (path) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  return (
    <div className="sidebar-container">
      <div className="logo">Anomaly Dashboard</div>
      {user ? (
        <ul className="menu-list">
          <li className="menu-item"><Link to="/" className={`menu-link ${isActive('/') ? 'active' : ''}`}>Home</Link></li>
          <li className="menu-item">
            <button onClick={toggleDevicesMenu} className={`menu-button ${isActive('/devices') ? 'active' : ''}`}>
              <span>Devices</span>
              <span className={`icon-wrapper ${isDevicesOpen ? 'open' : ''}`}>▼</span>
            </button>
            <ul className={`sub-menu-list ${isDevicesOpen ? 'open' : ''}`}>
              <li className="sub-menu-item"><Link to="/devices/pc" className={`sub-menu-link ${isActive('/devices/pc') ? 'active' : ''}`}>PCs</Link></li>
              <li className="sub-menu-item"><Link to="/devices/router" className={`sub-menu-link ${isActive('/devices/router') ? 'active' : ''}`}>Routers</Link></li>
              <li className="sub-menu-item"><Link to="/devices/switch" className={`sub-menu-link ${isActive('/devices/switch') ? 'active' : ''}`}>Switches</Link></li>
            </ul>
          </li>
          {user.role === 'admin' && (
            <li className="menu-item"><Link to="/users" className={`menu-link ${isActive('/users') ? 'active' : ''}`}>User Management</Link></li>
          )}
          <li className="menu-item"><Link to="/anomalies" className={`menu-link ${isActive('/anomalies') ? 'active' : ''}`}>Anomaly Logs</Link></li>
          <li className="menu-item"><button onClick={handleLogout} className="logout-button">Logout</button></li>
        </ul>
      ) : (
        <p className="loading-text">Loading...</p>
      )}
    </div>
  );
};

export default Sidebar;