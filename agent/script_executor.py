import subprocess
import logging
import socket
from datetime import datetime
from supabase import Client

# Set up logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ScriptExecutor:
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.hostname = socket.gethostname()
        logger.info(f"ScriptExecutor initialized with hostname: {self.hostname}")

    def check_and_execute_scripts(self):
        """Query anomaly_scripts for queued scripts linked to anomalies for this hostname"""
        if not self.hostname:
            logger.error("Cannot check scripts: invalid hostname")
            return

        try:
            logger.debug(f"Checking for queued scripts for hostname {self.hostname}")

            # Step 1: Get anomaly_logs IDs for this hostname
            log_response = (
                self.supabase.table('anomaly_logs')
                .select('id')
                .eq('hostname', self.hostname)
                .execute()
            )
            anomaly_log_ids = [log['id'] for log in log_response.data]
            logger.debug(f"Anomaly log IDs for hostname {self.hostname}: {anomaly_log_ids}")

            if not anomaly_log_ids:
                logger.info(f"No anomaly logs found for hostname {self.hostname}")
                return

            # Step 2: Get anomaly_causes IDs for these anomaly_log IDs
            cause_response = (
                self.supabase.table('anomaly_causes')
                .select('id')
                .in_('anomaly_id', anomaly_log_ids)
                .execute()
            )
            cause_ids = [cause['id'] for cause in cause_response.data]
            logger.debug(f"Anomaly cause IDs: {cause_ids}")

            if not cause_ids:
                logger.info(f"No anomaly causes found for anomaly log IDs {anomaly_log_ids}")
                return

            # Step 3: Get queued scripts for these cause IDs
            script_response = (
                self.supabase.table('anomaly_scripts')
                .select('*')
                .eq('status', 'queued')
                .in_('cause_id', cause_ids)
                .execute()
            )
            scripts = script_response.data
            logger.debug(f"Raw script query response: {scripts}")

            if not scripts:
                logger.info(f"No queued scripts found for hostname {self.hostname}")
                return

            for script in scripts:
                script_id = script['id']
                script_content = script['script_content']
                logger.info(f"Executing script ID {script_id} for hostname {self.hostname}")

                # Execute the PowerShell command in background
                success = self._execute_powershell_background(script_content, script_id)

                # Update the script status in Supabase
                status = 'executed' if success else 'failed'
                update_data = {
                    'status': status,
                    'executed_at': datetime.utcnow().isoformat(),
                    'updated_at': datetime.utcnow().isoformat()
                }
                self.supabase.table('anomaly_scripts').update(update_data).eq('id', script_id).execute()
                logger.info(f"Updated script ID {script_id} to status {status}")

        except Exception as e:
            logger.error(f"Error checking/executing scripts: {str(e)}", exc_info=True)

    def _execute_powershell_background(self, command: str, script_id: int) -> bool:
        """Execute a PowerShell command in background without showing window"""
        try:
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startupinfo.wShowWindow = subprocess.SW_HIDE

            # Run PowerShell command in background
            cmd = ['powershell.exe', '-WindowStyle', 'Hidden', '-Command', command]
            logger.debug(f"Executing background command: {' '.join(cmd)}")
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30,
                startupinfo=startupinfo,
                creationflags=subprocess.CREATE_NO_WINDOW
            )

            # Log output
            if result.stdout:
                logger.info(f"Script ID {script_id} output: {result.stdout}")
            if result.stderr:
                logger.error(f"Script ID {script_id} error: {result.stderr}")

            success = result.returncode == 0
            logger.info(f"Script ID {script_id} execution {'succeeded' if success else 'failed'}")
            return success

        except subprocess.TimeoutExpired:
            logger.error(f"Script ID {script_id} timed out after 30 seconds")
            return False
        except Exception as e:
            logger.error(f"Error executing script ID {script_id}: {str(e)}", exc_info=True)
            return False
