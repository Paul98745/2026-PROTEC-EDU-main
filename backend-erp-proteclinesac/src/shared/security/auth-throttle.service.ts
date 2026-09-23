import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type WindowState = { count: number; resetsAt: number };

@Injectable()
export class AuthThrottleService {
  private readonly windows = new Map<string, WindowState>();

  check(action: 'login' | 'password-reset', ip: string | undefined) {
    const now = Date.now();
    const limit = action === 'login' ? 10 : 5;
    const windowMs = 15 * 60 * 1000;
    const key = `${action}:${ip ?? 'unknown'}`;
    const current = this.windows.get(key);
    const state =
      !current || current.resetsAt <= now
        ? { count: 0, resetsAt: now + windowMs }
        : current;
    state.count += 1;
    this.windows.set(key, state);
    if (state.count > limit) {
      throw new HttpException(
        'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
