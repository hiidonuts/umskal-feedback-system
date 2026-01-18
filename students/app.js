let currentSlide = 0;
let slideInterval;
let currentLanguage = 'en';
let chatSessionId = null;
let currentUserId = null;
let chatHistoryLoaded = false;

async function initializeUserSession() {
    try {
        const response = await fetch('../api/session.php?action=check');
        const data = await response.json();
        if (data.authenticated) {
            currentUserId = data.user_id;
            console.log('User authenticated:', currentUserId);
        } else {
            console.log('User not authenticated');
            chatSessionId = generateSessionId();
        }
    } catch (error) {
        console.error('Could not fetch user session:', error);
        chatSessionId = generateSessionId();
    }
}

async function initializeChatSession() {
    if (!currentUserId) {
        console.log('No user ID, creating new session');
        chatSessionId = generateSessionId();
        return;
    }
    
    try {
        console.log('Loading chat sessions for user:', currentUserId);
        const response = await fetch(`load-chat.php?user_id=${currentUserId}`);
        const data = await response.json();
        
        console.log('Load chat response:', data);
        
        if (!data.success) {
            console.error('API returned error:', data.error);
            chatSessionId = generateSessionId();
            return;
        }
        
        if (data.success && data.data && data.data.length > 0) {
            populateSidebarSessions(data.data);
            
            chatSessionId = data.data[0].session_key;
            console.log('Using existing session:', chatSessionId);
            await loadChatHistory();
        } else {
            chatSessionId = generateSessionId();
            console.log('Creating new session:', chatSessionId);
            clearSidebarSessions();
        }
    } catch (error) {
        console.error('Could not initialize chat session:', error);
        chatSessionId = generateSessionId();
        clearSidebarSessions();
    }
}

async function deleteChatSession(sessionKey) {
    if (!sessionKey || sessionKey === 'current') return;
    
    if (!confirm(currentLanguage === 'bm' 
        ? 'Adakah anda pasti ingin memadam sembang ini?' 
        : 'Are you sure you want to delete this chat?')) {
        return;
    }
    
    try {
        const response = await fetch('save-chat.php', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: sessionKey,
                user_id: currentUserId
            })
        });
        
        const result = await response.json();
        if (result.success) {
            console.log('Chat session deleted from database');
            
            const sessionItem = document.querySelector(`[data-session="${sessionKey}"]`);
            if (sessionItem) {
                sessionItem.style.opacity = '0';
                sessionItem.style.transition = 'opacity 0.3s ease';
                setTimeout(() => {
                    sessionItem.remove();
                    console.log('Session removed from sidebar');
                }, 300);
            }
            
            setTimeout(() => {
                loadChatSessions();
            }, 400);
        } else {
            alert(currentLanguage === 'bm' 
                ? 'Gagal memadam sembang. Sila cuba lagi.' 
                : 'Failed to delete chat. Please try again.');
        }
    } catch (error) {
        console.error('Error deleting chat session:', error);
        alert(currentLanguage === 'bm' 
            ? 'Ralat memadam sembang. Sila cuba lagi.' 
            : 'Error deleting chat. Please try again.');
    }
}

function populateSidebarSessions(sessions) {
    const sidebarSessions = document.getElementById('sidebarSessions');
    if (!sidebarSessions) {
        console.error('sidebarSessions element not found');
        return;
    }
    
    if (!sessions || sessions.length === 0) {
        console.log('No sessions to populate');
        clearSidebarSessions();
        return;
    }
    
    console.log('Populating sidebar with', sessions.length, 'sessions');
    
    sidebarSessions.innerHTML = '';
    
    sessions.forEach((session, index) => {
        console.log(`Session ${index}:`, session);
        const sessionDiv = document.createElement('div');
        sessionDiv.className = `session-item ${index === 0 ? 'active' : ''}`;
        sessionDiv.setAttribute('data-session', session.session_key);
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'session-time';
        timeDiv.textContent = formatSessionDate(session.started_at);
        
        const previewDiv = document.createElement('div');
        previewDiv.className = 'session-preview';
        previewDiv.textContent = session.preview ? session.preview.substring(0, 50) + '...' : 'No messages';
        
        sessionDiv.appendChild(timeDiv);
        sessionDiv.appendChild(previewDiv);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'session-delete-btn';
        deleteBtn.title = currentLanguage === 'bm' ? 'Padam sembang' : 'Delete chat';
        deleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChatSession(session.session_key);
        });
        sessionDiv.appendChild(deleteBtn);
        
        sidebarSessions.appendChild(sessionDiv);
        
        sessionDiv.addEventListener('click', (e) => {
            e.preventDefault();
            loadSessionChat(session.session_key);
        });
    });
    
    console.log('Sidebar populated with', sessions.length, 'sessions');
}

function clearSidebarSessions() {
    const sidebarSessions = document.getElementById('sidebarSessions');
    if (!sidebarSessions) return;
    
    sidebarSessions.innerHTML = `
        <div class="session-item active" data-session="current">
            <div class="session-time">Today</div>
            <div class="session-preview">New conversation</div>
        </div>
    `;
}

function formatSessionDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
}

