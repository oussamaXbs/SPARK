import psutil 
import time
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def collect_metrics():
    try:
        # Prime the CPU usage calculation
        psutil.cpu_percent(interval=1)  # Initial call to prime the calculation

        # Introduce a small delay to ensure the CPU usage is accurately calculated
        time.sleep(1)

        # Collect CPU usage
        cpu_usage = psutil.cpu_percent(interval=None)
        # Collect memory usage
        memory = psutil.virtual_memory()
        memory_usage = memory.percent

        # Return the metrics
        return {"cpu_usage": cpu_usage, "memory_usage": memory_usage}

    except Exception as e:
        logger.error(f"Error collecting metrics: {str(e)}")
        return {"cpu_usage": 0.0, "memory_usage": 0.0}