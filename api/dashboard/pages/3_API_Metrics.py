from datetime import datetime, timedelta, timezone

import streamlit as st
from google.cloud import bigquery

from common import get_conf, require_auth

st.set_page_config(page_title="API Metrics", layout="wide")
require_auth()

client = bigquery.Client()
project = get_conf("GCP_PROJECT_ID", "menal-zero-trust-dev")
dataset = get_conf("BQ_DATASET_ID", "menal_security_dev")

st.title("API Metrics")
st.markdown("Aggregated API performance and error metrics")

hours = st.slider("Time range (hours)", 1, 168, 24)
cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

try:
    q = f"""
        SELECT hour, total_requests, success_count, error_count, auth_failures,
               avg_latency_ms, p99_latency_ms, unique_ips, waf_blocks
        FROM `{project}.{dataset}.api_metrics`
        WHERE hour >= @cutoff
        ORDER BY hour ASC
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[bigquery.ScalarQueryParameter("cutoff", "TIMESTAMP", cutoff)]
    )
    df = client.query(q, job_config=job_config).result().to_dataframe()
    st.info(f"Loaded {len(df)} hourly data points")

    if not df.empty:
        df["error_rate"] = df["error_count"] / df["total_requests"].clip(lower=1)

        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Avg Error Rate", f"{df['error_rate'].mean():.2%}")
        col2.metric("Avg Latency", f"{df['avg_latency_ms'].mean():.0f} ms")
        col3.metric("Avg P99 Latency", f"{df['p99_latency_ms'].mean():.0f} ms")
        col4.metric("Total Errors", f"{df['error_count'].sum():,}")

        st.subheader("Request Volume")
        st.line_chart(df.set_index("hour")["total_requests"])

        col1, col2 = st.columns(2)
        col1.subheader("Error Rate")
        col1.line_chart(df.set_index("hour")["error_rate"])

        col2.subheader("Latency (ms)")
        lat_df = df.set_index("hour")[["avg_latency_ms", "p99_latency_ms"]]
        col2.line_chart(lat_df)

        st.subheader("Auth Failures / WAF Blocks")
        st.bar_chart(df.set_index("hour")[["auth_failures", "waf_blocks"]])

        st.subheader("Raw Data")
        st.dataframe(df, use_container_width=True, hide_index=True)
except Exception as e:
    st.error(f"Query failed: {e}")
