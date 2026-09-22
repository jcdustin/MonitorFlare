export function daysUntil(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.ceil((time - Date.now()) / 86400000);
}

export function monitorTone(monitor) {
  if (!monitor) return 'unknown';
  if (monitor.paused === 1 || monitor.status === 'PAUSED') return 'paused';
  if (monitor.status === 'DOWN') return 'down';
  if (monitor.status === 'RETRYING') return 'warning';
  return 'online';
}

export function toneLabel(tone) {
  return { online: 'Online', warning: 'Warning', down: 'Down', paused: 'Paused', unknown: 'Unknown' }[tone] || 'Unknown';
}

export function expiryTone(value) {
  const days = daysUntil(value);
  if (days == null) return 'unknown';
  if (days <= 7) return 'down';
  if (days <= 30) return 'warning';
  return 'online';
}

export function targetOf(monitor) {
  if (!monitor) return '';
  if (monitor.type === 'port') {
    try {
      const cfg = JSON.parse(monitor.config || '{}');
      const host = new URL(monitor.url).hostname;
      return `${host}:${cfg.port || ''}`.replace(/:$/, '');
    } catch {
      return monitor.url || '';
    }
  }
  if (monitor.type === 'dns') {
    try { return new URL(monitor.url).hostname; } catch { return monitor.url || ''; }
  }
  return monitor.url || '';
}

export function typeLabel(type) {
  return { http: 'HTTP', dns: 'DNS', port: 'TCP' }[type] || (type || 'HTTP').toUpperCase();
}

export function formatWhen(value) {
  if (!value) return 'Never';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return 'Never';
  const delta = Date.now() - time;
  const sec = Math.max(0, Math.round(delta / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 36) return `${hr}h ago`;
  return new Date(value).toLocaleString();
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function parseConfig(monitor) {
  try { return JSON.parse(monitor?.config || '{}'); } catch { return {}; }
}

export function tagsOf(monitor) {
  return String(monitor?.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
}
