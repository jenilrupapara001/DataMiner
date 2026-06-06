import json
import requests
from octoparse_pipeline.config import Config

class AlertSystem:
    @staticmethod
    def notify(level: str, message: str, details: dict = None):
        """Standard alerting method that handles system logs and external slack webhooks."""
        formatted_details = json.dumps(details or {}, indent=2)
        log_message = f"[{level}] {message}\nDetails: {formatted_details}"
        
        # 1. Print to console / stderr
        if level == "CRITICAL":
            print(f"🔴 {log_message}")
        elif level == "WARNING":
            print(f"⚠️ {log_message}")
        else:
            print(f"ℹ️ {log_message}")

        # 2. Trigger Slack webhook if configured
        if Config.ALERT_SLACK_WEBHOOK:
            try:
                payload = {
                    "text": f"*{level} Octoparse Alert*\n{message}",
                    "attachments": [
                        {
                            "color": "#FF0000" if level == "CRITICAL" else "#FFCC00",
                            "fields": [
                                {"title": k, "value": str(v), "short": True}
                                for k, v in (details or {}).items()
                            ]
                        }
                    ]
                }
                # Direct post bypassing rate limiter to ensure alert delivery
                requests.post(Config.ALERT_SLACK_WEBHOOK, json=payload, timeout=5)
            except Exception as e:
                print(f"❌ Failed to send Slack alert: {e}")

    @staticmethod
    def critical(message: str, details: dict = None):
        AlertSystem.notify("CRITICAL", message, details)

    @staticmethod
    def warning(message: str, details: dict = None):
        AlertSystem.notify("WARNING", message, details)

    @staticmethod
    def info(message: str, details: dict = None):
        AlertSystem.notify("INFO", message, details)
