import "server-only";

import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";

const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 128 * 1024;
const REQUEST_TIMEOUT_MS = 4_000;

const blockedAddresses = new BlockList();
[
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4]
].forEach(([address, prefix]) => blockedAddresses.addSubnet(address as string, prefix as number, "ipv4"));
[
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
  ["5f00::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8]
].forEach(([address, prefix]) => blockedAddresses.addSubnet(address as string, prefix as number, "ipv6"));

type ResolvedAddress = { address: string; family: 4 | 6 };

export async function resolveLinkTitle(rawUrl: string): Promise<string | null> {
  let currentUrl = validateUrl(rawUrl);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const address = await resolvePublicAddress(currentUrl.hostname);
    const response = await requestPage(currentUrl, address);

    if (response.statusCode >= 300 && response.statusCode < 400 && response.location) {
      if (redirects === MAX_REDIRECTS) throw new Error("TOO_MANY_REDIRECTS");
      currentUrl = validateUrl(new URL(response.location, currentUrl).toString());
      continue;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) return null;
    if (!/^(text\/html|application\/xhtml\+xml)\b/i.test(response.contentType)) return null;
    return extractTitle(response.body);
  }

  return null;
}

function validateUrl(rawUrl: string) {
  if (rawUrl.length > 2048) throw new Error("URL_TOO_LONG");
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("UNSUPPORTED_PROTOCOL");
  if (url.username || url.password) throw new Error("URL_CREDENTIALS_NOT_ALLOWED");
  if (!url.hostname) throw new Error("HOST_REQUIRED");

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".home") ||
    hostname.endsWith(".lan") ||
    hostname.endsWith(".test")
  ) {
    throw new Error("PRIVATE_HOST_NOT_ALLOWED");
  }
  return url;
}

async function resolvePublicAddress(hostnameWithBrackets: string): Promise<ResolvedAddress> {
  const hostname = hostnameWithBrackets.replace(/^\[|\]$/g, "");
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily as 4 | 6 }]
    : await lookup(hostname, { all: true, verbatim: true }) as ResolvedAddress[];

  if (addresses.length === 0 || addresses.some(({ address, family }) => !isPublicAddress(address, family))) {
    throw new Error("PRIVATE_ADDRESS_NOT_ALLOWED");
  }
  return addresses[0];
}

function isPublicAddress(address: string, family: 4 | 6) {
  return !blockedAddresses.check(address, family === 4 ? "ipv4" : "ipv6");
}

function requestPage(url: URL, resolved: ResolvedAddress) {
  return new Promise<{
    statusCode: number;
    location: string | undefined;
    contentType: string;
    body: string;
  }>((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const canonicalHostname = url.hostname.replace(/^\[|\]$/g, "");
    const request = transport.request({
      protocol: url.protocol,
      hostname: resolved.address,
      family: resolved.family,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      servername: url.protocol === "https:" && !isIP(canonicalHostname) ? canonicalHostname : undefined,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Encoding": "identity",
        Host: url.host,
        "User-Agent": "PlabinTask-LinkPreview/1.0"
      }
    }, (response) => {
      const statusCode = response.statusCode ?? 0;
      const location = Array.isArray(response.headers.location)
        ? response.headers.location[0]
        : response.headers.location;
      const contentType = Array.isArray(response.headers["content-type"])
        ? response.headers["content-type"][0] ?? ""
        : response.headers["content-type"] ?? "";

      if (statusCode >= 300 && statusCode < 400) {
        response.resume();
        resolve({ statusCode, location, contentType, body: "" });
        return;
      }

      const chunks: Buffer[] = [];
      let bodyBytes = 0;
      response.on("data", (chunk: Buffer) => {
        bodyBytes += chunk.length;
        if (bodyBytes > MAX_BODY_BYTES) {
          request.destroy(new Error("RESPONSE_TOO_LARGE"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        resolve({
          statusCode,
          location,
          contentType,
          body: Buffer.concat(chunks).toString("utf8")
        });
      });
    });

    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error("REQUEST_TIMEOUT")));
    request.on("error", reject);
    request.end();
  });
}

function extractTitle(html: string) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    const property = readAttribute(tag, "property") || readAttribute(tag, "name");
    if (property?.toLowerCase() !== "og:title") continue;
    const content = readAttribute(tag, "content");
    const title = cleanTitle(content ?? "");
    if (title) return title;
  }

  const pageTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  return cleanTitle(pageTitle) || null;
}

function readAttribute(tag: string, attribute: string) {
  const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`\\b${escapedAttribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

function cleanTitle(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"'
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] !== "#") return named[code.toLowerCase()] ?? entity;
    const number = code[1]?.toLowerCase() === "x"
      ? Number.parseInt(code.slice(2), 16)
      : Number.parseInt(code.slice(1), 10);
    return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
  });
}
