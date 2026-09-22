<template>
  <p v-if="!usable.length" class="empty">Not enough monitoring data yet.</p>
  <svg v-else class="chart" viewBox="0 0 640 180" role="img">
    <polyline :points="line" fill="none" stroke="#49d0ea" stroke-width="2" />
    <text v-for="tick in ticks" :key="tick.y" :x="8" :y="tick.y">{{ tick.label }}</text>
  </svg>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({ points: { type: Array, default: () => [] }, metric: { type: String, default: 'uptime' } });
const usable = computed(() => props.points.filter(point => point[props.metric] != null));
const line = computed(() => {
  const rows = usable.value;
  if (rows.length < 2) return '';
  const values = rows.map(point => point[props.metric]);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (props.metric === 'uptime') {
    min = Math.min(min, 100);
    max = 100;
    if (min > 98.5) min = 98.5;
    if (max - min < 0.5) min = max - 0.5;
  } else if (min === max) {
    min = 0;
  }
  return rows.map((point, index) => {
    const x = 48 + (index / (rows.length - 1)) * 580;
    const y = 20 + (1 - (point[props.metric] - min) / (max - min)) * 130;
    return `${x},${y}`;
  }).join(' ');
});
const ticks = computed(() => {
  const rows = usable.value;
  if (!rows.length) return [];
  const values = rows.map(point => point[props.metric]);
  const max = props.metric === 'uptime' ? 100 : Math.max(...values);
  const min = props.metric === 'uptime' && Math.min(...values) > 98.5 ? 98.5 : Math.min(...values);
  const unit = props.metric === 'uptime' ? '%' : ' ms';
  return [{ y: 24, label: `${Math.round(max)}${unit}` }, { y: 150, label: `${Math.round(min)}${unit}` }];
});
</script>
