const API_BASE_URL = 'http://localhost:5000/api'; // Adjust as needed

export const apiRequest = async (endpoint, method = 'GET', data = null, includeUserId = false) => {
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (includeUserId) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user && user.id) {
      config.headers['X-User-ID'] = user.id;
    }
  }

  if (data) {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'API request failed');
    }

    return result;
  } catch (error) {
    console.error(`API request failed for ${endpoint}:`, error);
    throw error;
  }
};

// Authentication
export const login = (email, password) => 
  apiRequest('/auth/login', 'POST', { email, password });

export const logout = () => 
  apiRequest('/auth/logout', 'POST');

// Logs
export const fetchLogs = () => 
  apiRequest('/logs');

// Metrics (New)
export const fetchMetrics = () => 
  apiRequest('/metrics');

// Users
export const fetchUsers = () => 
  apiRequest('/users', 'GET', null, true);

export const createUser = (userData) => 
  apiRequest('/users', 'POST', userData, true);

export const deleteUser = (userId) => 
  apiRequest(`/users/${userId}`, 'DELETE', null, true);

export const updateUserRole = (userId, role) => 
  apiRequest(`/users/${userId}/role`, 'PUT', { role }, true);

// Anomaly Scripts
export const updateScriptStatus = (causeId, status) => 
  apiRequest(`/anomaly_scripts/${causeId}/status`, 'PUT', { status }, true);

export const fetchScriptContent = (causeId) => 
  apiRequest(`/scripts/${causeId}`, 'GET', null, true);