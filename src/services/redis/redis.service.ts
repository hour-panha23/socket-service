import { Injectable } from '@nestjs/common';
import { Redis } from '@upstash/redis';

@Injectable()
export class RedisService {
  private readonly client: Redis;

  constructor() {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        'UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing in environment variables',
      );
    }

    this.client = new Redis({
      url,
      token,
    });
  }

  /** Exposes raw Upstash Redis client for direct command access */
  getClient(): Redis {
    return this.client;
  }

  /** Generic typed getter */
  async get<T>(key: string): Promise<T | null> {
    return await this.client.get<T>(key);
  }

  /**
   * Set key in Redis.
   * Passing ttlSeconds = 0 or undefined stores the key with NO expiration (infinite TTL).
   */
  async set(
    key: string,
    value: any,
    ttlSeconds?: number,
  ): Promise<'OK' | null> {
    if (ttlSeconds && ttlSeconds > 0) {
      return await this.client.set(key, value, { ex: ttlSeconds });
    }
    return await this.client.set(key, value);
  }

  /** Deletes a key from Redis */
  async del(key: string): Promise<number> {
    return await this.client.del(key);
  }
}
