from flask import Flask, request, jsonify
from supabase import create_client, Client
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Supabase configuration
SUPABASE_URL = 'https://bjkissrqquzlpxtgbodn.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqa2lzc3JxcXV6bHB4dGdib2RuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzI2NTc0NSwiZXhwIjoyMDU4ODQxNzQ1fQ.41BD4cRjTmHZ5cro_myoEJ8CyiWjjwzrq67nlelfcHo'
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Middleware to check admin role
def check_admin_role(user_id):
    try:
        user_data = supabase.table('users').select('role').eq('id', user_id).single().execute()
        if not user_data.data or user_data.data['role'] != 'admin':
            return False
        return True
    except Exception as e:
        print(f"Error checking admin role: {str(e)}")
        return False

# Authentication Routes
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    try:
        response = supabase.auth.sign_in_with_password({
            'email': email,
            'password': password
        })
        user = response.user

        user_data = supabase.table('users').select('id, username, role').eq('id', user.id).single().execute()
        return jsonify({
            'id': user_data.data['id'],
            'username': user_data.data['username'],
            'role': user_data.data['role']
        })
    except Exception as e:
        return jsonify({'message': str(e)}), 401

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    try:
        supabase.auth.sign_out()
        return jsonify({'message': 'Logged out successfully'})
    except Exception as e:
        return jsonify({'message': str(e)}), 500

# Logs Route
@app.route('/api/logs', methods=['GET'])
def get_logs():
    try:
        logs_response = supabase.table('anomaly_logs').select(
            'id, timestamp, event_id, level, source, message, hostname, cpu_usage, memory_usage, is_anomaly, anomaly_score, anomaly_causes(id, anomaly_type, cause, recommendation, device_type)'
        ).eq('is_anomaly', True).order('timestamp', desc=True).execute()

        logs = logs_response.data

        cause_ids = set()
        for log in logs:
            causes = log.get('anomaly_causes', [])
            for cause in causes:
                cause_id = cause.get('id')
                if cause_id:
                    cause_ids.add(cause_id)

        scripts_response = supabase.table('anomaly_scripts').select('cause_id, script_content').in_('cause_id', list(cause_ids)).execute()
        script_map = {s['cause_id']: s['script_content'] for s in scripts_response.data}

        for log in logs:
            causes = log.get('anomaly_causes', [])
            for cause in causes:
                cid = cause.get('id')
                cause['anomaly_scripts'] = {
                    'script_content': script_map.get(cid, 'No script available')
                }

        return jsonify(logs)

    except Exception as e:
        print(f"Error fetching logs: {str(e)}")
        return jsonify({'message': str(e)}), 500

# Metrics Route (Updated with all disk fields)
@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    try:
        metrics_response = supabase.table('system_metrics').select(
            'id, created_at, hostname, cpu_usage_percent, '
            'memory_usage_gb, memory_total_gb, memory_usage_percent, '
            'primary_disk_usage_gb, primary_disk_capacity_gb, primary_disk_usage_percent, '
            'secondary_disk_usage_gb, secondary_disk_capacity_gb, secondary_disk_usage_percent'
        ).order('created_at', desc=True).execute()
        metrics = metrics_response.data
        return jsonify(metrics)
    except Exception as e:
        print(f"Error fetching metrics: {str(e)}")
        return jsonify({'message': str(e)}), 500

# User Management Routes
@app.route('/api/users', methods=['GET'])
def get_users():
    user_id = request.headers.get('X-User-ID')
    if not user_id or not check_admin_role(user_id):
        return jsonify({'message': 'User not allowed'}), 403

    try:
        response = supabase.table('users').select('id, username, email, role, created_at').order('created_at', desc=True).execute()
        return jsonify(response.data)
    except Exception as e:
        print(f"Error fetching users: {str(e)}")
        return jsonify({'message': str(e)}), 500

@app.route('/api/users', methods=['POST'])
def create_user():
    user_id = request.headers.get('X-User-ID')
    if not user_id or not check_admin_role(user_id):
        return jsonify({'message': 'User not allowed'}), 403

    data = request.get_json()
    try:
        auth_response = supabase.auth.admin.create_user({
            'email': data['email'],
            'password': data['password'],
            'email_confirm': True,
            'user_metadata': {'username': data['username']}
        })

        user_data = supabase.table('users').insert({
            'id': auth_response.user.id,
            'email': data['email'],
            'username': data['username'],
            'role': data['role']
        }).execute()

        return jsonify(user_data.data[0])
    except Exception as e:
        print(f"Error creating user: {str(e)}")
        return jsonify({'message': str(e)}), 400

@app.route('/api/users/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    requester_id = request.headers.get('X-User-ID')
    if not requester_id or not check_admin_role(requester_id):
        return jsonify({'message': 'User not allowed'}), 403

    if requester_id == user_id:
        return jsonify({'message': 'Cannot delete yourself'}), 403

    try:
        supabase.table('users').delete().eq('id', user_id).execute()
        supabase.auth.admin.delete_user(user_id)
        return jsonify({'message': 'User deleted successfully'})
    except Exception as e:
        print(f"Error deleting user: {str(e)}")
        return jsonify({'message': str(e)}), 500

@app.route('/api/users/<user_id>/role', methods=['PUT'])
def update_user_role(user_id):
    requester_id = request.headers.get('X-User-ID')
    if not requester_id or not check_admin_role(requester_id):
        return jsonify({'message': 'User not allowed'}), 403

    if requester_id == user_id:
        return jsonify({'message': 'Cannot change your own role'}), 403

    data = request.get_json()
    try:
        response = supabase.table('users').update({'role': data['role']}).eq('id', user_id).execute()
        return jsonify(response.data[0])
    except Exception as e:
        print(f"Error updating user role: {str(e)}")
        return jsonify({'message': str(e)}), 500

# Anomaly Scripts Routes
@app.route('/api/anomaly_scripts/<cause_id>/status', methods=['PUT'])
def update_script_status(cause_id):
    requester_id = request.headers.get('X-User-ID')
    if not requester_id or not check_admin_role(requester_id):
        return jsonify({'message': 'User not allowed'}), 403

    data = request.get_json()
    status = data.get('status')

    try:
        response = supabase.table('anomaly_scripts').update({
            'status': status,
            'updated_at': 'now()'
        }).eq('cause_id', cause_id).execute()

        if not response.data:
            return jsonify({'message': 'No script found for this cause'}), 404

        return jsonify(response.data[0])
    except Exception as e:
        print(f"Error updating script status: {str(e)}")
        return jsonify({'message': str(e)}), 500

@app.route('/api/scripts/<cause_id>', methods=['GET'])
def get_script(cause_id):
    requester_id = request.headers.get('X-User-ID')
    if not requester_id or not check_admin_role(requester_id):
        return jsonify({'message': 'User not allowed'}), 403

    try:
        response = supabase.table('anomaly_scripts').select('script_content').eq('cause_id', cause_id).execute()
        return jsonify(response.data[0] if response.data else {'script_content': 'No script available'})
    except Exception as e:
        print(f"Error fetching script: {str(e)}")
        return jsonify({'message': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)