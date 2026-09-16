import { fileNode, filesFromContent, type MockDirNode, type MockTreeRoot } from "./helpers";

const WEB_MAIN_CONTENT: Record<string, string> = {
  "README.md": `# Web Client

React + Vite front-end for the Chat Bot test harness. Talks to the backend API
and renders streaming assistant responses with session history.

## Scripts

\`\`\`bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run test
\`\`\`

## Layout

- \`src/components/chat/\` — message UI
- \`src/hooks/\` — data fetching + session state
- \`src/lib/\` — typed API client
`,

  "package.json": `{
  "name": "web-client",
  "private": true,
  "version": "0.3.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "lint": "eslint src"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.59.0",
    "lucide-react": "^0.460.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.27.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@vitejs/plugin-react": "^4.3.3",
    "autoprefixer": "^10.4.20",
    "eslint": "^8.57.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.4"
  }
}
`,

  "tsconfig.json": `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
`,

  "vite.config.ts": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8080", changeOrigin: true },
    },
  },
});
`,

  "tailwind.config.ts": `import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1a1a1a",
        mid: "#6b6b6b",
        surface: "#ffffff",
        line: "#e5e5e5",
      },
    },
  },
  plugins: [],
} satisfies Config;
`,

  "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Chat Bot</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,

  "src/main.tsx": `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles/index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
`,

  "src/App.tsx": `import { Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ChatPage } from "./pages/ChatPage";
import { SessionsPage } from "./pages/SessionsPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<ChatPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
      </Route>
    </Routes>
  );
}
`,

  "src/styles/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-neutral-50 text-ink antialiased;
  font-family: system-ui, sans-serif;
}
`,

  "src/lib/api.ts": `import type { ChatRequest, ChatResponse, SessionSummary } from "./types";

const BASE = "/api/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(\`\${BASE}\${path}\`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(\`API \${res.status}\`);
  return res.json() as Promise<T>;
}

export function listSessions(token: string) {
  return request<SessionSummary[]>("/sessions", {
    headers: { Authorization: \`Bearer \${token}\` },
  });
}

export function postChat(token: string, body: ChatRequest) {
  return request<ChatResponse>("/chat", {
    method: "POST",
    headers: { Authorization: \`Bearer \${token}\` },
    body: JSON.stringify(body),
  });
}
`,

  "src/lib/types.ts": `export interface SessionSummary {
  id: string;
  title: string | null;
  updated_at: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  session_id?: string;
  messages: ChatMessage[];
  stream?: boolean;
}

export interface ChatResponse {
  session_id: string;
  message: ChatMessage;
  usage_tokens: number;
}
`,

  "src/hooks/useChat.ts": `import { useMutation } from "@tanstack/react-query";
import { postChat } from "../lib/api";
import type { ChatRequest, ChatResponse } from "../lib/types";

export function useChat(token: string) {
  return useMutation<ChatResponse, Error, ChatRequest>({
    mutationFn: (body) => postChat(token, body),
  });
}
`,

  "src/hooks/useSessions.ts": `import { useQuery } from "@tanstack/react-query";
import { listSessions } from "../lib/api";

export function useSessions(token: string | null) {
  return useQuery({
    queryKey: ["sessions", token],
    queryFn: () => listSessions(token!),
    enabled: Boolean(token),
  });
}
`,

  "src/components/layout/AppLayout.tsx": `import { Outlet, Link } from "react-router-dom";

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface px-4 py-3">
        <nav className="mx-auto flex max-w-5xl gap-4 text-sm">
          <Link to="/">Chat</Link>
          <Link to="/sessions">Sessions</Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
`,

  "src/components/chat/ChatPanel.tsx": `import { useState } from "react";
import { Send } from "lucide-react";
import { useChat } from "../../hooks/useChat";
import { MessageList } from "./MessageList";
import type { ChatMessage } from "../../lib/types";

interface ChatPanelProps {
  token: string;
}

export function ChatPanel({ token }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const chat = useChat(token);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setDraft("");
    const resp = await chat.mutateAsync({ messages: next });
    setMessages([...next, resp.message]);
  };

  return (
    <section className="flex h-[70vh] flex-col rounded-xl border border-line bg-surface">
      <MessageList messages={messages} />
      <footer className="flex gap-2 border-t border-line p-3">
        <input
          className="flex-1 rounded-md border border-line px-3 py-2 text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask the assistant..."
        />
        <button type="button" onClick={send} disabled={chat.isPending} className="rounded-md bg-ink px-3 py-2 text-white">
          <Send size={16} />
        </button>
      </footer>
    </section>
  );
}
`,

  "src/components/chat/MessageList.tsx": `import { Bot, User } from "lucide-react";
import type { ChatMessage } from "../../lib/types";

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <ul className="flex-1 space-y-3 overflow-y-auto p-4">
      {messages.length === 0 && (
        <li className="text-sm text-mid">Start a conversation to see messages here.</li>
      )}
      {messages.map((message, index) => (
        <li key={index} className="flex gap-2 text-sm">
          {message.role === "user" ? <User size={16} /> : <Bot size={16} />}
          <div>
            <p className="text-xs uppercase text-mid">{message.role}</p>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
`,

  "src/pages/ChatPage.tsx": `import { ChatPanel } from "../components/chat/ChatPanel";

const DEMO_TOKEN = "demo-edge-token";

export function ChatPage() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Chat</h1>
      <ChatPanel token={DEMO_TOKEN} />
    </div>
  );
}
`,

  "src/pages/SessionsPage.tsx": `import { useSessions } from "../hooks/useSessions";

const DEMO_TOKEN = "demo-edge-token";

export function SessionsPage() {
  const { data, isLoading, isError } = useSessions(DEMO_TOKEN);

  if (isLoading) return <p className="text-sm text-mid">Loading sessions...</p>;
  if (isError) return <p className="text-sm text-red-600">Failed to load sessions.</p>;

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Sessions</h1>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {(data ?? []).map((session) => (
          <li key={session.id} className="px-4 py-3 text-sm">
            <p className="font-medium">{session.title ?? "Untitled"}</p>
            <p className="font-mono text-xs text-mid">{session.id}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
`,

  "src/components/ui/Button.tsx": `import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export function Button({ variant = "primary", className = "", ...props }: Props) {
  const styles =
    variant === "primary"
      ? "bg-ink text-white hover:opacity-90"
      : "bg-transparent text-mid hover:bg-neutral-100";
  return (
    <button
      className={\`inline-flex items-center rounded-md px-3 py-2 text-sm font-medium \${styles} \${className}\`}
      {...props}
    />
  );
}
`,
};

