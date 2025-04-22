import os
import time
from dotenv import load_dotenv
from supabase import create_client, Client
from log_collector import LogCollector
from anomaly_detector import AnomalyDetector
import logging
from metric_collector import collect_metrics
from log_saver import save_log_with_metrics 
from log_saver_fine_tuning import save_log_for_fine_tuning
from log_saver_anomalies import save_anomaly_log
from script_executor import ScriptExecutor

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Supabase configuration
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def process_log_entry(log_entry):
    """Process a single log entry through the anomaly detection pipeline and save to Supabase"""
    try:
        # Collect metrics
        metrics = collect_metrics()
        log_entry["cpu_usage"] = metrics["cpu_usage"]
        log_entry["memory_usage"] = metrics["memory_usage"]

        is_anomaly, anomaly_score = detector.detect_single_event(log_entry['Message'])
        
        # If it's an anomaly, prepare data for Supabase
        if is_anomaly:
            supabase_data = {
                "timestamp": log_entry["Timestamp"],
                "event_id": log_entry["event_id"],
                "level": log_entry["Level"],
                "source": log_entry["Source"],
                "message": log_entry["Message"],
                "hostname": log_entry["Hostname"],
                "cpu_usage": log_entry["cpu_usage"],
                "memory_usage": log_entry["memory_usage"],
                "is_anomaly": is_anomaly,
                "anomaly_score": anomaly_score,
            }
            
            # Insert into Supabase
            response = supabase.table('anomaly_logs').insert(supabase_data).execute()
            logger.info(f"Saved anomaly to Supabase: {response}")
            
            # Save anomaly log to a separate CSV file using log_saver_anomalies.py
            save_anomaly_log(supabase_data)
        
        # Save log with metrics to a single CSV file using log_saver.py
        save_log_with_metrics(log_entry)
        
        # Save log for fine-tuning to a separate CSV file using log_saver_fine_tuning.py
        save_log_for_fine_tuning(log_entry, is_anomaly)
            
    except Exception as e:
        logger.error(f"Error processing log entry: {str(e)}", exc_info=True)

# Initialize components
detector = AnomalyDetector()
log_collector = LogCollector(process_log_callback=process_log_entry)
script_executor = ScriptExecutor(supabase)

def main():
    """Main function to start the application"""
    try:
        logger.info("Starting Windows Log Monitor")
        log_collector.start_collection()
        
        # Periodically check for queued scripts
        while True:
            logger.debug("Checking for queued scripts")
            script_executor.check_and_execute_scripts()
            time.sleep(20)  # Check every 20 seconds

    except KeyboardInterrupt:
        logger.info("Stopping Windows Log Monitor")
        log_collector.stop_collection()
    except Exception as e:
        logger.error(f"Application error: {str(e)}", exc_info=True)
        log_collector.stop_collection()

if __name__ == "__main__":
    main()
