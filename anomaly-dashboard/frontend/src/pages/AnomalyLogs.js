import React, { useState, useMemo, useEffect } from 'react';
import { apiRequest } from '../api'; // Adjust path as needed
import './AnomalyLogs.css';

const AnomalyLogs = ({ logs, isLoading }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (logs.length > 0) {
      console.log("First log entry:", logs[0]);
      if (logs[0].anomaly_causes) {
        console.log("First anomaly cause:", logs[0].anomaly_causes[0]);
      }
    }
  }, [logs]);

  const sortedLogs = useMemo(() => {
    const sortableLogs = [...logs];
    if (sortConfig.key) {
      sortableLogs.sort((a, b) => {
        if (!['device_type', 'cause', 'recommendation'].includes(sortConfig.key)) {
          const aValue = a[sortConfig.key] || '';
          const bValue = b[sortConfig.key] || '';
          return sortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }
        
        const aCause = a.anomaly_causes?.[0] || {};
        const bCause = b.anomaly_causes?.[0] || {};
        const aValue = aCause[sortConfig.key] || '';
        const bValue = bCause[sortConfig.key] || '';
        
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      });
    }
    return sortableLogs;
  }, [logs, sortConfig]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedLogs, currentPage]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleAutoFix = async (causeId) => {
    try {
      await apiRequest(`/anomaly_scripts/${causeId}/status`, 'PUT', { status: 'queued' }, true);
      alert('Script status changed to queued successfully');
    } catch (error) {
      console.error('Error queueing script:', error);
      alert('Failed to queue script: ' + error.message);
    }
  };

  if (isLoading) return <div className="no-logs">Loading logs...</div>;

  return (
    <div className="anomaly-container">
      <h1 className="anomaly-header">Anomaly Logs</h1>
      
      {logs.length === 0 ? (
        <div className="no-logs">No anomaly logs found.</div>
      ) : (
        <>
          <div className="table-container">
            <table className="logs-table">
              <thead>
                <tr>
                  {['timestamp', 'hostname', 'device_type', 'source', 'message', 'cause', 'recommendation', 'actions'].map((key) => (
                    <th 
                      key={key}
                      onClick={key !== 'actions' ? () => requestSort(key) : undefined}
                    >
                      {key.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}
                      {sortConfig.key === key && key !== 'actions' && (
                        sortConfig.direction === 'asc' ? ' ↑' : ' ↓'
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map((log, index) => {
                  const anomalyCause = log.anomaly_causes?.[0] || {};
                  
                  return (
                    <tr key={index}>
                      <td>{log.timestamp}</td>
                      <td>{log.hostname}</td>
                      <td>{anomalyCause.device_type || 'N/A'}</td>
                      <td>{log.source}</td>
                      <td>{log.message}</td>
                      <td>{anomalyCause.cause || 'N/A'}</td>
                      <td>{anomalyCause.recommendation || 'N/A'}</td>
                      <td>
                        {anomalyCause.id && (
                          <button 
                            className="auto-fix-button"
                            onClick={() => handleAutoFix(anomalyCause.id)}
                          >
                            Auto Fix
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="pagination">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="pagination-button"
            >
              Previous
            </button>
            <span className="pagination-span">
              Page {currentPage} of {Math.ceil(sortedLogs.length / itemsPerPage)}
            </span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(sortedLogs.length / itemsPerPage), p + 1))}
              disabled={currentPage === Math.ceil(sortedLogs.length / itemsPerPage)}
              className="pagination-button"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AnomalyLogs;