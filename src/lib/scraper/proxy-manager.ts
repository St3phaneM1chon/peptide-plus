/**
 * Proxy Manager — Rotating proxy pool for anti-detection scraping.
 *
 * Supports SOCKS5 and HTTP proxies. Round-robin rotation with health checking.
 * Falls back to direct connection if all proxies are down.
 */

import { logger } from '@/lib/logger';

export interface ProxyConfig {
  url: string;         // socks5://host:port or http://host:port
  protocol: 'socks5' | 'http' | 'https';
  host: string;
  port: number;
  auth?: { username: string; password: string };
  healthy: boolean;
  lastChecked: number;
  failCount: number;
}

const MAX_FAIL_COUNT = 3;

class ProxyManager {
  private proxies: ProxyConfig[] = [];
  private currentIndex = 0;

  constructor() {
    this.loadFromEnv();
  }

  /** Load proxies from SCRAPER_PROXY_LIST env var */
  private loadFromEnv(): void {
    const proxyList = process.env.SCRAPER_PROXY_LIST;
    if (!proxyList) return;

    const urls = proxyList.split(',').map(u => u.trim()).filter(Boolean);
    for (const url of urls) {
      try {
        const parsed = this.parseProxyUrl(url);
        if (parsed) this.proxies.push(parsed);
      } catch (err) {
        logger.warn('Invalid proxy URL', { url, error: String(err) });
      }
    }

    logger.info(`ProxyManager: loaded ${this.proxies.length} proxies`);
  }

  /** Parse a proxy URL into config */
  private parseProxyUrl(url: string): ProxyConfig | null {
    const match = url.match(/^(socks5|https?):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)$/);
    if (!match) return null;

    return {
      url,
      protocol: match[1] as ProxyConfig['protocol'],
      host: match[4],
      port: parseInt(match[5], 10),
      auth: match[2] ? { username: match[2], password: match[3] } : undefined,
      healthy: true,
      lastChecked: 0,
      failCount: 0,
    };
  }

  /** Get the next healthy proxy (round-robin) or null for direct connection */
  getNext(): ProxyConfig | null {
    if (this.proxies.length === 0) return null;

    const healthy = this.proxies.filter(p => p.healthy);
    if (healthy.length === 0) {
      // Reset all proxies if all are down
      logger.warn('ProxyManager: all proxies down, resetting');
      for (const p of this.proxies) {
        p.healthy = true;
        p.failCount = 0;
      }
      return this.proxies[0] || null;
    }

    const proxy = healthy[this.currentIndex % healthy.length];
    this.currentIndex = (this.currentIndex + 1) % healthy.length;
    return proxy;
  }

  /** Get Playwright proxy config for the next proxy */
  getPlaywrightProxy(): { server: string; username?: string; password?: string } | undefined {
    const proxy = this.getNext();
    if (!proxy) return undefined;

    return {
      server: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
      username: proxy.auth?.username,
      password: proxy.auth?.password,
    };
  }

  /** Mark a proxy as failed */
  markFailed(proxyUrl: string): void {
    const proxy = this.proxies.find(p => p.url === proxyUrl);
    if (!proxy) return;

    proxy.failCount++;
    if (proxy.failCount >= MAX_FAIL_COUNT) {
      proxy.healthy = false;
      logger.warn('ProxyManager: proxy marked unhealthy', { url: proxyUrl, failCount: proxy.failCount });
    }
  }

  /** Mark a proxy as successful (reset fail count) */
  markSuccess(proxyUrl: string): void {
    const proxy = this.proxies.find(p => p.url === proxyUrl);
    if (!proxy) return;

    proxy.failCount = 0;
    proxy.healthy = true;
  }

  /** Check if proxies are configured */
  hasProxies(): boolean {
    return this.proxies.length > 0;
  }

  /** Get number of healthy proxies */
  healthyCount(): number {
    return this.proxies.filter(p => p.healthy).length;
  }

  /** Get status summary */
  getStatus(): { total: number; healthy: number; proxies: Array<{ url: string; healthy: boolean; failCount: number }> } {
    return {
      total: this.proxies.length,
      healthy: this.healthyCount(),
      proxies: this.proxies.map(p => ({
        url: p.url.replace(/:[^:]+@/, ':***@'), // Mask password
        healthy: p.healthy,
        failCount: p.failCount,
      })),
    };
  }
}

// Singleton
let _instance: ProxyManager | null = null;

export function getProxyManager(): ProxyManager {
  if (!_instance) {
    _instance = new ProxyManager();
  }
  return _instance;
}