async function loadSessionChat(sessionKey) {
    if (!currentUserId || !sessionKey) return;
    
    try {
        console.log('Loading chat for session:', sessionKey);
        const response = await fetch(`load-chat.php?user_id=${currentUserId}&session_id=${sessionKey}`);
        const data = await response.json();
        
        console.log('Session chat response:', data);
        
        if (data.success && data.data && data.data.length > 0) {
            const messagesContainer = document.getElementById('chatbotMessages');
            if (!messagesContainer) return;

            const mainChatSection = document.getElementById('mainChatSection');
            const feedbackSection = document.getElementById('feedbackSection');
            if (feedbackSection && feedbackSection.style.display === 'flex') {
                feedbackSection.style.display = 'none';
                mainChatSection.style.display = 'flex';
                resetFeedbackState();
            }

            messagesContainer.innerHTML = '';

            data.data.forEach(msg => {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${msg.message_role}-message`;
                
                if (msg.message_role === 'bot' && typeof parseMarkdownToHtml === 'function') {
                    messageDiv.innerHTML = parseMarkdownToHtml(msg.message_text);
                } else {
                    const messageText = document.createElement('p');
                    messageText.textContent = msg.message_text;
                    messageDiv.appendChild(messageText);
                }
                
                messagesContainer.appendChild(messageDiv);
            });
            
            const sessionItems = document.querySelectorAll('.session-item');
            sessionItems.forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('data-session') === sessionKey) {
                    item.classList.add('active');
                }
            });
            
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            chatSessionId = sessionKey;
            console.log('Session chat loaded successfully');
        }
    } catch (error) {
        console.error('Could not load session chat:', error);
    }
}

function startNewChat() {
    console.log('Starting new chat');
    
    const messagesContainer = document.getElementById('chatbotMessages');
    const sidebarSessions = document.getElementById('sidebarSessions');
    
    const previousSessionId = chatSessionId;
    chatSessionId = generateSessionId();
    chatHistoryLoaded = false;
    
    console.log('Previous session:', previousSessionId, 'New session:', chatSessionId);
    
    if (messagesContainer) {
        messagesContainer.innerHTML = `
            <div class="message bot-message">
                <p data-en="Hello! I'm Aiva. I'll help you with any questions about UMSKAL's feedback system. How can I assist you today?"
                   data-bm="Helo! Saya Aiva. Saya akan membantu anda dengan sebarang soalan tentang sistem maklum balas UMSKAL. Bagaimana saya boleh membantu anda hari ini?">
                   Hello! I'm Aiva. I'll help you with any questions about UMSKAL. How can I assist you today?
                </p>
            </div>
        `;
        messagesContainer.scrollTop = 0;
    }
    
    if (currentUserId) {
        registerNewChatSession(chatSessionId);
    }
    
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.focus();
    }
    
    console.log('New chat session created:', chatSessionId);
}

async function loadChatSessions() {
    if (!currentUserId) return;
    
    try {
        console.log('Loading chat sessions for user:', currentUserId);
        const response = await fetch(`load-chat.php?user_id=${currentUserId}`);
        const data = await response.json();
        
        console.log('Chat sessions response:', data);
        
        if (data.success && data.data && data.data.length > 0) {
            populateSidebarSessions(data.data);
        }
    } catch (error) {
        console.error('Error loading chat sessions:', error);
    }
}

async function registerNewChatSession(sessionId) {
    if (!currentUserId || !sessionId) return;
    
    try {
        console.log('Registering new chat session:', sessionId);

        const response = await fetch('save-chat.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: sessionId,
                message: 'New chat session started',
                sender: 'system',
                language: currentLanguage,
                user_id: currentUserId
            })
        });
        
        const result = await response.json();
        if (result.success) {
            console.log('Chat session registered in database');
            setTimeout(() => {
                loadChatSessions();
            }, 300);
        } else {
            console.error('Error registering session:', result.error);
        }
    } catch (error) {
        console.error('Error registering chat session:', error);
    }
}

async function loadChatHistory() {
    if (!currentUserId || !chatSessionId || chatHistoryLoaded) {
        console.log('Skipping chat history load - already loaded or missing params');
        return;
    }
    
    try {
        console.log('Loading chat history for session:', chatSessionId);
        const response = await fetch(`load-chat.php?user_id=${currentUserId}&session_id=${chatSessionId}`);
        const data = await response.json();
        
        console.log('Chat history response:', data);
        
        if (data.success && data.data && data.data.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const messagesContainer = document.getElementById('chatbotMessages');
            if (!messagesContainer) {
                console.error('Messages container not found');
                return;
            }

            messagesContainer.innerHTML = '';
            
            data.data.forEach(msg => {
                const messageDiv = document.createElement('div');
                messageDiv.className = `message ${msg.message_role}-message`;
                
                if (msg.message_role === 'bot' && typeof parseMarkdownToHtml === 'function') {
                    messageDiv.innerHTML = parseMarkdownToHtml(msg.message_text);
                } else {
                    const messageText = document.createElement('p');
                    messageText.textContent = msg.message_text;
                    messageDiv.appendChild(messageText);
                }
                
                messagesContainer.appendChild(messageDiv);
            });
            
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
            chatHistoryLoaded = true;
            console.log('Chat history loaded successfully');
        } else {
            console.log('No chat history found');
        }
    } catch (error) {
        console.error('Could not load chat history:', error);
    }
}

function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function checkAuthenticationStatus() {
    const candidates = [
        '/ums_feedback_system/api/session.php?action=check',
        '../api/session.php?action=check',
        '/api/session.php?action=check'
    ];

    for (const url of candidates) {
        try {
            const response = await fetch(url, { method: 'GET', credentials: 'include' });
            if (!response.ok) continue;
            const data = await response.json();
            if (typeof data.authenticated !== 'undefined') {
                return data.authenticated ? data : null;
            }
        } catch (e) {

        }
    }

    console.warn('Failed to check auth: no reachable session endpoint');
    return null;
}

function initSlider() {
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');

    function showSlide(index) {
        slides.forEach(slide => slide.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));

        if (index >= slides.length) {
            currentSlide = 0;
        } else if (index < 0) {
            currentSlide = slides.length - 1;
        } else {
            currentSlide = index;
        }

        slides[currentSlide].classList.add('active');
        dots[currentSlide].classList.add('active');
    }

    function nextSlide() {
        showSlide(currentSlide + 1);
    }

    function prevSlide() {
        showSlide(currentSlide - 1);
    }

    document.querySelector('.next').addEventListener('click', () => {
        nextSlide();
        resetInterval();
    });

    document.querySelector('.prev').addEventListener('click', () => {
        prevSlide();
        resetInterval();
    });

    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            showSlide(index);
            resetInterval();
        });
    });

    function startInterval() {
        slideInterval = setInterval(nextSlide, 5000);
    }

    function resetInterval() {
        clearInterval(slideInterval);
        startInterval();
    }

    startInterval();
}

function initLanguageToggle() {
    const langToggle = document.getElementById('langToggle');
    const langOptions = document.querySelectorAll('.lang-option');

    langOptions.forEach(option => {
        option.addEventListener('click', () => {
            const lang = option.getAttribute('data-lang');
            switchLanguage(lang);
        });
    });
}

function initFacilitiesSlider() {
    const panels = document.querySelectorAll('.facility-panel');
    let current = 0;
    const total = panels.length;
    let intervalId = null;
    const DURATION = 6000;

    panels.forEach((panel, idx) => {
        const card = panel.querySelector('.facility-card');
        if (!card) return;

        const info = card.querySelector('.facility-info');
        if (info && !info.querySelector('.subhead')) {
            const sub = document.createElement('small');
            sub.className = 'subhead';
            sub.setAttribute('data-en', 'Our Facilities');
            sub.setAttribute('data-bm', 'Kemudahan Kami');
            sub.textContent = 'Our Facilities';
            const intro = document.createElement('p');
            intro.className = 'facilities-intro';
            intro.setAttribute('data-en', "Explore UMSKAL's campus facilities: modern learning spaces, labs, libraries and student services designed to support your success.");
            intro.setAttribute('data-bm', 'Terokai kemudahan kampus UMSKAL: ruang pembelajaran moden, makmal, perpustakaan dan perkhidmatan pelajar yang direka untuk menyokong kejayaan anda.');
            intro.textContent = "Explore UMSKAL's campus facilities: modern learning spaces, labs, libraries and student services designed to support your success.";

            info.insertBefore(intro, info.firstChild);
            info.insertBefore(sub, intro);
        }

        if (!card.querySelector('.card-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'card-overlay';
            
            const pagination = document.createElement('div');
            pagination.className = 'card-pagination';
            pagination.textContent = String(idx + 1).padStart(2, '0') + '/' + String(total).padStart(2, '0');
            
            const titleElement = info.querySelector('.facility-title');
            const titleClone = titleElement ? titleElement.cloneNode(true) : null;

            const progress = document.createElement('div');
            progress.className = 'card-progress';

            for (let i = 0; i < total; i++) {
                const seg = document.createElement('div');
                seg.className = 'segment';
                const fill = document.createElement('div');
                fill.className = 'fill';
                seg.appendChild(fill);
                progress.appendChild(seg);
            }

            overlay.appendChild(pagination);
            if (titleClone) {
                overlay.appendChild(titleClone);
            }
            overlay.appendChild(progress);
            card.appendChild(overlay);

            if (titleElement) {
                titleElement.style.display = 'none';
            }
        }
    });

    function showPanel(index) {
        if (index >= total) index = 0;
        if (index < 0) index = total - 1;
        current = index;

        panels.forEach(p => p.classList.remove('active'));
        panels[current].classList.add('active');

        panels.forEach((p, i) => {
            const pag = p.querySelector('.card-pagination');
            if (pag) pag.textContent = String(current + 1).padStart(2, '0') + '/' + String(total).padStart(2, '0');
        });

        panels.forEach((p) => {
            const fills = p.querySelectorAll('.card-progress .fill');
            fills.forEach(f => f.style.width = '0%');
        });

        const underline = panels[current].querySelector('.facility-underline');
        if (underline) {
            underline.style.width = '0%';
            void underline.offsetWidth;
            underline.style.width = '100%';
        }

        const currentFills = panels[current].querySelectorAll('.card-progress .fill');
        if (currentFills.length) {
            void currentFills[current].offsetWidth;
            currentFills[current].style.width = '100%';
        }
    }

    function nextPanel() {
        showPanel(current + 1);
    }

    function startAuto() {
        stopAuto();
        intervalId = setInterval(nextPanel, DURATION);
    }

    function stopAuto() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    }

    let autoPlayEnabled = true;
    const slider = document.getElementById('facilitySlider');
    if (slider) {
        slider.addEventListener('mouseenter', () => {
            autoPlayEnabled = false;
            stopAuto();
        });
        slider.addEventListener('mouseleave', () => {
            autoPlayEnabled = true;
            startAuto();
        });
        slider.addEventListener('focusin', () => {
            autoPlayEnabled = false;
            stopAuto();
        });
        slider.addEventListener('focusout', () => {
            autoPlayEnabled = true;
            startAuto();
        });
    }

    if (total > 0) {
        showPanel(0);
        startAuto();
    }
}

function switchLanguage(lang) {
    currentLanguage = lang;
    const langOptions = document.querySelectorAll('.lang-option');

    langOptions.forEach(option => {
        option.classList.remove('active');
        if (option.getAttribute('data-lang') === lang) {
            option.classList.add('active');
        }
    });

    const elements = document.querySelectorAll('[data-en], [data-bm]');
    elements.forEach(element => {
        const text = element.getAttribute(`data-${lang}`);
        if (text) {
            if (element.tagName === 'INPUT') {
                element.placeholder = text;
            } else {
                element.textContent = text;
            }
        }
    });

    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.placeholder = chatInput.getAttribute(`data-${lang}-placeholder`);
    }
}

function initChatbot() {
    const chatbotClosed = document.getElementById('chatbotClosed');
    const chatbotOpen = document.getElementById('chatbotOpen');
    const minimizeChat = document.getElementById('minimizeChat');
    const closeChat = document.getElementById('closeChat');
    const sendMessage = document.getElementById('sendMessage');
    const chatInput = document.getElementById('chatInput');
    const toggleFullscreen = document.getElementById('toggleFullscreen');
    const closeSidebar = document.getElementById('closeSidebar');

    chatbotClosed.addEventListener('click', () => {
        chatbotClosed.style.display = 'none';
        chatbotOpen.style.display = 'flex';
        document.getElementById('notificationBadge').style.display = 'none';
    });

    minimizeChat.addEventListener('click', () => {
        chatbotOpen.style.display = 'none';
        chatbotClosed.style.display = 'flex';
        if (chatbotOpen.classList.contains('fullscreen')) {
            exitChatFullscreen(chatbotOpen, toggleFullscreen);
        }
    });

    closeChat.addEventListener('click', () => {
        chatbotOpen.style.display = 'none';
        chatbotClosed.style.display = 'flex';
        if (chatbotOpen.classList.contains('fullscreen')) {
            exitChatFullscreen(chatbotOpen, toggleFullscreen);
        }
    });

    sendMessage.addEventListener('click', sendChatMessage);

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    if (toggleFullscreen) {
        toggleFullscreen.addEventListener('click', () => {
            toggleChatFullscreen(chatbotOpen, toggleFullscreen);
        });
    }

    if (closeSidebar) {
        closeSidebar.addEventListener('click', () => {
            if (chatbotOpen.classList.contains('fullscreen')) {
                exitChatFullscreen(chatbotOpen, toggleFullscreen);
            }
        });
    }
}

function initFeedbackChat() {
    const submitFeedbackBtn = document.getElementById('sidebarSubmitFeedback');
    const feedbackBackBtn = document.getElementById('feedbackBackBtn');
    const sendFeedbackBtn = document.getElementById('sendFeedback');
    const feedbackInput = document.getElementById('feedbackInput');
    const minimizeChat2 = document.getElementById('minimizeChat2');
    const closeChat2 = document.getElementById('closeChat2');
    const toggleFullscreen2 = document.getElementById('toggleFullscreen2');
    const chatbotOpen = document.getElementById('chatbotOpen');

    if (submitFeedbackBtn) {
        submitFeedbackBtn.addEventListener('click', switchToFeedback);
    }

    if (feedbackBackBtn) {
        feedbackBackBtn.addEventListener('click', switchToMainChat);
    }

    if (sendFeedbackBtn) {
        sendFeedbackBtn.addEventListener('click', sendFeedbackMessage);
    }

    if (feedbackInput) {
        feedbackInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendFeedbackMessage();
            }
        });
    }

    if (minimizeChat2) {
        minimizeChat2.addEventListener('click', () => {
            chatbotOpen.style.display = 'none';
            document.getElementById('chatbotClosed').style.display = 'flex';
            if (chatbotOpen.classList.contains('fullscreen')) {
                exitChatFullscreen(chatbotOpen, toggleFullscreen2);
            }
        });
    }

    if (closeChat2) {
        closeChat2.addEventListener('click', () => {
            chatbotOpen.style.display = 'none';
            document.getElementById('chatbotClosed').style.display = 'flex';
            if (chatbotOpen.classList.contains('fullscreen')) {
                exitChatFullscreen(chatbotOpen, toggleFullscreen2);
            }
        });
    }

    if (toggleFullscreen2) {
        toggleFullscreen2.addEventListener('click', () => {
            toggleChatFullscreen(chatbotOpen, toggleFullscreen2);
        });
    }
}

function initSidebarSessions() {
    console.log('Sidebar sessions initialized');
}

function switchToFeedback() {
    const mainChatSection = document.getElementById('mainChatSection');
    const feedbackSection = document.getElementById('feedbackSection');
    const chatBackBtn = document.getElementById('chatBackBtn');

    mainChatSection.style.display = 'none';
    feedbackSection.style.display = 'flex';
    chatBackBtn.style.display = 'none';

    resetFeedbackState();

    const feedbackMessages = document.getElementById('feedbackMessages');
    feedbackMessages.innerHTML = '';

    if (!currentUserId) {
        const loginMessage = currentLanguage === 'bm'
            ? 'Nampaknya anda belum masuk. Sila masuk untuk menggunakan ciri ini.'
            : 'It seems like you aren\'t signed in. Please sign in to use this feature.';
        
        addMessageToFeedbackChat(loginMessage, 'bot');
        
        const feedbackInput = document.getElementById('feedbackInput');
        if (feedbackInput) {
            feedbackInput.disabled = true;
            feedbackInput.placeholder = currentLanguage === 'bm' ? 'Sila masuk terlebih dahulu' : 'Please sign in first';
        }
        
        return;
    }

    feedbackState.isSubmittingFeedback = true;

    const prompt = getPromptText('greeting') + '\n\n';
    const categoryList = FEEDBACK_CATEGORIES.map((cat, idx) => 
        `${idx + 1}. ${currentLanguage === 'bm' ? cat.labelBm : cat.label}`
    ).join('\n');

    addMessageToFeedbackChat(prompt + categoryList, 'bot');

    const feedbackInput = document.getElementById('feedbackInput');
    if (feedbackInput) {
        feedbackInput.disabled = false;
        feedbackInput.placeholder = getPromptText('enterCategory');
        feedbackInput.focus();
    }
}

function switchToMainChat() {
    const mainChatSection = document.getElementById('mainChatSection');
    const feedbackSection = document.getElementById('feedbackSection');
    const chatBackBtn = document.getElementById('chatBackBtn');

    feedbackSection.style.display = 'none';
    mainChatSection.style.display = 'flex';
    chatBackBtn.style.display = 'none';

    resetFeedbackState();

    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.focus();
    }
}

async function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendMessage');
    const message = chatInput.value.trim();

    if (window.chatCooldownActive) {
        return;
    }

    if (!message) return;

    startChatCooldown(30); 

    addMessageToChat(message, 'user');
    chatInput.value = '';

    await saveChatMessage(message, 'user');

    showTypingIndicator();

    const botResponse = await getBotResponse(message);

    removeTypingIndicator();
    
    setTimeout(() => {
        addMessageToChat(botResponse, 'bot');
        saveChatMessage(botResponse, 'bot');
    }, 300);
}

async function sendFeedbackMessage() {
    const feedbackInput = document.getElementById('feedbackInput');
    const feedbackMessages = document.getElementById('feedbackMessages');
    const message = feedbackInput.value.trim();

    if (!message) return;

    const userDiv = document.createElement('div');
    userDiv.className = 'message user-message';
    const formattedUserMsg = escapeHtml(message).replace(/\n/g, '<br>');
    userDiv.innerHTML = `<p>${formattedUserMsg}</p>`;
    feedbackMessages.appendChild(userDiv);
    feedbackInput.value = '';
    feedbackMessages.scrollTop = feedbackMessages.scrollHeight;

    const handled = handleFeedbackResponse(message);

    if (!feedbackState.isSubmittingFeedback && handled && feedbackState.feedbackContent) {
        setTimeout(() => {
            switchToMainChat();
            resetFeedbackState();
        }, 2000);
    }
}

window.chatCooldownActive = false;
window.chatCooldownTimer = null;
window.chatCooldownRemaining = 0;

function startChatCooldown(seconds) {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendMessage');
    const notice = document.getElementById('cooldownNotice');
    const secondsSpan = document.getElementById('cooldownSeconds');

    if (window.chatCooldownTimer) {
        clearInterval(window.chatCooldownTimer);
        window.chatCooldownTimer = null;
    }

    window.chatCooldownActive = true;
    window.chatCooldownRemaining = seconds;

    if (chatInput) {
        chatInput.classList.add('chat-input-disabled');
        chatInput.setAttribute('readonly', 'readonly');
        chatInput.blur();
        chatInput.style.cursor = 'not-allowed';
    }
    if (sendBtn) {
        sendBtn.classList.add('send-btn-disabled');
        sendBtn.disabled = true;
    }
    if (notice && secondsSpan) {
        secondsSpan.textContent = window.chatCooldownRemaining;
        notice.style.display = 'block';
    }

    window.chatCooldownTimer = setInterval(() => {
        window.chatCooldownRemaining -= 1;
        if (secondsSpan) secondsSpan.textContent = window.chatCooldownRemaining;

        if (window.chatCooldownRemaining <= 0) {
            clearInterval(window.chatCooldownTimer);
            window.chatCooldownTimer = null;
            window.chatCooldownActive = false;

            if (chatInput) {
                chatInput.classList.remove('chat-input-disabled');
                chatInput.removeAttribute('readonly');
                chatInput.style.cursor = '';
            }
            if (sendBtn) {
                sendBtn.classList.remove('send-btn-disabled');
                sendBtn.disabled = false;
            }
            if (notice) notice.style.display = 'none';
        }
    }, 1000);
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('chatbotMessages');
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'message bot-message typing-indicator';
    
    typingDiv.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function parseMarkdownToHtml(markdown) {
    const lines = markdown.split('\n');
    let html = '';
    let inList = false;
    let inParagraph = false;
    let buffer = [];

    lines.forEach((line, index) => {
        const trimmedLine = line.trim();

        if (/^### /.test(trimmedLine)) {
            if (inParagraph && buffer.length > 0) {
                html += '<p>' + buffer.join('<br>') + '</p>\n';
                buffer = [];
                inParagraph = false;
            }

            if (inList) {
                html += '</ul>\n';
                inList = false;
            }

            const headerText = trimmedLine.replace(/^### /, '');
            html += '<h3>' + escapeHtml(headerText) + '</h3>\n';
            return;
        }
        if (/^## /.test(trimmedLine)) {
            if (inParagraph && buffer.length > 0) {
                html += '<p>' + buffer.join('<br>') + '</p>\n';
                buffer = [];
                inParagraph = false;
            }
            if (inList) {
                html += '</ul>\n';
                inList = false;
            }
            const headerText = trimmedLine.replace(/^## /, '');
            html += '<h2>' + escapeHtml(headerText) + '</h2>\n';
            return;
        }
        if (/^# /.test(trimmedLine)) {
            if (inParagraph && buffer.length > 0) {
                html += '<p>' + buffer.join('<br>') + '</p>\n';
                buffer = [];
                inParagraph = false;
            }
            if (inList) {
                html += '</ul>\n';
                inList = false;
            }
            const headerText = trimmedLine.replace(/^# /, '');
            html += '<h1>' + escapeHtml(headerText) + '</h1>\n';
            return;
        }

        if (/^\* /.test(trimmedLine) || /^\d+\. /.test(trimmedLine)) {
            if (inParagraph && buffer.length > 0) {
                html += '<p>' + buffer.join('<br>') + '</p>\n';
                buffer = [];
                inParagraph = false;
            }

            if (!inList) {
                html += '<ul>\n';
                inList = true;
            }

            const itemText = trimmedLine.replace(/^\* /, '').replace(/^\d+\. /, '');
            const processedText = processInlineMarkdown(itemText);
            html += '<li>' + processedText + '</li>\n';
            return;
        }

        if (trimmedLine === '') {
            if (inParagraph && buffer.length > 0) {
                html += '<p>' + buffer.join('<br>') + '</p>\n';
                buffer = [];
                inParagraph = false;
            }
            if (inList) {
                html += '</ul>\n';
                inList = false;
            }
            return;
        }

        if (!inList) {
            inParagraph = true;
            const processedLine = processInlineMarkdown(trimmedLine);
            buffer.push(processedLine);
        }
    });

    if (inParagraph && buffer.length > 0) {
        html += '<p>' + buffer.join('<br>') + '</p>\n';
    }
    if (inList) {
        html += '</ul>\n';
    }

    return html.trim();
}

function processInlineMarkdown(text) {
    return text
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>')
        .replace(/\*([^\*]+?)\*/g, '<em>$1</em>')
        .replace(/_([^_]+?)_/g, '<em>$1</em>');
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>\"']/g, m => map[m]);
}

function addMessageToChat(message, sender) {
    const messagesContainer = document.getElementById('chatbotMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;

    if (sender === 'bot') {
        messageDiv.innerHTML = parseMarkdownToHtml(message);
    } else {
        const messageText = document.createElement('p');
        messageText.textContent = message;
        messageDiv.appendChild(messageText);
    }

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    const chatbotOpen = document.getElementById('chatbotOpen');
    if (chatbotOpen && chatbotOpen.classList.contains('fullscreen')) {
        updateChatHistorySidebar();
    }
}

function isSensitiveTopic(message) {
    const sensitiveKeywords = {
        politics: ['politics', 'political', 'election', 'politician', 'president', 'minister', 'parliament', 'government policy', 'vote', 'party', 'senator', 'congress', 'politic', 'pemilihan', 'pilihan raya', 'politik', 'kerajaan', 'menteri', 'perdana menteri'],
        religion: ['religion', 'religious', 'god', 'allah', 'jesus', 'church', 'mosque', 'temple', 'prayer', 'faith', 'belief', 'hindu', 'buddhist', 'jewish', 'christian', 'islam', 'agama', 'sembahyang', 'masjid', 'gereja', 'tuhan'],
        race: ['race', 'racism', 'racist', 'racial', 'ethnicity', 'ethnic', 'discrimination', 'bumiputera', 'indigenous', 'bangsa', 'suku', 'perkauman', 'kaum'],
        offensive: ['controversy', 'controversies', 'controversial', 'hate', 'violence', 'kill', 'attack', 'harm', 'abuse', 'bully', 'bullying', 'harassment', 'sexual', 'inappropriate', 'crude', 'vulgar', 'kekerasan', 'bunuh', 'serang' ]
    };
    
    const lowerMessage = message.toLowerCase().trim();
    
    for (const [category, keywords] of Object.entries(sensitiveKeywords)) {
        for (const keyword of keywords) {
            if (lowerMessage.includes(keyword)) {
                return true;
            }
        }
    }
    
    return false;
}

function getSensitiveTopicResponse() {
    return currentLanguage === 'bm'
        ? 'Maaf, saya tidak boleh menjawab pertanyaan tentang topik sensitif seperti politik, agama, atau perkauman. Saya di sini untuk membantu dengan pertanyaan tentang UMSKAL dan sistem maklum balas. Bolehkah saya membantu anda dengan sesuatu yang lain?'
        : 'I appreciate your question, but I cannot discuss sensitive topics such as politics, religion, or race. I\'m here to help with questions about UMSKAL and our feedback system. Is there anything else I can help you with?';
}

async function getBotResponse(userMessage) {
    if (isSensitiveTopic(userMessage)) {
        return getSensitiveTopicResponse();
    }
    
    try {
        const response = await fetch('get-bot-response-improved.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: userMessage,
                language: currentLanguage
            })
        });

        const data = await response.json();
        
        if (!response.ok || !data.success) {
            console.error('Bot response error:', data);
            return currentLanguage === 'bm'
                ? 'Maaf, saya mengalami masalah teknikal. Sila cuba lagi.'
                : 'Sorry, I\'m experiencing technical difficulties. Please try again.';
        }
        
        return data.message;
    } catch (error) {
        console.error('Error getting bot response:', error);
        return currentLanguage === 'bm'
            ? 'Maaf, saya mengalami masalah teknikal. Sila cuba lagi.'
            : 'Sorry, I\'m experiencing technical difficulties. Please try again.';
    }
}

async function saveChatMessage(message, sender) {
    try {
        const response = await fetch('save-chat.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: chatSessionId,
                message: message,
                sender: sender,
                language: currentLanguage,
                user_id: currentUserId
            })
        });

        const result = await response.json();
        if (!result.success) {
            console.error('Error saving chat message:', result.error);
        }
    } catch (error) {
        console.error('Error saving chat message:', error);
    }
}

function toggleChatFullscreen(chatbotOpenEl, toggleBtn) {
    if (!chatbotOpenEl) return;
    const isFS = chatbotOpenEl.classList.toggle('fullscreen');
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-pressed', isFS ? 'true' : 'false');
        toggleBtn.setAttribute('aria-label', isFS ? 'Exit fullscreen' : 'Enter fullscreen');
        toggleBtn.setAttribute('title', isFS ? 'Exit fullscreen' : 'Expand chat');
    }
    if (isFS) {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        updateChatHistorySidebar();
    } else {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
    }
}

function exitChatFullscreen(chatbotOpenEl, toggleBtn) {
    if (!chatbotOpenEl) return;
    chatbotOpenEl.classList.remove('fullscreen');
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-pressed', 'false');
        toggleBtn.setAttribute('aria-label', 'Enter fullscreen');
        toggleBtn.setAttribute('title', 'Expand chat');
    }
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
}

function updateChatHistorySidebar() {
    const sidebarSessions = document.getElementById('sidebarSessions');
    if (!sidebarSessions) return;
    
    const messagesContainer = document.getElementById('chatbotMessages');
    if (!messagesContainer) return;
    
    const messages = messagesContainer.querySelectorAll('.message');
    let preview = 'New conversation';
    
    if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        const text = lastMessage.textContent.trim();
        preview = text.substring(0, 40) + (text.length > 40 ? '...' : '');
    }
    
    const currentSessionItem = sidebarSessions.querySelector('.session-item.active');
    if (currentSessionItem) {
        const previewEl = currentSessionItem.querySelector('.session-preview');
        if (previewEl) {
            previewEl.textContent = preview;
        }
    }
}

function openChatbot() {
    document.getElementById('chatbotClosed').style.display = 'none';
    document.getElementById('chatbotOpen').style.display = 'flex';
}

function openChatbotFeedback() {
    openChatbot();
    switchToFeedback();
}

function initFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    const closeModal = document.querySelector('.close-modal');
    const form = document.getElementById('feedbackForm');

    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
        modal.classList.remove('active');
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
            studentName: document.getElementById('studentName').value,
            studentId: document.getElementById('studentId').value,
            email: document.getElementById('email').value,
            category: document.getElementById('category').value,
            message: document.getElementById('message').value,
            language: currentLanguage,
            user_id: currentUserId 
        };

        try {
            const response = await fetch('submit-feedback.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                alert(currentLanguage === 'bm'
                    ? 'Maklum balas anda telah berjaya dihantar! Terima kasih.'
                    : 'Your feedback has been submitted successfully! Thank you.');
                form.reset();
                modal.style.display = 'none';
                modal.classList.remove('active');
                loadStatistics();
            } else {
                alert(currentLanguage === 'bm'
                    ? 'Ralat menghantar maklum balas. Sila cuba lagi.'
                    : 'Error submitting feedback. Please try again.');
            }
        } catch (error) {
            console.error('Error submitting feedback:', error);
            alert(currentLanguage === 'bm'
                ? 'Ralat menghantar maklum balas. Sila cuba lagi.'
                : 'Error submitting feedback. Please try again.');
        }
    });
}

function openFeedbackForm() {
    const modal = document.getElementById('feedbackModal');
    modal.style.display = 'block';
    modal.classList.add('active');
}

async function loadStatistics() {
    try {
        const response = await fetch('get-statistics.php');
        const stats = await response.json();

        if (stats.success && stats.data) {
            const totalSubmissionsEl = document.getElementById('totalSubmissions');
            const avgResponseTimeEl = document.getElementById('avgResponseTime');
            const issuesResolvedEl = document.getElementById('issuesResolved');
            const satisfactionEl = document.getElementById('satisfaction');
            
            if (totalSubmissionsEl) {
                totalSubmissionsEl.textContent = stats.data.total_submissions.toLocaleString();
            }
            if (avgResponseTimeEl) {
                avgResponseTimeEl.textContent = stats.data.avg_response_time;
            }
            if (issuesResolvedEl) {
                issuesResolvedEl.textContent = stats.data.issues_resolved.toLocaleString();
            }
            if (satisfactionEl) {
                satisfactionEl.textContent = stats.data.satisfaction_rate + '%';
            }
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await initializeUserSession();
    
    initSlider();
    initLanguageToggle();
    initChatbot();
    initFeedbackChat();
    initSidebarSessions();
    initFeedbackModal();
    initFacilitiesSlider();
    loadStatistics();
    initAuthUI();
    initProfileSidebar();

    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', startNewChat);
    }
    
    const newChatBtn2 = document.getElementById('newChatBtn2');
    if (newChatBtn2) {
        newChatBtn2.addEventListener('click', startNewChat);
    }
    
    await initializeChatSession();

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const chatbotOpen = document.getElementById('chatbotOpen');
            const toggleFullscreen = document.getElementById('toggleFullscreen');
            if (chatbotOpen && chatbotOpen.classList.contains('fullscreen')) {
                exitChatFullscreen(chatbotOpen, toggleFullscreen);
                e.preventDefault();
            }
        }
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offset = 80;
                const targetPosition = target.offsetTop - offset;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
});


const DEFAULT_PROFILE_PIC = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23d0d0d0'/%3E%3Ccircle cx='50' cy='35' r='15' fill='%23a0a0a0'/%3E%3Cellipse cx='50' cy='70' rx='20' ry='18' fill='%23a0a0a0'/%3E%3C/svg%3E";

const FEEDBACK_CATEGORIES = [
    { id: 'facilities', label: 'Facilities', labelBm: 'Kemudahan' },
    { id: 'academics', label: 'Academics', labelBm: 'Akademik' },
    { id: 'administration', label: 'Administration', labelBm: 'Pentadbiran' },
    { id: 'services', label: 'Services', labelBm: 'Perkhidmatan' },
    { id: 'dormitory', label: 'Dormitory', labelBm: 'Asrama' },
    { id: 'other', label: 'Other', labelBm: 'Lain-lain' }
];

let feedbackState = {
    isSubmittingFeedback: false,
    selectedCategory: null,
    feedbackContent: ''
};

function resetFeedbackState() {
    feedbackState = {
        isSubmittingFeedback: false,
        selectedCategory: null,
        feedbackContent: ''
    };
}

function getCategoryLabel(category) {
    const cat = FEEDBACK_CATEGORIES.find(c => c.id === category);
    if (!cat) return category;
    return currentLanguage === 'bm' ? cat.labelBm : cat.label;
}

function getPromptText(key) {
    const prompts = {
        greeting: {
            en: 'Great! I can help you submit feedback. Please choose a category:',
            bm: 'Sempurna! Saya boleh membantu anda menyerahkan maklum balas. Sila pilih kategori:'
        },
        categorySelected: {
            en: 'Now please describe your feedback in detail.',
            bm: 'Sila terangkan maklum balas anda secara terperinci.'
        },
        confirm: {
            en: 'Thank you for your feedback! Your reference number is: ',
            bm: 'Terima kasih atas maklum balas anda! Nombor rujukan anda ialah: '
        },
        appreciative: {
            en: 'We appreciate your input.',
            bm: 'Kami menghargai input anda.'
        },
        invalidSelection: {
            en: 'Invalid selection. Please enter a number between 1 and 6.',
            bm: 'Pilihan tidak sah. Sila masukkan nombor antara 1 dan 6.'
        },
        enterCategory: {
            en: 'Enter category number (1-6)...',
            bm: 'Masukkan nombor kategori (1-6)...'
        },
        submitting: {
            en: 'Submitting...',
            bm: 'Menghantar...'
        },
        error: {
            en: 'Error submitting feedback. Please try again.',
            bm: 'Ralat menghantar maklum balas. Sila cuba lagi.'
        }
    };
    
    const text = prompts[key];
    return text ? (currentLanguage === 'bm' ? text.bm : text.en) : '';
}

async function submitFeedback() {
    try {
        const response = await fetch('/ums_feedback_system/api/feedback.php?action=submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                title: `Feedback - ${feedbackState.selectedCategory}`,
                content: feedbackState.feedbackContent,
                category: feedbackState.selectedCategory
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const confirmMsg = `${getPromptText('confirm')}${data.reference}. ${getPromptText('appreciative')}`;
            addMessageToFeedbackChat(confirmMsg, 'bot');
            feedbackState.isSubmittingFeedback = false;
            return true;
        } else {
            addMessageToFeedbackChat(`${getPromptText('error')} ${data.error}`, 'bot');
            resetFeedbackState();
            return false;
        }
    } catch (error) {
        console.error('Feedback submission error:', error);
        addMessageToFeedbackChat(getPromptText('error'), 'bot');
        resetFeedbackState();
        return false;
    }
}

function addMessageToFeedbackChat(text, role) {
    const feedbackMessages = document.getElementById('feedbackMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;

    const formattedText = escapeHtml(text).replace(/\n/g, '<br>');
    messageDiv.innerHTML = `<p>${formattedText}</p>`;
    
    feedbackMessages.appendChild(messageDiv);
    feedbackMessages.scrollTop = feedbackMessages.scrollHeight;
}



function handleFeedbackResponse(userInput) {
    if (feedbackState.isSubmittingFeedback && !feedbackState.selectedCategory) {
        const input = userInput.trim().toLowerCase();
        const categoryIndex = parseInt(input) - 1;
        
        if (categoryIndex >= 0 && categoryIndex < FEEDBACK_CATEGORIES.length) {
            feedbackState.selectedCategory = FEEDBACK_CATEGORIES[categoryIndex].id;
            const categoryLabel = getCategoryLabel(feedbackState.selectedCategory);
            const msg = `${categoryLabel}. ${getPromptText('categorySelected')}`;
            addMessageToFeedbackChat(msg, 'bot');
            return true;
        } else {
            addMessageToFeedbackChat(getPromptText('invalidSelection'), 'bot');
            return true;
        }
    }
    
    if (feedbackState.isSubmittingFeedback && feedbackState.selectedCategory) {
        feedbackState.feedbackContent = userInput;
        const categoryLabel = getCategoryLabel(feedbackState.selectedCategory);
        const confirmText = currentLanguage === 'bm' 
            ? `Terima kasih atas maklum balas anda:\n\nKategori: ${categoryLabel}\nMaklum balas: "${userInput}"\n\n${getPromptText('submitting')}`
            : `Thank you for your feedback:\n\nCategory: ${categoryLabel}\nFeedback: "${userInput}"\n\n${getPromptText('submitting')}`;
        
        addMessageToFeedbackChat(confirmText, 'bot');
        
        setTimeout(() => {
            submitFeedback();
        }, 500);
        
        return true;
    }
    
    return false;
}

function getStoredUser() {
    try {
        const raw = localStorage.getItem('ums_user');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.warn('Failed to parse stored user', e);
        return null;
    }
}

function getGoogleProfilePicture(email) {
    return `https://lh3.googleusercontent.com/a/default-user?sz=200`;
}

function getMicrosoftProfilePicture(email) {
    return `https://graph.microsoft.com/v1.0/me/photo/$value`;
}

async function fetchUserProfileFromDatabase() {
    try {
        const response = await fetch('/ums_feedback_system/api/session.php?action=user', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!response.ok) return null;
        
        const data = await response.json();
        if (data.success && data.user) {
            return data.user;
        }
        return null;
    } catch (error) {
        console.warn('Failed to fetch user profile:', error);
        return null;
    }
}

async function toggleProfileSidebar() {
    const sidebar = document.getElementById('profileSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    console.log('toggleProfileSidebar called - sidebar exists:', !!sidebar);
    
    if (!sidebar) {
        console.error('Profile sidebar not found in DOM!');
        return;
    }
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    
    console.log('Sidebar active:', sidebar.classList.contains('active'));
    
    if (sidebar.classList.contains('active')) {
        await loadProfileSidebarData();
    }
}

function closeProfileSidebar() {
    const sidebar = document.getElementById('profileSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

async function loadProfileSidebarData() {
    try {
        let userData = localStorage.getItem('ums_user');
        if (userData) {
            userData = JSON.parse(userData);
        } else {
            const response = await fetch('../api/session.php?action=getUserProfile', {
                credentials: 'include'
            });
            const data = await response.json();
            userData = data.user || null;
        }
        
        if (!userData) return;
        
        const userInfo = await fetchUserProfileFromDatabase();
        if (!userInfo) return;
        
        const sidebarProfilePic = document.getElementById('sidebarProfilePic');
        if (sidebarProfilePic) {
            sidebarProfilePic.src = userData.picture || userInfo.profile_picture_url || DEFAULT_PROFILE_PIC;
        }
        
        const displayName = document.getElementById('sidebarDisplayName');
        if (displayName) {
            const name = userData.name || userInfo.display_name || userInfo.full_name || '';
            displayName.textContent = name;
            displayName.setAttribute('data-original', name);
        }

        const fullNameValue = document.getElementById('fullNameValue');
        if (fullNameValue) {
            fullNameValue.textContent = userInfo.full_name || 'Not provided';
        }
        
        const statusValue = document.getElementById('statusValue');
        if (statusValue) {
            const statusText = userInfo.status === 'active' ? 'Student (Active)' : 'Student (' + (userInfo.status || 'Pending') + ')';
            statusValue.textContent = statusText;
        }
        
        const registerTimeValue = document.getElementById('registerTimeValue');
        if (registerTimeValue && userInfo.created_at) {
            const date = new Date(userInfo.created_at);
            const formattedDate = date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            registerTimeValue.textContent = formattedDate;
        }

        await loadProfileFeedback(userInfo.id);

        await loadResolvedFeedback();
        
    } catch (error) {
        console.error('Error loading profile sidebar data:', error);
    }
}

async function loadProfileFeedback(userId) {
    try {
        const response = await fetch(`get-statistics.php?action=getUserFeedback&user_id=${userId}`);
        const data = await response.json();
        
        const feedbackList = document.getElementById('feedbackList');
        if (!feedbackList) return;
        
        if (data.success && data.feedback && data.feedback.length > 0) {
            feedbackList.innerHTML = '';
            
            data.feedback.forEach(feedback => {
                const feedbackItem = document.createElement('div');
                feedbackItem.className = 'feedback-item';
                
                const title = document.createElement('div');
                title.className = 'feedback-item-title';
                title.textContent = feedback.content.substring(0, 50) + (feedback.content.length > 50 ? '...' : '');
                
                const category = document.createElement('span');
                category.className = 'feedback-item-category';
                category.textContent = feedback.category || 'General';
                
                const status = document.createElement('span');
                status.className = 'feedback-item-status';
                status.textContent = feedback.status || 'Pending';
                
                const content = document.createElement('div');
                content.className = 'feedback-item-content';
                content.textContent = feedback.content;
                
                const date = document.createElement('div');
                date.className = 'feedback-item-date';
                const feedbackDate = new Date(feedback.created_at);
                date.textContent = feedbackDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                
                feedbackItem.appendChild(title);
                feedbackItem.appendChild(category);
                feedbackItem.appendChild(status);
                feedbackItem.appendChild(content);
                feedbackItem.appendChild(date);
                
                feedbackList.appendChild(feedbackItem);
            });
        } else {
            feedbackList.innerHTML = '<div class="feedback-empty" data-en="No feedback submitted yet" data-bm="Tiada maklum balas dihantar lagi">No feedback submitted yet</div>';
        }
    } catch (error) {
        console.error('Error loading feedback:', error);
        const feedbackList = document.getElementById('feedbackList');
        if (feedbackList) {
            feedbackList.innerHTML = '<div class="feedback-empty">Error loading feedback</div>';
        }
    }
}

async function loadResolvedFeedback() {
    try {
        const response = await fetch('../api/feedback.php?action=get-resolved', {
            credentials: 'include'
        });
        const data = await response.json();
        
        const resolvedFeedbackList = document.getElementById('resolvedFeedbackList');
        const resolvedBadge = document.getElementById('resolvedBadge');
        
        if (!resolvedFeedbackList) return;
        
        if (data.success && data.data && data.data.length > 0) {
            resolvedFeedbackList.innerHTML = '';

            if (resolvedBadge) {
                resolvedBadge.style.display = 'inline-block';
                resolvedBadge.textContent = data.data.length;
            }
            
            data.data.forEach(feedback => {
                const feedbackItem = document.createElement('div');
                feedbackItem.className = 'resolved-feedback-item';
                
                const header = document.createElement('div');
                header.className = 'resolved-feedback-header';
                
                const title = document.createElement('div');
                title.className = 'resolved-feedback-title';
                title.textContent = feedback.title || feedback.content.substring(0, 50) + (feedback.content.length > 50 ? '...' : '');
                
                const reference = document.createElement('div');
                reference.className = 'resolved-feedback-reference';
                reference.textContent = feedback.reference;
                
                header.appendChild(title);
                header.appendChild(reference);
                feedbackItem.appendChild(header);
                
                const meta = document.createElement('div');
                meta.className = 'resolved-feedback-meta';
                
                const category = document.createElement('span');
                category.className = 'resolved-feedback-category';
                category.textContent = feedback.category || 'General';
                
                const status = document.createElement('span');
                status.className = 'resolved-feedback-status';
                status.textContent = '✓ Resolved';
                
                meta.appendChild(category);
                meta.appendChild(status);
                feedbackItem.appendChild(meta);
                
                const originalMessage = document.createElement('div');
                originalMessage.className = 'resolved-feedback-original';
                
                const originalLabel = document.createElement('div');
                originalLabel.className = 'message-label';
                originalLabel.textContent = 'Your Feedback:';
                
                const originalContent = document.createElement('div');
                originalContent.className = 'message-content';
                originalContent.textContent = feedback.content;
                
                originalMessage.appendChild(originalLabel);
                originalMessage.appendChild(originalContent);
                feedbackItem.appendChild(originalMessage);
                
                if (feedback.admin_response) {
                    const adminMessage = document.createElement('div');
                    adminMessage.className = 'resolved-feedback-response';
                    
                    const responseLabel = document.createElement('div');
                    responseLabel.className = 'message-label admin-label';
                    responseLabel.textContent = 'Admin Response:';
                    
                    const responseContent = document.createElement('div');
                    responseContent.className = 'message-content admin-message';
                    responseContent.textContent = feedback.admin_response;
                    
                    adminMessage.appendChild(responseLabel);
                    adminMessage.appendChild(responseContent);
                    feedbackItem.appendChild(adminMessage);
                }
                
                const date = document.createElement('div');
                date.className = 'resolved-feedback-date';
                const feedbackDate = new Date(feedback.resolved_at);
                date.textContent = 'Resolved: ' + feedbackDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                feedbackItem.appendChild(date);
                
                resolvedFeedbackList.appendChild(feedbackItem);
            });
        } else {
            resolvedFeedbackList.innerHTML = '<div class="feedback-empty">No resolved feedback yet</div>';
            if (resolvedBadge) {
                resolvedBadge.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error loading resolved feedback:', error);
        const resolvedFeedbackList = document.getElementById('resolvedFeedbackList');
        if (resolvedFeedbackList) {
            resolvedFeedbackList.innerHTML = '<div class="feedback-empty">Error loading resolved feedback</div>';
        }
    }
}

async function updateProfilePicture(file) {
    if (!file) return;
    
    try {
        const formData = new FormData();
        formData.append('profile_picture', file);
        formData.append('user_id', currentUserId);
        
        const response = await fetch('upload-profile-picture.php', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
            const sidebarProfilePic = document.getElementById('sidebarProfilePic');
            if (sidebarProfilePic) {
                sidebarProfilePic.src = result.picture_url + '?t=' + new Date().getTime();
            }
            
            const profilePic = document.getElementById('profilePic');
            if (profilePic) {
                profilePic.src = result.picture_url + '?t=' + new Date().getTime();
            }

            const userData = JSON.parse(localStorage.getItem('ums_user') || '{}');
            userData.picture = result.picture_url;
            localStorage.setItem('ums_user', JSON.stringify(userData));
            
            alert(currentLanguage === 'bm' 
                ? 'Gambar profil telah berjaya dikemas kini.' 
                : 'Profile picture updated successfully.');
        } else {
            alert(result.error || 'Failed to update profile picture');
        }
    } catch (error) {
        console.error('Error updating profile picture:', error);
        alert('Error updating profile picture');
    }
}

async function updateDisplayName(newName) {
    if (!newName || !newName.trim()) return;
    
    try {
        const response = await fetch('update-profile.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: currentUserId,
                display_name: newName.trim()
            }),
            credentials: 'include'
        });
        
        const result = await response.json();
        
        if (result.success) {
            const sidebarDisplayName = document.getElementById('sidebarDisplayName');
            if (sidebarDisplayName) {
                sidebarDisplayName.textContent = newName;
            }
            
            const profileName = document.getElementById('profileName');
            if (profileName) {
                profileName.textContent = newName;
            }

            const userData = JSON.parse(localStorage.getItem('ums_user') || '{}');
            userData.name = newName;
            localStorage.setItem('ums_user', JSON.stringify(userData));
            
            alert(currentLanguage === 'bm' 
                ? 'Nama paparan telah berjaya dikemas kini.' 
                : 'Display name updated successfully.');
        } else {
            alert(result.error || 'Failed to update display name');
        }
    } catch (error) {
        console.error('Error updating display name:', error);
        alert('Error updating display name');
    }
}

async function loadUserProfile() {
    const sessionData = await checkAuthenticationStatus();
    
    if (sessionData && sessionData.authenticated) {
        const userProfile = await fetchUserProfileFromDatabase();
        
        if (userProfile) {
            const displayName = userProfile.display_name || userProfile.full_name || sessionData.user_name || '';
            const email = userProfile.email || sessionData.user_email || '';
            
            let profilePic = userProfile.profile_picture_url || DEFAULT_PROFILE_PIC;

            if (!userProfile.profile_picture_url) {
                if (userProfile.login_method === 'google') {
                    profilePic = `https://www.gravatar.com/avatar/${hashEmail(email)}?d=identicon&s=200`;
                } else if (userProfile.login_method === 'microsoft') {
                    profilePic = DEFAULT_PROFILE_PIC;
                }
            }

            const userObj = {
                id: userProfile.id,
                name: displayName,
                email: email,
                picture: profilePic,
                login_method: userProfile.login_method
            };
            
            localStorage.setItem('ums_user', JSON.stringify(userObj));
            return userObj;
        }
    }

    localStorage.removeItem('ums_user');
    return null;
}

function hashEmail(email) {
    return encodeURIComponent(email.toLowerCase().trim());
}

function initProfileSidebar() {
    const profileBtn = document.getElementById('profileBtn');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const editPicBtn = document.getElementById('editPicBtn');
    const profilePicInput = document.getElementById('profilePicInput');
    const displayNameEl = document.getElementById('sidebarDisplayName');
    
    if (profileBtn) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleProfileSidebar();
        });
    } else {
    }
    
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', closeProfileSidebar);
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeProfileSidebar);
    }
    
    if (editPicBtn && profilePicInput) {
        editPicBtn.addEventListener('click', () => {
            profilePicInput.click();
        });
        
        profilePicInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                updateProfilePicture(file);
            }
        });
    }
    
    if (displayNameEl) {
        displayNameEl.addEventListener('blur', async () => {
            const newName = displayNameEl.textContent.trim();
            const oldName = displayNameEl.getAttribute('data-original') || '';
            
            if (newName && newName !== oldName) {
                await updateDisplayName(newName);
                displayNameEl.setAttribute('data-original', newName);
            } else if (!newName) {
                displayNameEl.textContent = oldName;
            }
        });

        displayNameEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                displayNameEl.blur();
            } else if (e.key === 'Escape') {
                displayNameEl.textContent = displayNameEl.getAttribute('data-original') || '';
                displayNameEl.blur();
            }
        });
    }
    
    initProfileSidebarDropdowns();
}

