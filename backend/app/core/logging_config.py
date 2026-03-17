"""
Logging configuration for the application.
Writes logs to both console and file for monitoring.
"""

import logging
import os
from logging.handlers import RotatingFileHandler
from datetime import datetime

# Log directory
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs")
LOG_FILE = os.path.join(LOG_DIR, "app.log")

# Ensure log directory exists
os.makedirs(LOG_DIR, exist_ok=True)


def setup_logging():
    """Configure application logging with file rotation."""

    # Create formatter
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    # File handler with rotation (5MB max, keep 3 backups)
    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=5 * 1024 * 1024,  # 5MB
        backupCount=3,
        encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)

    # Remove existing handlers to avoid duplicates
    root_logger.handlers.clear()

    # Add handlers
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)

    # Create app logger
    app_logger = logging.getLogger("app")
    app_logger.setLevel(logging.INFO)

    return app_logger


def get_logger(name: str = "app") -> logging.Logger:
    """Get a logger instance."""
    return logging.getLogger(name)


def read_logs(lines: int = 100, level: str = None) -> list[dict]:
    """
    Read recent log entries from the log file.

    Args:
        lines: Number of recent lines to return
        level: Filter by log level (INFO, WARNING, ERROR, etc.)

    Returns:
        List of log entries as dictionaries
    """
    if not os.path.exists(LOG_FILE):
        return []

    entries = []

    try:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            # Read all lines and get the last N
            all_lines = f.readlines()
            recent_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines

            for line in recent_lines:
                line = line.strip()
                if not line:
                    continue

                # Parse log line
                entry = parse_log_line(line)
                if entry:
                    # Filter by level if specified
                    if level and entry["level"] != level.upper():
                        continue
                    entries.append(entry)

    except Exception as e:
        entries.append({
            "timestamp": datetime.now().isoformat(),
            "level": "ERROR",
            "logger": "system",
            "message": f"Failed to read logs: {str(e)}"
        })

    return entries


def parse_log_line(line: str) -> dict | None:
    """Parse a log line into a structured dictionary."""
    try:
        # Format: "2024-01-15 10:30:45 | INFO     | app | Message here"
        parts = line.split(" | ", 3)
        if len(parts) >= 4:
            return {
                "timestamp": parts[0],
                "level": parts[1].strip(),
                "logger": parts[2],
                "message": parts[3]
            }
        elif len(parts) == 3:
            return {
                "timestamp": parts[0],
                "level": parts[1].strip(),
                "logger": "unknown",
                "message": parts[2]
            }
        else:
            # Non-standard format, return as-is
            return {
                "timestamp": "",
                "level": "INFO",
                "logger": "unknown",
                "message": line
            }
    except Exception:
        return None


def get_log_stats() -> dict:
    """Get statistics about the log file."""
    if not os.path.exists(LOG_FILE):
        return {
            "file_size": 0,
            "file_size_human": "0 B",
            "total_lines": 0,
            "log_file": LOG_FILE
        }

    file_size = os.path.getsize(LOG_FILE)

    # Count lines
    with open(LOG_FILE, "r", encoding="utf-8") as f:
        total_lines = sum(1 for _ in f)

    # Human readable size
    if file_size < 1024:
        size_human = f"{file_size} B"
    elif file_size < 1024 * 1024:
        size_human = f"{file_size / 1024:.1f} KB"
    else:
        size_human = f"{file_size / (1024 * 1024):.1f} MB"

    return {
        "file_size": file_size,
        "file_size_human": size_human,
        "total_lines": total_lines,
        "log_file": LOG_FILE
    }
