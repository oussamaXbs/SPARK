import os
import json
import asyncio
import aiohttp
import logging
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Initialize logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler('app.log'), logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# Load Supabase config
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.critical("Supabase URL or Key not set in .env.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# LM Studio API config
LM_STUDIO_API_URL = "http://192.168.1.198:1234/v1/chat/completions"

async def query_lmstudio(prompt: str, max_tokens=500, temperature=0.5) -> str:
    payload = {
        "model": "mistral-7b-instruct-v0.3",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stop": ["[INST]"]
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(LM_STUDIO_API_URL, json=payload) as response:
            if response.status != 200:
                logger.error(f"LM Studio API error: {response.status} - {await response.text()}")
                return ""
            data = await response.json()
            return data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

async def generate_powershell_command(recommendation: str, log_data: dict) -> str:
    prompt = (
    f"[INST] You are a PowerShell expert. Based on the recommendation and event log, return ONE safe PowerShell command.\n"
    f"**Rules:**\n"
    f"- Only use these exact safe cmdlets: Restart-Service, Stop-Service, Start-Service, Clear-EventLog, Set-Service, Get-Service.\n"
    f"- DO NOT use unsupported cmdlets like 'Update-Driver', 'Install-Package', 'Remove-Item'.\n"
    f"- If the fix requires something else (e.g., 'sfc /scannow' or external tools), return 'review manually'.\n"
    f"- Max 100 characters. Use one or two commands, separated by semicolon.\n"
    f"- Do NOT use quotes around service names unless required by PowerShell syntax.\n\n"
    f"Examples:\n"
    f"- Recommendation: Restart Windows Update → Restart-Service wuauserv\n"
    f"- Recommendation: Start EventLog service → Start-Service EventLog\n"
    f"- Recommendation: Run sfc /scannow → review manually\n"
    f"- Recommendation: Update driver → review manually\n\n"
    f"Event Log:\n"
    f"Timestamp: {log_data['timestamp']}\n"
    f"Event ID: {log_data['event_id']}\n"
    f"Message: {log_data['message']}\n"
    f"Source: {log_data['source']}\n"
    f"Recommendation: {recommendation}\n"
    f"[/INST]"
)


    response = await query_lmstudio(prompt, max_tokens=500, temperature=0.2)
    command = response.strip()

    logger.info(f"Generated valid command: {command}")
    return command

async def get_cause_and_recommendation(log_data: dict, anomaly_score: float):
    prompt = (
        f"[INST] You are a cybersecurity expert. Based on the following Windows event log, return a valid JSON object with the root cause.\n\n"
        f"Strictly return the JSON in this format only:\n"
        f'{{"anomaly_type": "<normal|threat>", "cause": "<short clear explanation>", "recommendation": "<exact fix in under 10 words>", "device_type": "<PC|router|switch>"}}\n\n'
        f"DO NOT include markdown, explanations, or anything outside the JSON format.\n"
        f"If unsure, use 'normal' and 'PC' as default.\n"
        f"Only suggest a safe and realistic fix that a system admin could run in PowerShell.\n\n"
        f"Event Log:\n"
        f"Timestamp: {log_data['timestamp']}\n"
        f"Event ID: {log_data['event_id']}\n"
        f"Message: {log_data['message']}\n"
        f"[/INST]"
    )

    response = await query_lmstudio(prompt)
    try:
        json_part = response[response.find("{"):response.rfind("}") + 1]
        parsed = json.loads(json_part)

        anomaly_type = parsed.get("anomaly_type", "normal").lower()
        if anomaly_type not in ["normal", "threat"]:
            anomaly_type = "normal"

        cause = parsed.get("cause", "Unknown")
        recommendation = parsed.get("recommendation", "Manual check required")
        device_type = parsed.get("device_type", "PC")

        powershell_command = await generate_powershell_command(recommendation, log_data)

        return (
            anomaly_type,
            cause,
            recommendation,
            device_type,
            powershell_command
        )
    except (json.JSONDecodeError, TypeError) as e:
        logger.error(f"JSON parsing failed: {e} - Response: {response}")
        return "normal", "Unknown", "Manual check required", "PC", "Write-Output 'Manual intervention required'"

async def fetch_and_classify_anomalies():
    try:
        anomalies = supabase.from_("anomaly_logs").select("*").execute()

        for anomaly in anomalies.data:
            exists = supabase.from_("anomaly_causes").select("*").eq("anomaly_id", anomaly["id"]).execute()
            if exists.data:
                logger.info(f"Anomaly ID {anomaly['id']} already processed.")
                continue

            anomaly_type, cause, recommendation, device_type, powershell_command = await get_cause_and_recommendation(anomaly, anomaly["anomaly_score"])

            cause_entry = {
                "anomaly_id": anomaly["id"],
                "anomaly_type": anomaly_type,
                "cause": cause,
                "recommendation": recommendation,
                "device_type": device_type
            }
            saved_cause = supabase.from_("anomaly_causes").insert([cause_entry]).execute()

            if not saved_cause.data:
                logger.error(f"Failed to insert cause for anomaly {anomaly['id']}.")
                continue

            cause_id = saved_cause.data[0]["id"]

            script_entry = {
                "cause_id": cause_id,
                "script_content": powershell_command,
                "device_type": device_type,
                "status": "pending",
                "recommendation": recommendation
            }
            saved_script = supabase.from_("anomaly_scripts").insert([script_entry]).execute()

            if not saved_script.data:
                logger.error(f"Failed to insert script for anomaly {anomaly['id']}, cause {cause_id}.")
                continue

            logger.info(f"Saved cause and script for anomaly {anomaly['id']}, cause {cause_id}.")

    except Exception as e:
        logger.error(f"Error processing anomalies: {e}")

async def main():
    while True:
        await fetch_and_classify_anomalies()
        await asyncio.sleep(10)

if __name__ == "__main__":
    asyncio.run(main())
