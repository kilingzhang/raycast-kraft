import { SocksProxyAgent } from "socks-proxy-agent";
import { AppSettings } from "../runtime/app-settings";

export function useProxy(appSettings: AppSettings): SocksProxyAgent | undefined {
  if (!appSettings.useProxy || !appSettings.proxyHost || !appSettings.proxyPort) {
    return undefined;
  }

  let auth = "";

  if (appSettings.proxyUsername) {
    auth = `${encodeURIComponent(appSettings.proxyUsername)}`;
    if (appSettings.proxyPassword) {
      auth = `${auth}:${encodeURIComponent(appSettings.proxyPassword)}`;
    }
    auth = `${auth}@`;
  }

  const proxy = `socks5://${auth}${appSettings.proxyHost}:${appSettings.proxyPort}`;

  return new SocksProxyAgent(proxy);
}
