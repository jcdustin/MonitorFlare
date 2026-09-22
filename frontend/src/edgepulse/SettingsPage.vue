<template>
  <div>
    <div class="page-head"><div><h1>Settings</h1><p>Account, access, and data for this EdgePulse install.</p></div></div>
    <div class="settings">
      <nav class="card">
        <button v-for="item in sections" :key="item" :class="{ on: section === item }" @click="section = item">{{ item }}</button>
      </nav>
      <article class="card">
        <template v-if="section === 'General'">
          <label class="stack">Site name <input v-model="draft.site_title" /></label>
          <label class="stack">Language
            <select v-model="draft.language"><option>en</option><option>zh</option><option>zh-tw</option><option>ja</option><option>ko</option><option>de</option><option>fr</option><option>it</option><option>es</option></select>
          </label>
          <label class="stack">Timezone <input v-model="draft.timezone" placeholder="UTC" /></label>
          <button class="btn-primary" @click="save">Save</button>
        </template>
        <template v-else-if="section === 'Appearance'">
          <p>EdgePulse uses the dark cyan system by default. The header theme control switches this console only.</p>
        </template>
        <template v-else-if="section === 'Authentication'">
          <p>Magic Link, Google, GitHub, and Cloudflare Access stay on the existing auth routes. Password sign-in is the console login.</p>
        </template>
        <template v-else-if="section === 'Security'">
          <p>Admin sessions use the current bearer token. Status page access is edited under Status Pages.</p>
          <button class="btn-danger" @click="logout">Sign out</button>
        </template>
        <template v-else-if="section === 'Backup & Data'">
          <p class="muted">Export downloads the current backup payload. Restore replaces stored monitors, logs, incidents, settings, channels, and subscriptions.</p>
          <div class="row">
            <button class="btn" @click="download">Export JSON</button>
            <label class="btn">Import JSON <input type="file" accept="application/json" hidden @change="restore" /></label>
          </div>
        </template>
        <template v-else-if="section === 'API Keys'">
          <div class="row"><input class="field" v-model="keyName" placeholder="Key name" /><button class="btn" @click="createKey">Create</button></div>
          <p v-if="freshKey" class="warning">Copy this key now. It will not be shown again: {{ freshKey }}</p>
          <table class="data">
            <thead><tr><th>Name</th><th>Created</th><th>Last Used</th><th></th></tr></thead>
            <tbody>
              <tr v-for="item in apiKeys" :key="item.id">
                <td>{{ item.name }}</td><td>{{ item.created_at }}</td><td>{{ item.last_used_at || '—' }}</td>
                <td><button class="btn-danger" @click="revoke(item)">Revoke</button></td>
              </tr>
            </tbody>
          </table>
        </template>
        <template v-else>
          <label class="stack">Down alert template <textarea v-model="draft.alert_template_down" rows="3"></textarea></label>
          <label class="stack">Up alert template <textarea v-model="draft.alert_template_up" rows="3"></textarea></label>
          <button class="btn-primary" @click="save">Save</button>
        </template>
      </article>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { API_BASE } from '../utils/api';
import { useConsole } from './useConsole';

const { settings, apiKeys, loadApiKeys, authFetch, refresh, logout, askConfirm } = useConsole();
const sections = ['General', 'Appearance', 'Authentication', 'Security', 'Backup & Data', 'API Keys', 'Advanced'];
const section = ref('General');
const keyName = ref('');
const freshKey = ref('');
const draft = reactive({ site_title: '', language: 'en', timezone: 'UTC', alert_template_down: '', alert_template_up: '' });
watch(settings, (value) => Object.assign(draft, {
  site_title: value.site_title || '', language: value.language || 'en', timezone: value.timezone || 'UTC',
  alert_template_down: value.alert_template_down || '', alert_template_up: value.alert_template_up || '',
}), { immediate: true });
onMounted(loadApiKeys);
async function save() {
  await authFetch(`${API_BASE}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft }) });
  await refresh();
}
async function download() {
  const res = await authFetch(`${API_BASE}/backup`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'edgepulse-backup.json';
  link.click();
  URL.revokeObjectURL(url);
}
async function restore(event) {
  const file = event.target.files?.[0];
  if (!file || !await askConfirm('Restore replaces the current monitoring data. Continue?')) return;
  const payload = JSON.parse(await file.text());
  await authFetch(`${API_BASE}/backup/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  await refresh();
}
async function createKey() {
  if (!keyName.value.trim()) return;
  const res = await authFetch(`${API_BASE}/api-keys`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: keyName.value.trim() }) });
  const data = await res.json();
  freshKey.value = data.key || '';
  keyName.value = '';
  await loadApiKeys();
}
async function revoke(item) {
  if (!await askConfirm(`Revoke ${item.name}?`)) return;
  await authFetch(`${API_BASE}/api-keys/${item.id}`, { method: 'DELETE' });
  await loadApiKeys();
}
</script>
