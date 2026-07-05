/**
 * Travel Helper Frontend
 *
 * Handles chat UI interactions, single-pair message motion, and booking actions.
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
const chatStatus = document.getElementById("chatStatus");
const newTopicBtn = document.getElementById("newTopicBtn");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const welcomeResponse = {
	reply:
		"Tell me what kind of trip you want, and I'll help you narrow it down.",
	intent: { hasDestinationIntent: false },
	actions: [],
};

let chatHistory = [{ role: "assistant", content: welcomeResponse.reply }];
let isProcessing = false;
let activeQuestionSlot = null;
let activeAnswerSlot = null;
let loadingSlot = null;
let revealGeneration = 0;

renderAssistantResponse(welcomeResponse, {
	immediate: true,
});

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

newTopicBtn.addEventListener("click", resetChat);

async function sendMessage(messageOverride) {
	const message = (messageOverride ?? chatInput.value).trim();

	if (message === "" || isProcessing) return;

	openChatScreen();
	setProcessingState(true);
	await showQuestion(message);
	chatHistory.push({ role: "user", content: message });

	boardInput.value = "";
	chatInput.value = "";
	showLoadingAnswer();

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
		await renderAssistantResponse(travelResponse);
		chatHistory.push({ role: "assistant", content: travelResponse.reply });
	} catch (error) {
		console.error("Error:", error);
		const fallback = {
			reply:
				"Sorry, there was an error planning that response. Try asking again with your destination, dates, or budget.",
			intent: { hasDestinationIntent: false },
			actions: [],
		};
		await renderAssistantResponse(fallback, { notice: true });
		chatHistory.push({ role: "assistant", content: fallback.reply });
	} finally {
		setProcessingState(false);
		chatInput.focus();
	}
}

async function showQuestion(content) {
	await clearCurrentPair();

	const questionSlot = document.createElement("div");
	questionSlot.className = "question-slot is-entering";

	const messageEl = document.createElement("div");
	messageEl.className = "bubble user";
	messageEl.textContent = content;

	questionSlot.appendChild(messageEl);
	messages.appendChild(questionSlot);
	activeQuestionSlot = questionSlot;
	scrollToBottom();
	finishEntering(questionSlot);
}

async function renderAssistantResponse(response, options = {}) {
	revealGeneration += 1;
	const generation = revealGeneration;

	if (loadingSlot) {
		loadingSlot.remove();
		loadingSlot = null;
		activeAnswerSlot = null;
	}

	if (activeAnswerSlot) {
		await transitionOut(activeAnswerSlot);
		activeAnswerSlot = null;
	}

	const answerSlot = document.createElement("div");
	answerSlot.className = options.immediate
		? "answer-slot"
		: "answer-slot is-entering is-answering";

	const messageEl = document.createElement("div");
	const variantClass = options.notice ? " notice" : "";
	messageEl.className = `bubble bot answer-bubble${variantClass}`;
	answerSlot.appendChild(messageEl);

	messages.appendChild(answerSlot);
	activeAnswerSlot = answerSlot;
	scrollToBottom();
	finishEntering(answerSlot);

	await revealWords(messageEl, response.reply, { immediate: options.immediate, generation });

	if (generation !== revealGeneration) return;

	const actions = buildActionButtons(response);
	if (actions) {
		answerSlot.appendChild(actions);
		scrollToBottom();
	}
}

function showLoadingAnswer() {
	loadingSlot = document.createElement("div");
	loadingSlot.className = "answer-slot is-loading";
	loadingSlot.innerHTML = `
		<div class="loading-card">
			<div class="dots"><span></span><span></span><span></span></div>
			Planning your answer...
		</div>
	`;
	messages.appendChild(loadingSlot);
	activeAnswerSlot = loadingSlot;
	scrollToBottom();
}

async function clearCurrentPair() {
	revealGeneration += 1;
	const exitingSlots = [activeQuestionSlot, activeAnswerSlot].filter(Boolean);
	activeQuestionSlot = null;
	activeAnswerSlot = null;
	loadingSlot = null;

	await Promise.all(exitingSlots.map((slot) => transitionOut(slot)));
}

function transitionOut(slot) {
	if (!slot?.isConnected) return Promise.resolve();

	if (prefersReducedMotion()) {
		slot.remove();
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		slot.classList.remove("is-entering", "is-answering", "is-loading");
		slot.classList.add("is-exiting");
		window.setTimeout(() => {
			slot.remove();
			resolve();
		}, 210);
	});
}

async function revealWords(element, text, options = {}) {
	if (options.immediate || prefersReducedMotion()) {
		element.textContent = text;
		return;
	}

	const words = text.match(/\S+\s*/g) ?? [text];
	element.textContent = "";

	for (const word of words) {
		if (options.generation !== revealGeneration) return;
		element.textContent += word;
		scrollToBottom();
		await delay(getWordDelay(word));
	}
}

function getWordDelay(word) {
	if (/[.!?]\s*$/.test(word)) return 42;
	if (/[,;:]\s*$/.test(word)) return 30;
	return 18;
}

function delay(milliseconds) {
	return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function finishEntering(slot) {
	if (prefersReducedMotion()) {
		slot.classList.remove("is-entering", "is-answering", "is-loading");
		return;
	}

	window.setTimeout(() => {
		slot.classList.remove("is-entering");
	}, 280);
}

function prefersReducedMotion() {
	return reducedMotionQuery.matches;
}

function buildActionButtons(response) {
	const hasActions =
		response.intent?.hasDestinationIntent === true &&
		Array.isArray(response.actions) &&
		response.actions.length > 0;

	if (!hasActions) return null;

	const actionButtons = document.createElement("div");
	actionButtons.className = "action-bubbles";
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

function openBookingAction(url) {
	window.open(url, "_blank", "noopener,noreferrer");
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
	const rawDestination =
		typeof intent?.destination === "string" && intent.destination.trim().length > 0
			? intent.destination.trim()
			: undefined;
	const destination = rawDestination ? normalizeSingleDestination(rawDestination) : undefined;
	const hasDestinationIntent = intent?.hasDestinationIntent === true && Boolean(destination);

	return {
		hasDestinationIntent,
		...(destination ? { destination } : {}),
	};
}

function normalizeSingleDestination(destination) {
	const normalized = destination.replace(/\s+/g, " ").trim();
	if (!normalized) return undefined;
	if (/^(?:n\/a|none|null|undefined|unknown|empty|destination|this destination)$/i.test(normalized)) return undefined;
	if (/[,;\n\r/]/.test(normalized)) return undefined;
	if (/\s(?:or|and)\s/i.test(normalized)) return undefined;
	if (/^\s*(?:\d+\.|[-*])\s/m.test(normalized)) return undefined;
	return normalized;
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
		if (button === newTopicBtn) continue;
		if (button.closest("form")) continue;
		button.disabled = processing;

	}
}

function openChatScreen() {
	body.classList.add("chat-open");
}

function resetChat() {
	revealGeneration += 1;
	chatHistory = [{ role: "assistant", content: welcomeResponse.reply }];
	isProcessing = false;
	activeQuestionSlot = null;
	activeAnswerSlot = null;
	loadingSlot = null;
	boardInput.value = "";
	chatInput.value = "";
	messages.replaceChildren();
	renderAssistantResponse(welcomeResponse, {
		immediate: true,
	});
	setProcessingState(false);
	chatInput.focus();
}

function scrollToBottom() {
	messageStage.scrollTop = messageStage.scrollHeight;
}
