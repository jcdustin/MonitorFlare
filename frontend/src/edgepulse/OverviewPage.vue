<template>
  <div class="grid">
    <div v-if="loading && !loaded" class="skeleton"></div>
    <div v-else-if="error" class="card error-box">{{ error }} <button class="btn" @click="refresh">Retry</button></div>
    <template v-else>
      <section class="card hero">
        <div>
          <h2>{{ greeting() }}</h2>
          <p class="muted">{{ counts.warning + counts.down ? `${counts.warning + counts.down} monitors need your attention.` : 'Everything looks stable.' }}</p>
        </div>
        <Globe />
      </section>
      <section class="grid kpis">
        <article class="card kpi"><span>Total Monitors</span><b>{{ counts.total }}</b><small>All configured services</small></article>
        <article class="card kpi"><span>Healthy</span><b>{{ counts.online }}</b><small>{{ share(counts.online) }} of monitors</small></article>
        <article class="card kpi"><span>Degraded</span><b>{{ counts.warning }}</b><small>Experiencing issues</small></article>
        <article class="card kpi"><span>Incidents</span><b>{{ activeIncidents.length }}</b><small>{{ activeIncidents.length ? `${activeIncidents.length} active incident` : 'No active incidents' }}</small></article>
        <article class="card kpi"><span>Avg Response Time</span><b>{{ avgLatency }}</b><small>Recent successful checks</small></article>
        <article class="card kpi"><span>SSL Expiring</span><b>{{ sslExpiring }}</b><small>Within 30 days</small></article>
      </section>
      <section class="split">
        <article class="card">
          <div class="row" style="justify-content:space-between">
            <strong>Uptime & Latency</strong>
            <div class="seg">
              <button :class="{ on: metric === 'uptime' }" @click="metric = 'uptime'">Uptime</button>
              <button :class="{ on: metric === 'latency' }" @click="metric = 'latency'">Latency</button>
              <button v-for="item in ranges" :key="item" :class="{ on: range === item }" @click="load(item)">{{ item }}</button>
            </div>
          </div>
          <TrendChart :points="points" :metric="metric" />
        </article>
        <article class="card">
          <strong>Uptime Heatmap</strong>
          <p class="muted">Last 30 days</p>
          <div v-if="!heatmap.length" class="empty">Not enough monitoring data yet.</div>
          <div v-else class="heat">
            <div v-for="row in heatmap" :key="row.id" class="heat-row">
              <span class="muted">{{ row.name }}</span>
              <div class="cells">
                <i v-for="cell in row.cells" :key="cell.date" class="cell" :class="cell.tone" :title="cell.title"></i>
              </div>
            </div>
            <router-link v-if="monitors.length > 6" class="linkish" to="/monitors">View all monitors →</router-link>
          </div>
        </article>
      </section>
      <section class="split-70">
        <article class="card">
          <div class="row" style="justify-content:space-between">
            <strong>Monitors</strong>
            <div class="filters">
              <button v-for="item in filters" :key="item.id" :class="{ on: filter === item.id }" @click="filter = item.id">{{ item.label }}</button>
            </div>
          </div>
          <input class="field" v-model="q" placeholder="Search" style="margin:10px 0;width:220px" />
          <div v-if="!preview.length" class="empty">No monitors yet. <button class="linkish" @click="ui.drawer = true">Add Monitor</button></div>
          <table v-else class="data">
            <thead><tr><th>Name</th><th>Status</th><th>Type</th><th>Latency</th><th>Last Check</th><th>SSL</th></tr></thead>
            <tbody>
              <tr v-for="item in preview" :key="item.id" class="click" @click="$router.push(`/monitors/${item.id}`)">
                <td>{{ item.name }}</td>
                <td><span class="pill" :class="toneOf(item)"><i></i>{{ labelOf(item) }}</span></td>
                <td>{{ typeLabel(item.type) }}</td>
                <td>{{ item.latency != null ? `${item.latency} ms` : '—' }}</td>
                <td>{{ formatWhen(item.last_check) }}</td>
                <td>{{ daysUntil(item.cert_expiry) == null ? '—' : `${daysUntil(item.cert_expiry)}d` }}</td>
              </tr>
            </tbody>
          </table>
          <router-link class="linkish" to="/monitors">View all monitors →</router-link>
        </article>
        <div class="rail">
          <article class="card">
            <strong>Alert Channels</strong>
            <p v-if="!channels.length" class="empty">No channels yet.</p>
            <p v-for="ch in channels.slice(0, 4)" :key="ch.id" class="row" style="justify-content:space-between">
              <span>{{ ch.name }}</span><span class="pill" :class="ch.enabled ? 'online' : 'paused'">{{ ch.enabled ? 'Active' : 'Muted' }}</span>
            </p>
            <router-link class="linkish" to="/notifications">Manage notifications →</router-link>
          </article>
          <article class="card">
            <strong>Status Distribution</strong>
            <div class="donut" :style="{ background: donut }"><span>{{ counts.total }}</span></div>
            <p class="muted" style="text-align:center">Online {{ counts.online }} · Warning {{ counts.warning }} · Down {{ counts.down }} · Paused {{ counts.paused }}</p>
          </article>
          <article class="card desktop-only">
            <strong>Global Availability</strong>
            <p>Regional probes are not configured yet.</p>
            <router-link class="linkish" to="/nodes">Explore Global Nodes</router-link>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { API_BASE } from '../utils/api';
