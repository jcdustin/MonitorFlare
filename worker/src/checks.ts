// ============================================================
// MonitorFlare — 监测引擎
// 支持: http(HTTP/HTTPS) / dns(DoH 解析比对) / port(TCP 连通性)
// ============================================================
import type { Bindings, CheckResult, Monitor } from './types';

// ---------- HTTP 监测 ----------
async function checkHTTP(monitor: Monitor): Promise<CheckResult> {
  const startTime = Date.now();
  try {
    let headers: Record<string, string> = {
      'User-Agent': monitor.user_agent || 'MonitorFlare/1.0',
    };
    if (monitor.request_headers) {
      try {
        headers = { ...headers, ...JSON.parse(monitor.request_headers) as Record<string, string> };
      } catch { /* ignore */ }
    }
    const fetchOptions: RequestInit = {
      method: monitor.method || 'GET',
      headers,
      cf: { cacheTtl: 0, cacheEverything: false } as RequestInitCfProperties,
    };
    if (['POST', 'PUT', 'PATCH'].includes(monitor.method || 'GET') && monitor.request_body) {
      fetchOptions.body = monitor.request_body;
      if (!headers['Content-Type']) {
        (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/json';
      }
    }
    const response = await fetch(monitor.url, fetchOptions);
    const latency = Date.now() - startTime;
    if (!response.ok) {
      return { ok: false, statusCode: response.status, latency, reason: `HTTP ${response.status}` };
    }
    if (monitor.keyword) {
      const text = await response.text();
      if (!text.includes(monitor.keyword)) {
        return { ok: false, statusCode: response.status, latency, reason: `Keyword "${monitor.keyword}" not found` };
      }
    }
    return { ok: true, statusCode: response.status, latency, reason: '' };
  } catch (e: unknown) {
    const latency = Date.now() - startTime;
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    let reason = errorMsg;
    if (errorMsg.includes('handshake') || errorMsg.includes('certificate') || errorMsg.includes('SSL') || errorMsg.includes('TLS')) {
      reason = `SSL Error: ${errorMsg}`;
    } else if (errorMsg.includes('time') || errorMsg.includes('timeout')) {
      reason = 'Timeout';
    } else if (errorMsg.includes('fetch failed') || errorMsg.includes('getaddrinfo')) {
      reason = 'DNS resolution failed';
    }
    return { ok: false, statusCode: 0, latency, reason };
  }
}

// ---------- DNS 监测(DoH) ----------
interface DnsConfig {
  record_type?: string;  // A / AAAA / CNAME / MX / TXT / NS
  expected?: string;     // 期望值,逗号分隔;留空 = 仅检查记录存在
  resolver?: 'cloudflare' | 'google';
}

interface DohAnswer {
  name?: string;
  type?: number;
  data?: string;
}

function parseDnsConfig(monitor: Monitor): DnsConfig {
  try { return (monitor.config ? JSON.parse(monitor.config) : {}) as DnsConfig; } catch { return {}; }
}

function extractRecordValue(ans: DohAnswer): string {
  return (ans.data || '').replace(/\.$/, '').toLowerCase();
}

async function checkDNS(monitor: Monitor): Promise<CheckResult> {
  const startTime = Date.now();
  try {
    const cfg = parseDnsConfig(monitor);
    const recordType = (cfg.record_type || 'A').toUpperCase();
    let hostname: string;
    try {
      hostname = new URL(monitor.url).hostname;
    } catch {
      hostname = monitor.url.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
    }
    const resolver = cfg.resolver === 'google'
      ? 'https://dns.google/resolve'
      : 'https://cloudflare-dns.com/dns-query';
    const url = `${resolver}?name=${encodeURIComponent(hostname)}&type=${recordType}`;
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/dns-json' },
      cf: { cacheTtl: 0, cacheEverything: false } as RequestInitCfProperties,
    });
    const latency = Date.now() - startTime;
    if (!resp.ok) {
      return { ok: false, statusCode: resp.status, latency, reason: `DoH ${resp.status}` };
    }
    const data = await resp.json<{ Status?: number; Answer?: DohAnswer[]; Comment?: string }>();
    if (data.Status !== 0) {
      return { ok: false, statusCode: 0, latency, reason: `DNS status ${data.Status} (${data.Comment || 'NXDOMAIN or error'})` };
    }
    const answers = (data.Answer || []).filter(a => (a.type || 0) > 0);
    if (answers.length === 0) {
      return { ok: false, statusCode: 0, latency, reason: `No ${recordType} record found` };
    }
    const values = answers.map(extractRecordValue);
    if (cfg.expected) {
      const expectedList = cfg.expected.split(',').map(s => s.trim().toLowerCase().replace(/\.$/, '')).filter(Boolean);
      const matched = values.some(v => expectedList.includes(v));
      if (!matched) {
        return { ok: false, statusCode: 0, latency, reason: `Expected [${expectedList.join(', ')}] got [${values.join(', ')}]` };
      }
    }
    return { ok: true, statusCode: 0, latency, reason: '', detail: `${recordType}: ${values.join(', ')}` };
  } catch (e: unknown) {
    const latency = Date.now() - startTime;
    return { ok: false, statusCode: 0, latency, reason: e instanceof Error ? e.message : 'DNS check error' };
  }
}

