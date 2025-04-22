import os
import csv
import logging
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def save_log_with_metrics(log_entry):
    """Save the log entry with metrics to a single CSV file in the data folder"""
    try:
        # Ensure the data folder exists
        os.makedirs("data", exist_ok=True)

        # Define the CSV file path
        filename = "data/logs_with_metrics.csv"

        # Define the CSV header
        fieldnames = [
            "Timestamp", "Event ID", "Level", "Source", "Message", "Hostname",
            "CPU Usage", "Memory Usage"
        ]

        # Write the log entry with metrics to the CSV file
        with open(filename, "a", newline='') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

            # Write the header if the file is empty
            if os.path.getsize(filename) == 0:
                writer.writeheader()

            writer.writerow({
                "Timestamp": log_entry["Timestamp"],
                "Event ID": log_entry["event_id"],
                "Level": log_entry["Level"],
                "Source": log_entry["Source"],
                "Message": log_entry["Message"],
                "Hostname": log_entry["Hostname"],
                "CPU Usage": log_entry["cpu_usage"],
                "Memory Usage": log_entry["memory_usage"]
            })

        logger.info(f"Saved log with metrics to {filename}")
    except Exception as e:
        logger.error(f"Error saving log with metrics: {str(e)}")