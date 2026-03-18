"""
System metrics collection for server monitoring.
Tracks CPU, memory, disk, and API performance.
"""

import os
import time
import psutil
from datetime import datetime, timezone
from collections import deque
from threading import Lock
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class ErrorRecord:
    """Stores details of an API error."""
    timestamp: str
    method: str
    path: str
    status_code: int
    response_time_ms: float
    error_message: Optional[str] = None


@dataclass
class RequestMetrics:
    """Tracks API request performance."""
    total_requests: int = 0
    total_errors: int = 0
    total_response_time: float = 0.0

    # Recent response times (last 100 requests)
    recent_times: deque = field(default_factory=lambda: deque(maxlen=100))

    # Recent errors (last 100 errors with details)
    recent_errors: deque = field(default_factory=lambda: deque(maxlen=100))

    # Requests per endpoint
    endpoint_counts: Dict[str, int] = field(default_factory=dict)
    endpoint_errors: Dict[str, int] = field(default_factory=dict)
    endpoint_times: Dict[str, List[float]] = field(default_factory=dict)

    # Time-based tracking
    requests_per_minute: deque = field(default_factory=lambda: deque(maxlen=60))
    last_minute_timestamp: int = 0
    current_minute_count: int = 0


class SystemMetrics:
    """Singleton class to track system and API metrics."""

    _instance = None
    _lock = Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self._initialized = True
        self.start_time = datetime.now(timezone.utc)
        self.request_metrics = RequestMetrics()
        self._metrics_lock = Lock()

    def record_request(
        self,
        path: str,
        method: str,
        status_code: int,
        response_time: float,
        error_message: Optional[str] = None
    ):
        """Record a completed request."""
        with self._metrics_lock:
            metrics = self.request_metrics

            # Update totals
            metrics.total_requests += 1
            metrics.total_response_time += response_time
            metrics.recent_times.append(response_time)

            if status_code >= 400:
                metrics.total_errors += 1
                # Store error details
                error_record = ErrorRecord(
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    method=method,
                    path=path,
                    status_code=status_code,
                    response_time_ms=round(response_time * 1000, 2),
                    error_message=error_message
                )
                metrics.recent_errors.append(error_record)

            # Update per-endpoint stats
            endpoint = f"{method} {path}"
            metrics.endpoint_counts[endpoint] = metrics.endpoint_counts.get(endpoint, 0) + 1

            if status_code >= 400:
                metrics.endpoint_errors[endpoint] = metrics.endpoint_errors.get(endpoint, 0) + 1

            if endpoint not in metrics.endpoint_times:
                metrics.endpoint_times[endpoint] = []
            # Keep last 50 times per endpoint
            if len(metrics.endpoint_times[endpoint]) >= 50:
                metrics.endpoint_times[endpoint].pop(0)
            metrics.endpoint_times[endpoint].append(response_time)

            # Track requests per minute
            current_minute = int(time.time() // 60)
            if current_minute != metrics.last_minute_timestamp:
                if metrics.last_minute_timestamp > 0:
                    metrics.requests_per_minute.append(metrics.current_minute_count)
                metrics.last_minute_timestamp = current_minute
                metrics.current_minute_count = 1
            else:
                metrics.current_minute_count += 1

    def get_system_stats(self) -> dict:
        """Get current system resource usage."""
        # CPU
        cpu_percent = psutil.cpu_percent(interval=0.1)
        cpu_count = psutil.cpu_count()

        # Memory
        memory = psutil.virtual_memory()

        # Disk
        disk = psutil.disk_usage('/')

        # Network (if available)
        try:
            net_io = psutil.net_io_counters()
            network = {
                "bytes_sent": net_io.bytes_sent,
                "bytes_recv": net_io.bytes_recv,
                "bytes_sent_human": self._format_bytes(net_io.bytes_sent),
                "bytes_recv_human": self._format_bytes(net_io.bytes_recv)
            }
        except Exception:
            network = None

        # Process info
        process = psutil.Process(os.getpid())
        process_memory = process.memory_info()

        return {
            "cpu": {
                "percent": cpu_percent,
                "count": cpu_count,
                "status": "high" if cpu_percent > 80 else "medium" if cpu_percent > 50 else "normal"
            },
            "memory": {
                "total": memory.total,
                "available": memory.available,
                "used": memory.used,
                "percent": memory.percent,
                "total_human": self._format_bytes(memory.total),
                "available_human": self._format_bytes(memory.available),
                "used_human": self._format_bytes(memory.used),
                "status": "high" if memory.percent > 85 else "medium" if memory.percent > 70 else "normal"
            },
            "disk": {
                "total": disk.total,
                "used": disk.used,
                "free": disk.free,
                "percent": disk.percent,
                "total_human": self._format_bytes(disk.total),
                "used_human": self._format_bytes(disk.used),
                "free_human": self._format_bytes(disk.free),
                "status": "high" if disk.percent > 90 else "medium" if disk.percent > 75 else "normal"
            },
            "network": network,
            "process": {
                "memory_rss": process_memory.rss,
                "memory_rss_human": self._format_bytes(process_memory.rss),
                "pid": process.pid,
                "threads": process.num_threads()
            }
        }

    def get_api_stats(self) -> dict:
        """Get API performance statistics."""
        with self._metrics_lock:
            metrics = self.request_metrics

            # Calculate averages
            avg_response_time = (
                metrics.total_response_time / metrics.total_requests
                if metrics.total_requests > 0 else 0
            )

            recent_avg = (
                sum(metrics.recent_times) / len(metrics.recent_times)
                if metrics.recent_times else 0
            )

            error_rate = (
                (metrics.total_errors / metrics.total_requests) * 100
                if metrics.total_requests > 0 else 0
            )

            # Requests per minute (average)
            rpm_avg = (
                sum(metrics.requests_per_minute) / len(metrics.requests_per_minute)
                if metrics.requests_per_minute else metrics.current_minute_count
            )

            # Slowest endpoints
            slowest_endpoints = []
            for endpoint, times in metrics.endpoint_times.items():
                if times:
                    avg_time = sum(times) / len(times)
                    slowest_endpoints.append({
                        "endpoint": endpoint,
                        "avg_time_ms": round(avg_time * 1000, 2),
                        "count": metrics.endpoint_counts.get(endpoint, 0)
                    })
            slowest_endpoints.sort(key=lambda x: x["avg_time_ms"], reverse=True)

            # Most requested endpoints
            top_endpoints = sorted(
                [{"endpoint": k, "count": v} for k, v in metrics.endpoint_counts.items()],
                key=lambda x: x["count"],
                reverse=True
            )[:10]

            return {
                "total_requests": metrics.total_requests,
                "total_errors": metrics.total_errors,
                "error_rate": round(error_rate, 2),
                "avg_response_time_ms": round(avg_response_time * 1000, 2),
                "recent_avg_response_time_ms": round(recent_avg * 1000, 2),
                "requests_per_minute": round(rpm_avg, 1),
                "current_minute_requests": metrics.current_minute_count,
                "slowest_endpoints": slowest_endpoints[:20],  # Return more, frontend will handle display
                "top_endpoints": top_endpoints,
                "status": "high" if error_rate > 5 else "medium" if recent_avg > 1 else "normal"
            }

    def get_uptime(self) -> dict:
        """Get server uptime information."""
        now = datetime.now(timezone.utc)
        uptime_delta = now - self.start_time

        days = uptime_delta.days
        hours, remainder = divmod(uptime_delta.seconds, 3600)
        minutes, seconds = divmod(remainder, 60)

        return {
            "started_at": self.start_time.isoformat(),
            "uptime_seconds": int(uptime_delta.total_seconds()),
            "uptime_human": f"{days}d {hours}h {minutes}m {seconds}s" if days > 0 else f"{hours}h {minutes}m {seconds}s"
        }

    def get_recent_errors(self, limit: int = 50) -> List[dict]:
        """Get recent API errors with details."""
        with self._metrics_lock:
            errors = list(self.request_metrics.recent_errors)
            # Return most recent first
            errors.reverse()
            return [
                {
                    "timestamp": e.timestamp,
                    "method": e.method,
                    "path": e.path,
                    "status_code": e.status_code,
                    "response_time_ms": e.response_time_ms,
                    "error_message": e.error_message
                }
                for e in errors[:limit]
            ]

    def clear_errors(self):
        """Clear the error log."""
        with self._metrics_lock:
            self.request_metrics.recent_errors.clear()

    def get_all_metrics(self) -> dict:
        """Get all metrics combined."""
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "uptime": self.get_uptime(),
            "system": self.get_system_stats(),
            "api": self.get_api_stats()
        }

    @staticmethod
    def _format_bytes(bytes_val: int) -> str:
        """Format bytes to human readable string."""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if bytes_val < 1024:
                return f"{bytes_val:.1f} {unit}"
            bytes_val /= 1024
        return f"{bytes_val:.1f} PB"


# Global instance
metrics = SystemMetrics()


def get_metrics() -> SystemMetrics:
    """Get the global metrics instance."""
    return metrics