import { daysUntil, formatWhen, greeting, monitorTone, toneLabel, typeLabel } from './model';
import { useConsole } from './useConsole';
import Globe from './GlobeMark.vue';
import TrendChart from './TrendChart.vue';

const { monitors, channels, counts, activeIncidents, sslExpiring, loading, loaded, error, refresh, ui, authFetch } = useConsole();
const metric = ref('uptime');
const range = ref('7d');
const ranges = ['24h', '7d', '30d'];
const points = ref([]);
const filter = ref('all');
const q = ref('');
const filters = [
  { id: 'all', label: 'All' }, { id: 'online', label: 'Online' }, { id: 'warning', label: 'Warning' },
  { id: 'down', label: 'Down' }, { id: 'paused', label: 'Paused' },
];

const avgLatency = computed(() => {
  const samples = monitors.value.filter(item => item.type === 'http' && item.paused !== 1 && item.latency != null).map(item => item.latency);
  if (!samples.length) return '—';
  return `${Math.round(samples.reduce((sum, n) => sum + n, 0) / samples.length)} ms`;
});
function share(n) { return counts.value.total ? `${Math.round((n / counts.value.total) * 100)}%` : '0%'; }
function toneOf(item) { return monitorTone(item); }
function labelOf(item) { return toneLabel(monitorTone(item)); }
const preview = computed(() => monitors.value.filter(item => {
  const tone = monitorTone(item);
  if (filter.value !== 'all' && tone !== filter.value) return false;
  const query = q.value.trim().toLowerCase();
  return !query || `${item.name} ${item.url}`.toLowerCase().includes(query);
}).slice(0, 8));

const heatmap = computed(() => monitors.value.slice(0, 6).map(item => {
  const stats = item.daily_stats || [];
  const cells = [];
  for (let i = 29; i >= 0; i -= 1) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - i);
    const key = day.toISOString().slice(0, 10);
    const stat = stats.find(row => String(row.date).slice(0, 10) === key);
    let tone = 'unknown';
    let title = `${key}: no data`;
    if (stat && stat.total > 0) {
      const uptime = (stat.up / stat.total) * 100;
      tone = uptime >= 99 ? 'online' : uptime >= 95 ? 'warning' : 'down';
      title = `${key}: ${uptime.toFixed(1)}% uptime, ${stat.total - stat.up} failed checks`;
    }
    cells.push({ date: key, tone, title });
  }
  return { id: item.id, name: item.name, cells };
}));

const donut = computed(() => {
  const total = counts.value.total || 1;
  const parts = [
    [counts.value.online, '#3dd6a0'],
    [counts.value.warning, '#f0b429'],
    [counts.value.down, '#f07178'],
    [counts.value.paused, '#8ea3bb'],
  ];
  let cursor = 0;
  const stops = parts.map(([count, color]) => {
    const start = cursor;
    cursor += (count / total) * 100;
    return `${color} ${start}% ${cursor}%`;
  });
  return `conic-gradient(${stops.join(',')})`;
});

async function load(next = range.value) {
  range.value = next;
  const res = await authFetch(`${API_BASE}/analytics?range=${next}`);
  points.value = res.ok ? (await res.json()).points || [] : [];
}
onMounted(() => load('7d'));
</script>
