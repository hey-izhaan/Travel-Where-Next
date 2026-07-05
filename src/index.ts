/**
 * Travel Helper Chatbot
 *
 * A small travel-only chat API using Cloudflare Workers AI.
 *
 * @license MIT
 */
import {
	ChatMessage,
	Env,
	TravelAction,
	TravelChatRequest,
	TravelChatResponse,
	TravelIntent,
} from "./types";

const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

const SYSTEM_PROMPT = `You are Travel Helper.
Answer travel questions clearly and practically.
If the user asks something unrelated to travel, politely say you only help with travel planning.
Set hasDestinationIntent to true only when the user has chosen one specific destination.
For comparisons, recommendations, or multiple destination lists, set hasDestinationIntent to false and leave destination empty.
Return only JSON:
{"reply":"answer for the user","intent":{"hasDestinationIntent":false,"destination":""}}`;

export default {
	async fetch(
		request: Request,
		env: Env,
		_ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		if (url.pathname === "/api/chat") {
			if (request.method === "POST") {
				return handleChatRequest(request, env);
			}

			return jsonResponse({ error: "Method not allowed" }, 405);
		}

		return jsonResponse({ error: "Not found" }, 404);
	},
} satisfies ExportedHandler<Env>;

async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const body = (await request.json()) as Partial<TravelChatRequest>;
		const messages = normalizeMessages(body.messages);

		if (messages.length === 0) {
			return jsonResponse(createFallbackResponse());
		}

		const modelMessages: ChatMessage[] = [
			{ role: "system", content: SYSTEM_PROMPT },
			...messages.filter((message) => message.role !== "system"),
		];

		const result = await env.AI.run<typeof MODEL_ID>(MODEL_ID, {
			messages: modelMessages,
			max_tokens: 600,
		});
		const rawText = extractModelText(result);
		const parsed = parseTravelResponse(rawText);

		if (!parsed) {
			console.warn(
				JSON.stringify({
					event: "travel_chat_invalid_model_json",
					rawLength: rawText.length,
				}),
			);
			return jsonResponse(createFallbackResponse());
		}

		return jsonResponse(validateTravelResponse(parsed));
	} catch (error) {
		console.error(
			JSON.stringify({
				event: "travel_chat_request_failed",
				message: error instanceof Error ? error.message : "Unknown error",
			}),
		);

		return jsonResponse(
			{ error: "Failed to process travel chat request" },
			500,
		);
	}
}

function normalizeMessages(messages: unknown): ChatMessage[] {
	if (!Array.isArray(messages)) return [];

	return messages.flatMap((message): ChatMessage[] => {
		if (!isObject(message)) return [];
		if (!isAllowedRole(message.role)) return [];
		if (typeof message.content !== "string") return [];

		const content = message.content.trim();
		if (content.length === 0) return [];

		return [{ role: message.role, content }];
	});
}

function extractModelText(result: unknown): string {
	if (typeof result === "string") return result.trim();
	if (!isObject(result)) return "";

	const response = result.response;
	if (typeof response === "string") return response.trim();

	return "";
}

function parseTravelResponse(rawText: string): unknown | null {
	if (rawText.length === 0) return null;

	const cleaned = rawText
		.replace(/^```(?:json)?/i, "")
		.replace(/```$/i, "")
		.trim();

	try {
		return JSON.parse(cleaned);
	} catch {
		const start = cleaned.indexOf("{");
		const end = cleaned.lastIndexOf("}");
		if (start === -1 || end === -1 || end <= start) return null;

		try {
			return JSON.parse(cleaned.slice(start, end + 1));
		} catch {
			return null;
		}
	}
}

function validateTravelResponse(value: unknown): TravelChatResponse {
	if (!isObject(value)) {
		return createFallbackResponse();
	}

	const reply =
		typeof value.reply === "string" && value.reply.trim().length > 0
			? value.reply.trim()
			: createFallbackReply();
	const intent = validateIntent(value.intent);
	const actions = intent.hasDestinationIntent
		? createDestinationActions(intent.destination)
		: [];

	return {
		reply,
		intent,
		actions,
	};
}

function validateIntent(value: unknown): TravelIntent {
	if (!isObject(value)) {
		return { hasDestinationIntent: false };
	}

	const rawDestination =
		typeof value.destination === "string" && value.destination.trim().length > 0
			? value.destination.trim()
			: undefined;
	const destination = rawDestination
		? normalizeSingleDestination(rawDestination)
		: undefined;
	const hasDestinationIntent =
		value.hasDestinationIntent === true && Boolean(destination);

	return {
		hasDestinationIntent,
		...(hasDestinationIntent && destination ? { destination } : {}),
	};
}

function normalizeSingleDestination(destination: string): string | undefined {
	const normalized = destination.replace(/\s+/g, " ").trim();
	if (!normalized) return undefined;
	if (looksLikeMissingDestination(normalized)) return undefined;
	if (looksLikeMultipleDestinations(normalized)) return undefined;

	return normalized;
}

function looksLikeMissingDestination(destination: string): boolean {
	return /^(?:n\/a|none|null|undefined|unknown|empty|destination|this destination)$/i.test(destination);
}

function looksLikeMultipleDestinations(destination: string): boolean {
	return (
		/[,;\n\r/]/.test(destination) ||
		/\s(?:or|and)\s/i.test(destination) ||
		/^\s*(?:\d+\.|[-*])\s/m.test(destination)
	);
}

function createDestinationActions(destination = "this destination"): TravelAction[] {
	return [
		{
			id: "book_flight",
			label: `Book flight to ${destination}`,
			url: `https://www.google.com/travel/flights/search?q=${encodeURIComponent(`Flights to ${destination}`)}`,
		},
		{
			id: "book_hotel",
			label: `Book hotel in ${destination}`,
			url: `https://www.google.com/travel/hotels?q=${encodeURIComponent(`Hotels in ${destination}`)}&destination=${encodeURIComponent(destination)}`,
		},
	];
}

function createFallbackReply(): string {
	return "I can help with destinations, itineraries, budgets, timing, packing, and other travel planning. Ask me about a trip you want to take.";
}

function createFallbackResponse(): TravelChatResponse {
	return {
		reply: createFallbackReply(),
		intent: { hasDestinationIntent: false },
		actions: [],
	};
}

function isAllowedRole(role: unknown): role is ChatMessage["role"] {
	return role === "system" || role === "user" || role === "assistant";
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "no-cache",
		},
	});
}

