// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DashboardHome from './pages/DashboardHome';
import DeviceList from './pages/DeviceList';
import UserManagement from './pages/UserManagement';
import AnomalyLogs from './pages/AnomalyLogs';
import Login from './pages/Login';
import { fetchLogs, fetchMetrics } from './api'; // Import fetchMetrics

const App = () => {
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [metrics, setMetrics] = useState([]); // Add state for metrics
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (err) {
        console.error('Session check error:', err);
      }
    };

    const loadData = async () => {
      try {
        const [logsData, metricsData] = await Promise.all([
          fetchLogs(),
          fetchMetrics(), // Fetch metrics
        ]);
        console.log('Fetched Logs:', logsData);
        console.log('Fetched Metrics:', metricsData);

        // Ensure logsData and metricsData are arrays
        setLogs(Array.isArray(logsData) ? logsData : []);
        setMetrics(Array.isArray(metricsData) ? metricsData : []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setLogs([]); // Fallback to empty array
        setMetrics([]); // Fallback to empty array
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
    loadData();
  }, []);

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  const mainContentStyle = {
    flex: 1,
    padding: '40px',
    marginLeft: '270px',
    background: '#f9f9f9',
    overflowY: 'auto',
    width: 'calc(100% - 270px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" /> : <Login setUser={setUser} />}
        />
        <Route
          path="/*"
          element={user ? (
            <div style={{ display: 'flex', minHeight: '100vh' }}>
              <Sidebar user={user} setUser={setUser} />
              <main style={mainContentStyle}>
                <Routes>
                  <Route path="/" element={<DashboardHome logs={logs} />} />
                  <Route
                    path="/devices/:type"
                    element={<DeviceList logs={logs} metrics={metrics} isLoading={isLoading} />}
                  />
                  {user?.role === 'admin' && (
                    <Route path="/users" element={<UserManagement />} />
                  )}
                  <Route path="/anomalies" element={<AnomalyLogs logs={logs} isLoading={isLoading} />} />
                </Routes>
              </main>
            </div>
          ) : (
            <Navigate to="/login" />
          )}
        />
      </Routes>
    </Router>
  );
};

export default App;