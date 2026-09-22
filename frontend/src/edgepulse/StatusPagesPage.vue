<template>
  <div>
    <div class="page-head"><div><h1>Status Pages</h1><p>One public page today. The editor is not limited to a single hard-coded page.</p></div></div>
    <article v-if="!editing" class="card">
      <div class="row" style="justify-content:space-between">
        <div>
          <strong>Default Status Page</strong>
          <p class="muted">{{ settings.status_page_visibility === 'private' ? 'Private' : 'Published' }} · {{ monitors.length }} monitors · {{ subscribers.length }} subscribers</p>
          <p>{{ origin }}/</p>
        </div>
        <div class="row">
          <button class="btn" @click="editing = true">Edit</button>
          <a class="btn" href="/" target="_blank" rel="noopener">Preview</a>
        </div>
      </div>
    </article>
    <article v-else class="card">
      <div class="tabs">
        <button v-for="item in tabs" :key="item" :class="{ on: tab === item }" @click="tab = item">{{ item }}</button>
      </div>
      <div v-if="tab === 'General'" class="grid">
        <label class="stack">Title <input v-model="draft.site_title" /></label>
        <label class="stack">Description <textarea v-model="draft.site_description" rows="3"></textarea></label>
        <label class="stack">Logo <input v-model="draft.site_logo_url" /></label>
      </div>
      <div v-else-if="tab === 'Monitors'">
        <p class="muted">The current status page lists every monitor. Per-page selection is reserved for a later multi-page model.</p>
        <p v-for="item in monitors" :key="item.id">{{ item.name }}</p>
      </div>
      <div v-else-if="tab === 'Groups'">
        <p class="muted">Groups follow monitor tags.</p>
        <p v-for="tag in tags" :key="tag">{{ tag }}</p>
      </div>
      <div v-else-if="tab === 'Appearance'">
        <p>Public page theme follows the visitor. EdgePulse accent stays cyan.</p>
      </div>
      <div v-else-if="tab === 'Subscribers'">
        <p v-if="!subscribers.length" class="muted">No subscribers yet.</p>
        <p v-for="item in subscribers" :key="item.id">{{ item.email }}</p>
      </div>
      <div v-else>
        <label class="row"><input type="radio" value="public" v-model="draft.status_page_visibility" /> Public</label>
        <label class="row"><input type="radio" value="private" v-model="draft.status_page_visibility" /> Private</label>
        <label class="stack">New password <input v-model="password" type="password" autocomplete="new-password" /></label>
      </div>
      <div class="row" style="margin-top:16px">
        <button class="btn-ghost" @click="editing = false">Cancel</button>
        <button class="btn-primary" @click="save">Save</button>
      </div>
    </article>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { API_BASE } from '../utils/api';
import { tagsOf } from './model';
import { useConsole } from './useConsole';

const { settings, monitors, subscribers, loadSubscribers, authFetch, refresh } = useConsole();
const editing = ref(false);
const tab = ref('General');
const tabs = ['General', 'Monitors', 'Groups', 'Appearance', 'Subscribers', 'Access'];
const password = ref('');
const draft = reactive({ site_title: '', site_description: '', site_logo_url: '', status_page_visibility: 'public' });
const origin = window.location.origin;
const tags = computed(() => [...new Set(monitors.value.flatMap(tagsOf))]);
watch(settings, (value) => Object.assign(draft, {
  site_title: value.site_title || '', site_description: value.site_description || '',
  site_logo_url: value.site_logo_url || '', status_page_visibility: value.status_page_visibility || 'public',
}), { immediate: true });
onMounted(loadSubscribers);
async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function save() {
  const body = { ...draft };
  if (password.value) body.status_page_password = await sha256Hex(password.value);
  await authFetch(`${API_BASE}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  password.value = '';
  editing.value = false;
  await refresh();
}
</script>
