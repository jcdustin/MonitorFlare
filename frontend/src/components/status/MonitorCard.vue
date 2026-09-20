<template>
  <div class="glass-card monitor-card rounded-xl px-4 py-4 sm:px-5 cursor-default group"
    :class="[
      monitor.paused ? 'opacity-50 monitor-status-paused' : '',
      monitor.status === 'UP' && !monitor.paused ? 'monitor-status-up' : '',
      monitor.status === 'DOWN' ? 'monitor-status-down' : '',
      monitor.status === 'RETRYING' ? 'monitor-status-retrying' : '',
    ]"
    :style="{ animationDelay: (index * 0.06) + 's' }">

    <div class="monitor-card-layout">
      <section class="min-w-0">
        <div class="flex items-center gap-3">
          <div class="relative shrink-0">
            <div class="w-2.5 h-2.5 rounded-full"
              :class="{
                'bg-emerald-400': monitor.status === 'UP' && !monitor.paused,
                'bg-red-400': monitor.status === 'DOWN',
                'bg-yellow-400': monitor.status === 'RETRYING',
                'bg-slate-400 dark:bg-slate-600': monitor.paused,
              }"></div>
            <div v-if="monitor.status === 'UP' && !monitor.paused" class="absolute inset-0 rounded-full bg-emerald-400/40 pulse-dot"></div>
          </div>
          <div class="flex items-center gap-1.5 min-w-0">
            <router-link :to="`/monitor/${monitor.id}`" :title="$t('monitorCard.viewDetails')"
              class="flex items-center gap-1.5 min-w-0 group/name">
              <h3 class="font-semibold text-slate-900 dark:text-white text-base truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">{{ monitor.name }}</h3>
              <span class="type-badge shrink-0" :title="$t('monitorCard.type.' + typeKey)">
                <span class="type-badge-icon"><i :class="typeIcon"></i></span>
                <span class="type-badge-label">{{ typeLabel }}</span>
              </span>
              <svg class="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0 opacity-0 group-hover/name:opacity-100 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-all duration-200" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
            </router-link>
          </div>
        </div>

        <div class="mt-2 flex min-w-0 items-center gap-x-3 pl-5">
          <a :href="monitor.url" target="_blank" rel="noopener" class="min-w-0 flex-1 text-[11px] sm:text-[13px] font-mono text-slate-500 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate cursor-pointer flex items-center gap-1.5 group/link">
            {{ monitor.url }}
            <svg class="w-2.5 h-2.5 opacity-70 group-hover/link:opacity-100 transition-opacity duration-200 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>
          </a>
          <a v-if="monitor.cert_expiry && sslCheckUrl" :href="sslCheckUrl" target="_blank" rel="noopener"
            class="flex items-center gap-1 text-[11px] sm:text-[12px] font-mono text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors cursor-pointer shrink-0"
            :title="$t('monitorCard.sslCheck')">
            <i class="fa-regular fa-flag"></i>
          </a>
          <span class="shrink-0 text-[10px] sm:text-[11px] font-mono text-slate-400 dark:text-slate-600">{{ formatDate(monitor.last_check) }}</span>
        </div>

        <div v-if="monitorTags.length" class="monitor-tags mt-2 flex flex-wrap content-start gap-1.5 pl-5">
          <button v-for="tag in monitorTags" :key="tag" type="button"
            class="tag-chip cursor-pointer hover:border-emerald-500/40 hover:text-emerald-500 transition-colors"
            @click.stop="emit('select-tag', tag)">
            {{ tag }}
          </button>
        </div>
      </section>

      <section class="monitor-expiry-grid grid grid-cols-2 gap-4 border-slate-200/70 dark:border-white/[0.06]">
        <a v-if="monitor.cert_expiry" :href="sslCheckUrl || undefined" target="_blank" rel="noopener"
          class="expiry-field min-w-0" :class="sslCheckUrl ? 'cursor-pointer' : 'cursor-default'"
          :title="$t('monitorCard.sslCheck')">
          <span class="expiry-label"><i class="fa-solid fa-calendar-days"></i>{{ $t('monitorForm.ssl') }}</span>
          <span class="expiry-value" :class="expiryTextClass(monitor.cert_expiry)">{{ formatExpiryDate(monitor.cert_expiry) }} · {{ formatExpiry(monitor.cert_expiry) }}</span>
        </a>
        <div v-else class="expiry-field min-w-0" :title="monitor.last_info_error || ''">
          <span class="expiry-label"><i class="fa-solid fa-calendar-days"></i>{{ $t('monitorForm.ssl') }}</span>
          <span class="expiry-value text-slate-400 dark:text-slate-600">
            {{ monitor.type === 'http' && monitor.check_ssl === 1
              ? $t(monitor.info_status === 'ERROR' || monitor.info_status === 'PARTIAL' ? 'monitorDetail.sslUnavailable' : 'monitorDetail.sslPending')
              : '—' }}
          </span>
        </div>

        <div class="expiry-field min-w-0">
          <span class="expiry-label"><i class="fa-solid fa-globe"></i>{{ $t('monitorForm.domain') }}</span>
          <span v-if="monitor.domain_expiry" class="expiry-value" :class="expiryTextClass(monitor.domain_expiry)">{{ formatExpiryDate(monitor.domain_expiry) }} · {{ formatExpiry(monitor.domain_expiry) }}</span>
          <span v-else class="expiry-value text-slate-400 dark:text-slate-600">—</span>
        </div>
      </section>

      <section class="monitor-meta grid shrink-0 grid-cols-[repeat(3,max-content)_minmax(72px,92px)] items-center gap-2">
        <span v-if="monitor.paused" class="inline-flex min-w-[64px] justify-center px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700">{{ $t('status.paused') }}</span>
        <span v-else-if="monitor.status === 'UP'" class="inline-flex min-w-[64px] justify-center px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20">{{ $t('status.up') }}</span>
        <span v-else-if="monitor.status === 'DOWN'" class="inline-flex min-w-[64px] justify-center px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25">{{ $t('status.down') }}</span>
        <span v-else class="inline-flex min-w-[64px] justify-center px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors bg-yellow-50 dark:bg-yellow-400/10 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-400/25">{{ $t('status.retrying') }}</span>

        <div v-if="monitor.latency != null && !monitor.paused" class="latency-badge flex min-w-[70px] justify-center items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-mono font-medium border cursor-default"
          :class="latencyClass(monitor.latency)">
          <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>
          {{ monitor.latency }}ms
        </div>
        <div v-else class="metric-placeholder">—</div>

        <div v-if="monitor.uptime_24h != null && !monitor.paused" class="min-w-[82px] text-center px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-mono font-semibold border"
          :class="monitor.uptime_24h >= 99.9 ? 'text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' : monitor.uptime_24h >= 95 ? 'text-yellow-600 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-400/10 border-yellow-200 dark:border-yellow-400/20' : 'text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'">
          24h {{ monitor.uptime_24h }}%
        </div>
        <div v-else class="metric-placeholder">—</div>

        <svg v-if="sparkline && !monitor.paused" class="sparkline-wrap w-[92px] h-[26px]" :class="monitor.status === 'DOWN' ? 'text-red-500' : monitor.status === 'RETRYING' ? 'text-yellow-500' : 'text-emerald-500'" viewBox="0 0 120 28" preserveAspectRatio="none" :aria-label="$t('monitorCard.latencyTrend')">
          <path :d="sparkline.area" class="sparkline-area" fill="currentColor"/>
          <path :d="sparkline.line" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
          <circle :cx="sparkline.dot.x" :cy="sparkline.dot.y" r="2.5" fill="currentColor" opacity="0.9"/>
        </svg>
        <div v-else class="h-[26px] w-[92px] border-b border-dashed border-slate-200 dark:border-white/[0.08]"></div>
      </section>
    </div>

    <UptimeBar v-if="monitor.daily_stats && monitor.daily_stats.length > 0 && !monitor.paused" :monitor="monitor" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { formatDate, getDaysRemaining, formatExpiry, formatExpiryDate, latencyClass } from '../../utils/format';
