import type { PeerOptions } from 'peerjs';

/** All VITE_* values are public. TURN credentials come from a short-lived endpoint. */
export async function peerOptions(): Promise<PeerOptions> {
  const env = import.meta.env;
  const options: PeerOptions = { debug: 0 };
  if (env.VITE_PEER_HOST) {
    options.host = env.VITE_PEER_HOST;
    options.port = Number(env.VITE_PEER_PORT || 443);
    options.path = env.VITE_PEER_PATH || '/';
    options.secure = env.VITE_PEER_SECURE !== 'false';
  }
  if (env.VITE_ICE_SERVERS_URL) {
    const response = await fetch(env.VITE_ICE_SERVERS_URL, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Could not load relay configuration. Try again.');
    const data = await response.json();
    if (
      !Array.isArray(data.iceServers) ||
      data.iceServers.length > 10 ||
      !data.iceServers.every(
        (server: RTCIceServer) =>
          server &&
          (typeof server.urls === 'string' ||
            (Array.isArray(server.urls) && server.urls.every((url) => typeof url === 'string'))),
      )
    ) {
      throw new Error('The relay configuration is invalid.');
    }
    options.config = { iceServers: data.iceServers };
  }
  return options;
}
