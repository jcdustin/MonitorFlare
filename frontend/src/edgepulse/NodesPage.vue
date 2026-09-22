<template>
  <div>
    <div class="page-head"><div><h1>Global Nodes</h1><p>Regional probes will run checks outside the core worker.</p></div></div>
    <article class="card" style="margin-bottom:16px">
      <Globe />
      <h2>Global Monitoring is not configured yet.</h2>
      <p class="muted">Regional probes will run the same HTTP, DNS, and TCP checks from North America, Europe, and Asia Pacific, then report results back to EdgePulse Core. A Cloudflare cron region is not treated as a city probe.</p>
    </article>
    <article class="card empty">
      <p>No regional probes are connected.</p>
      <button class="btn" disabled>Configure Regional Probe · Coming Soon</button>
    </article>
  </div>
</template>

<script setup>
import Globe from './GlobeMark.vue';
</script>
