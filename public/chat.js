/**
 * Travel Helper Frontend
 *
 * Handles chat UI interactions and booking actions.
 */

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

const popularQuestions = [
	"Where should I go for a relaxing beach trip?",
	"Plan a budget-friendly city break",
	"Help me compare Japan and Italy",
	"Suggest winter vacation ideas",
];

const welcomeResponse = {
	reply:
		"Hi, I'm Travel Helper. Ask about a destination, itinerary, budget, dates, or travel style.",
	intent: { hasDestinationIntent: false },
	actions: [],
};

let chatHistory = [{ role: "assistant", content: welcomeResponse.reply }];
let isProcessing = false;
let hasUserMessage = false;

renderAssistantResponse(welcomeResponse, { showPopularQuestions: true });

userInput.addEventListener("input", function () {
	this.style.height = "auto";
	this.style.height = `${this.scrollHeight}px`;
});

userInput.addEventListener("keydown", function (event) {
	if (event.key === "Enter" && !event.shiftKey) {
		event.preventDefault();
		sendMessage();
	}
});

sendButton.addEventListener("click", () => sendMessage());

async function sendMessage(messageOverride) {
	const message = (messageOverride ?? userInput.value).trim();

	if (message === "" || isProcessing) return;

	setProcessingState(true);
	clearLatestControls();
	addMessageToChat("user", message);
	chatHistory.push({ role: "user", content: message });
	hasUserMessage = true;

	userInput.value = "";
	userInput.style.height = "auto";
	showTyping(true);

	try {
		const response = await fetch("/api/chat", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messages: chatHistory,
			}),
		});

		if (!response.ok) {
			throw new Error("Failed to get response");
		}

		const data = await response.json();
		const travelResponse = normalizeTravelResponse(data);
		renderAssistantResponse(travelResponse);
		chatHistory.push({ role: "assistant", content: travelResponse.reply });
	} catch (error) {
		console.error("Error:", error);
		const fallback = {
			reply:
				"Sorry, there was an error planning that response. Try asking again with your destination, dates, or budget.",
			intent: { hasDestinationIntent: false },
			actions: [],
		};
		renderAssistantResponse(fallback);
		chatHistory.push({ role: "assistant", content: fallback.reply });
	} finally {
		showTyping(false);
		setProcessingState(false);
		userInput.focus();
	}
}

function renderAssistantResponse(response, options = {}) {
	const block = document.createElement("div");
	block.className = "message-block assistant-block";

	const messageEl = document.createElement("div");
	messageEl.className = "message assistant-message";

	const textEl = document.createElement("p");
	textEl.textContent = response.reply;
	messageEl.appendChild(textEl);
	block.appendChild(messageEl);

	const controls = buildResponseControls(response, options);
	if (controls) {
		block.appendChild(controls);
	}

	chatMessages.appendChild(block);
	scrollToBottom();
}

function buildResponseControls(response, options = {}) {
	const controls = document.createElement("div");
	controls.className = "response-controls latest-controls";
	let hasControls = false;

	if (options.showPopularQuestions && !hasUserMessage) {
		const popularButtons = document.createElement("div");
		popularButtons.className = "controls-buttons popular-buttons";
		for (const question of popularQuestions) {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "popular-question-button";
			button.textContent = question;
			button.addEventListener("click", () => sendMessage(question));
			popularButtons.appendChild(button);
		}
		controls.appendChild(popularButtons);
		hasControls = true;
	}

	const hasActions =
		response.intent?.hasDestinationIntent === true &&
		Array.isArray(response.actions) &&
		response.actions.length > 0;

	if (hasActions) {
		const actionButtons = document.createElement("div");
		actionButtons.className = "controls-buttons";
		for (const action of response.actions) {
			const button = document.createElement("button");
			button.type = "button";
			button.className = "action-button";
			button.textContent = action.label;
			button.addEventListener("click", () => openBookingAction(action.url));
			actionButtons.appendChild(button);
		}
		controls.appendChild(actionButtons);
		hasControls = true;
	}

	return hasControls ? controls : null;
}

function openBookingAction(url) {
	window.open(url, "_blank", "noopener,noreferrer");
}

function addMessageToChat(role, content) {
	const block = document.createElement("div");
	block.className = `message-block ${role}-block`;

	const messageEl = document.createElement("div");
	messageEl.className = `message ${role}-message`;

	const textEl = document.createElement("p");
	textEl.textContent = content;
	messageEl.appendChild(textEl);
	block.appendChild(messageEl);
	chatMessages.appendChild(block);
	scrollToBottom();
}

function normalizeTravelResponse(data) {
	const reply =
		typeof data?.reply === "string" && data.reply.trim().length > 0
			? data.reply.trim()
			: "I can help with destinations, itinerary planning, timing, budgets, packing, and local tips.";
	const intent = normalizeIntent(data?.intent);
	const actions = intent.hasDestinationIntent ? normalizeActions(data?.actions) : [];

	return {
		reply,
		intent,
		actions,
	};
}

function normalizeIntent(intent) {
	const destination =
		typeof intent?.destination === "string" && intent.destination.trim().length > 0
			? intent.destination.trim()
			: undefined;
	const hasDestinationIntent = intent?.hasDestinationIntent === true && Boolean(destination);

	return {
		hasDestinationIntent,
		...(destination ? { destination } : {}),
	};
}

function normalizeActions(actions) {
	if (!Array.isArray(actions)) return [];

	const approvedIds = new Set(["book_flight", "book_hotel"]);
	const seen = new Set();

	return actions.flatMap((action) => {
		if (!approvedIds.has(action?.id) || seen.has(action.id)) return [];
		if (typeof action.label !== "string" || typeof action.url !== "string") return [];

		const label = action.label.trim();
		const url = action.url.trim();
		if (!label || !url || !isAllowedBookingUrl(url)) return [];

		seen.add(action.id);
		return [{ id: action.id, label, url }];
	});
}

function isAllowedBookingUrl(url) {
	try {
		const parsed = new URL(url);
		return parsed.origin === "https://www.google.com" &&
			parsed.pathname.startsWith("/travel/");
	} catch {
		return false;
	}
}

function clearLatestControls() {
	const controls = chatMessages.querySelectorAll(".latest-controls");
	for (const control of controls) {
		control.classList.remove("latest-controls");
		const buttons = control.querySelectorAll("button");
		for (const button of buttons) {
			button.disabled = true;
		}
	}
}

function setProcessingState(processing) {
	isProcessing = processing;
	userInput.disabled = processing;
	sendButton.disabled = processing;
	const buttons = chatMessages.querySelectorAll("button");
	for (const button of buttons) {
		button.disabled = processing || !button.closest(".latest-controls");
	}
}

function showTyping(visible) {
	typingIndicator.classList.toggle("visible", visible);
}

function scrollToBottom() {
	chatMessages.scrollTop = chatMessages.scrollHeight;
}
