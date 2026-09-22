<template>
  <div>
    <button class="linkish" @click="$router.push('/monitors')">← Monitors</button>
    <div v-if="!monitor && loaded" class="card empty">This monitor no longer exists.</div>
    <template v-else-if="monitor">
      <div class="page-head">
        <div>
          <h1>{{ monitor.name }}</h1>
          <p>{{ targetOf(monitor) }}</p>
        </div>
        <div class="row">
          <span class="pill" :class="monitorTone(monitor)"><i></i>{{ toneLabel(monitorTone(monitor)) }}</span>
          <button class="btn" @click="run">Run Check</button>
          <button class="btn" @click="pause">{{ monitor.paused ? 'Resume' : 'Pause' }}</button>
          <button class="btn" @click="edit">Edit</button>
        </div>
      </div>
      <section class="grid kpis" style="margin-bottom:16px">
        <article class="card kpi"><span>Uptime 24h</span><b>{{ pct(stats.uptime_24h) }}</b></article>
        <article class="card kpi"><span>Uptime 30d</span><b>{{ pct(stats.uptime_30d) }}</b></article>
        <article class="card kpi"><span>Avg Latency</span><b>{{ stats.avg_latency != null ? `${stats.avg_latency} ms` : '—' }}</b></article>
        <article class="card kpi"><span>SSL Remaining</span><b>{{ daysUntil(monitor.cert_expiry) == null ? '—' : `${daysUntil(monitor.cert_expiry)}d` }}</b></article>
        <article class="card kpi"><span>Last Check</span><b style="font-size:16px">{{ formatWhen(monitor.last_check) }}</b></article>
        <article class="card kpi"><span>Current Status</span><b style="font-size:16px">{{ toneLabel(monitorTone(monitor)) }}</b></article>
      </section>
      <div class="tabs">
        <button v-for="item in tabs" :key="item" :class="{ on: tab === item }" @click="tab = item">{{ item }}</button>
      </div>
      <article v-if="tab === 'Overview'" class="card">
        <p>Uptime 7d {{ pct(monitor.uptime_7d) }} · 30d {{ pct(monitor.uptime_30d) }}</p>
        <p>Certificate {{ monitor.cert_expiry || 'Unknown' }} · Domain {{ monitor.domain_expiry || 'Unknown' }}</p>
        <h3>Recent failures</h3>
        <p v-if="!failures.length" class="muted">No recent failures in the latest checks.</p>
        <p v-for="log in failures" :key="log.id">{{ formatWhen(log.created_at) }} · {{ log.reason || log.status_code || 'Failed' }}</p>
      </article>
      <article v-else-if="tab === 'Checks'" class="card table-wrap">
        <table class="data">
          <thead><tr><th>Timestamp</th><th>Result</th><th>Status Code</th><th>Latency</th><th>Reason</th></tr></thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id">
              <td>{{ log.created_at }}</td>
              <td><span class="pill" :class="log.is_fail ? 'down' : 'online'">{{ log.is_fail ? 'Fail' : 'OK' }}</span></td>
              <td>{{ log.status_code ?? '—' }}</td>
              <td>{{ log.latency != null ? `${log.latency} ms` : '—' }}</td>
              <td>{{ log.reason || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!logs.length" class="empty">Not enough monitoring data yet.</p>
      </article>
      <article v-else-if="tab === 'Incidents'" class="card">
        <p v-if="!related.length" class="empty">No incidents are linked to this monitor.</p>
        <p v-for="item in related" :key="item.id"><router-link class="linkish" :to="`/incidents/${item.id}`">{{ item.title }}</router-link> · {{ item.status }}</p>
      </article>
      <article v-else class="card">
        <p>Type {{ typeLabel(monitor.type) }} · Interval {{ monitor.interval }}s · Keyword {{ monitor.keyword || '—' }}</p>
        <p>SSL check {{ monitor.check_ssl ? 'on' : 'off' }} · Domain check {{ monitor.check_domain ? 'on' : 'off' }}</p>
        <button class="btn" @click="edit">Edit</button>
      </article>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { API_BASE } from '../utils/api';
import { daysUntil, formatWhen, monitorTone, toneLabel, typeLabel, targetOf } from './model';
import { useConsole } from './useConsole';

const route = useRoute();
const { monitors, incidents, loaded, ui, authFetch, refresh } = useConsole();
const tab = ref('Overview');
const tabs = ['Overview', 'Checks', 'Incidents', 'Configuration'];
const logs = ref([]);
const stats = ref({});
const monitor = computed(() => monitors.value.find(item => String(item.id) === String(route.params.id)));
const failures = computed(() => logs.value.filter(log => log.is_fail).slice(0, 8));
const related = computed(() => incidents.value.filter(item => String(item.affected_monitors || '').split(',').includes(String(route.params.id))));
function pct(value) { return value == null ? '—' : `${value}%`; }
function edit() { ui.editing = monitor.value; ui.drawer = true; }
async function run() { await authFetch(`${API_BASE}/monitors/${route.params.id}/check`, { method: 'POST' }); await load(); await refresh(); }
async function pause() {
  await authFetch(`${API_BASE}/monitors/${route.params.id}/pause`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paused: monitor.value.paused ? 0 : 1 }) });
  await refresh();
}
async function load() {
  const [logRes, statRes] = await Promise.all([
    authFetch(`${API_BASE}/monitors/${route.params.id}/logs?limit=100`),
    authFetch(`${API_BASE}/monitors/${route.params.id}/stats`),
  ]);
  logs.value = logRes.ok ? await logRes.json() : [];
  stats.value = statRes.ok ? await statRes.json() : {};
}
onMounted(load);
watch(() => route.params.id, load);
</script>
