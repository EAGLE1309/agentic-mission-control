// SSRF guard rules (tech spec §7.5). Pure functions: the Node action applies
// them before the request and again at each connect, and after each redirect.

function parseIPv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const numbers = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN));
  return numbers.every((value) => Number.isInteger(value) && value >= 0 && value <= 255) ? numbers : null;
}

function inV4Range(ip: number[], base: number[], bits: number): boolean {
  const value = ((ip[0] << 24) | (ip[1] << 16) | (ip[2] << 8) | ip[3]) >>> 0;
  const start = ((base[0] << 24) | (base[1] << 16) | (base[2] << 8) | base[3]) >>> 0;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (start & mask);
}

const BLOCKED_V4: [number[], number][] = [
  [[0, 0, 0, 0], 8], // "this" network
  [[10, 0, 0, 0], 8], // private
  [[100, 64, 0, 0], 10], // carrier-grade NAT
  [[127, 0, 0, 0], 8], // loopback
  [[169, 254, 0, 0], 16], // link-local and cloud metadata (169.254.169.254)
  [[172, 16, 0, 0], 12], // private
  [[192, 0, 0, 0], 24], // IETF protocol assignments
  [[192, 0, 2, 0], 24], // documentation
  [[192, 168, 0, 0], 16], // private
  [[198, 18, 0, 0], 15], // benchmarking
  [[198, 51, 100, 0], 24], // documentation
  [[203, 0, 113, 0], 24], // documentation
  [[224, 0, 0, 0], 4], // multicast
  [[240, 0, 0, 0], 4], // reserved and broadcast
];

function isBlockedV4(ip: number[]): boolean {
  return BLOCKED_V4.some(([base, bits]) => inV4Range(ip, base, bits));
}

/** Expand an IPv6 address to 8 groups, or null. Handles "::" and an IPv4 tail. */
function parseIPv6(address: string): number[] | null {
  let text = address.toLowerCase().replace(/^\[|\]$/g, "");
  const zone = text.indexOf("%");
  if (zone !== -1) text = text.slice(0, zone);
  let tail: number[] = [];
  const lastColon = text.lastIndexOf(":");
  if (lastColon === -1) return null;
  if (text.slice(lastColon + 1).includes(".")) {
    const v4 = parseIPv4(text.slice(lastColon + 1));
    if (!v4) return null;
    tail = [(v4[0] << 8) | v4[1], (v4[2] << 8) | v4[3]];
    text = text.slice(0, lastColon);
    // "::1.2.3.4" leaves ":" here: the removed colon was part of "::".
    if (text.endsWith(":")) text = `${text}:`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const read = (part: string) => (part ? part.split(":").map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : Number.NaN)) : []);
  const head = read(halves[0]);
  const rest = halves.length === 2 ? read(halves[1]) : [];
  const fill = 8 - head.length - rest.length - tail.length;
  if (halves.length === 1 && fill !== 0) return null;
  if (fill < 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? fill : 0).fill(0), ...rest, ...tail];
  return groups.length === 8 && groups.every((group) => Number.isInteger(group)) ? groups : null;
}

function isBlockedV6(groups: number[]): boolean {
  const allZeroBefore = (index: number) => groups.slice(0, index).every((group) => group === 0);
  if (groups.every((group) => group === 0)) return true; // ::
  if (allZeroBefore(7) && groups[7] === 1) return true; // ::1
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d): check the IPv4 part.
  if (allZeroBefore(5) && (groups[5] === 0xffff || groups[5] === 0)) {
    return isBlockedV4([groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff]);
  }
  // NAT64 (64:ff9b::/96) embeds an IPv4 address too.
  if (groups[0] === 0x64 && groups[1] === 0xff9b && groups.slice(2, 6).every((group) => group === 0)) {
    return isBlockedV4([groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff]);
  }
  if ((groups[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((groups[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((groups[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true; // documentation
  return false;
}

/** True when a resolved address is private, loopback, link-local, metadata, or reserved. */
export function isBlockedAddress(address: string): boolean {
  const v4 = parseIPv4(address);
  if (v4) return isBlockedV4(v4);
  const v6 = parseIPv6(address);
  if (v6) return isBlockedV6(v6);
  // Not an IP address: the caller must resolve it first. Block to be safe.
  return true;
}

const BLOCKED_HOSTS = [/^localhost$/i, /\.localhost$/i, /\.local$/i, /\.internal$/i, /^metadata$/i];

/** Checks that need no DNS: the scheme, credentials, and names that are always internal. */
export function checkUrlShape(url: URL): string | null {
  if (url.protocol !== "http:" && url.protocol !== "https:") return "Only http and https URLs are allowed.";
  if (url.username || url.password) return "URLs with credentials are not allowed.";
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.some((pattern) => pattern.test(host))) return "This address is not allowed.";
  if ((parseIPv4(host) || parseIPv6(host)) && isBlockedAddress(host)) return "This address is not allowed.";
  return null;
}
