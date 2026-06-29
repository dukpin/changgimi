#!/usr/bin/env node
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { createSession, sessions, sweepIdleSessions, SESSION_SWEEP_INTERVAL_MS } from "./sessionManager.js";

// PlayMCP가 "MCP Server URL" 등록 방식만 지원해서, stdio 대신 remote(HTTP) MCP
// endpoint를 추가한다. 예선 MVP라 인증은 사용하지 않는다(콘솔의 "인증 사용하지
// 않음" 옵션과 맞춤).
//
// 세션(Mcp-Session-Id) 단위 store 분리, 유휴 TTL/동시 세션 상한 정책은
// src/sessionManager.ts에 모아뒀다 — 이 파일은 Node http <-> Web Standard
// Request/Response 변환과 라우팅만 책임진다.
//
// SDK가 기본 제공하는 Node 래퍼(StreamableHTTPServerTransport)는 내부적으로
// @hono/node-server를 거치는데, 이 조합(Node 24 + Windows)에서 알림(notification,
// id 없는 메시지) 요청 처리 시 500이 발생하는 문제가 있었다. 그래서 Web Standard
// 버전(WebStandardStreamableHTTPServerTransport)을 Node http와 직접 수동으로
// 연결해 hono 의존성을 제거했다(실제 연결은 sessionManager.ts가 만든 transport가 담당).
const DEFAULT_PORT = Number(process.env.PORT ?? 8787);
const MCP_PATH = "/mcp";

function toWebRequest(req: IncomingMessage, body: Buffer | undefined): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const hasBody = body !== undefined && body.length > 0;
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? new Uint8Array(body) : undefined,
  });
}

async function readRawBody(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "DELETE") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

async function writeWebResponse(webResponse: Response, res: ServerResponse): Promise<void> {
  const headers: Record<string, string> = {};
  webResponse.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(webResponse.status, headers);

  if (!webResponse.body) {
    res.end();
    return;
  }

  const reader = webResponse.body.getReader();
  res.on("close", () => {
    reader.cancel().catch(() => {});
  });
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

async function handleMcpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const incomingSessionId = req.headers["mcp-session-id"];
  const sessionId = Array.isArray(incomingSessionId) ? incomingSessionId[0] : incomingSessionId;

  const existing = sessionId ? sessions.get(sessionId) : undefined;
  // 세션ID가 없거나 모르는 세션이면 새 세션(=새 store)을 만든다. initialize
  // 요청이 아닌데 세션이 없으면 SDK가 자체적으로 400 Invalid Request를 반환한다.
  const session = existing ?? (await createSession());
  session.lastActivityAt = Date.now();

  const body = await readRawBody(req);
  const webRequest = toWebRequest(req, body);
  const webResponse = await session.transport.handleRequest(webRequest);
  await writeWebResponse(webResponse, res);
}

/** 테스트에서도 재사용할 수 있도록 서버 생성/기동을 별도 함수로 분리한다. */
export function createChaeggimiHttpServer(): Server {
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (!req.url || !req.url.startsWith(MCP_PATH)) {
      res.writeHead(404, { "Content-Type": "application/json" }).end(
        JSON.stringify({ error: "not_found", hint: `MCP endpoint는 ${MCP_PATH} 입니다.` }),
      );
      return;
    }

    try {
      await handleMcpRequest(req, res);
    } catch (error) {
      console.error("챙기미 HTTP MCP 요청 처리 실패:", error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" }).end(
          JSON.stringify({ error: "internal_error" }),
        );
      }
    }
  });

  const sweepTimer = setInterval(() => sweepIdleSessions(), SESSION_SWEEP_INTERVAL_MS);
  httpServer.on("close", () => clearInterval(sweepTimer));

  return httpServer;
}

// 직접 실행될 때만(`node dist/httpServer.js`) 자동으로 listen한다. 테스트에서
// import할 때는 이 블록이 실행되지 않아 의도치 않은 포트 점유가 없다.
// process.argv[1]은 cwd 기준 상대경로일 수 있어 new URL(path, "file://")로는
// 정확히 비교되지 않는다(드라이브 문자/상대경로 처리가 깨짐) — pathToFileURL로
// 절대 file:// URL을 만들어 비교해야 한다.
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  const httpServer = createChaeggimiHttpServer();
  httpServer.listen(DEFAULT_PORT, () => {
    console.log(`챙기미 remote MCP 서버: http://localhost:${DEFAULT_PORT}${MCP_PATH}`);
  });
}
