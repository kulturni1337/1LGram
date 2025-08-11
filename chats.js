const messageArea = document.getElementById('messageArea');
const messageInput = document.getElementById('messageInput');
const sendMessageButton = document.getElementById('sendMessageButton');
const chatListElement = document.getElementById('chatList');
const chatHeaderName = document.getElementById('chatName');
const chatAvatar = document.getElementById('chatAvatar');
const userNameElement = document.getElementById('userName');
const userProfileAvatar = document.getElementById('userProfileAvatar');
const searchChatsInput = document.getElementById('searchChats');
const searchResultsContainer = document.getElementById('searchResults');
const profileEditIcon = document.getElementById('profileEditIcon');
const profileModal = document.getElementById('profileModal');
const closeButton = document.querySelector('.close-button');
const saveProfileButton = document.getElementById('saveProfileButton');
const editNameInput = document.getElementById('editName');
const editAvatarUrlInput = document.getElementById('editAvatarUrl');
const notificationContainer = document.getElementById('notificationContainer');

let currentChatId = null;
let currentUserId = null;
let currentUserName = null;
let ws = null;

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

async function fetchUserData() {
    try {
        const response = await fetch('http://localhost:3000/user', {
            method: 'GET'
        });
        if (response.ok) {
            const userData = await response.json();
            userNameElement.innerText = userData.name;
            userProfileAvatar.src = userData.avatar || `https://via.placeholder.com/48/4299e1/fff?text=${userData.name.charAt(0).toUpperCase()}`;
            currentUserId = userData.id;
            currentUserName = userData.name;
            return userData;
        } else {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Ошибка:', error);
        window.location.href = 'index.html';
    }
    return null;
}

async function fetchMessages(chatId) {
    try {
        const response = await fetch(`http://localhost:3000/messages/${chatId}`, {
            method: 'GET'
        });
        if (response.ok) {
            const messages = await response.json();
            messageArea.innerHTML = '';
            messages.forEach(message => {
                appendMessageToUI(message, currentUserId);
            });
            messageArea.scrollTop = messageArea.scrollHeight;
        }
    } catch (error) {
        console.error('Ошибка при загрузке сообщений:', error);
    }
}

async function fetchChats() {
    try {
        const response = await fetch('http://localhost:3000/chats', {
            method: 'GET'
        });
        if (response.ok) {
            const chats = await response.json();
            chatListElement.innerHTML = '';
            chats.forEach(chat => {
                const chatItem = document.createElement('div');
                chatItem.classList.add('chat-item');
                chatItem.setAttribute('data-chat-id', chat.id);
                chatItem.innerHTML = `
                    <img src="https://via.placeholder.com/40/4a5568/e2e8f0?text=${chat.name.charAt(0).toUpperCase()}" alt="Avatar" class="chat-avatar">
                    <div class="chat-info">
                        <span class="chat-name">${chat.name}</span>
                        <span class="last-message">${chat.last_message || 'Начните беседу'}</span>
                    </div>
                `;
                chatItem.addEventListener('click', () => selectChat(chat.id, chat.name));
                chatListElement.appendChild(chatItem);
            });

            if (chats.length > 0 && !currentChatId) {
                selectChat(chats[0].id, chats[0].name);
            }
        }
    } catch (error) {
        console.error('Ошибка при загрузке чатов:', error);
    }
}

function selectChat(chatId, chatName) {
    currentChatId = chatId;
    chatHeaderName.innerText = chatName;
    chatAvatar.src = `https://via.placeholder.com/40/4a5568/e2e8f0?text=${chatName.charAt(0).toUpperCase()}`;

    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    const selectedChat = document.querySelector(`.chat-item[data-chat-id="${chatId}"]`);
    if (selectedChat) {
        selectedChat.classList.add('active');
    }
    
    fetchMessages(currentChatId);
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentChatId) return;

    const message = {
        chatId: currentChatId,
        text: text,
        senderId: currentUserId,
        senderName: currentUserName
    };

    try {
        const response = await fetch('http://localhost:3000/message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(message)
        });

        if (response.ok) {
            const data = await response.json();
            message.timestamp = data.timestamp;
            ws.send(JSON.stringify(message));
            appendMessageToUI(message, currentUserId);
            messageInput.value = '';
        } else {
            const errorData = await response.json();
            alert(`Ошибка при отправке: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось отправить сообщение.');
    }
}

function appendMessageToUI(message, userId) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'animate', message.senderId === userId ? 'sent' : 'received');
    messageElement.innerHTML = `
        <p>${message.text}</p>
        <span class="message-time">${formatTime(message.timestamp)}</span>
    `;
    messageArea.appendChild(messageElement);
    messageArea.scrollTop = messageArea.scrollHeight;
}

async function createChatWithUser(friendId, friendName) {
    try {
        const response = await fetch('http://localhost:3000/createChat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ friendId })
        });
        const data = await response.json();
        if (response.ok) {
            alert(`Чат с ${friendName} создан!`);
            fetchChats();
        } else {
            alert(`Ошибка: ${data.error}`);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось создать чат.');
    }
}

async function handleSearch() {
    const query = searchChatsInput.value;
    if (query.length < 2) {
        searchResultsContainer.innerHTML = '';
        searchResultsContainer.classList.remove('active');
        return;
    }
    try {
        const response = await fetch(`http://localhost:3000/searchUsers?q=${query}`);
        if (response.ok) {
            const users = await response.json();
            searchResultsContainer.innerHTML = '';
            users.forEach(user => {
                if (user.id !== currentUserId) {
                    const resultItem = document.createElement('div');
                    resultItem.classList.add('search-result-item');
                    resultItem.innerHTML = `
                        <img src="${user.avatar || 'https://via.placeholder.com/40/4a5568/e2e8f0?text=' + user.name.charAt(0).toUpperCase()}" class="chat-avatar">
                        <span>${user.name}</span>
                    `;
                    resultItem.addEventListener('click', () => {
                        createChatWithUser(user.id, user.name);
                        searchResultsContainer.classList.remove('active');
                        searchChatsInput.value = '';
                    });
                    searchResultsContainer.appendChild(resultItem);
                }
            });
            searchResultsContainer.classList.add('active');
        } else {
            searchResultsContainer.classList.remove('active');
        }
    } catch (error) {
        console.error('Ошибка поиска:', error);
    }
}

profileEditIcon.addEventListener('click', () => {
    profileModal.style.display = 'block';
});

closeButton.addEventListener('click', () => {
    profileModal.style.display = 'none';
});

window.onclick = function(event) {
    if (event.target == profileModal) {
        profileModal.style.display = 'none';
    }
}

saveProfileButton.addEventListener('click', async () => {
    const newName = editNameInput.value;
    const newAvatarUrl = editAvatarUrlInput.value;

    try {
        const response = await fetch('http://localhost:3000/user/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newName, avatar: newAvatarUrl })
        });

        if (response.ok) {
            alert('Профиль обновлен!');
            profileModal.style.display = 'none';
            fetchUserData();
        } else {
            const errorData = await response.json();
            alert(`Ошибка: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Не удалось обновить профиль.');
    }
});



async function fetchUserData() {
    try {
        const response = await fetch('http://localhost:3000/user', {
            method: 'GET'
        });
        if (response.ok) {
            const userData = await response.json();
            userNameElement.innerText = userData.name;
            userProfileAvatar.src = userData.avatar || `https://via.placeholder.com/48/4299e1/fff?text=${userData.name.charAt(0).toUpperCase()}`;
            currentUserId = userData.id;
            currentUserName = userData.name;
            return userData;
        } else {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Ошибка:', error);
        window.location.href = 'index.html';
    }
    return null;
}



function showNotification(title, message, avatarUrl) {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.classList.add('notification');
    notification.innerHTML = `
        <img src="${avatarUrl}" alt="Avatar" class="notification-avatar">
        <div class="notification-content">
            <span class="notification-title">${title}</span>
            <span class="notification-message">${message}</span>
        </div>
    `;
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 5000);
}

async function init() {
    await fetchUserData();
    fetchChats();

    ws = new WebSocket('ws://localhost:3000');
    
    ws.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.chatId === currentChatId) {
            appendMessageToUI(message, currentUserId);
        } else {
            const chatName = document.querySelector(`.chat-item[data-chat-id="${message.chatId}"] .chat-name`).innerText;
            const avatarUrl = document.querySelector(`.chat-item[data-chat-id="${message.chatId}"] .chat-avatar`).src;
            showNotification(chatName, message.text, avatarUrl);
        }
    };
}

sendMessageButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});
searchChatsInput.addEventListener('input', handleSearch);

init();