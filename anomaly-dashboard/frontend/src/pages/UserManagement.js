// src/pages/UserManagement.js
import React, { useState, useEffect } from 'react';
import { fetchUsers, createUser, deleteUser, updateUserRole } from '../api';
import './UserManagement.css';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        setCurrentUserId(storedUser?.id || null);
        const data = await fetchUsers();
        setUsers(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const validatePassword = () => {
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return false;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return false;
    }
    setPasswordError('');
    return true;
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validatePassword()) return;

    setLoading(true);
    try {
      const userData = {
        email: newEmail,
        password: newPassword,
        username: newUsername,
        role: newRole,
      };
      const newUser = await createUser(userData);
      setUsers([newUser, ...users]);
      setNewEmail('');
      setNewPassword('');
      setConfirmPassword('');
      setNewUsername('');
      setNewRole('user');
      setSuccess('User created successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (userId === currentUserId) {
      setError('You cannot delete yourself!');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this user?')) return;

    setLoading(true);
    try {
      await deleteUser(userId);
      setUsers(users.filter(user => user.id !== userId));
      setSuccess('User deleted successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    if (userId === currentUserId) {
      setError('You cannot change your own role!');
      return;
    }

    setLoading(true);
    try {
      await updateUserRole(userId, newRole);
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
      setSuccess('User role updated successfully!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="user-container">
      <h1 className="user-header">User Management</h1>
      <div className="form-container">
        <h3 className="form-header">Add New User</h3>
        <form onSubmit={handleAddUser}>
          <div className="input-group">
            <label className="input-label">Email</label>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required className="input-field" placeholder="user@example.com" />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input type="password" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); if (confirmPassword) validatePassword(); }} required className="input-field" placeholder="Minimum 6 characters" minLength="6" />
          </div>
          <div className="input-group">
            <label className="input-label">Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); validatePassword(); }} required className="input-field" placeholder="Confirm your password" />
            {passwordError && <p className="password-error">{passwordError}</p>}
          </div>
          <div className="input-group">
            <label className="input-label">Username</label>
            <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required className="input-field" placeholder="Display name" />
          </div>
          <div className="input-group">
            <label className="input-label">Role</label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="select-field">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <p className="error-message">{error}</p>}
          {success && <p className="success-message">{success}</p>}
          <button type="submit" className="primary-button" disabled={loading}>{loading ? 'Creating...' : 'Add User'}</button>
        </form>
      </div>
      <div style={{ minHeight: '300px' }}>
        {loading && users.length === 0 ? (
          <div className="loading-container">Loading users...</div>
        ) : (
          <div className="table-container">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>
                      <select value={user.role} onChange={(e) => handleUpdateRole(user.id, e.target.value)} className="select-field" disabled={loading || user.id === currentUserId}>
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <button onClick={() => handleDeleteUser(user.id)} className={`danger-button ${user.id === currentUserId ? 'disabled' : ''}`} disabled={loading || user.id === currentUserId}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;