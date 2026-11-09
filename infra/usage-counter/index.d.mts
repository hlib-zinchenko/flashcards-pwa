// Types for the tests, which import toCount and referrer from index.mjs.
export const ORIGINS: string[];
export const PLATFORMS: string[];
export const FORMS: string[];
export const LANGS: string[];
export const AGES: string[];
export const CARDS: string[];
export const STUDIED: string[];
export const PAGES: string[];
export const KEEP_DAYS: number;
export function referrer(value: unknown): string;
export function toCount(body: unknown, now?: Date): { pk: string; sk: string; fields: Record<string, string> } | null;
export function handler(event: unknown): Promise<{ statusCode: number; headers: Record<string, string> }>;
