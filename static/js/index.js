const baseUrl = window.location.origin;
let currentConversationId = null;

let isAnswering = false;

function getSourcesReview(sources) {
  const sourceReview = sources.map((source) => {
    const article = source.article_name;
    const articleNumber = source.article_name
      ? source.article_name.split("-")[0].trim()
      : "";

    const articleTitle = source.article_name
      ? source.article_name.split("-")[1].trim()
      : "";

    const chapter = source.chapter;

    const chapterNumber = source.chapter
      ? source.chapter.split("-")[0].trim()
      : "";
    const sectionNumber = source.section
      ? source.section.split("-")[0].trim()
      : "";
    const articleContent = source.article_content;

    const sourceName = source.source_name;

    return {
      article,
      articleNumber,
      articleTitle,
      chapter,
      chapterNumber,
      sectionNumber,
      articleContent,
      sourceName,
    };
  });
  return sourceReview;
}

function appendChatItemToUI(sourceReview, question, answer, fromChat = false) {
  const template = `<li class="item">
    <div class="question">
      <p>${question}</p>
    </div>
    <div class="answer">
      <ul class="tabs">
        <li class="answer-tab active">
          <i class="fa-solid fa-robot"></i> Answer
        </li>
        <li class="source-tab">
          <i class="fa-solid fa-folder-tree"></i> Sources
        </li>
      </ul>

      <div class="answer-content active">
        <ul class="source-overview">
        ${sourceReview
          .slice(0, 5)
          .map((item) => {
            return `<li class="item">${item.articleNumber} ${item.sectionNumber} ${item.chapterNumber} ${item.sourceName}</li>`;
          })
          .join("")}
        </ul>
        <div class="answer-text">
        ${marked.parse(answer)}
        </div>
      </div>
    </div>

    <ul class="source">
    ${sourceReview
      .map((item) => {
        return `<li class="item">
        <div class="heading">
          ${item.articleNumber} ${item.sectionNumber} ${item.chapterNumber} ${item.sourceName}
        </div>
        <div class="article-title">${item.articleTitle}</div>
        <div class="content">
          ${item.articleContent}
        </div>
      </li>`;
      })
      .join("")}
    </ul>
  </li>
`;
  const conversation = document.querySelector(".conversation");

  if (fromChat) {
    const lastElementChild = conversation.lastElementChild;
    conversation.removeChild(lastElementChild);
  }

  conversation.innerHTML += template;

  conversation.lastElementChild.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
  addEventHanlderForConversationItems();
}

function newConversation(question) {
  const id = crypto.randomUUID();
  const time = Date.now();
  const created_at = time;
  const updated_at = time;
  const name = question;
  const conversation = [];

  const conversationObj = {
    id,
    time,
    created_at,
    updated_at,
    name,
    conversation,
  };

  const conversationsStr = localStorage.getItem("conversations") || "[]";
  const conversations = JSON.parse(conversationsStr);
  conversations.push(conversationObj);
  localStorage.setItem("conversations", JSON.stringify(conversations));

  return id;
}

function addChatItem(id, sourceReview, question, answer) {
  const conversationsStr = localStorage.getItem("conversations") || "[]";
  const conversations = JSON.parse(conversationsStr);

  let conversation = null;
  for (const conv of conversations) {
    if (conv.id == id) {
      conversation = conv;
      break;
    }
  }
  if (conversation !== null) {
    conversation.conversation.push({
      question,
      answer: {
        text: answer,
        sources: sourceReview.map((item) => {
          return {
            article_content: item.articleContent,
            article_name: item.article,
            chapter: item.chapter,
            section: item.section,
            source_name: item.sourceName,
          };
        }),
      },
    });
    conversation.updated_at = Date.now();
    localStorage.setItem("conversations", JSON.stringify(conversations));
  }
}

async function chat(question) {
  if (!question.trim()) {
    return;
  }

  try {
    const relativePath = "/query";
    const url = new URL(relativePath, baseUrl);
    url.searchParams.append("q", question);
    const response = await fetch(url, {
      method: "GET",
    });
    let result = await response.json();
    result = result.result;

    const sourceReview = getSourcesReview(result.sources);

    if (currentConversationId == null) {
      const id = newConversation(question);
      loadData();
      activateConversation(id);
      currentConversationId = id;
    }

    addChatItem(currentConversationId, sourceReview, question, result.answer);
    appendChatItemToUI(sourceReview, question, result.answer, true);
  } catch (e) {
    console.error("Error");
    console.error(e);
  }
}

function addEventHanlderForConversationItems() {
  const conversationItems = document.querySelectorAll(".conversation > .item");

  conversationItems.forEach((conversationItem) => {
    const answerTab = conversationItem.querySelector(".answer-tab");
    const sourceTab = conversationItem.querySelector(".source-tab");

    const answerContent = conversationItem.querySelector(".answer-content");
    const source = conversationItem.querySelector(".source");

    answerTab.addEventListener("click", (event) => {
      answerTab.classList.add("active");
      answerContent.classList.add("active");

      sourceTab.classList.remove("active");
      source.classList.remove("active");
    });

    sourceTab.addEventListener("click", (event) => {
      sourceTab.classList.add("active");
      source.classList.add("active");

      answerTab.classList.remove("active");
      answerContent.classList.remove("active");
    });
  });
}

