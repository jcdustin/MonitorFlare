<template>
  <div v-if="item">
    <button class="linkish" @click="$router.push('/incidents')">← Incidents</button>
    <div class="page-head">
      <div><h1>{{ item.title }}</h1><p>{{ item.type }} · {{ item.severity }} · {{ item.status }}</p></div>
      <button v-if="item.status !== 'resolved'" class="btn" @click="resolve">Mark resolved</button>
    </div>
    <article class="card">
      <h3>Affected services</h3>
      <p v-if="!affected.length" class="muted">No monitors were attached.</p>
      <p v-for="monitor in affected" :key="monitor.id"><router-link class="linkish" :to="`/monitors/${monitor.id}`">{{ monitor.name }}</router-link></p>
      <h3>Description</h3>
      <p>{{ item.description || 'No description.' }}</p>
      <h3>Timeline</h3>
      <p>Opened {{ item.created_at }}</p>
      <p v-if="item.scheduled_start">Window {{ item.scheduled_start }} → {{ item.scheduled_end }}</p>
      <p v-if="item.resolved_at">Resolved {{ item.resolved_at }}</p>
      <p class="muted">Status updates stay in the incident record. A separate timeline table can be added later without rewriting checks.</p>
    </article>
  </div>
  <div v-else class="card empty">Incident not found.</div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { API_BASE } from '../utils/api';
import { useConsole } from './useConsole';

const route = useRoute();
const { incidents, monitors, authFetch, refresh } = useConsole();
const item = computed(() => incidents.value.find(row => String(row.id) === String(route.params.id)));
const affected = computed(() => {
  const ids = String(item.value?.affected_monitors || '').split(',').filter(Boolean);
  return monitors.value.filter(monitor => ids.includes(String(monitor.id)));
});
async function resolve() {
  await authFetch(`${API_BASE}/incidents/${route.params.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'resolved' }) });
  await refresh();
}
</script>
