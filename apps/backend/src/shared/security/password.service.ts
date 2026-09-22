import { Injectable } from '@nestjs/common';
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const keyLength = 64;

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('base64url');
    const derivedKey = (await scrypt(password, salt, keyLength)) as Buffer;

    return `scrypt$${salt}$${Buffer.from(derivedKey).toString('base64url')}`;
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const [algorithm, salt, encodedKey] = storedHash.split('$');

    if (algorithm !== 'scrypt' || !salt || !encodedKey) {
      return false;
    }

    const expectedKey = Buffer.from(encodedKey, 'base64url');
    const derivedKey = Buffer.from(
      (await scrypt(password, salt, expectedKey.length)) as Buffer,
    );

    return (
      expectedKey.length === derivedKey.length &&
      timingSafeEqual(expectedKey, derivedKey)
    );
  }

  isStrong(password: string): boolean {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password)
    );
  }
}
