import * as http from "http";
import * as https from "https";
import { performance } from "perf_hooks";
import { IMonitor, ServerInfo, PingData } from "./types";
import { TLSSocket } from "tls";

export class HttpMonitor implements IMonitor {
  public ping(server: ServerInfo): Promise<PingData> {
    return new Promise((resolve) => {
      const urlStr = server.url;
      let url: URL;
      try {
        url = new URL(urlStr);
      } catch (e) {
        return resolve(this.createErrorPing(0, "URL Inválida"));
      }

      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return resolve(this.createErrorPing(0, "Protocolo não suportado"));
      }

      const protocol = url.protocol === 'https:' ? https : http;
      
      const timings = {
        startAt: performance.now(),
        dnsLookupAt: 0,
        tcpConnectionAt: 0,
        sslHandshakeAt: 0,
        firstByteAt: 0,
        endAt: 0,
      };

      const options = {
        method: 'GET',
        timeout: 10000, 
        headers: { 'User-Agent': 'VSCode-Server-Monitor/1.0' }
      };

      const req = protocol.request(url, options, (res) => {
        timings.firstByteAt = performance.now();
        
        const statusCode = res.statusCode || 0;
        const isOnline = statusCode >= 200 && statusCode < 400;

        let contentLength = 0;
        let bodyChunks: Buffer[] = [];
        let sslExpiryDays: number | undefined = undefined;
        
        if (url.protocol === 'https:' && res.socket instanceof TLSSocket) {
           const cert = res.socket.getPeerCertificate();
           if (cert && cert.valid_to) {
               const validTo = new Date(cert.valid_to).getTime();
               const now = Date.now();
               sslExpiryDays = Math.max(0, Math.floor((validTo - now) / (1000 * 60 * 60 * 24)));
           }
        }

        res.on('data', (chunk) => {
          contentLength += chunk.length;
          if (server.keyword) {
            bodyChunks.push(chunk);
          }
        });

        res.on('end', () => {
          timings.endAt = performance.now();
          
          let keywordFound: boolean | undefined = undefined;
          if (server.keyword) {
             const bodyStr = Buffer.concat(bodyChunks).toString('utf-8');
             keywordFound = bodyStr.includes(server.keyword);
          }

          const getRelative = (curr: number, prev: number) => {
              if (curr === 0) return 0;
              if (prev === 0) return Math.max(0, curr - timings.startAt);
              return Math.max(0, curr - prev);
          };

          const dnsLookup = getRelative(timings.dnsLookupAt, timings.startAt);
          const tcpConnection = getRelative(timings.tcpConnectionAt, timings.dnsLookupAt || timings.startAt);
          const sslHandshake = getRelative(timings.sslHandshakeAt, timings.tcpConnectionAt || timings.startAt);
          const ttfb = getRelative(timings.firstByteAt, timings.sslHandshakeAt || timings.tcpConnectionAt || timings.dnsLookupAt || timings.startAt);

          const result: PingData = {
            isOnline,
            statusCode,
            ttfb: Math.round(ttfb),
            dnsLookup: Math.round(dnsLookup),
            tcpConnection: Math.round(tcpConnection),
            sslHandshake: Math.round(sslHandshake),
            totalResponseTime: Math.round(Math.max(0, timings.endAt - timings.startAt)),
            contentLength,
            sslExpiryDays,
            keywordFound,
            redirectCount: (statusCode >= 300 && statusCode < 400) ? 1 : 0
          };
          
          resolve(result);
        });
      });

      req.on('socket', (socket) => {
        socket.on('lookup', () => { timings.dnsLookupAt = performance.now(); });
        socket.on('connect', () => { timings.tcpConnectionAt = performance.now(); });
        socket.on('secureConnect', () => { timings.sslHandshakeAt = performance.now(); });
      });

      req.on('error', (err) => {
        timings.endAt = performance.now();
        resolve(this.createErrorPing(Math.round(Math.max(0, timings.endAt - timings.startAt)), err.message));
      });

      req.on('timeout', () => {
        req.destroy(); // Will emit 'error' usually, but just in case
        timings.endAt = performance.now();
        resolve(this.createErrorPing(Math.round(Math.max(0, timings.endAt - timings.startAt)), "Timeout"));
      });

      req.end();
    });
  }

  private createErrorPing(totalTimeMs: number, errorMsg: string): PingData {
    return {
      isOnline: false,
      statusCode: 0,
      ttfb: 0,
      dnsLookup: 0,
      tcpConnection: 0,
      sslHandshake: 0,
      totalResponseTime: totalTimeMs,
      contentLength: 0,
      errorMessage: errorMsg
    };
  }
}
