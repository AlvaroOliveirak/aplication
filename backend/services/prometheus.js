import axios from "axios";

const PROMETHEUS_URL = "http://prometheus:9090";

export async function queryRange(query) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - 60 * 5;

  const res = await axios.get(`${PROMETHEUS_URL}/api/v1/query_range`, {
    params: {
      query,
      start,
      end,
      step: 5
    }
  });

  return res.data.data.result;
}