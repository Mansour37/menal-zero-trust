from datetime import datetime, timedelta, timezone

import streamlit as st
from google.cloud import bigquery

from common import get_conf, require_auth

st.set_page_config(page_title="Alert Enrichment", layout="wide")
require_auth()

client = bigquery.Client()
project = get_conf("GCP_PROJECT_ID", "menal-zero-trust-dev")
dataset = get_conf("BQ_DATASET_ID", "menal_security_dev")

st.title("Alert Enrichment")
st.markdown("ML-enriched alerts with MITRE ATT&CK mapping")

with st.expander("Filters", expanded=True):
    col1, col2 = st.columns(2)
    hours = col1.slider("Time range (hours)", 1, 168, 24)
    min_score = col2.slider("Min similarity score", 0.0, 1.0, 0.5)
    tactic_filter = st.text_input("Tactic filter (optional)")

cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

where = "timestamp >= @cutoff AND similarity >= @min_score"
params = [
    bigquery.ScalarQueryParameter("cutoff", "TIMESTAMP", cutoff),
    bigquery.ScalarQueryParameter("min_score", "FLOAT64", min_score),
]
if tactic_filter:
    where += " AND tactic LIKE @tactic_like"
    params.append(bigquery.ScalarQueryParameter("tactic_like", "STRING", f"%{tactic_filter}%"))

try:
    q = f"""
        SELECT timestamp, detection_id, technique_id, tactic, similarity,
               status, model_version
        FROM `{project}.{dataset}.alert_enrichment`
        WHERE {where}
        ORDER BY similarity DESC, timestamp DESC
        LIMIT 500
    """
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    df = client.query(q, job_config=job_config).result().to_dataframe()
    st.info(f"Found {len(df)} enriched alerts")

    if not df.empty:
        st.dataframe(df, use_container_width=True, hide_index=True)
        csv = df.to_csv(index=False)
        st.download_button("Download CSV", csv, file_name="alert_enrichment.csv", mime="text/csv")

        col1, col2 = st.columns(2)
        top_tactics = df["tactic"].value_counts().head(10)
        col1.subheader("Top Tactics")
        col1.bar_chart(top_tactics)

        top_tech = df["technique_id"].value_counts().head(10)
        col2.subheader("Top Techniques")
        col2.bar_chart(top_tech)

        unmapped = (df["status"] == "unmapped").sum()
        st.metric("Taux unmapped", f"{unmapped / len(df):.0%}")
except Exception as e:
    st.error(f"Query failed: {e}")
