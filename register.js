const emailForm = document.getElementById('emailForm');
const registerForm = document.getElementById('registerForm');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const messageElement = document.getElementById('message');

let userEmail = '';

emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    userEmail = document.getElementById('email').value;

    try {
        const response = await fetch('http://localhost:3000/send-verification-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail })
        });

        const data = await response.json();
        if (response.ok) {
            messageElement.className = 'success-message';
            messageElement.innerText = 'Код отправлен! Проверьте почту.';
            step1.style.display = 'none';
            step2.style.display = 'block';
        } else {
            messageElement.className = 'error-message';
            messageElement.innerText = data.error;
        }
    } catch (error) {
        console.error('Ошибка:', error);
        messageElement.className = 'error-message';
        messageElement.innerText = 'Что-то пошло не так. Попробуйте еще раз.';
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const password = document.getElementById('password').value;
    const code = document.getElementById('code').value;

    try {
        const response = await fetch('http://localhost:3000/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail, password, name, code })
        });

        const data = await response.json();
        if (response.ok) {
            alert('Регистрация успешна! Теперь вы можете войти.');
            window.location.href = 'index.html';
        } else {
            messageElement.className = 'error-message';
            messageElement.innerText = data.error;
        }
    } catch (error) {
        console.error('Ошибка:', error);
        messageElement.className = 'error-message';
        messageElement.innerText = 'Что-то пошло не так. Попробуйте еще раз.';
    }
});