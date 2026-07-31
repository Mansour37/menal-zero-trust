from datetime import datetime, timedelta, timezone

import streamlit as st
from google.cloud import bigquery

from common import get_conf, require_auth

st.set_page_config(page_title="Security Events", layout="wide")
require_auth()

client = bigquery.Client()
project = get_conf("GCP_PROJECT_ID", "menal-zero-trust-dev")
dataset = get_conf("BQ_DATASET_ID", "menal_security_dev")

st.title("Security Events")
st.markdown("Raw security events from GCP audit logs and anomaly detection")

with st.expander("Filters", expanded=True):
    col1, col2 = st.columns(2)
    hours = col1.slider("Time range (hours)", 1, 168, 24)
    event_type = col2.selectbox(
        "Event type",
        ["ALL", "auth_failure", "access_denied", "rate_limit_exceeded", "server_error"],
    )
    ip_filter = st.text_input("Source IP filter (optional)")

cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

where = "timestamp >= @cutoff"
params = [bigquery.ScalarQueryParameter("cutoff", "TIMESTAMP", cutoff)]
if event_type != "ALL":
    where += " AND event_type = @event_type"
    params.append(bigquery.ScalarQueryParameter("event_type", "STRING", event_type))
if ip_filter:
    where += " AND source_ip LIKE @ip_like"
    params.append(bigquery.ScalarQueryParameter("ip_like", "STRING", f"%{ip_filter}%"))

try:
    q = f"""
        SELECT timestamp, event_type, severity, source_ip, target_path,
               description, mitigated
        FROM `{project}.{dataset}.security_events`
        WHERE {where}
        ORDER BY timestamp DESC
        LIMIT 500
    """
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    df = client.query(q, job_config=job_config).result().to_dataframe()
    st.info(f"Found {len(df)} security events")

    if not df.empty:
        st.dataframe(df, use_container_width=True, hide_index=True)
        csv = df.to_csv(index=False)
        st.download_button("Download CSV", csv, file_name="security_events.csv", mime="text/csv")

        col1, col2 = st.columns(2)
        types = df["event_type"].value_counts()
        col1.subheader("By Event Type")
        col1.bar_chart(types)

        sev = df["severity"].value_counts()
        col2.subheader("By Severity")
        col2.bar_chart(sev)
except Exception as e:
    st.error(f"Query failed: {e}")
