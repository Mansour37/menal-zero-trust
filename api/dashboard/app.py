from datetime import datetime, timedelta, timezone

import streamlit as st
from google.cloud import bigquery

from common import get_conf, require_auth

st.set_page_config(page_title="MENAL Security Dashboard", layout="wide")
require_auth()


@st.cache_resource
def get_client():
    return bigquery.Client()


client = get_client()
project = get_conf("GCP_PROJECT_ID", "menal-zero-trust-dev")
dataset = get_conf("BQ_DATASET_ID", "menal_security_dev")

st.title("MENAL Security Dashboard")
st.markdown("---")

col1, col2, col3, col4 = st.columns(4)
cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
cutoff_cfg = bigquery.QueryJobConfig(
    query_parameters=[bigquery.ScalarQueryParameter("cutoff", "TIMESTAMP", cutoff)]
)

try:
    q_total = f"SELECT COUNT(*) AS cnt FROM `{project}.{dataset}.access_logs` WHERE timestamp >= @cutoff"
    total = client.query(q_total, job_config=cutoff_cfg).result().to_dataframe().iloc[0, 0]
    col1.metric("Requests (24h)", f"{total:,}")
except Exception:
    col1.metric("Requests (24h)", "N/A")

try:
    q_det = f"SELECT COUNT(*) AS cnt FROM `{project}.{dataset}.detections` WHERE timestamp >= @cutoff"
    det = client.query(q_det, job_config=cutoff_cfg).result().to_dataframe().iloc[0, 0]
    col2.metric("Detections (24h)", f"{det:,}")
except Exception:
    col2.metric("Detections (24h)", "N/A")

try:
    q_alert = f"SELECT COUNT(*) AS cnt FROM `{project}.{dataset}.alert_enrichment` WHERE timestamp >= @cutoff"
    alert = client.query(q_alert, job_config=cutoff_cfg).result().to_dataframe().iloc[0, 0]
    col3.metric("Alerts (24h)", f"{alert:,}")
except Exception:
    col3.metric("Alerts (24h)", "N/A")

try:
    q_ip = f"SELECT COUNT(DISTINCT source_ip) AS cnt FROM `{project}.{dataset}.security_events` WHERE timestamp >= @cutoff"
    ips = client.query(q_ip, job_config=cutoff_cfg).result().to_dataframe().iloc[0, 0]
    col4.metric("Unique IPs (24h)", f"{ips:,}")
except Exception:
    col4.metric("Unique IPs (24h)", "N/A")

st.markdown("---")
st.subheader("Recent Detections")
try:
    q_recent = f"""
        SELECT timestamp, rule_id, rule_name, severity, entity, message, mitre_tactic, mitre_technique
        FROM `{project}.{dataset}.detections`
        WHERE timestamp >= @cutoff
        ORDER BY timestamp DESC
        LIMIT 20
    """
    df = client.query(q_recent, job_config=cutoff_cfg).result().to_dataframe()
    st.dataframe(df, use_container_width=True, hide_index=True)
except Exception as e:
    st.warning(f"Could not load detections: {e}")

st.markdown("---")
st.subheader("Alert Enrichment (Top Similarity)")
try:
    q_enrich = f"""
        SELECT timestamp, detection_id, technique_id, tactic, similarity, status, model_version
        FROM `{project}.{dataset}.alert_enrichment`
        WHERE timestamp >= @cutoff
        ORDER BY similarity DESC
        LIMIT 20
    """
    df_enrich = client.query(q_enrich, job_config=cutoff_cfg).result().to_dataframe()
    st.dataframe(df_enrich, use_container_width=True, hide_index=True)
except Exception as e:
    st.warning(f"Could not load enrichment: {e}")
