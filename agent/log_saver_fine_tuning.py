import os
import csv
import logging
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def save_log_for_fine_tuning(log_entry, is_anomaly):
    """Save the log entry with metrics to a CSV file in the fine_tuning_data folder"""
    try:
        # Ensure the fine_tuning_data folder exists
        os.makedirs("fine_tuning_data", exist_ok=True)

        # Define the CSV file path
        filename = "fine_tuning_data/logs_for_fine_tuning.csv"

        # Define the CSV header
        fieldnames = [
            "level", "source", "message", "full_message", "is_anomaly"
        ]

        # Prepare the full message
        full_message = f"{log_entry['Level']} - {log_entry['Source']} - {log_entry['Message']}"

        # Write the log entry with metrics to the CSV file
        with open(filename, "a", newline='') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

            # Write the header if the file is empty
            if os.path.getsize(filename) == 0:
                writer.writeheader()

            writer.writerow({
                "level": log_entry["Level"],
                "source": log_entry["Source"],
                "message": log_entry["Message"],
                "full_message": full_message,
                "is_anomaly": int(is_anomaly)
            })

        logger.info(f"Saved log for fine-tuning to {filename}")
    except Exception as e:
        logger.error(f"Error saving log for fine-tuning: {str(e)}")
