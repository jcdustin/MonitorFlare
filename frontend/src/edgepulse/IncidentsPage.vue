<template>
  <div>
    <div class="page-head">
      <div><h1>Incidents</h1><p>Active outages, maintenance, and resolved events.</p></div>
      <button class="btn-primary" @click="creating = true">+ Create Incident</button>
    </div>
    <div class="tabs">
      <button v-for="item in tabs" :key="item" :class="{ on: tab === item }" @click="tab = item">{{ item }}</button>
    </div>
    <div v-if="!visible.length" class="card empty">No {{ tab.toLowerCase() }} incidents.</div>
    <article v-for="item in visible" :key="item.id" class="card" style="margin-bottom:12px">
      <div class="row" style="justify-content:space-between">
        <router-link class="linkish" :to="`/incidents/${item.id}`">{{ item.title }}</router-link>
        <span class="pill" :class="severityClass(item.severity)">{{ item.severity }}</span>
      </div>
      <p class="muted">{{ item.type }} · {{ item.status }} · started {{ formatWhen(item.created_at) }}</p>
      <p>{{ item.description }}</p>
    </article>

    <div v-if="creating" class="modal-back" @click.self="creating = false">
      <form class="modal" @submit.prevent="create">
        <header><strong>Create incident</strong></header>
        <div class="body">
          <label class="stack">Title <input v-model="form.title" required /></label>
          <label class="stack">Description <textarea v-model="form.description" rows="3"></textarea></label>
          <label class="stack">Severity
            <select v-model="form.severity"><option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option></select>
          </label>
          <label class="stack">Type
            <select v-model="form.type"><option value="incident">Incident</option><option value="maintenance">Maintenance</option></select>
          </label>
          <label class="stack">Affected monitors
            <select v-model="form.affected" multiple size="5">
              <option v-for="item in monitors" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>
          </label>
          <template v-if="form.type === 'maintenance'">
            <label class="stack">Scheduled start <input v-model="form.start" type="datetime-local" required /></label>
            <label class="stack">Scheduled end <input v-model="form.end" type="datetime-local" required /></label>
          </template>
          <p v-if="formError" class="down">{{ formError }}</p>
        </div>
        <footer>
          <button type="button" class="btn-ghost" @click="creating = false">Cancel</button>
          <button class="btn-primary">Create</button>
        </footer>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { API_BASE } from '../utils/api';
import { formatWhen } from './model';
import { useConsole } from './useConsole';

const { incidents, monitors, authFetch, refresh } = useConsole();
const tab = ref('Active');
const tabs = ['Active', 'Scheduled', 'Resolved'];
const creating = ref(false);
const formError = ref('');
const form = reactive({ title: '', description: '', severity: 'warning', type: 'incident', affected: [], start: '', end: '' });
const visible = computed(() => incidents.value.filter(item => {
  if (tab.value === 'Resolved') return item.status === 'resolved';
  if (tab.value === 'Scheduled') return item.type === 'maintenance' && item.status !== 'resolved';
  return item.status === 'active' && item.type !== 'maintenance';
}));
function severityClass(value) { return value === 'critical' ? 'down' : value === 'warning' ? 'warning' : 'online'; }
async function create() {
  formError.value = '';
  const body = {
    title: form.title, description: form.description, severity: form.severity, type: form.type,
    affected_monitors: form.affected.join(','),
    scheduled_start: form.type === 'maintenance' ? new Date(form.start).toISOString() : undefined,
    scheduled_end: form.type === 'maintenance' ? new Date(form.end).toISOString() : undefined,
  };
  const res = await authFetch(`${API_BASE}/incidents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) { formError.value = (await res.json().catch(() => ({}))).error || 'Could not create the incident.'; return; }
  creating.value = false;
  await refresh();
}
</script>
