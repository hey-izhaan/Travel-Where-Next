/**
 * Type definitions for the Travel Helper chat application.
 */

export interface Env {
  /**
   * Binding for the Workers AI API.
   */
  AI: Ai;

  /**
   * Binding for static assets.
   */
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

/**
 * Represents a chat message.
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TravelChatRequest {
  messages: ChatMessage[];
}

export interface TravelIntent {
  hasDestinationIntent: boolean;
  destination?: string;
}

export type TravelActionId = "book_flight" | "book_hotel";

export interface TravelAction {
  id: TravelActionId;
  label: string;
  url: string;
}

export interface TravelChatResponse {
  reply: string;
  intent: TravelIntent;
  actions: TravelAction[];
}
