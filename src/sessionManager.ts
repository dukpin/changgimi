import { randomUUID } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createChaeggimiServer } from "./mcpServer.js";
import { ChaeggimiStore } from "./store.js";

// 인증이 없어 실제 user_id를 구분할 방법이 없으므로, MCP 표준 세션(Mcp-Session-Id)
// 단위로 ChaeggimiStore를 분리한다. 세션이 끝나면(DELETE 종료 또는 유휴시간 초과)
// store도 함께 사라진다 — 다중 사용자 영속 데이터에는 쓸 수 없는 데모 전용 구조다.
export const SESSION_IDLE_TTL_MS = 30 * 60 * 1000; // 30분
export const SESSION_SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5분
export const MAX_CONCURRENT_SESSIONS = 50;

export interface Session {
  transport: WebStandardStreamableHTTPServerTransport;
  store: ChaeggimiStore;
  lastActivityAt: number;
}

export const sessions = new Map<string, Session>();

async function closeSession(sessionId: string, session: Session): Promise<void> {
  sessions.delete(sessionId);
  try {
    await session.transport.close();
  } catch (error) {
    console.error(`[session ${sessionId}] close 실패:`, error);
  }
}

export function sweepIdleSessions(now: number = Date.now()): void {
  for (const [sessionId, session] of sessions) {
    if (now - session.lastActivityAt > SESSION_IDLE_TTL_MS) {
      console.log(`[session ${sessionId}] 유휴 ${SESSION_IDLE_TTL_MS / 60000}분 초과로 정리`);
      void closeSession(sessionId, session);
    }
  }
}

/**
 * 상한 초과 시 가장 오래된 세션을 골라 제거한다. 호출하는 쪽(onsessioninitialized)이
 * await 없이 동기적으로 호출해야 한다 — 그래야 "크기 확인 → 제거 → 등록"이 하나의
 * JS 실행 턴 안에서 끊기지 않고 끝나서, 동시에 여러 initialize 요청이 들어와도
 * 상한을 초과하지 않는다(JS는 단일 스레드라 await 없는 동기 코드는 중간에
 * 다른 콜백이 끼어들 수 없다). transport.close()처럼 실제 정리가 필요한 부분은
 * fire-and-forget으로 분리해서 이 함수 자체는 동기로 유지한다.
 */
function evictOldestSessionSync(): void {
  let oldestId: string | undefined;
  let oldestSession: Session | undefined;
  for (const [sessionId, session] of sessions) {
    if (!oldestSession || session.lastActivityAt < oldestSession.lastActivityAt) {
      oldestId = sessionId;
      oldestSession = session;
    }
  }
  if (oldestId && oldestSession) {
    console.log(`[session ${oldestId}] 동시 세션 상한(${MAX_CONCURRENT_SESSIONS}) 초과로 가장 오래된 세션 정리`);
    sessions.delete(oldestId); // 동기적으로 즉시 자리 비우기 — 용량 계산은 여기서 끝난다.
    void closeSession(oldestId, oldestSession); // 실제 transport.close()는 비동기로 흘려보냄.
  }
}

/** 새 세션(전용 store 포함)을 만들고 McpServer를 transport에 연결한다. 연결 실패 시 던진다. */
export async function createSession(): Promise<Session> {
  const store = new ChaeggimiStore();
  const server = createChaeggimiServer(store);
  const session: Session = {
    transport: undefined as unknown as WebStandardStreamableHTTPServerTransport,
    store,
    lastActivityAt: Date.now(),
  };
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    // 이 콜백은 await 없이 동기로만 작성한다 — sessions.size 체크와 set()이
    // 한 턴 안에서 끊기지 않아야 동시 요청에서도 상한이 정확히 지켜진다.
    onsessioninitialized: (sessionId) => {
      if (sessions.size >= MAX_CONCURRENT_SESSIONS) {
        evictOldestSessionSync();
      }
      sessions.set(sessionId, session);
    },
    onsessionclosed: (sessionId) => {
      sessions.delete(sessionId);
    },
  });
  session.transport = transport;
  transport.onerror = (error) => {
    console.error("[transport.onerror]", error);
  };
  transport.onclose = () => {
    if (transport.sessionId) sessions.delete(transport.sessionId);
  };

  // 연결을 기다린다 — 실패하면 이 세션은 sessions Map에 등록되지 않은 채(아직
  // onsessioninitialized가 호출되지 않았으므로) 그냥 버려진다.
  await server.connect(transport);
  return session;
}
