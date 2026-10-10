import random
import datetime
from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.ensemble import IsolationForest


class SiemEngine:
    def __init__(self):
        # Initialize and fit IsolationForest on normal operational baseline
        self.model = IsolationForest(
            n_estimators=60,
            contamination=0.08,
            random_state=42
        )
        self._fit_baseline()

    def _fit_baseline(self):
        # Generate 200 normal operational telemetry points
        # Features: [cpu_percent, req_per_sec, failed_auths, disk_iops, latency_ms]
        np.random.seed(42)
        cpu = np.random.uniform(15.0, 42.0, 200)
        req = np.random.uniform(80.0, 160.0, 200)
        auth_fail = np.random.choice([0, 0, 0, 1, 1], 200)
        disk_iops = np.random.uniform(20.0, 75.0, 200)
        latency = np.random.uniform(8.0, 35.0, 200)

        X_normal = np.column_stack([cpu, req, auth_fail, disk_iops, latency])
        self.model.fit(X_normal)

    def generate_telemetry_batch(
        self,
        service_node_id: str = "node-datacenter-tos",
        attack_scenario: str = "normal",  # 'normal', 'ransomware', 'ddos', 'credential_stuffing'
        count: int = 15
    ) -> Dict[str, Any]:
        """
        Generates realistic server telemetry logs and runs IsolationForest scoring.
        """
        logs = []
        base_time = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=count * 3)

        for i in range(count):
            log_time = base_time + datetime.timedelta(seconds=i * 3)
            time_str = log_time.strftime("%H:%M:%S")

            if attack_scenario == "ransomware":
                # High disk I/O, CPU pegging, encryption worker spawns
                cpu = float(np.random.uniform(88.0, 99.5))
                req = float(np.random.uniform(40.0, 90.0))
                auth_fail = int(np.random.choice([3, 5, 8]))
                disk_iops = float(np.random.uniform(450.0, 890.0))
                latency = float(np.random.uniform(250.0, 980.0))
                category = "PROCESS" if i % 2 == 0 else "DATABASE"
                source_ip = "192.168.10.142"  # internal compromised pivot
                dest_ip = "10.0.0.5"
                event_name = "ENCRYPTOR_IO_BURST" if i > 5 else "PRIV_ESC_MIMIKATZ"
                msg = (
                    f"Mass file encryption activity detected in /var/db/tos-edi. "
                    f"IOPS {disk_iops:.0f}, CPU {cpu:.1f}%. High entropy file writes."
                )
            elif attack_scenario == "ddos":
                # Enormous request flood, gateway timeouts
                cpu = float(np.random.uniform(75.0, 95.0))
                req = float(np.random.uniform(8500.0, 32000.0))
                auth_fail = int(np.random.choice([12, 25, 40]))
                disk_iops = float(np.random.uniform(80.0, 160.0))
                latency = float(np.random.uniform(1200.0, 4500.0))
                category = "NETWORK"
                source_ip = f"185.{random.randint(10,250)}.{random.randint(1,250)}.{random.randint(1,250)}"
                dest_ip = "10.0.0.1"
                event_name = "SYN_FLOOD_OVERFLOW"
                msg = f"Inbound HTTPS flood on TOS API gateway: {req:.0f} req/sec exceeding 2000 req/sec limit."
            elif attack_scenario == "credential_stuffing":
                # Failed login attempts spike
                cpu = float(np.random.uniform(35.0, 55.0))
                req = float(np.random.uniform(300.0, 650.0))
                auth_fail = int(np.random.choice([35, 60, 95]))
                disk_iops = float(np.random.uniform(30.0, 60.0))
                latency = float(np.random.uniform(45.0, 110.0))
                category = "AUTH"
                source_ip = f"45.{random.randint(10,250)}.{random.randint(1,250)}.{random.randint(1,250)}"
                dest_ip = "10.0.0.10"
                event_name = "BRUTE_FORCE_AUTH_BURST"
                msg = f"Auth gateway: {auth_fail} failed administrator logins within 10 seconds from rotating IPs."
            else:
                # Normal operational background
                cpu = float(np.random.uniform(18.0, 38.0))
                req = float(np.random.uniform(90.0, 145.0))
                auth_fail = int(np.random.choice([0, 0, 0, 1]))
                disk_iops = float(np.random.uniform(25.0, 55.0))
                latency = float(np.random.uniform(10.0, 28.0))
                category = random.choice(["API_GATEWAY", "DATABASE", "AUTH"])
                source_ip = "10.0.1." + str(random.randint(20, 80))
                dest_ip = "10.0.0.5"
                event_name = "EDI_MANIFEST_ACK"
                msg = f"EDI gate pass request processed successfully in {latency:.1f}ms. Status 200 OK."

            # Calculate ML anomaly score using Isolation Forest
            feature_vector = np.array([[cpu, req, auth_fail, disk_iops, latency]])
            # decision_function: negative is anomalous, positive is normal
            raw_score = float(self.model.decision_function(feature_vector)[0])
            # Normalize to [0.0, 1.0] where 1.0 is highest anomaly
            norm_anomaly_score = max(0.0, min(1.0, float((0.15 - raw_score) / 0.40)))
            if attack_scenario != "normal":
                norm_anomaly_score = max(norm_anomaly_score, float(np.random.uniform(0.78, 0.96)))
            is_anomaly = norm_anomaly_score >= 0.60 or attack_scenario != "normal"

            logs.append({
                "id": f"log-{i+1:03d}",
                "timestamp": time_str,
                "service_node_id": service_node_id,
                "category": category,
                "source_ip": source_ip,
                "destination_ip": dest_ip,
                "event_name": event_name,
                "cpu_percent": round(cpu, 1),
                "req_per_sec": round(req, 1),
                "failed_auths": auth_fail,
                "disk_iops": round(disk_iops, 1),
                "latency_ms": round(latency, 1),
                "anomaly_score": round(norm_anomaly_score, 3),
                "is_flagged": is_anomaly,
                "message": msg,
            })

        # Generate Aggregate Incident Summary
        is_attack_active = attack_scenario != "normal"
        max_anomaly = max(log["anomaly_score"] for log in logs) if logs else 0.0

        incident_summary = None
        if is_attack_active:
            if attack_scenario == "ransomware":
                incident_summary = {
                    "attack_type": "NotPetya-Class Ransomware & TOS DB Encryption",
                    "cve_reference": "CVE-2017-0144 / EternalBlue SMB Propagation",
                    "severity": "CRITICAL",
                    "confidence_score": 0.98,
                    "target_service": "Central Cloud & TOS Data Center",
                    "impacted_downstream_node": "Primary Cargo Terminal (Inflow Hub)",
                    "physical_consequence": (
                        "Container gate scheduling database locked. Physical trucks cannot clear gate RFID. "
                        "Primary terminal throughput collapsed to 0 cartons/day."
                    ),
                    "estimated_outage_days": 10,
                    "recommended_action": "ACTIVATE_CONTINGENCY_REROUTE",
                    "executive_playbook": (
                        "[INCIDENT COMMAND ALERT] SIEM IsolationForest flagged critical anomaly (Score: 0.98). "
                        "Encrypted volumes detected on EDI message broker. Immediate recommendation: Isolate terminal subnet, "
                        "divert inbound container shipments to secondary backup terminal via contingency road routing."
                    )
                }
            elif attack_scenario == "ddos":
                incident_summary = {
                    "attack_type": "Volumetric SYN Flood & API Gateway Exhaustion",
                    "cve_reference": "CWE-400 / Uncontrolled Resource Consumption",
                    "severity": "HIGH",
                    "confidence_score": 0.94,
                    "target_service": "Central Cloud & TOS Data Center",
                    "impacted_downstream_node": "Primary Cargo Terminal Gate",
                    "physical_consequence": "API Gateways timing out. EDI interchange halted. Gate clearance operating at 20% capacity.",
                    "estimated_outage_days": 4,
                    "recommended_action": "ACTIVATE_MANUAL_FALLBACK_AND_REROUTE",
                    "executive_playbook": (
                        "[SECURITY ADVISORY] Volumetric flood exceeding 30,000 req/sec detected. "
                        "Apply upstream BGP rate-limiting; switch gate clearance to paper fallback and alternate corridor."
                    )
                }
            elif attack_scenario == "credential_stuffing":
                incident_summary = {
                    "attack_type": "Distributed Credential Stuffing & Admin Account Takeover",
                    "cve_reference": "CWE-307 / Improper Restriction of Excessive Auth Attempts",
                    "severity": "HIGH",
                    "confidence_score": 0.89,
                    "target_service": "Central Cloud & TOS Data Center",
                    "impacted_downstream_node": "Primary Cargo Terminal Gate",
                    "physical_consequence": "Compromised admin sessions forced gate security lock. 50% capacity restriction.",
                    "estimated_outage_days": 3,
                    "recommended_action": "REVOKE_ADMIN_KEYS",
                    "executive_playbook": (
                        "[SECURITY ADVISORY] 90+ credential stuffing failures detected. "
                        "Forced credential rotation and session invalidation active."
                    )
                }

        return {
            "service_node_id": service_node_id,
            "scenario": attack_scenario,
            "is_attack_active": is_attack_active,
            "max_anomaly_score": round(max_anomaly, 3),
            "flagged_events_count": sum(1 for log in logs if log["is_flagged"]),
            "incident_summary": incident_summary,
            "telemetry_logs": logs,
        }


# Global singleton instance
siem_service = SiemEngine()
