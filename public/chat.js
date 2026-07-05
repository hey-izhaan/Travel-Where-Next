/**
 * Travel Helper Frontend
 *
 * Handles chat UI interactions and booking actions.
 */

const body = document.body;
const messages = document.getElementById("messages");
const messageStage = document.getElementById("messageStage");
const boardForm = document.getElementById("boardForm");
const boardInput = document.getElementById("boardInput");
const boardSuggestions = document.getElementById("boardSuggestions");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const sendButton = document.getElementById("send-button");
const quickFollowups = document.getElementById("quickFollowups");
const chatStatus = document.getElementById("chatStatus");
const backBtn = document.getElementById("backBtn");
const newTopicBtn = document.getElementById("newTopicBtn");

const popularQuestions = [
	"Where should I go for a relaxing beach trip?",
	"Plan a budget-friendly city break",
	"Help me compare Japan and Italy",
	"Suggest winter vacation ideas",
];

const welcomeResponse = {
	reply:
		"Tell me what kind of trip you want, and I'll help you narrow it down.",
	intent: { hasDestinationIntent: false },
	actions: [],
};

let chatHistory = [{ role: "assistant", content: welcomeResponse.reply }];
let isProcessing = false;
let hasUserMessage = false;
let loadingSlot = null;

renderAssistantResponse(welcomeResponse, { showPopularQuestions: true });

boardForm.addEventListener("submit", (event) => {
	event.preventDefault();
	sendMessage(boardInput.value);
});

boardSuggestions.addEventListener("click", (event) => {
	const button = event.target.closest("button[data-question]");
	if (!button) return;
	sendMessage(button.dataset.question);
});

chatForm.addEventListener("submit", (event) => {
	event.preventDefault();
	sendMessage(chatInput.value);
});

chatInput.addEventListener("keydown", (event) => {
	if (event.key === "Enter") {
		event.preventDefault();
		sendMessage(chatInput.value);
	}
});

backBtn.addEventListener("click", () => {
	body.classList.remove("chat-open");
	boardInput.focus();
});

newTopicBtn.addEventListener("click", resetChat);

async function sendMessage(messageOverride) {
	const message = (messageOverride ?? chatInput.value).trim();

	if (message === "" || isProcessing) return;

	openChatScreen();
	setProcessingState(true);
	clearLatestControls();
	addMessageToChat("user", message);
	chatHistory.push({ role: "user", content: message });
	hasUserMessage = true;

	boardInput.value = "";
	chatInput.value = "";
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
		renderAssistantResponse(fallback, { notice: true });
		chatHistory.push({ role: "assistant", content: fallback.reply });
	} finally {
		showTyping(false);
		setProcessingState(false);
		chatInput.focus();
	}
}

function renderAssistantResponse(response, options = {}) {
	if (loadingSlot) {
		loadingSlot.remove();
		loadingSlot = null;
	}

	const block = document.createElement("div");
	block.className = "message-block assistant-block";

	const answerSlot = document.createElement("div");
	answerSlot.className = "answer-slot is-answering";

	const messageEl = document.createElement("div");
	messageEl.className = `bubble bot${options.notice ? " notice" : ""}`;
	messageEl.textContent = response.reply;
	answerSlot.appendChild(messageEl);

	const actions = buildActionButtons(response);
	if (actions) {
		answerSlot.appendChild(actions);
	}

	block.appendChild(answerSlot);
	messages.appendChild(block);
	renderQuickFollowups(options.showPopularQuestions && !hasUserMessage);
	scrollToBottom();
}

function buildActionButtons(response) {
	const hasActions =
		response.intent?.hasDestinationIntent === true &&
		Array.isArray(response.actions) &&
		response.actions.length > 0;

	if (!hasActions) return null;

	const actionButtons = document.createElement("div");
	actionButtons.className = "action-bubbles latest-controls";
	for (const action of response.actions) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = `action-bubble${action.id === "book_hotel" ? " hotel" : ""}`;
		button.textContent = action.label;
		button.addEventListener("click", () => openBookingAction(action.url));
		actionButtons.appendChild(button);
	}

	return actionButtons;
}

function renderQuickFollowups(showPopularQuestions = false) {
	quickFollowups.replaceChildren();
	if (!showPopularQuestions) return;

	const fragment = document.createDocumentFragment();
	for (const question of popularQuestions) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "popular-question-button latest-controls";
		button.textContent = question;
		button.addEventListener("click", () => sendMessage(question));
		fragment.appendChild(button);
	}
	quickFollowups.appendChild(fragment);
}

function openBookingAction(url) {
	window.open(url, "_blank", "noopener,noreferrer");
}

function addMessageToChat(role, content) {
	const block = document.createElement("div");
	block.className = `message-block ${role}-block`;

	const messageEl = document.createElement("div");
	messageEl.className = `bubble ${role === "user" ? "user" : "bot"}`;
	messageEl.textContent = content;

	block.appendChild(messageEl);
	messages.appendChild(block);
	messages.classList.remove("is-ready");
	requestAnimationFrame(() => messages.classList.add("is-ready"));
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
	const controls = document.querySelectorAll(".latest-controls");
	for (const control of controls) {
		control.classList.remove("latest-controls");
		const buttons = control.matches("button") ? [control] : control.querySelectorAll("button");
		for (const button of buttons) {
			button.disabled = true;
		}
	}
}

function setProcessingState(processing) {
	isProcessing = processing;
	boardInput.disabled = processing;
	chatInput.disabled = processing;
	sendButton.disabled = processing;
	newTopicBtn.disabled = processing;
	boardForm.querySelector("button").disabled = processing;
	chatStatus.textContent = processing ? "Planning" : "Ready";

	const buttons = document.querySelectorAll("button");
	for (const button of buttons) {
		if (button === backBtn || button === newTopicBtn) continue;
		if (button.closest("form")) continue;
		button.disabled = processing || !button.closest(".latest-controls") && button.classList.contains("action-bubble");
	}
}

function showTyping(visible) {
	if (visible) {
		loadingSlot = document.createElement("div");
		loadingSlot.className = "answer-slot is-loading";
		loadingSlot.innerHTML = `
			<div class="loading-card">
				<div class="dots"><span></span><span></span><span></span></div>
				Planning your answer...
			</div>
		`;
		messages.appendChild(loadingSlot);
		scrollToBottom();
		return;
	}

	if (loadingSlot) {
		loadingSlot.remove();
		loadingSlot = null;
	}
}

function openChatScreen() {
	body.classList.add("chat-open");
}

function resetChat() {
	chatHistory = [{ role: "assistant", content: welcomeResponse.reply }];
	isProcessing = false;
	hasUserMessage = false;
	loadingSlot = null;
	boardInput.value = "";
	chatInput.value = "";
	messages.replaceChildren();
	renderAssistantResponse(welcomeResponse, { showPopularQuestions: true });
	setProcessingState(false);
	chatInput.focus();
}

function scrollToBottom() {
	messageStage.scrollTop = messageStage.scrollHeight;
}