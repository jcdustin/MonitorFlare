<template>
  <div>
    <div class="page-head"><div><h1>SSL & Domains</h1><p>Certificate and registration expiry across monitored domains.</p></div></div>
    <section class="grid stat4" style="margin-bottom:16px">
      <article class="card kpi"><span>Expiring &lt;7 days</span><b>{{ count(row => days(row.cert_expiry) != null && days(row.cert_expiry) <= 7) }}</b></article>
      <article class="card kpi"><span>Expiring &lt;30 days</span><b>{{ count(row => days(row.cert_expiry) != null && days(row.cert_expiry) <= 30) }}</b></article>
      <article class="card kpi"><span>Healthy certificates</span><b>{{ count(row => days(row.cert_expiry) != null && days(row.cert_expiry) > 30) }}</b></article>
      <article class="card kpi"><span>Domain expiring &lt;30 days</span><b>{{ count(row => days(row.domain_expiry) != null && days(row.domain_expiry) <= 30) }}</b></article>
    </section>
    <div class="filters" style="margin-bottom:12px">
      <button v-for="item in filters" :key="item" :class="{ on: filter === item }" @click="filter = item">{{ item }}</button>
    </div>
    <div class="card table-wrap">
      <table class="data">
        <thead><tr><th>Domain</th><th>Monitor</th><th>SSL Status</th><th>Certificate Expiry</th><th>Domain Expiry</th><th>Last Checked</th><th></th></tr></thead>
        <tbody>
          <tr v-for="item in rows" :key="item.id" class="click" @click="$router.push(`/monitors/${item.id}`)">
            <td>{{ host(item) }}</td>
            <td>{{ item.name }}</td>
            <td><span class="pill" :class="expiryTone(item.cert_expiry)">{{ label(item.cert_expiry) }}</span></td>
            <td>{{ item.cert_expiry || '—' }}</td>
            <td>{{ item.domain_expiry || '—' }}</td>
            <td>{{ formatWhen(item.last_check) }}</td>
            <td><button class="btn" @click.stop="refreshInfo(item)">Refresh</button></td>
          </tr>
        </tbody>
      </table>
      <p v-if="!rows.length" class="empty">No certificate records match this filter.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { API_BASE } from '../utils/api';
import { daysUntil, expiryTone, formatWhen } from './model';
import { useConsole } from './useConsole';

const { monitors, authFetch, refresh } = useConsole();
const filter = ref('All');
const filters = ['All', 'Critical', 'Warning', 'Healthy', 'Unknown'];
const days = daysUntil;
function host(item) { try { return new URL(item.url).hostname; } catch { return item.url; } }
function label(value) {
  const tone = expiryTone(value);
  return { down: 'Critical', warning: 'Warning', online: 'Healthy', unknown: 'Unknown' }[tone];
}
function bucket(item) {
  const ssl = expiryTone(item.cert_expiry);
  const domain = expiryTone(item.domain_expiry);
  if (ssl === 'down' || domain === 'down') return 'Critical';
  if (ssl === 'warning' || domain === 'warning') return 'Warning';
  if (ssl === 'online' || domain === 'online') return 'Healthy';
  return 'Unknown';
}
const rows = computed(() => monitors.value.filter(item => item.type === 'http' && (filter.value === 'All' || bucket(item) === filter.value)));
function count(fn) { return monitors.value.filter(fn).length; }
async function refreshInfo(item) {
  await authFetch(`${API_BASE}/monitors/${item.id}/refresh-info`, { method: 'POST' });
  await refresh();
}
</script>