function initProfileSidebarDropdowns() {
    const sectionToggles = document.querySelectorAll('.section-toggle');
    
    sectionToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const section = toggle.getAttribute('data-section');
            const content = document.getElementById(section + 'Content');
            
            if (!content) return;
            
            const isActive = content.classList.contains('active');

            sectionToggles.forEach(otherToggle => {
                const otherSection = otherToggle.getAttribute('data-section');
                const otherContent = document.getElementById(otherSection + 'Content');
                if (otherContent && otherSection !== section) {
                    otherContent.classList.remove('active');
                    otherToggle.classList.remove('active');
                    otherContent.style.display = 'none';
                }
            });

            if (isActive) {
                content.classList.remove('active');
                toggle.classList.remove('active');
                content.style.display = 'none';
            } else {
                content.classList.add('active');
                toggle.classList.add('active');
                content.style.display = 'block';
            }
        });
    });
}

function initAuthUI() {
    const loginBtn = document.getElementById('loginBtn');
    const profileView = document.getElementById('profileView');
    const profileBtn = document.getElementById('profileBtn');
    const logoutBtnNavbar = document.getElementById('logoutBtnNavbar');
    const profilePic = document.getElementById('profilePic');
    const profileName = document.getElementById('profileName');

    console.log('initAuthUI called');

    async function render() {
        const user = await loadUserProfile();
        
        console.log('User loaded in render:', user ? user.name : 'null');
        
        if (user && user.name) {
            if (loginBtn) {
                loginBtn.style.display = 'none';
                console.log('Login button hidden');
            }
            if (profileView) {
                profileView.style.display = 'flex';
                console.log('Profile view shown');
            }

            const displayName = user.name || '';
            if (profileName) profileName.textContent = displayName;

            const pic = user.picture ? user.picture : DEFAULT_PROFILE_PIC;
            if (profilePic) profilePic.src = pic;
        } else {
            if (loginBtn) {
                loginBtn.style.display = 'inline-block';
                console.log('Login button shown - user not authenticated');
            }
            if (profileView) {
                profileView.style.display = 'none';
                console.log('Profile view hidden');
            }
        }
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            window.location.href = '../login/';
        });
    }

    render();

    if (logoutBtnNavbar) {
        logoutBtnNavbar.addEventListener('click', async () => {
            try {
                await fetch('/ums_feedback_system/api/auth.php?action=logout', {
                    method: 'POST',
                    credentials: 'include'
                });
            } catch (e) {
                console.warn('Logout request failed:', e);
            }
            
            localStorage.removeItem('ums_user');
            window.location.href = '../login/';
        });
    }
}