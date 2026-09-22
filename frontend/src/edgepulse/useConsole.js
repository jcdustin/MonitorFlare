import { computed, reactive, ref } from 'vue';
import { API_BASE, fetchT, withRetry } from '../utils/api';
import { useAuth } from '../composables/useAuth';
import { daysUntil, monitorTone } from './model';

const monitors = ref([]);
const incidents = ref([]);
const channels = ref([]);
const settings = ref({});
const subscribers = ref([]);
const apiKeys = ref([]);
const health = ref(null);
const loading = ref(false);
const error = ref('');
const loaded = ref(false);

const ui = reactive({
  palette: false,
  navOpen: false,
  drawer: false,
  editing: null,
  confirm: null,
});

async function authFetch(url, options = {}) {
  const token = sessionStorage.getItem('uptime_admin_token') || '';
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  const res = await fetchT(url, { ...options, headers });
  if (res.status === 401) {
    sessionStorage.removeItem('uptime_admin_token');
    window.location.assign('/overview');
  }
  return res;
}

async function refresh() {
  if (!sessionStorage.getItem('uptime_admin_token')) return;
  loading.value = true;
  error.value = '';
  try {
    const [adminRes, publicRes, incidentRes, channelRes, healthRes, settingsRes] = await Promise.all([
      withRetry(() => authFetch(`${API_BASE}/monitors`)),
      fetchT(`${API_BASE}/monitors/public/details`).catch(() => null),
      authFetch(`${API_BASE}/incidents/all`).catch(() => null),
      authFetch(`${API_BASE}/notification-channels`).catch(() => null),
      authFetch(`${API_BASE}/health`).catch(() => null),
      authFetch(`${API_BASE}/settings`).catch(() => null),
    ]);
    if (!adminRes?.ok) {
      error.value = `Monitors could not be loaded (${adminRes?.status || 'network'}).`;
      return;
    }
    const adminData = await adminRes.json();
    const publicMap = {};
    if (publicRes?.ok) {
      const body = await publicRes.json();
      (body.monitors || []).forEach(item => { publicMap[item.id] = item; });
    }
    monitors.value = (Array.isArray(adminData) ? adminData : []).map(item => ({ ...item, ...(publicMap[item.id] || {}) }));
    incidents.value = incidentRes?.ok ? await incidentRes.json() : [];
    channels.value = channelRes?.ok ? await channelRes.json() : [];
    health.value = healthRes?.ok ? await healthRes.json() : null;
    settings.value = settingsRes?.ok ? await settingsRes.json() : {};
    loaded.value = true;
  } catch {
    error.value = 'The console could not reach the monitoring API.';
  } finally {
    loading.value = false;
  }
}

async function loadSubscribers() {
  const res = await authFetch(`${API_BASE}/subscriptions`);
  subscribers.value = res.ok ? await res.json() : [];
}

async function loadApiKeys() {
  const res = await authFetch(`${API_BASE}/api-keys`);
  apiKeys.value = res.ok ? await res.json() : [];
}

function askConfirm(message) {
  return new Promise(resolve => { ui.confirm = { message, resolve }; });
}

function settleConfirm(ok) {
  ui.confirm?.resolve(ok);
  ui.confirm = null;
}

export function useConsole() {
  const auth = useAuth();
  const tones = computed(() => monitors.value.map(monitor => ({ monitor, tone: monitorTone(monitor) })));
  const counts = computed(() => ({
    total: monitors.value.length,
    online: tones.value.filter(item => item.tone === 'online').length,
    warning: tones.value.filter(item => item.tone === 'warning').length,
    down: tones.value.filter(item => item.tone === 'down').length,
    paused: tones.value.filter(item => item.tone === 'paused').length,
  }));
  const activeIncidents = computed(() => incidents.value.filter(item => item.status === 'active' && item.type !== 'maintenance'));
  const sslExpiring = computed(() => monitors.value.filter(item => {
    const days = daysUntil(item.cert_expiry);
    return days != null && days <= 30;
  }).length);

  return {
    ...auth,
    monitors, incidents, channels, settings, subscribers, apiKeys, health,
    loading, error, loaded, ui, tones, counts, activeIncidents, sslExpiring,
    refresh, loadSubscribers, loadApiKeys, authFetch, askConfirm, settleConfirm,
  };
}