const WEB_STAGING_EXTRA: Record<string, string> = {
  "README.md": `# Web Client (staging)

Pre-release branch with experimental UI under \`src/experimental/\`. Feature flags
are enabled via \`VITE_PREVIEW_BANNER=1\`.
`,

  "src/experimental/PreviewBanner.tsx": `interface PreviewBannerProps {
  environment?: string;
}

export function PreviewBanner({ environment = "staging" }: PreviewBannerProps) {
  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900">
      Preview build — {environment}. Responses may differ from production.
    </div>
  );
}
`,

  "src/experimental/FeatureFlags.ts": `export const featureFlags = {
  streamingMarkdown: true,
  sessionPinning: false,
  voiceInput: false,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export function isEnabled(flag: FeatureFlag): boolean {
  return featureFlags[flag];
}
`,

  "src/App.tsx": `import { Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { PreviewBanner } from "./experimental/PreviewBanner";
import { ChatPage } from "./pages/ChatPage";
import { SessionsPage } from "./pages/SessionsPage";

export function App() {
  return (
    <>
      <PreviewBanner environment="staging" />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<ChatPage />} />
          <Route path="/sessions" element={<SessionsPage />} />
        </Route>
      </Routes>
    </>
  );
}
`,
};

function treeFromContent(content: Record<string, string>): MockTreeRoot {
  const root: MockTreeRoot = {};
  for (const path of Object.keys(content)) {
    const parts = path.split("/");
    let current: MockTreeRoot | MockDirNode["children"] = root;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]!;
      const isFile = i === parts.length - 1;
      if (isFile) {
        current[part] = fileNode(content[path]!);
      } else {
        if (!current[part] || current[part].type !== "dir") {
          current[part] = { type: "dir", children: {} };
        }
        current = (current[part] as MockDirNode).children;
      }
    }
  }
  return root;
}

export const WEB_TREES_BY_BRANCH = {
  main: treeFromContent(WEB_MAIN_CONTENT),
  staging: treeFromContent({ ...WEB_MAIN_CONTENT, ...WEB_STAGING_EXTRA }),
};

export const WEB_FILES_BY_BRANCH = {
  main: filesFromContent(WEB_MAIN_CONTENT),
  staging: filesFromContent({ ...WEB_MAIN_CONTENT, ...WEB_STAGING_EXTRA }),
};
