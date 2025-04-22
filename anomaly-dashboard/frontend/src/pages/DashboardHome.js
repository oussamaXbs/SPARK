import React, { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import './DashboardHome.css';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const DashboardHome = ({ logs, isLoading }) => {
  const [period, setPeriod] = useState('daily'); // State for selected time period

  // Calculate total devices, anomalies, and chart data
  const { totalDevices, anomalies, chartData } = useMemo(() => {
    const uniqueDevices = new Set(logs.map(log => log.hostname)).size;
    const anomalyCount = logs.filter(log => log.is_anomaly).length; // Keep this based on is_anomaly

    // Process logs for chart data (threats and normal logs based on anomaly_type)
    const groupLogsByPeriod = (logs, period) => {
      const groupedThreats = {};
      const groupedNormal = {};

      logs.forEach(log => {
        const date = new Date(log.timestamp);
        let key;

        if (period === 'daily') {
          key = date.toISOString().split('T')[0]; // YYYY-MM-DD
        } else if (period === 'weekly') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
        } else if (period === 'monthly') {
          key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        }

        const causes = log.anomaly_causes || [];
        const firstCause = causes[0];
        const anomalyType = firstCause ? firstCause.anomaly_type.toLowerCase() : 'normal';

        if (anomalyType === 'threat') {
          groupedThreats[key] = (groupedThreats[key] || 0) + 1;
        } else {
          groupedNormal[key] = (groupedNormal[key] || 0) + 1;
        }
      });

      // Combine keys from both threats and normal logs
      const allKeys = [...new Set([...Object.keys(groupedThreats), ...Object.keys(groupedNormal)])].sort();
      const labels = allKeys.slice(-30); // Last 30 periods
      const threatData = labels.map(key => groupedThreats[key] || 0);
      const normalData = labels.map(key => groupedNormal[key] || 0);

      return { labels, threatData, normalData };
    };

    const { labels, threatData, normalData } = groupLogsByPeriod(logs, period);

    // Chart.js data structure with two datasets
    const chartData = {
      labels,
      datasets: [
        {
          label: 'Threats',
          data: threatData,
          backgroundColor: 'rgba(231, 76, 60, 0.6)', // Red for threats
          borderColor: 'rgba(231, 76, 60, 1)',
          borderWidth: 1,
        },
        {
          label: 'Normal',
          data: normalData,
          backgroundColor: 'rgba(255, 235, 59, 0.6)', // Yellow for normal
          borderColor: 'rgba(255, 235, 59, 1)',
          borderWidth: 1,
        },
      ],
    };

    return { totalDevices: uniqueDevices, anomalies: anomalyCount, chartData };
  }, [logs, period]);

  if (isLoading) return <div className="card">Loading dashboard data...</div>;

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: `Logs per ${period.charAt(0).toUpperCase() + period.slice(1)} Period`,
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: period === 'daily' ? 'Date' : period === 'weekly' ? 'Week Starting' : 'Month',
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Logs',
        },
        stacked: false, // Bars are side by side
      },
    },
    barPercentage: 0.4, // Reduce bar width for spacing
    categoryPercentage: 0.6, // Add spacing between groups
  };

  return (
    <div className="dashboard-container">
      <h1 className="dashboard-header">Dashboard Overview</h1>
      <div className="card-grid">
        <div className="card">
          <h3 className="card-title">Total Devices</h3>
          <p className="card-value blue">{totalDevices}</p>
        </div>
        <div className="card">
          <h3 className="card-title">Anomalies Detected</h3>
          <p className={`card-value ${anomalies > 0 ? 'red' : 'green'}`}>
            {anomalies}
          </p>
        </div>
      </div>
      <div className="chart-section">
        <div className="card chart-card">
          <h3 className="card-title">Log Trends</h3>
          <div className="period-selector">
            <label htmlFor="period-select">Select Period: </label>
            <select
              id="period-select"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="chart-container">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;