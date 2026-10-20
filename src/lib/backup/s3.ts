import { createHash, createHmac } from "node:crypto";

/**
 * Минимальный клиент S3-совместимого хранилища (Timeweb Cloud S3, Yandex Object Storage, Selectel и др.)
 * для резервных копий: PUT, GET, LIST, DELETE с подписью AWS Signature Version 4, path-style адреса.
 * Секретный ключ участвует только в вычислении подписи и никуда не выводится.
 */

export type S3Config = { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string };

const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data).digest();

function encodePath(path: string): string {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
    .join("/");
}

/** Подпись запроса (AWS SigV4). Возвращает заголовки, включая Authorization. */
export function signRequest(input: {
  method: string;
  url: URL;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  payloadHash: string;
  headers?: Record<string, string>;
  date?: Date;
}): Record<string, string> {
  const date = input.date ?? new Date();
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const headers: Record<string, string> = {
    ...Object.fromEntries(Object.entries(input.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v.trim()])),
    host: input.url.host,
    "x-amz-content-sha256": input.payloadHash,
    "x-amz-date": amzDate,
  };
  const names = Object.keys(headers).sort();
  const query = [...input.url.searchParams.entries()]
    .map(([k, v]) => [encodeURIComponent(k), encodeURIComponent(v)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const canonical = [
    input.method,
    encodePath(decodeURIComponent(input.url.pathname)),
    query,
    names.map((n) => `${n}:${headers[n]}\n`).join(""),
    names.join(";"),
    input.payloadHash,
  ].join("\n");
  const scope = `${day}/${input.region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, day), input.region), "s3"), "aws4_request");
  const signature = createHmac("sha256", key).update(toSign).digest("hex");
  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`,
  };
}

function objectUrl(config: S3Config, key: string, query?: Record<string, string>): URL {
  const url = new URL(`${config.endpoint.replace(/\/+$/, "")}/${config.bucket}/${key}`);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  return url;
}

async function send(config: S3Config, method: string, url: URL, body?: Buffer, extra?: Record<string, string>): Promise<Response> {
  const payloadHash = sha256(body ?? "");
  const headers = signRequest({ method, url, region: config.region, accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, payloadHash, headers: extra });
  delete headers.host;
  const response = await fetch(url, { method, headers, body: body ? new Uint8Array(body) : undefined, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) {
    const text = (await response.text().catch(() => "")).slice(0, 300);
    const code = /<Code>([^<]+)<\/Code>/.exec(text)?.[1];
    throw new Error(`Хранилище S3 ответило ${response.status}${code ? ` (${code})` : ""}.`);
  }
  return response;
}

export async function s3Put(config: S3Config, key: string, body: Buffer): Promise<void> {
  await send(config, "PUT", objectUrl(config, key), body, { "content-type": "application/octet-stream" });
}

export async function s3Get(config: S3Config, key: string): Promise<Buffer> {
  const response = await send(config, "GET", objectUrl(config, key));
  return Buffer.from(await response.arrayBuffer());
}

export async function s3Delete(config: S3Config, key: string): Promise<void> {
  await send(config, "DELETE", objectUrl(config, key));
}

/** Список ключей с префиксом (до 1000 — для резервных копий достаточно). */
export async function s3List(config: S3Config, prefix: string): Promise<{ key: string; size: number; lastModified: string }[]> {
  const url = new URL(`${config.endpoint.replace(/\/+$/, "")}/${config.bucket}`);
  url.searchParams.set("list-type", "2");
  url.searchParams.set("prefix", prefix);
  const xml = await (await send(config, "GET", url)).text();
  return [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map((m) => ({
    key: /<Key>([^<]*)<\/Key>/.exec(m[1]!)?.[1] ?? "",
    size: Number(/<Size>(\d+)<\/Size>/.exec(m[1]!)?.[1] ?? 0),
    lastModified: /<LastModified>([^<]*)<\/LastModified>/.exec(m[1]!)?.[1] ?? "",
  }));
}
