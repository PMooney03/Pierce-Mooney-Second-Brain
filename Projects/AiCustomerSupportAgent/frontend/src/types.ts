export interface Source {
  id: string;
  title: string;
  snippet: string;
}

export interface AskResponse {
  answer: string;
  sources: Source[];
  confidence: "high" | "low";
  model?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  confidence?: "high" | "low";
  rating?: "yes" | "no" | null;
}
