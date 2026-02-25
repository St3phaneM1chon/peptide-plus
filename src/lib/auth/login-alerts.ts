/**
 * Admin Access Alerts
 * Notify on login from new IP/device/country
 */

export interface LoginEvent {
  userId: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  country?: string;
  isNewIp: boolean;
  isNewDevice: boolean;
}

export interface LoginAlert {
  type: 'NEW_IP' | 'NEW_DEVICE' | 'NEW_COUNTRY' | 'SUSPICIOUS_TIME' | 'MULTIPLE_FAILURES';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  titleFr: string;
  description: string;
  userId: string;
  email: string;
  metadata: Record<string, string>;
}

export function analyzeLogin(event: LoginEvent, knownIPs: Set<string>, knownDevices: Set<string>): LoginAlert[] {
  const alerts: LoginAlert[] = [];

  if (event.isNewIp || !knownIPs.has(event.ipAddress)) {
    alerts.push({
      type: 'NEW_IP',
      severity: 'MEDIUM',
      title: 'New IP Address Login',
      titleFr: 'Connexion depuis une nouvelle IP',
      description: `Admin login from IP ${event.ipAddress}`,
      userId: event.userId,
      email: event.email,
      metadata: { ip: event.ipAddress },
    });
  }

  const deviceFingerprint = event.userAgent.substring(0, 100);
  if (event.isNewDevice || !knownDevices.has(deviceFingerprint)) {
    alerts.push({
      type: 'NEW_DEVICE',
      severity: 'MEDIUM',
      title: 'New Device Login',
      titleFr: 'Connexion depuis un nouvel appareil',
      description: `Admin login from new device: ${deviceFingerprint}`,
      userId: event.userId,
      email: event.email,
      metadata: { device: deviceFingerprint },
    });
  }

  // Suspicious time (2AM-5AM)
  const hour = event.timestamp.getHours();
  if (hour >= 2 && hour <= 5) {
    alerts.push({
      type: 'SUSPICIOUS_TIME',
      severity: 'LOW',
      title: 'Off-Hours Login',
      titleFr: 'Connexion en dehors des heures',
      description: `Admin login at ${hour}:00`,
      userId: event.userId,
      email: event.email,
      metadata: { hour: String(hour) },
    });
  }

  return alerts;
}

export function shouldSendEmailAlert(alert: LoginAlert): boolean {
  return alert.severity === 'HIGH' || alert.severity === 'MEDIUM';
}