// ---------- 端口监测(TCP connect) ----------
interface PortConfig {
  port?: number;
  timeout?: number;       // 毫秒,默认 5000
}

type SocketLike = {
  opened?: Promise<void>;
  closed?: Promise<void>;
  readable?: ReadableStream;
  close: () => void;
};

async function checkPort(monitor: Monitor): Promise<CheckResult> {
  const startTime = Date.now();
  try {
    const cfg = (() => { try { return (monitor.config ? JSON.parse(monitor.config) : {}) as PortConfig; } catch { return {}; } })();
    let hostname: string;
    try {
      hostname = new URL(monitor.url).hostname;
    } catch {
      hostname = monitor.url.replace(/^https?:\/\//, '').split('/')[0];
    }
    const port = Number(cfg.port) || 443;
    const timeoutMs = Number(cfg.timeout) || 5000;

    // Workers TCP Socket API(cloudflare:sockets)
    const mod = await import('cloudflare:sockets');
    const connect = mod.connect as unknown as (opts: { hostname: string; port: number }) => SocketLike;
    const result = await new Promise<{ ok: boolean; err?: string }>((resolve) => {
      let socket: SocketLike | null = null;
      const timer = setTimeout(() => {
        try { socket?.close(); } catch { /* ignore */ }
        resolve({ ok: false, err: 'Timeout' });
      }, timeoutMs);
      let settled = false;
      const done = (r: { ok: boolean; err?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(r);
      };
      try {
        socket = connect({ hostname, port });
        socket.opened?.then(() => done({ ok: true })).catch((err: unknown) => done({ ok: false, err: err instanceof Error ? err.message : 'connect error' }));
        socket.closed?.catch((err: unknown) => {
          if (!settled) done({ ok: false, err: err instanceof Error ? err.message : 'closed' });
        });
        socket.readable?.getReader().read().then(() => done({ ok: true })).catch((err: unknown) => {
          if (!settled) done({ ok: false, err: err instanceof Error ? err.message : 'read error' });
        });
      } catch (err) {
        done({ ok: false, err: err instanceof Error ? err.message : 'connect failed' });
      }
    });
    const latency = Date.now() - startTime;
    if (result.ok) {
      return { ok: true, statusCode: 0, latency, reason: '', detail: `Port ${port} open` };
    }
    return { ok: false, statusCode: 0, latency, reason: `Port ${port} unreachable: ${result.err || 'refused'}` };
  } catch (e: unknown) {
    const latency = Date.now() - startTime;
    return { ok: false, statusCode: 0, latency, reason: e instanceof Error ? e.message : 'Port check error' };
  }
}

// ---------- 统一分发 ----------
export async function performCheck(monitor: Monitor, _env: Bindings): Promise<CheckResult> {
  switch (monitor.type) {
    case 'dns':  return await checkDNS(monitor);
    case 'port': return await checkPort(monitor);
    case 'http':
    default:     return await checkHTTP(monitor);
  }
}

// ---------- 域名 / 证书信息更新(Cert Spotter / crt.sh + RDAP) ----------
export type MetadataRefreshStatus = 'OK' | 'PARTIAL' | 'ERROR';

export interface MetadataRefreshResult {
  status: MetadataRefreshStatus;
  certUpdated: boolean;
  domainUpdated: boolean;
  registrableDomain: string | null;
  errors: string[];
}

type CtCertificate = {
  common_name?: string;
  name_value?: string;
  not_before?: string;
  not_after?: string;
};

type CertSpotterIssuance = {
  dns_names?: string[];
  not_before?: string;
  not_after?: string;
  revoked?: boolean;
};

const METADATA_FETCH_TIMEOUT_MS = 12_000;
const METADATA_USER_AGENT = 'MonitorFlare/1.0 (+https://github.com/xusteve/MonitorFlare)';

function parseCtDate(value?: string): number {
  if (!value) return Number.NaN;
  return new Date(value.replace(' ', 'T')).getTime();
}

function certificateNames(cert: CtCertificate): string[] {
  return [cert.common_name || '', ...(cert.name_value || '').split('\n')]
    .map(name => name.trim().toLowerCase().replace(/\.$/, ''))
    .filter(Boolean);
}

function certificateCoversHostname(cert: CtCertificate, hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return certificateNames(cert).some(name => {
    if (name === host) return true;
    if (!name.startsWith('*.')) return false;
    const suffix = name.slice(2);
    return host.endsWith(`.${suffix}`) && host.split('.').length === suffix.split('.').length + 1;
  });
}

export function selectCertificateExpiry(certs: CtCertificate[], hostname: string, nowMs = Date.now()): string | null {
  const candidates = certs
    .filter(cert => certificateCoversHostname(cert, hostname))
    .map(cert => ({ cert, issuedAt: parseCtDate(cert.not_before), expiresAt: parseCtDate(cert.not_after) }))
    .filter(item => Number.isFinite(item.issuedAt) && item.issuedAt <= nowMs && Number.isFinite(item.expiresAt) && item.expiresAt > nowMs)
    .sort((a, b) => b.issuedAt - a.issuedAt || b.expiresAt - a.expiresAt);
  return candidates.length > 0 ? new Date(candidates[0].expiresAt).toISOString() : null;
}

export function rdapDomainCandidates(hostname: string): string[] {
  const labels = hostname.toLowerCase().replace(/\.$/, '').split('.').filter(Boolean);
  const candidates: string[] = [];
  for (let i = 0; i <= labels.length - 2; i += 1) candidates.push(labels.slice(i).join('.'));
  return candidates;
}

async function fetchCertificates(searchDomain: string): Promise<CtCertificate[]> {
  const res = await fetch(`https://crt.sh/?q=${encodeURIComponent(searchDomain)}&output=json`, {
    headers: { 'Accept': 'application/json', 'User-Agent': METADATA_USER_AGENT },
    signal: AbortSignal.timeout(METADATA_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`crt.sh returned HTTP ${res.status}`);
  const data = await res.json<unknown>();
  if (!Array.isArray(data)) throw new Error('crt.sh returned an invalid response');
  return data as CtCertificate[];
}

async function fetchCertSpotterCertificates(hostname: string): Promise<CtCertificate[]> {
  const params = new URLSearchParams({
    domain: hostname,
    include_subdomains: 'false',
    expand: 'dns_names',
  });
  const res = await fetch(`https://api.certspotter.com/v1/issuances?${params.toString()}`, {
    headers: { 'Accept': 'application/json', 'User-Agent': METADATA_USER_AGENT },
    signal: AbortSignal.timeout(METADATA_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Cert Spotter returned HTTP ${res.status}`);
  const data = await res.json<unknown>();
  if (!Array.isArray(data)) throw new Error('Cert Spotter returned an invalid response');
  return (data as CertSpotterIssuance[])
    .filter(item => item.revoked !== true)
    .map(item => ({
      name_value: (item.dns_names || []).join('\n'),
      not_before: item.not_before,
      not_after: item.not_after,
    }));
}

async function fetchDomainExpiry(hostname: string): Promise<{ expiry: string; domain: string }> {
  for (const candidate of rdapDomainCandidates(hostname)) {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(candidate)}`, {
      headers: {
        'Accept': 'application/rdap+json, application/json',
        'User-Agent': METADATA_USER_AGENT,
      },
      signal: AbortSignal.timeout(METADATA_FETCH_TIMEOUT_MS),
    });
    if (res.status === 404 || res.status === 400) continue;
    if (!res.ok) throw new Error(`RDAP returned HTTP ${res.status}`);
    const data = await res.json<{ events?: { eventAction?: string; eventDate?: string }[] }>();
    const event = (data.events || []).find(item => item.eventAction?.toLowerCase().includes('expiration'));
    if (event?.eventDate) return { expiry: event.eventDate, domain: candidate };
  }
  throw new Error(`RDAP expiry not found for ${hostname}`);
}

export async function updateDomainCertInfo(env: Bindings, monitor: Monitor): Promise<MetadataRefreshResult> {
  const errors: string[] = [];
  let certExpiry: string | null = null;
  let domainExpiry: string | null = null;
  let registrableDomain: string | null = null;
  let certUpdated = monitor.check_ssl !== 1;
  let domainUpdated = monitor.check_domain !== 1;

  let hostname: string;
  try {
    hostname = new URL(monitor.url).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return { status: 'ERROR', certUpdated: false, domainUpdated: false, registrableDomain: null, errors: ['Invalid monitor URL'] };
  }

  if (!hostname || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')) {
    return { status: 'ERROR', certUpdated: false, domainUpdated: false, registrableDomain: null, errors: ['Metadata checks require a domain name'] };
  }

  let rdapResult: { expiry: string; domain: string } | null = null;
  if (monitor.check_ssl === 1 || monitor.check_domain === 1) {
    try {
      rdapResult = await fetchDomainExpiry(hostname);
      registrableDomain = rdapResult.domain;
    } catch (error) {
      if (monitor.check_domain === 1) errors.push(error instanceof Error ? error.message : 'Domain lookup failed');
    }
  }

  if (monitor.check_domain === 1) {
    if (rdapResult) {
      domainExpiry = rdapResult.expiry;
      domainUpdated = true;
    }
  }

  if (monitor.check_ssl === 1) {
    try {
      let certSpotterError: string | null = null;
      try {
        const certSpotterCerts = await fetchCertSpotterCertificates(hostname);
        certExpiry = selectCertificateExpiry(certSpotterCerts, hostname);
      } catch (error) {
        certSpotterError = error instanceof Error ? error.message : 'Cert Spotter lookup failed';
      }

      // Cert Spotter usually contains the newest issuance first. Fall back to
      // crt.sh when its public API is unavailable or has not indexed the host.
      if (!certExpiry) {
        const queries = new Set<string>([hostname]);
        if (registrableDomain) {
          queries.add(registrableDomain);
          queries.add(`%.${registrableDomain}`);
        } else {
          for (const candidate of rdapDomainCandidates(hostname).slice(1)) queries.add(candidate);
        }
        const outcomes = await Promise.allSettled([...queries].map(query => fetchCertificates(query)));
        const certs = outcomes.flatMap(outcome => outcome.status === 'fulfilled' ? outcome.value : []);
        if (certs.length === 0 && outcomes.every(outcome => outcome.status === 'rejected')) {
          throw new Error(certSpotterError || 'Certificate transparency services are unavailable');
        }
        certExpiry = selectCertificateExpiry(certs, hostname);
      }
      if (!certExpiry) throw new Error(`No current matching certificate found for ${hostname}`);
      certUpdated = true;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Certificate lookup failed');
    }
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  if (certExpiry) {
    updates.push('cert_expiry = ?');
    values.push(certExpiry);
  }
  if (domainExpiry) {
    updates.push('domain_expiry = ?');
    values.push(domainExpiry);
  }
  if (updates.length > 0) {
    await env.DB.prepare(`UPDATE monitors SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values, monitor.id).run();
  }

  const successful = Number(certUpdated) + Number(domainUpdated);
  const requested = Number(monitor.check_ssl === 1) + Number(monitor.check_domain === 1);
  const status: MetadataRefreshStatus = successful === requested ? 'OK' : successful > 0 ? 'PARTIAL' : 'ERROR';
  return { status, certUpdated, domainUpdated, registrableDomain, errors };
}