import UptimeBar from './UptimeBar.vue';

const props = defineProps({
    monitor: { type: Object, required: true },
    index:   { type: Number, required: true },
});
const emit = defineEmits(['select-tag']);
const monitorTags = computed(() => props.monitor.tags
    ? props.monitor.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    : []
);
const expiryTextClass = (dateStr) => {
    const days = getDaysRemaining(dateStr);
    if (days === null) return 'text-slate-500 dark:text-slate-400';
    if (days < 7) return 'text-red-600 dark:text-red-300';
    if (days < 30) return 'text-yellow-600 dark:text-yellow-300';
    return 'text-emerald-600 dark:text-emerald-300';
};

const sparkline = computed(() => {
    const lats = props.monitor.recent_latencies;
    if (!lats || lats.length < 3) return null;

    const W = 120, H = 28, P = 2;
    const max = Math.max(...lats), min = Math.min(...lats);
    const range = max - min || 1;

    const pts = lats.map((v, i) => ({
        x: P + (i / (lats.length - 1)) * (W - 2 * P),
        y: H - P - ((v - min) / range) * (H - 2 * P),
    }));

    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const ptStr = pts.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
    const area = `M${ptStr[0]} L${ptStr.join(' L')} L${(W - P).toFixed(1)} ${H} L${P} ${H} Z`;

    return { line, area, dot: pts[pts.length - 1] };
});

