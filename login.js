const loginForm = document.getElementById('loginForm');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('http://localhost:3000/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (response.ok) {
            // Больше не нужно alert, сразу перенаправляем
            window.location.href = 'chats.html';
        } else {
            const errorData = await response.json();
            alert(`Ошибка: ${errorData.error}`);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Что-то пошло не так. Попробуйте еще раз.');
    }
});