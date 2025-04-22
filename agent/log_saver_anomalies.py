import os
import csv
import logging
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def save_anomaly_log(log_entry):
    """Save the anomaly log entry to a CSV file in the anomalies_data folder"""
    try:
        # Ensure the anomalies_data folder exists
        os.makedirs("anomalies_data", exist_ok=True)

        # Define the CSV file path
        filename = "anomalies_data/anomalies.csv"

        # Define the CSV header
        fieldnames = [
            "timestamp", "event_id", "level", "source", "message", "hostname",
            "cpu_usage", "memory_usage", "is_anomaly", "anomaly_score"
        ]

        # Check if the log entry is valid
        if not all(key in log_entry for key in fieldnames):
            logger.warning("Invalid log entry: missing required fields")
            return

        # Write the anomaly log entry to the CSV file
        with open(filename, "a", newline='') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

            # Write the header if the file is empty
            if os.path.getsize(filename) == 0:
                writer.writeheader()

            writer.writerow(log_entry)

        logger.info(f"Saved anomaly log to {filename}")
    except Exception as e:
        logger.error(f"Error saving anomaly log: {str(e)}")