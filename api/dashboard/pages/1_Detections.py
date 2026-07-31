from datetime import datetime, timedelta, timezone

import streamlit as st
from google.cloud import bigquery

from common import get_conf, require_auth

st.set_page_config(page_title="Detections", layout="wide")
require_auth()

client = bigquery.Client()
project = get_conf("GCP_PROJECT_ID", "menal-zero-trust-dev")
dataset = get_conf("BQ_DATASET_ID", "menal_security_dev")

st.title("Detections")
st.markdown("Rule-level detection events from Sigma rules")

with st.expander("Filters", expanded=True):
    col1, col2 = st.columns(2)
    hours = col1.slider("Time range (hours)", 1, 168, 24)
    severity = col2.selectbox("Severity", ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"])
    rule_filter = st.text_input("Rule name filter (optional)")

cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

where = "timestamp >= @cutoff"
params = [bigquery.ScalarQueryParameter("cutoff", "TIMESTAMP", cutoff)]
if severity != "ALL":
    where += " AND severity = @severity"
    params.append(bigquery.ScalarQueryParameter("severity", "STRING", severity))
if rule_filter:
    where += " AND rule_name LIKE @rule_like"
    params.append(bigquery.ScalarQueryParameter("rule_like", "STRING", f"%{rule_filter}%"))

try:
    q = f"""
        SELECT timestamp, rule_id, rule_name, severity, entity, message, source,
               mitre_tactic, mitre_technique
        FROM `{project}.{dataset}.detections`
        WHERE {where}
        ORDER BY timestamp DESC
        LIMIT 1000
    """
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    df = client.query(q, job_config=job_config).result().to_dataframe()
    st.info(f"Found {len(df)} detections")
    st.dataframe(df, use_container_width=True, hide_index=True)

    if not df.empty:
        csv = df.to_csv(index=False)
        st.download_button("Download CSV", csv, file_name="detections.csv", mime="text/csv")

        col1, col2 = st.columns(2)
        counts = df["rule_name"].value_counts().head(10)
        col1.subheader("Top Rules")
        col1.bar_chart(counts)

        sev_counts = df["severity"].value_counts()
        col2.subheader("By Severity")
        col2.bar_chart(sev_counts)
except Exception as e:
    st.error(f"Query failed: {e}")
