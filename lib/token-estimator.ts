import { encode } from "gpt-tokenizer";

export function estimateTokens(value: unknown): number {
  const text = stringifyForTokenEstimate(value);
  if (!text) {
    return 0;
  }

  try {
    return encode(text).length;
  } catch {
    return Math.max(1, Math.ceil(text.length / 4));
  }
}

export function byteSize(value: unknown): number {
  return Buffer.byteLength(stringifyForTokenEstimate(value), "utf8");
}

export function stringifyForTokenEstimate(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
