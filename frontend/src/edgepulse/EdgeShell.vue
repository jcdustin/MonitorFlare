<template>
  <div class="edgepulse" :class="{ light: !isDark }">
    <div v-if="!isAuthenticated" class="modal-back" style="position:absolute">
      <form class="modal" @submit.prevent="submitLogin">
        <header><strong>Sign in to EdgePulse</strong></header>
        <div class="body">
          <label class="stack">Admin password
            <input v-model="inputPassword" type="password" autocomplete="current-password" />
          </label>
          <p v-if="loginError" class="down">Sign-in failed. Check the admin password.</p>
        </div>
        <footer><button class="btn-primary" :disabled="loggingIn">Continue</button></footer>
      </form>
    </div>
    <template v-else>
      <aside class="sidebar" :class="{ open: ui.navOpen }">
        <div class="brand">
          <div class="brand-mark"><i class="fa-solid fa-satellite-dish"></i></div>
          <div><strong>EdgePulse</strong><small>Uptime beyond borders</small></div>
        </div>
        <nav class="nav">
          <router-link v-for="item in nav" :key="item.to" :to="item.to" :class="{ active: isActive(item.to) }" @click="ui.navOpen = false">
            <i :class="`fa-solid ${item.icon}`"></i>
            <span>{{ item.label }}</span>
            <em v-if="item.to === '/incidents' && activeIncidents.length" class="badge">{{ activeIncidents.length }}</em>
          </router-link>
        </nav>
        <div class="engine">
          <b><i class="dot"></i>EdgePulse Engine</b>
          <span>{{ health?.ok === false ? 'Unavailable' : 'Operational' }} · Last check {{ lastCheck }}</span>
        </div>
      </aside>
      <div class="workspace">
        <header class="topbar">
          <button class="icon-btn nav-toggle" @click="ui.navOpen = !ui.navOpen" aria-label="Menu"><i class="fa-solid fa-bars"></i></button>
          <button class="search" @click="openPalette">
            <i class="fa-solid fa-magnifying-glass"></i>
            Search monitors, incidents, or jump to...
            <kbd>Ctrl K</kbd>
          </button>
          <div class="spacer"></div>
          <button class="icon-btn" title="Refresh" @click="refresh"><i class="fa-solid fa-rotate"></i></button>
          <button class="icon-btn" title="Theme" @click="toggleTheme"><i :class="isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'"></i></button>
          <router-link class="icon-btn" to="/incidents" title="Notifications" style="display:grid;place-items:center">
            <i class="fa-solid fa-bell"></i>
          </router-link>
          <details class="menu">
            <summary class="icon-btn" style="list-style:none;display:grid;place-items:center"><i class="fa-solid fa-user"></i></summary>
            <div class="menu-pop">
              <button @click="$router.push('/settings')">Settings</button>
              <button @click="$router.push('/')">Public status</button>
              <button @click="logout">Sign out</button>
            </div>
          </details>
          <button class="btn-primary" @click="openCreate">+ Add Monitor</button>
        </header>
        <main class="content"><router-view /></main>
      </div>
      <nav class="bottom-nav">
        <router-link to="/overview">Overview</router-link>
        <router-link to="/monitors">Monitors</router-link>
        <router-link to="/incidents">Incidents</router-link>
        <router-link to="/ssl">SSL</router-link>
        <button class="linkish" @click="ui.navOpen = true">More</button>
      </nav>
    </template>

    <div v-if="ui.palette" class="modal-back" @click.self="ui.palette = false">
      <div class="palette">
        <input v-model="query" placeholder="Search monitors, incidents, or jump to..." autofocus />
        <button v-for="item in paletteItems" :key="item.key" @click="go(item)">
          <strong>{{ item.label }}</strong>
          <span class="muted"> · {{ item.hint }}</span>
        </button>
        <p v-if="!paletteItems.length" class="empty">No matches.</p>
      </div>
    </div>

    <div v-if="ui.confirm" class="modal-back">
      <div class="modal">
        <header><strong>Confirm</strong></header>
        <div class="body"><p>{{ ui.confirm.message }}</p></div>
        <footer>
          <button class="btn-ghost" @click="settleConfirm(false)">Cancel</button>
          <button class="btn-danger" @click="settleConfirm(true)">Confirm</button>
        </footer>
      </div>
    </div>
    <MonitorDrawer />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTheme } from '../composables/useTheme';
import { useConsole } from './useConsole';
import { formatWhen } from './model';
import MonitorDrawer from './MonitorDrawer.vue';
import './edgepulse.css';

const route = useRoute();
const router = useRouter();
if (!localStorage.getItem('edgepulse-theme')) localStorage.setItem('edgepulse-theme', 'dark');
const { isDark, toggleTheme } = useTheme('edgepulse-theme');
const consoleApi = useConsole();
const { isAuthenticated, inputPassword, loginError, loggingIn, login, logout, ui, refresh, health, monitors, incidents, activeIncidents, settleConfirm } = consoleApi;

const nav = [
  { to: '/overview', label: 'Overview', icon: 'fa-gauge-high' },
  { to: '/monitors', label: 'Monitors', icon: 'fa-wave-square' },
  { to: '/incidents', label: 'Incidents', icon: 'fa-triangle-exclamation' },
  { to: '/ssl', label: 'SSL & Domains', icon: 'fa-lock' },
  { to: '/notifications', label: 'Notifications', icon: 'fa-bell' },
  { to: '/status-pages', label: 'Status Pages', icon: 'fa-pager' },
  { to: '/nodes', label: 'Global Nodes', icon: 'fa-earth-americas' },
  { to: '/analytics', label: 'Analytics', icon: 'fa-chart-line' },
  { to: '/settings', label: 'Settings', icon: 'fa-gear' },
];
const query = ref('');
const lastCheck = computed(() => formatWhen(health.value?.last_check || monitors.value.map(item => item.last_check).filter(Boolean).sort().at(-1)));

function isActive(path) {
  return route.path === path || route.path.startsWith(`${path}/`);
}
function openCreate() { ui.editing = null; ui.drawer = true; }
function openPalette() { query.value = ''; ui.palette = true; }
function submitLogin() { login(() => refresh()); }
function go(item) { ui.palette = false; router.push(item.to); }

const paletteItems = computed(() => {
  const q = query.value.trim().toLowerCase();
  const pages = nav.map(item => ({ key: item.to, label: item.label, hint: 'Page', to: item.to }));
  const mons = monitors.value.map(item => ({ key: `m${item.id}`, label: item.name, hint: item.url, to: `/monitors/${item.id}` }));
  const incs = incidents.value.map(item => ({ key: `i${item.id}`, label: item.title, hint: 'Incident', to: `/incidents/${item.id}` }));
  return [...pages, ...mons, ...incs].filter(item => !q || `${item.label} ${item.hint}`.toLowerCase().includes(q)).slice(0, 12);
});

function onKey(event) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    ui.palette = !ui.palette;
  }
}
watch(() => route.path, () => { document.title = 'EdgePulse'; });
onMounted(() => {
  window.addEventListener('keydown', onKey);
  document.title = 'EdgePulse';
  if (isAuthenticated.value) refresh();
});
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>
