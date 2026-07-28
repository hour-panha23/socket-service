// cec-reporter.service.ts
import { Injectable, Logger } from '@nestjs/common';

export interface CecEventPayload {
  event_type:
    'LOGIN' | 'SECURITY' | 'ERROR' | 'WARNING' | 'PERFORMANCE' | 'BUSINESS';
  title: string;
  level?: 'info' | 'warning' | 'error' | 'critical';
  system: string;
  application: string;
  environment: string;
  user?: { id: string | number; email?: string };
  context?: Record<string, any>;
}

@Injectable()
export class CecReporterService {
  private readonly logger = new Logger(CecReporterService.name);
  private readonly cecUrl =
    process.env.CEC_API_URL || 'https://cec.vectoraclouds.com/api/v1/events';

  /**
   * Fire-and-forget payload dispatch to CEC API.
   * Fails silently to prevent disrupting socket runtime.
   */
  async captureEvent(payload: CecEventPayload): Promise<void> {
    const fullPayload = {
      event_id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      hostname: process.env.HOSTNAME || 'socket-server',
      app_version: process.env.APP_VERSION || '1.0.0',
      ...payload,
    };

    // Asynchronous fetch without awaiting inside business loop
    fetch(this.cecUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullPayload),
    }).catch((err) => {
      // Local fallback logging
      this.logger.error(`[CEC Fallback] Failed to log event: ${err.message}`);
    });
  }
}
