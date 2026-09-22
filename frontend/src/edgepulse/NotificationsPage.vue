<template>
  <div>
    <div class="page-head">
      <div><h1>Notification Channels</h1><p>Alerts still broadcast to every enabled channel.</p></div>
      <button class="btn-primary" @click="open()">+ Add Channel</button>
    </div>
    <div class="tabs">
      <button class="on">Channels</button>
      <button disabled title="Coming in V2.1">Routing Rules</button>
    </div>
    <div v-if="!channels.length" class="card empty">No notification channels yet. <button class="linkish" @click="open()">Add Channel</button></div>
    <div v-else class="grid channel-grid">
      <article v-for="ch in channels" :key="ch.id" class="card">
        <strong>{{ ch.name }}</strong>
        <p class="muted">{{ ch.type }}</p>
        <span class="pill" :class="ch.enabled ? 'online' : 'paused'">{{ ch.enabled ? 'Active' : 'Muted' }}</span>
        <div class="row" style="margin-top:12px">
          <button class="btn" @click="open(ch)">Edit</button>
          <button class="btn" @click="test(ch)">Test</button>
          <button class="btn" @click="toggle(ch)">{{ ch.enabled ? 'Disable' : 'Enable' }}</button>
          <button class="btn-danger" @click="remove(ch)">Delete</button>
        </div>
      </article>
    </div>
    <div v-if="editing" class="modal-back" @click.self="editing = null">
      <form class="modal" @submit.prevent="save">
        <header><strong>{{ editing.id ? 'Edit channel' : 'Add channel' }}</strong></header>
        <div class="body">
          <label class="stack">Name <input v-model="editing.name" required /></label>
          <label class="stack">Type
            <select v-model="editing.type"><option v-for="item in types" :key="item">{{ item }}</option></select>
          </label>
          <label v-for="field in fields" :key="field" class="stack">{{ field }} <input v-model="editing.config[field]" /></label>
          <p v-if="formError" class="down">{{ formError }}</p>
        </div>
        <footer>
          <button type="button" class="btn-ghost" @click="editing = null">Cancel</button>
          <button class="btn-primary">Save</button>
        </footer>
      </form>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { API_BASE } from '../utils/api';
import { useConsole } from './useConsole';

const { channels, authFetch, refresh, askConfirm } = useConsole();
const editing = ref(null);
const formError = ref('');
const types = ['telegram', 'slack', 'discord', 'dingtalk', 'wecom', 'feishu', 'ntfy', 'webhook', 'email'];
const fieldMap = {
  telegram: ['bot_token', 'chat_id'], slack: ['webhook_url'], discord: ['webhook_url'],
  dingtalk: ['access_token', 'secret'], wecom: ['key'], feishu: ['webhook_url', 'secret'],
  ntfy: ['server', 'topic', 'token'], webhook: ['url', 'method', 'headers'],
  email: ['provider', 'api_key', 'from_email', 'to_email', 'domain', 'region', 'api_secret'],
};
const fields = computed(() => fieldMap[editing.value?.type] || []);
function open(ch) {
  formError.value = '';
  editing.value = ch
    ? { id: ch.id, name: ch.name, type: ch.type, enabled: ch.enabled, config: { ...(ch.config || {}) } }
    : { name: '', type: 'telegram', enabled: 1, config: {} };
}
async function save() {
  const payload = { name: editing.value.name, type: editing.value.type, enabled: editing.value.enabled ?? 1, config: editing.value.config };
  const res = editing.value.id
    ? await authFetch(`${API_BASE}/notification-channels/${editing.value.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    : await authFetch(`${API_BASE}/notification-channels`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) { formError.value = (await res.json().catch(() => ({}))).error || 'Could not save the channel.'; return; }
  editing.value = null;
  await refresh();
}
async function toggle(ch) {
  await authFetch(`${API_BASE}/notification-channels/${ch.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: ch.enabled ? 0 : 1 }) });
  await refresh();
}
async function remove(ch) {
  if (!await askConfirm(`Delete ${ch.name}?`)) return;
  await authFetch(`${API_BASE}/notification-channels/${ch.id}`, { method: 'DELETE' });
  await refresh();
}
async function test(ch) {
  const res = await authFetch(`${API_BASE}/notification-channels/${ch.id}/test`, { method: 'POST' });
  formError.value = res.ok ? '' : 'Test failed.';
}
</script>
