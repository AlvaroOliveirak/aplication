import axios from "axios";

const PROMETHEUS_URL = "http://prometheus:9090";

export async function queryRange(query, range = 300, startTime = null, endTime = null, comparePrevious = false) {
  try {
    let end = Math.floor(Date.now() / 1000);
    let start = end - (range || 300);

    // Se o usuário forneceu data/hora de fim, usar
    if (endTime) {
      try {
        const endDate = new Date(endTime);
        if (!isNaN(endDate.getTime())) {
          end = Math.floor(endDate.getTime() / 1000);
        }
      } catch (e) {
        console.warn("Erro ao converter endTime:", e.message);
      }
    }

    // Se o usuário forneceu data/hora de início, usar
    if (startTime) {
      try {
        const startDate = new Date(startTime);
        if (!isNaN(startDate.getTime())) {
          start = Math.floor(startDate.getTime() / 1000);
        }
      } catch (e) {
        console.warn("Erro ao converter startTime:", e.message);
      }
    }

    // Garantir que start < end
    if (start >= end) {
      start = end - 300;
    }

    // Calcular step baseado no intervalo (não ter mais de 500 pontos)
    const step = Math.max(1, Math.ceil((end - start) / 500));

    const res = await axios.get(`${PROMETHEUS_URL}/api/v1/query_range`, {
      params: {
        query,
        start,
        end,
        step
      },
      timeout: 10000
    });

    const series = res.data.data.result || [];
    const result = {
      series,
      start,
      end
    };

    // Se comparação com período anterior foi solicitada
    if (comparePrevious && series.length > 0) {
      const rangeDuration = end - start;
      const previousStart = start - rangeDuration;
      const previousEnd = start;

      try {
        const prevRes = await axios.get(`${PROMETHEUS_URL}/api/v1/query_range`, {
          params: {
            query,
            start: previousStart,
            end: previousEnd,
            step
          },
          timeout: 10000
        });

        result.comparisonSeries = prevRes.data.data.result || [];
      } catch (err) {
        console.warn("Erro ao buscar período anterior:", err.message);
        result.comparisonSeries = [];
      }
    }

    return result;
  } catch (err) {
    console.error("Erro em queryRange:", err.message);
    throw new Error(`Falha ao consultar Prometheus: ${err.message}`);
  }
}