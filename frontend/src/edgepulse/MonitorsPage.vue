<template>
  <div>
    <div class="page-head">
      <div><h1>Monitors</h1><p>Monitor websites, APIs, DNS records and network services.</p></div>
      <button class="btn-primary" @click="create">+ Add Monitor</button>
    </div>
    <section class="grid stat4" style="margin-bottom:16px">
      <article class="card kpi"><span>Total</span><b>{{ counts.total }}</b></article>
      <article class="card kpi"><span>Online</span><b>{{ counts.online }}</b></article>
      <article class="card kpi"><span>Warning</span><b>{{ counts.warning }}</b></article>
      <article class="card kpi"><span>Down</span><b>{{ counts.down }}</b></article>
    </section>
    <div class="card" style="margin-bottom:12px">
      <div class="row" style="justify-content:space-between">
        <div class="filters">
          <button v-for="item in filters" :key="item" :class="{ on: filter === item }" @click="filter = item">{{ item }}</button>
        </div>
        <div class="row">
          <input class="field" v-model="q" placeholder="Search" />
          <select class="select" v-model="type"><option value="">All Types</option><option value="http">HTTP</option><option value="dns">DNS</option><option value="port">TCP</option></select>
          <select class="select" v-model="tag"><option value="">All tags</option><option v-for="item in tags" :key="item" :value="item">{{ item }}</option></select>
          <select class="select" v-model="sort">
            <option value="manual">Manual</option><option value="name">Name</option><option value="status">Status</option>
            <option value="latency">Latency</option><option value="check">Last Check</option><option value="uptime">Uptime</option>
          </select>
        </div>
      </div>
    </div>
    <div v-if="selected.length" class="batch">
      <span>{{ selected.length }} selected</span>
      <button class="btn" @click="batch('pause')">Pause</button>
      <button class="btn" @click="batch('resume')">Resume</button>
      <button class="btn" @click="tagSelected">Add Tag</button>
      <button class="btn-danger" @click="batch('delete')">Delete</button>
    </div>
    <div v-if="loading && !loaded" class="skeleton"></div>
    <div v-else-if="error" class="card error-box">{{ error }} <button class="btn" @click="refresh">Retry</button></div>
    <div v-else-if="!rows.length" class="card empty">No monitors yet. <button class="linkish" @click="create">Add Monitor</button></div>
    <div v-else class="card table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th><input type="checkbox" :checked="allChecked" @change="toggleAll" /></th>
            <th>Name</th><th>Status</th><th>Type</th><th>Target</th><th>Latency</th><th>Uptime 24h</th><th>Last Check</th><th>SSL</th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in rows" :key="item.id" :draggable="sort === 'manual'" @dragstart="drag = index" @drop.prevent="drop(index)" @dragover.prevent>
            <td><input type="checkbox" :value="item.id" v-model="selected" /></td>
            <td><button class="linkish" @click="$router.push(`/monitors/${item.id}`)">{{ item.name }}</button><div><span v-for="name in tagsOf(item)" :key="name" class="tag">{{ name }}</span></div></td>
            <td><span class="pill" :class="tone(item)"><i></i>{{ toneLabel(tone(item)) }}</span></td>
            <td>{{ typeLabel(item.type) }}</td>
            <td>{{ targetOf(item) }}</td>
            <td>{{ item.latency != null ? `${item.latency} ms` : '—' }}</td>
            <td>{{ item.uptime_24h != null ? `${item.uptime_24h}%` : '—' }}</td>
            <td>{{ formatWhen(item.last_check) }}</td>
            <td>{{ daysUntil(item.cert_expiry) == null ? '—' : `${daysUntil(item.cert_expiry)}d` }}</td>
            <td>
              <details class="menu">
                <summary class="icon-btn">···</summary>
                <div class="menu-pop">
                  <button @click="$router.push(`/monitors/${item.id}`)">View Details</button>
                  <button @click="run(item)">Run Check Now</button>
                  <button @click="pause(item)">{{ item.paused ? 'Resume' : 'Pause' }}</button>
                  <button @click="edit(item)">Edit</button>
                  <button @click="clone(item)">Clone</button>
                  <button @click="remove(item)">Delete</button>
                </div>
              </details>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { API_BASE } from '../utils/api';
