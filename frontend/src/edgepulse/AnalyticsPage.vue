<template>
  <div>
    <div class="page-head">
      <div><h1>Analytics</h1><p>Figures come from stored checks. Empty ranges stay empty.</p></div>
      <div class="seg">
        <button v-for="item in ranges" :key="item" :class="{ on: range === item }" @click="load(item)">{{ item }}</button>
      </div>
    </div>
    <div v-if="error" class="card error-box">{{ error }} <button class="btn" @click="load(range)">Retry</button></div>
    <template v-else>
      <section class="grid stat4" style="margin-bottom:16px">
        <article class="card kpi"><span>Overall Uptime</span><b>{{ report?.uptime != null ? `${report.uptime}%` : '—' }}</b></article>
        <article class="card kpi"><span>Avg Latency</span><b>{{ report?.latency?.avg != null ? `${report.latency.avg} ms` : '—' }}</b></article>
        <article class="card kpi"><span>Total Failures</span><b>{{ report?.failures ?? '—' }}</b></article>
        <article class="card kpi"><span>Total Incidents</span><b>{{ report?.incidents ?? '—' }}</b></article>
      </section>
      <section class="split">
        <article class="card"><strong>Uptime Trend</strong><TrendChart :points="report?.points || []" metric="uptime" /></article>
        <article class="card"><strong>Latency Trend</strong><TrendChart :points="report?.points || []" metric="latency" /></article>
      </section>
      <article class="card" style="margin-top:16px">
        <p>P50 {{ ms(report?.latency?.p50) }} · P95 {{ ms(report?.latency?.p95) }} · P99 {{ ms(report?.latency?.p99) }}</p>
        <table class="data">
          <thead><tr><th>Monitor</th><th>Uptime</th><th>Avg Latency</th><th>Failures</th></tr></thead>
          <tbody>
            <tr v-for="row in report?.ranking || []" :key="row.id">
              <td>{{ row.name }}</td>
              <td>{{ row.uptime != null ? `${row.uptime}%` : '—' }}</td>
              <td>{{ ms(row.latency) }}</td>
              <td>{{ row.failures }}</td>
            </tr>
          </tbody>
        </table>
      </article>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { API_BASE } from '../utils/api';
import { useConsole } from './useConsole';
import TrendChart from './TrendChart.vue';

const { authFetch } = useConsole();
const ranges = ['24h', '7d', '30d', '90d'];
const range = ref('7d');
const report = ref(null);
const error = ref('');
function ms(value) { return value == null ? '—' : `${value} ms`; }
async function load(next = range.value) {
  range.value = next;
  error.value = '';
  const res = await authFetch(`${API_BASE}/analytics?range=${next}`);
  if (!res.ok) { error.value = 'Analytics could not be loaded.'; return; }
  report.value = await res.json();
}
onMounted(() => load('7d'));
</script>
