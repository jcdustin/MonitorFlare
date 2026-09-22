<template>
  <div v-if="ui.drawer" class="drawer-back" @click.self="ui.drawer = false">
    <form class="drawer" @submit.prevent="save">
      <header>
        <strong>{{ form.id ? 'Edit monitor' : 'Add monitor' }}</strong>
        <button type="button" class="icon-btn" @click="ui.drawer = false">×</button>
      </header>
      <div class="body">
        <div class="types">
          <button type="button" v-for="item in types" :key="item.id" :class="{ on: form.type === item.id }" @click="form.type = item.id">{{ item.label }}</button>
        </div>
        <label class="stack">Name <input v-model="form.name" required /></label>
        <template v-if="form.type === 'http'">
          <label class="stack">URL <input v-model="form.url" placeholder="https://example.com" required /></label>
          <div class="row">
            <label class="stack">Method
              <select v-model="form.method"><option>GET</option><option>POST</option><option>PUT</option><option>HEAD</option></select>
            </label>
            <label class="stack">Interval (seconds) <input v-model.number="form.interval" type="number" min="30" /></label>
          </div>
          <label class="stack">Keyword <input v-model="form.keyword" /></label>
          <label class="stack">User agent <input v-model="form.user_agent" /></label>
          <label class="row"><input type="checkbox" v-model="form.check_ssl" /> Check SSL</label>
          <label class="row"><input type="checkbox" v-model="form.check_domain" /> Check domain</label>
          <details>
            <summary>Advanced</summary>
            <label class="stack">Request headers (JSON) <textarea v-model="form.request_headers" rows="3"></textarea></label>
            <label class="stack">Request body <textarea v-model="form.request_body" rows="3"></textarea></label>
            <label class="stack">Failure threshold <input v-model.number="form.alert_after_failures" type="number" min="1" /></label>
            <label class="stack">Error rate threshold (%) <input v-model.number="form.alert_error_rate" type="number" min="0" max="100" /></label>
            <label class="stack">Alert silence (hours) <input v-model.number="form.alert_silence_hours" type="number" min="0" /></label>
          </details>
        </template>
        <template v-else-if="form.type === 'dns'">
          <label class="stack">Domain <input v-model="form.domain" placeholder="example.com" required /></label>
          <label class="stack">Record type
            <select v-model="form.record_type"><option>A</option><option>AAAA</option><option>CNAME</option><option>MX</option><option>TXT</option><option>NS</option></select>
          </label>
          <label class="stack">Expected value <input v-model="form.expected" /></label>
          <label class="stack">Interval (seconds) <input v-model.number="form.interval" type="number" min="30" /></label>
          <label class="stack">Failure threshold <input v-model.number="form.alert_after_failures" type="number" min="1" /></label>
        </template>
        <template v-else>
          <label class="stack">Host <input v-model="form.host" placeholder="example.com" required /></label>
          <label class="stack">Port <input v-model.number="form.port" type="number" min="1" max="65535" required /></label>
          <label class="stack">Interval (seconds) <input v-model.number="form.interval" type="number" min="30" /></label>
          <label class="stack">Failure threshold <input v-model.number="form.alert_after_failures" type="number" min="1" /></label>
        </template>
        <label class="stack">Tags <input v-model="form.tags" placeholder="production, api" /></label>
        <p v-if="formError" class="down">{{ formError }}</p>
      </div>
      <footer>
        <button type="button" class="btn-ghost" @click="ui.drawer = false">Cancel</button>
        <button class="btn-primary" :disabled="saving">{{ form.id ? 'Save changes' : 'Create monitor' }}</button>
      </footer>
    </form>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import { API_BASE } from '../utils/api';
import { parseConfig } from './model';
import { useConsole } from './useConsole';

const { ui, authFetch, refresh } = useConsole();
const saving = ref(false);
const formError = ref('');
const types = [
  { id: 'http', label: 'HTTP/HTTPS' },
  { id: 'dns', label: 'DNS' },
  { id: 'port', label: 'TCP Port' },
];
const blank = () => ({
  id: null, type: 'http', name: '', url: '', domain: '', host: '', port: 443, record_type: 'A', expected: '',
  method: 'GET', interval: 300, keyword: '', user_agent: '', tags: '', request_headers: '', request_body: '',
  check_ssl: true, check_domain: true, alert_after_failures: 5, alert_error_rate: 0, alert_silence_hours: 24,
});
const form = reactive(blank());

watch(() => ui.drawer, (open) => {
  if (!open) return;
  Object.assign(form, blank());
  formError.value = '';
  const source = ui.editing;
  if (!source) return;
  const cfg = parseConfig(source);
  Object.assign(form, {
    id: source.id, type: source.type || 'http', name: source.name || '', url: source.url || '',
    method: source.method || 'GET', interval: source.interval || 300, keyword: source.keyword || '',
    user_agent: source.user_agent || '', tags: source.tags || '', request_headers: source.request_headers || '',
    request_body: source.request_body || '', check_ssl: source.check_ssl !== 0, check_domain: source.check_domain !== 0,
    alert_after_failures: source.alert_after_failures || 5, alert_error_rate: source.alert_error_rate || 0,
    alert_silence_hours: source.alert_silence_uptime || 24, record_type: cfg.record_type || 'A', expected: cfg.expected || '',
    port: cfg.port || 443,
  });
  try {
    const host = new URL(source.url).hostname;
    form.domain = host;
    form.host = host;
  } catch { /* keep raw url */ }
});

function validate() {
  if (!form.name.trim()) return 'Name is required.';
  if (form.type === 'http') {
    try { const url = new URL(form.url); if (!/^https?:$/.test(url.protocol)) return 'URL must start with http or https.'; }
    catch { return 'Enter a valid URL.'; }
    if (form.request_headers.trim()) {
      try {
        const parsed = JSON.parse(form.request_headers);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'Headers must be a JSON object.';
      } catch { return 'Headers must be valid JSON.'; }
    }
  }
  if (form.type === 'dns' && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(form.domain.trim())) return 'Enter a domain name.';
  if (form.type === 'port' && (!form.host.trim() || form.port < 1 || form.port > 65535)) return 'Enter a host and a port from 1 to 65535.';
  return '';
}

async function save() {
  formError.value = validate();
  if (formError.value) return;
  saving.value = true;
  try {
    let url = form.url.trim();
    let config = '{}';
    if (form.type === 'dns') {
      url = `https://${form.domain.trim()}`;
      config = JSON.stringify({ record_type: form.record_type, expected: form.expected });
    } else if (form.type === 'port') {
      url = `tcp://${form.host.trim()}`;
      config = JSON.stringify({ port: Number(form.port) });
    }
    const body = {
      name: form.name.trim(), url, type: form.type, config, method: form.method, interval: Number(form.interval) || 300,
      keyword: form.keyword || '', user_agent: form.user_agent || '', tags: form.tags || '',
      request_headers: form.request_headers || '', request_body: form.request_body || '',
      check_ssl: form.check_ssl ? 1 : 0, check_domain: form.check_domain ? 1 : 0,
      alert_after_failures: Number(form.alert_after_failures) || 5,
      alert_error_rate: Number(form.alert_error_rate) || 0,
      alert_silence_uptime: Number(form.alert_silence_hours) || 0,
    };
    const res = form.id
      ? await authFetch(`${API_BASE}/monitors/${form.id}/config`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await authFetch(`${API_BASE}/monitors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      formError.value = data.error || 'The monitor could not be saved.';
      return;
    }
    ui.drawer = false;
    await refresh();
  } finally {
    saving.value = false;
  }
}
</script>
