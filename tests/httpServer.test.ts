import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import { createChaeggimiHttpServer } from "../src/httpServer.js";
import { sessions, MAX_CONCURRENT_SESSIONS } from "../src/sessionManager.js";

function initializeBody(id: number) {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "0.0.1" },
    },
  });
}

async function postInitialize(baseUrl: string, id: number): Promise<string> {
  const res = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: initializeBody(id),
  });
  const sessionId = res.headers.get("mcp-session-id");
  if (!sessionId) throw new Error("Mcp-Session-Id 헤더가 응답에 없음");
  // 본문(SSE 1개 이벤트)을 소비해 연결을 정리한다.
  await res.text();
  return sessionId;
}

describe("챙기미 HTTP MCP 서버 — 세션 수명주기", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    sessions.clear();
    server = createChaeggimiHttpServer();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("서버 주소를 가져오지 못함");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("51개 동시 initialize 요청에도 동시 세션 수는 상한(50)을 넘지 않는다", async () => {
    const concurrentCount = MAX_CONCURRENT_SESSIONS + 1;
    await Promise.all(
      Array.from({ length: concurrentCount }, (_, i) => postInitialize(baseUrl, i)),
    );

    expect(sessions.size).toBeLessThanOrEqual(MAX_CONCURRENT_SESSIONS);
  });

  it("DELETE로 세션을 종료하면 같은 세션ID로 재요청 시 거부된다", async () => {
    const sessionId = await postInitialize(baseUrl, 1);
    expect(sessions.has(sessionId)).toBe(true);

    const deleteRes = await fetch(`${baseUrl}/mcp`, {
      method: "DELETE",
      headers: { "Mcp-Session-Id": sessionId },
    });
    expect(deleteRes.status).toBeLessThan(300);
    await deleteRes.text();

    expect(sessions.has(sessionId)).toBe(false);

    const reuseRes = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "Mcp-Session-Id": sessionId,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "tools/list", params: {} }),
    });
    expect(reuseRes.status).toBe(400);
    const reuseBody = await reuseRes.json();
    expect(reuseBody.error?.message).toMatch(/not initialized|Invalid Request/i);
  });
});