function unactivateConversationItem() {
  const historyItems = document.querySelectorAll(".history > li.item");
  historyItems.forEach((item) => item.classList.remove("active"));
}

function activateConversation(id) {
  if (id == null) return;

  unactivateConversationItem();
  document
    .querySelector(`.history > li.item[data-id="${id}"]`)
    .classList.add("active");
}

function loadConversationContent() {
  const conversationsStr = localStorage.getItem("conversations") || "[]";
  const conversations = JSON.parse(conversationsStr);

  let conversation = null;
  for (const conv of conversations) {
    if (conv.id === currentConversationId) {
      conversation = conv.conversation;
      break;
    }
  }

  document.querySelector("ul.conversation").innerHTML = "";

  if (conversation !== null) {
    conversation.forEach((item) => {
      const sourceReview = getSourcesReview(item.answer.sources);
      appendChatItemToUI(sourceReview, item.question, item.answer.text);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function addEventHandlerForHistoryItems() {
  const historyItems = document.querySelectorAll("ul.history > li.item");
  historyItems.forEach((item) => {
    item.addEventListener("click", (event) => {
      const conversationId = item.dataset.id;
      currentConversationId = conversationId;
      activateConversation(conversationId);
      loadConversationContent();
    });
  });
}

function loadData() {
  const conversationsStr = localStorage.getItem("conversations") || "[]";
  const conversations = JSON.parse(conversationsStr);
  conversations.sort((a, b) => b.updated_at - a.updated_at);

  const history = document.querySelector("ul.history");
  history.innerHTML = conversations
    .map((conversation) => {
      return `<li class="item" data-id="${conversation.id}">${conversation.name} <button class="delete-btn">
              <i class="fa-solid fa-trash"></i>
            </button></li>`;
    })
    .join("");
  addEventHandlerForHistoryItems();
  addEventHandlerForDeleteConversationBtn();
}

function prepareNewConversation() {
  document.querySelector("ul.conversation").innerHTML = "";
  currentConversationId = null;
  unactivateConversationItem();
}

function generatingEffect(isLoading) {
  if (isLoading) {
    document.querySelector(".send-btn").innerHTML =
      '<i class="fa-solid fa-circle-notch fa-spin"></i>';
  } else {
    document.querySelector(".send-btn").innerHTML =
      '<i class="fa-solid fa-paper-plane"></i>';
  }
}

function appendTemporaryChatItemToUI(question) {
  const template = `<li class="item">
    <div class="question">
      <p>${question}</p>
    </div>
  </li>
`;
  const conversation = document.querySelector(".conversation");
  conversation.innerHTML += template;

  conversation.lastElementChild.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

async function triggerChat(question) {
  if (question.trim()) {
    generatingEffect(true);
    appendTemporaryChatItemToUI(question);
    document.querySelector(".text-input-container > input").value = "";
    await chat(question);
    generatingEffect(false);
  }
}

function deleteConversation(id) {
  const conversationsStr = localStorage.getItem("conversations") || "[]";
  const conversations = JSON.parse(conversationsStr);
  const newConversations = conversations.filter((item) => item.id !== id);

  localStorage.setItem("conversations", JSON.stringify(newConversations));

  loadData();
  if (currentConversationId == id) {
    prepareNewConversation();
  } else {
    activateConversation(currentConversationId);
  }
}

function addEventHandlerForDeleteConversationBtn() {
  document.querySelectorAll("ul.history .item .delete-btn").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      const parentNode = event.target.closest("li.item");
      const id = parentNode.dataset.id;
      if (id) {
        deleteConversation(id);
      }
    });
  });
}

function init() {
  // chat("Tài sản thừa kế được phân chia cho các con như thế nào?");
  addEventHanlderForConversationItems();
  // generateContent();
  loadData();

  document
    .querySelector(".create-conversation")
    .addEventListener("click", (event) => {
      prepareNewConversation();
    });

  document
    .querySelector(".send-btn")
    .addEventListener("click", async (event) => {
      const textInputContainer = document.querySelector(
        ".text-input-container"
      );
      const input = textInputContainer.querySelector("input");
      const question = input.value;
      if (question.trim()) {
        triggerChat(question);
      }
    });

  document
    .querySelector(".text-input-container > input")
    .addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        triggerChat(event.target.value);
      }
    });

  document
    .querySelector(".text-input-container > input")
    .addEventListener("input", (event) => {
      const input = event.target;

      const sendBtn = document.querySelector(".text-input-container .send-btn");

      if (input.value.trim()) {
        sendBtn.disabled = false;
      } else {
        sendBtn.disabled = true;
      }
    });
}
init();
