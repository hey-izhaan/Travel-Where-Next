import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import worker from "./index";
import type { Env, TravelChatResponse } from "./types";

function createEnv(modelResponse: unknown): Env {
	return {
		AI: {
			run: vi.fn(async () => modelResponse),
		} as unknown as Ai,
		ASSETS: {
			fetch: vi.fn(async () => new Response("asset")),
		},
	};
}

function createRequest(message: string): Request {
	return new Request("https://travel-helper.test/api/chat", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			messages: [{ role: "user", content: message }],
		}),
	});
}

async function parseResponse(response: Response): Promise<TravelChatResponse> {
	return (await response.json()) as TravelChatResponse;
}

describe("travel chat API", () => {
	it("calls only the main model for a normal travel question", async () => {
		const env = createEnv({
			response: JSON.stringify({
				reply: "For a relaxing beach trip, compare budget, season, and flight time before choosing.",
				intent: { hasDestinationIntent: false, destination: "" },
			}),
		});

		const response = await worker.fetch(
			createRequest("Where should I go for a relaxing beach trip?"),
			env,
			{} as ExecutionContext,
		);
		const body = await parseResponse(response);
		const run = env.AI.run as unknown as ReturnType<typeof vi.fn>;

		expect(response.status).toBe(200);
		expect(run).toHaveBeenCalledTimes(1);
		expect(run.mock.calls[0][0]).toBe("@cf/meta/llama-3.1-8b-instruct-fp8");
		expect(body.reply).toContain("relaxing beach trip");
		expect(body.intent).toEqual({ hasDestinationIntent: false });
		expect(body.actions).toEqual([]);
		expect(body).not.toHaveProperty("suggestions");
		expect(body).not.toHaveProperty("state");
	});

	it("calls only the main model for an unrelated question and uses the model travel-only reply", async () => {
		const env = createEnv({
			response: JSON.stringify({
				reply: "I only help with travel planning. Ask me about destinations, hotels, flights, budgets, or itineraries.",
				intent: { hasDestinationIntent: false, destination: "" },
			}),
		});

		const response = await worker.fetch(
			createRequest("Write me a stock trading bot"),
			env,
			{} as ExecutionContext,
		);
		const body = await parseResponse(response);
		const run = env.AI.run as unknown as ReturnType<typeof vi.fn>;

		expect(response.status).toBe(200);
		expect(run).toHaveBeenCalledTimes(1);
		expect(run.mock.calls[0][0]).toBe("@cf/meta/llama-3.1-8b-instruct-fp8");
		expect(body.reply.toLowerCase()).toContain("travel planning");
		expect(body.intent).toEqual({ hasDestinationIntent: false });
		expect(body.actions).toEqual([]);
	});

	it("creates exactly flight and hotel booking actions for model destination intent", async () => {
		const env = createEnv({
			response: JSON.stringify({
				reply: "The Maldives is a strong choice for quiet beaches and clear water.",
				intent: { hasDestinationIntent: true, destination: "Maldives" },
				actions: [{ id: "itinerary", label: "Plan itinerary" }],
			}),
		});

		const response = await worker.fetch(
			createRequest("I want to visit Maldives"),
			env,
			{} as ExecutionContext,
		);
		const body = await parseResponse(response);

		expect(body.intent).toEqual({
			hasDestinationIntent: true,
			destination: "Maldives",
		});
		expect(body.actions.map((action) => action.id)).toEqual([
			"book_flight",
			"book_hotel",
		]);
		expect(body.actions.map((action) => action.label)).toEqual([
			"Book flight to Maldives",
			"Book hotel in Maldives",
		]);
		expect(body.actions[0].url).toContain("https://www.google.com/travel/flights/search");
		expect(body.actions[0].url).toContain("Flights%20to%20Maldives");
		expect(body.actions[1].url).toContain("https://www.google.com/travel/hotels");
		expect(body.actions[1].url).toContain("Hotels%20in%20Maldives");
	});

	it("encodes multi-word destination names in booking URLs", async () => {
		const env = createEnv({
			response: JSON.stringify({
				reply: "New York City has great museums, food, and neighborhoods for a city trip.",
				intent: { hasDestinationIntent: true, destination: "New York City" },
			}),
		});

		const response = await worker.fetch(
			createRequest("Plan my trip to New York City"),
			env,
			{} as ExecutionContext,
		);
		const body = await parseResponse(response);

		expect(body.actions[0].url).toContain("New%20York%20City");
		expect(body.actions[1].url).toContain("New%20York%20City");
	});

	it("does not create actions when destination is missing", async () => {
		const env = createEnv({
			response: JSON.stringify({
				reply: "Tell me the destination and I can help plan the trip.",
				intent: { hasDestinationIntent: true, destination: "" },
			}),
		});

		const response = await worker.fetch(
			createRequest("I want to travel"),
			env,
			{} as ExecutionContext,
		);
		const body = await parseResponse(response);

		expect(body.intent).toEqual({ hasDestinationIntent: false });
		expect(body.actions).toEqual([]);
	});


	it("does not create booking actions for comma-separated destination lists", async () => {
		const env = createEnv({
			response: JSON.stringify({
				reply: "For a first Europe trip, compare France, Italy, and Spain by budget and pace.",
				intent: { hasDestinationIntent: true, destination: "France, Italy, Spain" },
			}),
		});

		const response = await worker.fetch(
			createRequest("Where should I go in Europe?"),
			env,
			{} as ExecutionContext,
		);
		const body = await parseResponse(response);

		expect(body.intent).toEqual({ hasDestinationIntent: false });
		expect(body.actions).toEqual([]);
	});

	it("does not create booking actions for destination choices joined by or", async () => {
		const env = createEnv({
			response: JSON.stringify({
				reply: "Bali or Maldives could both work depending on your budget.",
				intent: { hasDestinationIntent: true, destination: "Bali or Maldives" },
			}),
		});

		const response = await worker.fetch(
			createRequest("Should I choose Bali or Maldives?"),
			env,
			{} as ExecutionContext,
		);
		const body = await parseResponse(response);

		expect(body.intent).toEqual({ hasDestinationIntent: false });
		expect(body.actions).toEqual([]);
	});

	it("does not create booking actions for placeholder destinations", async () => {
		const env = createEnv({
			response: JSON.stringify({
				reply: "Tell me the destination and I can help plan the trip.",
				intent: { hasDestinationIntent: true, destination: "this destination" },
			}),
		});

		const response = await worker.fetch(
			createRequest("I want to travel"),
			env,
			{} as ExecutionContext,
		);
		const body = await parseResponse(response);

		expect(body.intent).toEqual({ hasDestinationIntent: false });
		expect(body.actions).toEqual([]);
	});
	it("falls back safely when the model does not return JSON", async () => {
		const env = createEnv({ response: "I can help with travel planning." });

		const response = await worker.fetch(
			createRequest("Plan a cheap 4 day trip."),
			env,
			{} as ExecutionContext,
		);
		const body = await parseResponse(response);

		expect(response.status).toBe(200);
		expect(body.reply).toContain("I can help with destinations");
		expect(body.intent).toEqual({ hasDestinationIntent: false });
		expect(body.actions).toEqual([]);
		expect(body).not.toHaveProperty("suggestions");
		expect(body).not.toHaveProperty("state");
	});

	it("keeps the Worker free of classifier, state, suggestion, and destination-list logic", () => {
		const workerSource = readFileSync("src/index.ts", "utf8");

		expect(workerSource).not.toContain("CLASSIFIER_MODEL_ID");
		expect(workerSource).not.toContain("CLASSIFIER_PROMPT");
		expect(workerSource).not.toContain("classifyTravelMessage");
		expect(workerSource).not.toContain("looksTravelRelated");
		expect(workerSource).not.toContain("createOutOfDomainResponse");
		expect(workerSource).not.toContain("KNOWN_DESTINATIONS");
		expect(workerSource).not.toContain("TravelPlanningState");
		expect(workerSource).not.toContain("ready_to_recommend");
		expect(workerSource).not.toContain("Current planning state");
		expect(workerSource).not.toContain("suggestions");
	});

	it("uses the Travel Helper frontend with starter questions and booking actions", () => {
		const chatScript = readFileSync("public/chat.js", "utf8");
		const html = readFileSync("public/index.html", "utf8");

		expect(html).toContain("Travel Helper");
		expect(html).toContain("question-slot");
		expect(html).toContain("answer-slot");
		expect(html).toContain("answer-bubble");
		expect(html).toContain("prefers-reduced-motion");
		expect(chatScript).toContain("activeQuestionSlot");
		expect(chatScript).toContain("activeAnswerSlot");
		expect(chatScript).toContain("revealWords");
		expect(chatScript).toContain("getWordDelay");
		expect(chatScript).toContain("clearCurrentPair");
		expect(chatScript).toContain("prefersReducedMotion");
		expect(chatScript).toContain("book_flight");
		expect(chatScript).toContain("book_hotel");
		expect(chatScript).toContain("normalizeSingleDestination");
		expect(chatScript).not.toContain("suggestion-chip");
		expect(chatScript).not.toContain("You might ask");
		expect(chatScript).not.toContain("travelState");
		expect(html).not.toContain("backBtn");
		expect(html).not.toContain("Back to questions");
		expect(chatScript).not.toContain("backBtn");
		expect(html).not.toContain("quickFollowups");		expect(chatScript).not.toContain("quickFollowups");
		expect(chatScript).not.toContain("renderQuickFollowups");
		expect(chatScript).not.toContain("popularQuestions");
		expect(html).not.toContain("Cloudflare AI Chat");
		expect(html).not.toContain("controls-label");
	});
});