import { daysUntil, formatWhen, monitorTone, tagsOf, targetOf, toneLabel, typeLabel } from './model';
import { useConsole } from './useConsole';

const { monitors, counts, loading, loaded, error, refresh, ui, authFetch, askConfirm } = useConsole();
const filter = ref('All');
const filters = ['All', 'Online', 'Warning', 'Down', 'Paused'];
const q = ref('');
const type = ref('');
const tag = ref('');
const sort = ref('manual');
const selected = ref([]);
const drag = ref(null);
const tags = computed(() => [...new Set(monitors.value.flatMap(tagsOf))].sort());
const tone = monitorTone;

const rows = computed(() => {
  let list = monitors.value.filter(item => {
    const state = monitorTone(item);
    if (filter.value === 'Online' && state !== 'online') return false;
    if (filter.value === 'Warning' && state !== 'warning') return false;
    if (filter.value === 'Down' && state !== 'down') return false;
    if (filter.value === 'Paused' && state !== 'paused') return false;
    if (type.value && item.type !== type.value) return false;
    if (tag.value && !tagsOf(item).includes(tag.value)) return false;
    const query = q.value.trim().toLowerCase();
    return !query || `${item.name} ${item.url}`.toLowerCase().includes(query);
  });
  const order = { down: 0, warning: 1, online: 2, paused: 3 };
  if (sort.value === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  if (sort.value === 'status') list = [...list].sort((a, b) => order[monitorTone(a)] - order[monitorTone(b)]);
  if (sort.value === 'latency') list = [...list].sort((a, b) => (a.latency ?? 1e9) - (b.latency ?? 1e9));
  if (sort.value === 'check') list = [...list].sort((a, b) => new Date(b.last_check || 0) - new Date(a.last_check || 0));
  if (sort.value === 'uptime') list = [...list].sort((a, b) => (a.uptime_24h ?? -1) - (b.uptime_24h ?? -1));
  return list;
});
const allChecked = computed(() => rows.value.length > 0 && rows.value.every(item => selected.value.includes(item.id)));
function toggleAll(event) { selected.value = event.target.checked ? rows.value.map(item => item.id) : []; }
function create() { ui.editing = null; ui.drawer = true; }
function edit(item) { ui.editing = item; ui.drawer = true; }
function clone(item) { ui.editing = { ...item, id: null, name: `${item.name} copy` }; ui.drawer = true; }
async function run(item) { await authFetch(`${API_BASE}/monitors/${item.id}/check`, { method: 'POST' }); await refresh(); }
async function pause(item) {
  await authFetch(`${API_BASE}/monitors/${item.id}/pause`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paused: item.paused ? 0 : 1 }) });
  await refresh();
}
async function remove(item) {
  if (!await askConfirm(`Delete ${item.name}?`)) return;
  await authFetch(`${API_BASE}/monitors/${item.id}`, { method: 'DELETE' });
  await refresh();
}
async function batch(action) {
  if (action === 'delete' && !await askConfirm(`Delete ${selected.value.length} monitors?`)) return;
  await authFetch(`${API_BASE}/monitors/batch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: selected.value, action }) });
  selected.value = [];
  await refresh();
}
async function tagSelected() {
  const name = window.prompt('Tag to add');
  if (!name) return;
  for (const id of selected.value) {
    const item = monitors.value.find(row => row.id === id);
    const next = [...new Set([...tagsOf(item), name.trim()])].join(', ');
    await authFetch(`${API_BASE}/monitors/${id}/config`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tags: next }) });
  }
  await refresh();
}
async function drop(index) {
  if (sort.value !== 'manual' || drag.value == null) return;
  const next = [...rows.value];
  const [moved] = next.splice(drag.value, 1);
  next.splice(index, 0, moved);
  drag.value = null;
  await authFetch(`${API_BASE}/monitors/reorder`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: next.map(item => item.id) }) });
  await refresh();
}
</script>
