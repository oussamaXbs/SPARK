# log_collector.py
import win32evtlog
import win32evtlogutil
import time
import threading
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class LogCollector:
    def __init__(self, process_log_callback=None):
        """Initialize the LogCollector with a callback function to process logs"""
        self.running = False
        self.process_log_callback = process_log_callback
        self.thread = None
        self.start_time = None
        self.last_processed = {}  # Track last processed record number per log source
        
        # Windows Event Log sources to monitor
        self.log_sources = ["Application", "System"]

    def start_collection(self):
        """Start collecting logs in a separate thread"""
        if not self.running:
            self.start_time = datetime.now()  # Record the start time
            self.running = True
            self.thread = threading.Thread(target=self._collect_logs, daemon=True)
            self.thread.start()
            logger.info("Log collection started")

    def stop_collection(self):
        """Stop collecting logs"""
        self.running = False
        if self.thread:
            self.thread.join()
        logger.info("Log collection stopped")

    def _collect_logs(self):
        """Main loop to collect Windows Event Logs in real-time"""
        # Initialize position for each log source
        for log_type in self.log_sources:
            self._initialize_position(log_type)

        while self.running:
            try:
                for log_type in self.log_sources:
                    self._read_events(log_type)
                time.sleep(1)  # Sleep briefly to avoid overloading
            except Exception as e:
                logger.error(f"Error in log collection: {str(e)}")
                time.sleep(5)  # Wait longer if there's an error

    def _initialize_position(self, log_type):
        """Move the reading position to the latest event and set last processed"""
        hand = win32evtlog.OpenEventLog(None, log_type)
        
        # Get total number of records
        total_records = win32evtlog.GetNumberOfEventLogRecords(hand)
        
        if total_records > 0:
            try:
                # Read the last few events to find the latest record number
                flags = win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ
                events = win32evtlog.ReadEventLog(hand, flags, 0)
                if events:
                    # Set the last processed record number to the latest event
                    self.last_processed[log_type] = events[0].RecordNumber  # First event is the latest
                else:
                    self.last_processed[log_type] = total_records
            except Exception as e:
                logger.error(f"Failed to read last record in {log_type}: {str(e)}")
                self.last_processed[log_type] = total_records
        else:
            self.last_processed[log_type] = 0
        
        win32evtlog.CloseEventLog(hand)

    def _read_events(self, log_type):
        """Read new events from a specific Windows Event Log source"""
        hand = win32evtlog.OpenEventLog(None, log_type)
        
        # Read events sequentially from the current position
        flags = win32evtlog.EVENTLOG_FORWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ
        events = win32evtlog.ReadEventLog(hand, flags, 0)
        
        while events and self.running:
            for event in events:
                # Only process if the record number is greater than the last processed
                if log_type not in self.last_processed or event.RecordNumber > self.last_processed[log_type]:
                    log_entry = self._format_event(event, log_type)
                    event_time = datetime.strptime(log_entry["Timestamp"], "%Y-%m-%d %H:%M:%S")
                    if event_time >= self.start_time:
                        if self.process_log_callback:
                            self.process_log_callback(log_entry)
                        # Update the last processed record number
                        self.last_processed[log_type] = event.RecordNumber
            
            # Read next batch of events
            events = win32evtlog.ReadEventLog(hand, flags, 0)
        
        win32evtlog.CloseEventLog(hand)

    def _format_event(self, event, log_type):
        """Format a Windows Event Log entry with category as separate field"""
        timestamp = event.TimeGenerated.strftime("%Y-%m-%d %H:%M:%S")
        
        event_type_map = {
            win32evtlog.EVENTLOG_ERROR_TYPE: "ERROR",
            win32evtlog.EVENTLOG_WARNING_TYPE: "WARNING",
            win32evtlog.EVENTLOG_INFORMATION_TYPE: "INFO",
            win32evtlog.EVENTLOG_AUDIT_SUCCESS: "INFO",
            win32evtlog.EVENTLOG_AUDIT_FAILURE: "ERROR"
        }
        level = event_type_map.get(event.EventType, "INFO")
        
        # Get message content
        message = ""
        try:
            message = win32evtlogutil.SafeFormatMessage(event, log_type)
            
            if not message and log_type == "System":
                if event.StringInserts:
                    message = " | ".join(str(data) for data in event.StringInserts if data)
                else:
                    message = f"Event ID: {event.EventID}"
        except Exception as e:
            logger.debug(f"Could not format message for EventID {event.EventID}: {str(e)}")
            message = f"Event ID: {event.EventID} (No detailed message available)"
        
        if not message:
            message = f"Event ID: {event.EventID} (No message available)"

        # Create log entry dictionary with category as separate field
        log_entry = {
            "Timestamp": timestamp,
            "event_id": str(event.EventID & 0xFFFF),
            "Level": level,
            "Source": event.SourceName or log_type,
            "Message": message.strip(),
            "Hostname": event.ComputerName or "Unknown",
            "cpu_usage": 0.0,
            "memory_usage": 0.0,
            "Category": event.EventCategory if hasattr(event, 'EventCategory') else None
        }
        
        return log_entry

if __name__ == "__main__":
    # Configure logging for testing
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Test callback function
    def test_callback(log_entry):
        logger.info(f"Collected log: {log_entry}")
    
    # Create and start collector
    collector = LogCollector(process_log_callback=test_callback)
    collector.start_collection()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        collector.stop_collection()