const typeKey = computed(() => {
    const t = props.monitor.type || 'http';
    return t === 'http' && props.monitor.cert_expiry ? 'ssl' : t;
});

const typeIcon = computed(() => ({
    ssl: 'fa-brands fa-expeditedssl',
    http: 'fa-solid fa-fingerprint',
    dns: 'fa-solid fa-globe',
    port: 'fa-solid fa-server',
}[typeKey.value] || 'fa-solid fa-fingerprint'));

const typeLabel = computed(() => ({
    ssl: 'SSL',
    http: 'HTTP/HTTPS',
    dns: 'DNS',
    port: 'TCP',
}[typeKey.value] || 'HTTP/HTTPS'));

const sslCheckUrl = computed(() => {
    try {
        const host = new URL(props.monitor.url).hostname;
        if (!host) return '';
        return `https://csr.plus/check?domain=${encodeURIComponent(host)}`;
    } catch {
        return '';
    }
});
</script>

<style scoped>
.monitor-card-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    align-items: center;
}

.expiry-field {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.25rem;
}

.expiry-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: rgb(100 116 139);
    font-size: 0.6875rem;
    line-height: 1rem;
}

.dark .expiry-label {
    color: rgb(100 116 139);
}

.expiry-value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6875rem;
    line-height: 1rem;
    font-weight: 600;
}

.metric-placeholder {
    min-width: 70px;
    border: 1px solid rgb(226 232 240);
    border-radius: 0.5rem;
    padding: 0.25rem 0.625rem;
    color: rgb(148 163 184);
    text-align: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.75rem;
}

.dark .metric-placeholder {
    border-color: rgb(255 255 255 / 0.08);
    color: rgb(71 85 105);
}

@media (min-width: 768px) {
    .monitor-card-layout {
        grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
    }

    .monitor-meta {
        grid-column: 1 / -1;
        justify-content: end;
    }
}

@media (min-width: 1200px) {
    .monitor-card-layout {
        grid-template-columns: minmax(340px, 1.25fr) minmax(300px, 0.95fr) minmax(350px, auto);
    }

    .monitor-expiry-grid {
        align-self: stretch;
        border-left-width: 1px;
        border-right-width: 1px;
        padding: 0 1.25rem;
    }

    .monitor-meta {
        grid-column: auto;
        justify-content: end;
    }
}

.group:hover .type-badge-label {
    background: #10b981;
}
</style>
