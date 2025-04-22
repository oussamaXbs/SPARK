import React, { useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiRequest, fetchMetrics } from '../api';
import GaugeChart from 'react-gauge-chart';
import './DeviceList.css';

const DeviceList = ({ logs, isLoading }) => {
  const { type } = useParams();
  const [expandedRows, setExpandedRows] = useState({});
  const [expandedDevices, setExpandedDevices] = useState({});
  const [metrics, setMetrics] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Auto-refresh metrics every 10 seconds
  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await fetchMetrics();
        setMetrics(data);
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Error fetching metrics:', error);
      }
    };

    // Initial fetch
    fetchData();

    // Set up interval (10 seconds)
    const intervalId = setInterval(fetchData, 10000);

    // Cleanup
    return () => clearInterval(intervalId);
  }, []);

  const devices = useMemo(() => {
    const filteredLogs = (Array.isArray(logs) ? logs : []).filter(log => {
      const deviceType = log.anomaly_causes?.[0]?.device_type?.toLowerCase();
      if (type.toLowerCase() === 'switch') {
        return (deviceType === 'switch' || deviceType === 'server') && log.is_anomaly;
      }
      return deviceType === type.toLowerCase() && log.is_anomaly;
    });

    const deviceMap = filteredLogs.reduce((acc, log) => {
      const hostname = log.hostname;
      if (!acc[hostname]) {
        acc[hostname] = {
          hostname,
          device_type: log.anomaly_causes?.[0]?.device_type || 'Unknown',
          anomalies: [],
          metrics: null,
        };
      }
      acc[hostname].anomalies.push({
        message: log.message || 'No message available',
        timestamp: log.timestamp,
        cause: log.anomaly_causes?.[0]?.cause || 'Unknown',
        recommendation: log.anomaly_causes?.[0]?.recommendation || 'None',
        anomaly_type: log.anomaly_causes?.[0]?.anomaly_type || 'unknown',
        causeId: log.anomaly_causes?.[0]?.id,
        script_content: log.anomaly_causes?.[0]?.anomaly_scripts?.script_content || 'No script available',
        isThreat: log.anomaly_causes?.[0]?.anomaly_type === 'threat',
      });
      return acc;
    }, {});

    Object.values(deviceMap).forEach(device => {
      const deviceMetrics = (Array.isArray(metrics) ? metrics : [])
        .filter(metric => metric.hostname === device.hostname)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      device.metrics = deviceMetrics || null;
      device.anomalies.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    });

    return Object.values(deviceMap);
  }, [logs, metrics, type]);

  const handleAutoFix = async (causeId) => {
    try {
      await apiRequest(`/anomaly_scripts/${causeId}/status`, 'PUT', { status: 'queued' }, true);
      alert('Script status changed to queued successfully');
    } catch (error) {
      console.error('Error queueing script:', error);
      alert('Failed to queue script: ' + error.message);
    }
  };

  const toggleRow = (key) => {
    setExpandedRows(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleDevice = (hostname) => {
    setExpandedDevices(prev => ({
      ...prev,
      [hostname]: !prev[hostname]
    }));
  };

  const gaugeStyle = {
    width: '100px',
    height: '80px',
  };

  const gaugeColors = {
    safe: '#00FF00',
    warning: '#FFFF00',
    critical: '#FF0000',
  };

  if (!['pc', 'router', 'switch'].includes(type.toLowerCase())) {
    return (
      <div className="device-container">
        <h1 className="device-header">Invalid Device Type</h1>
        <p>Please select a valid device type (PC, Router, or Switch).</p>
      </div>
    );
  }

  if (isLoading) return <div className="no-devices">Loading devices...</div>;

  return (
    <div className="device-container">
      <div className="device-header-container">
        <h1 className="device-header">{type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()} Devices</h1>
        <div className="last-updated">
          Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
        </div>
      </div>
      
      {devices.length === 0 ? (
        <div className="no-devices">No anomalous {type.toLowerCase()} devices found.</div>
      ) : (
        <div className="device-list">
          {devices.map((device, index) => {
            const cpuUsage = device.metrics?.cpu_usage_percent || 0;
            const memoryUsageGB = Number(device.metrics?.memory_usage_gb) || 0;
            const memoryTotalGB = Number(device.metrics?.memory_total_gb) || 0;
            const diskUsageGB = Number(device.metrics?.primary_disk_usage_gb) || 0;
            const diskTotalGB = Number(device.metrics?.primary_disk_capacity_gb) || 0;
            const secondaryDiskUsageGB = device.metrics?.secondary_disk_usage_gb != null 
              ? Number(device.metrics.secondary_disk_usage_gb) 
              : null;
            const secondaryDiskTotalGB = device.metrics?.secondary_disk_capacity_gb != null 
              ? Number(device.metrics.secondary_disk_capacity_gb) 
              : null;

            const hasSecondaryDiskData = secondaryDiskUsageGB != null && secondaryDiskTotalGB != null && secondaryDiskTotalGB > 0;

            return (
              <div key={index} className="device-section">
                <div 
                  className="device-section-header"
                  onClick={() => toggleDevice(device.hostname)}
                  role="button"
                  aria-expanded={expandedDevices[device.hostname]}
                  style={{ cursor: 'pointer' }}
                >
                  <h2>{device.hostname}</h2>
                  <div className="metrics-container">
                    {device.metrics ? (
                      <div className="metrics-gauges">
                        <div className="gauge-item">
                          <GaugeChart
                            id={`cpu-gauge-${device.hostname}`}
                            nrOfLevels={30}
                            arcsLength={[0.6, 0.2, 0.2]}
                            colors={[gaugeColors.safe, gaugeColors.warning, gaugeColors.critical]}
                            percent={cpuUsage / 100}
                            arcWidth={0.4}
                            arcPadding={0}
                            cornerRadius={0}
                            textColor="#00FFFF"
                            needleColor="#00FFFF"
                            needleBaseColor="#00FFFF"
                            style={gaugeStyle}
                            hideText={true}
                          />
                          <span className="gauge-value">{cpuUsage.toFixed(1)}%</span>
                          <span className="gauge-label">CPU</span>
                        </div>
                        <div className="gauge-item">
                          <GaugeChart
                            id={`memory-gauge-${device.hostname}`}
                            nrOfLevels={30}
                            arcsLength={[0.6, 0.2, 0.2]}
                            colors={[gaugeColors.safe, gaugeColors.warning, gaugeColors.critical]}
                            percent={(memoryUsageGB / memoryTotalGB) || 0}
                            arcWidth={0.4}
                            arcPadding={0}
                            cornerRadius={0}
                            textColor="#00FFFF"
                            needleColor="#00FFFF"
                            needleBaseColor="#00FFFF"
                            style={gaugeStyle}
                            hideText={true}
                          />
                          <span className="gauge-value">
                            {memoryUsageGB.toFixed(1)} / {memoryTotalGB.toFixed(1)} GB
                          </span>
                          <span className="gauge-label">MEMORY</span>
                        </div>
                        <div className="gauge-item">
                          <GaugeChart
                            id={`disk-gauge-${device.hostname}`}
                            nrOfLevels={30}
                            arcsLength={[0.6, 0.2, 0.2]}
                            colors={[gaugeColors.safe, gaugeColors.warning, gaugeColors.critical]}
                            percent={(diskUsageGB / diskTotalGB) || 0}
                            arcWidth={0.4}
                            arcPadding={0}
                            cornerRadius={0}
                            textColor="#00FFFF"
                            needleColor="#00FFFF"
                            needleBaseColor="#00FFFF"
                            style={gaugeStyle}
                            hideText={true}
                          />
                          <span className="gauge-value">
                            {diskUsageGB.toFixed(1)} / {diskTotalGB.toFixed(1)} GB
                          </span>
                          <span className="gauge-label">DISK 1</span>
                        </div>
                        {hasSecondaryDiskData && (
                          <div className="gauge-item">
                            <GaugeChart
                              id={`secondary-disk-gauge-${device.hostname}`}
                              nrOfLevels={30}
                              arcsLength={[0.6, 0.2, 0.2]}
                              colors={[gaugeColors.safe, gaugeColors.warning, gaugeColors.critical]}
                              percent={(secondaryDiskUsageGB / secondaryDiskTotalGB) || 0}
                              arcWidth={0.4}
                              arcPadding={0}
                              cornerRadius={0}
                              textColor="#00FFFF"
                              needleColor="#00FFFF"
                              needleBaseColor="#00FFFF"
                              style={gaugeStyle}
                              hideText={true}
                            />
                            <span className="gauge-value">
                              {secondaryDiskUsageGB.toFixed(1)} / {secondaryDiskTotalGB.toFixed(1)} GB
                            </span>
                            <span className="gauge-label">DISK 2</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="no-metrics">No metrics available</div>
                    )}
                  </div>
                </div>
                {expandedDevices[device.hostname] && (
                  device.anomalies.length > 0 ? (
                    <div className="anomaly-table-container">
                      <table className="anomaly-table">
                        <thead>
                          <tr>
                            <th>Message</th>
                            <th>Detected</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {device.anomalies.map((anomaly, idx) => {
                            const rowKey = `${index}-${idx}`;
                            return (
                              <React.Fragment key={idx}>
                                <tr 
                                  className={anomaly.isThreat ? 'threat-anomaly' : 'normal-anomaly'}
                                  onClick={() => toggleRow(rowKey)}
                                  role="button"
                                  aria-expanded={expandedRows[rowKey]}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <td className="message-column expanded-message">
                                    {anomaly.message}
                                  </td>
                                  <td className="time-column">{new Date(anomaly.timestamp).toLocaleString()}</td>
                                  <td className="action-column">
                                    {anomaly.causeId && (
                                      <button
                                        className="auto-fix-button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAutoFix(anomaly.causeId);
                                        }}
                                      >
                                        Auto Fix
                                      </button>
                                    )}
                                  </td>
                                </tr>
                                {expandedRows[rowKey] && (
                                  <tr className="details-row">
                                    <td colSpan="3">
                                      <div className="details-content">
                                        <div className="details-left">
                                          <dl>
                                            <dt>Cause</dt>
                                            <dd>{anomaly.cause}</dd>
                                            <dt>Timestamp</dt>
                                            <dd>{new Date(anomaly.timestamp).toLocaleString()}</dd>
                                            <dt>Recommendation</dt>
                                            <dd>{anomaly.recommendation}</dd>
                                            <dt>Anomaly Type</dt>
                                            <dd>{anomaly.anomaly_type}</dd>
                                          </dl>
                                        </div>
                                        <div className="script-content">
                                          <h4>Script Content</h4>
                                          <pre>{anomaly.script_content}</pre>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="no-anomalies">No anomalies found for this device.</p>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DeviceList;