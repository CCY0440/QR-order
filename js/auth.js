// js/auth.js
document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // 🌟 初始化已經被 config.js 接管了，這裡直接抓 DOM
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const btnShowRegister = document.getElementById('btn-show-register');
    const btnShowLogin = document.getElementById('btn-show-login');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');

    function switchView(view) {
        if (view === 'register') {
            loginForm.classList.add('hidden');
            loginForm.classList.remove('fade-in');
            registerForm.classList.remove('hidden');
            void registerForm.offsetWidth;
            registerForm.classList.add('fade-in');
            authTitle.textContent = '註冊新店家';
            authSubtitle.textContent = '只需幾秒鐘，即可開始打造專屬點餐系統';
        } else {
            registerForm.classList.add('hidden');
            registerForm.classList.remove('fade-in');
            loginForm.classList.remove('hidden');
            void loginForm.offsetWidth;
            loginForm.classList.add('fade-in');
            authTitle.textContent = '歡迎回來';
            authSubtitle.textContent = '請登入您的店家管理帳號';
        }
    }

    if (btnShowRegister) btnShowRegister.addEventListener('click', () => switchView('register'));
    if (btnShowLogin) btnShowLogin.addEventListener('click', () => switchView('login'));

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const storeName = document.getElementById('register-store-name').value;
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const errorMsg = document.getElementById('register-error');

            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
            if (!passwordRegex.test(password)) {
                errorMsg.textContent = '密碼格式不符：須至少 8 碼，且包含大小寫英文與數字';
                errorMsg.classList.remove('hidden');
                return;
            }

            const submitBtn = registerForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> 建立中...';
            lucide.createIcons();

            // 🌟 改用 supabaseClient
            const { data, error } = await supabaseClient.auth.signUp({ email, password });

            if (error) {
                errorMsg.textContent = '註冊失敗：' + error.message;
                errorMsg.classList.remove('hidden');
                submitBtn.innerHTML = originalText;
                lucide.createIcons();
                return;
            }

            if (data.user) {
                const { error: storeError } = await supabaseClient
                    .from('stores')
                    .insert([{ name: storeName, owner_id: data.user.id }]);

                if (storeError) {
                    errorMsg.textContent = '帳號已建立，但店家初始化失敗，請聯絡客服。';
                    errorMsg.classList.remove('hidden');
                    submitBtn.innerHTML = originalText;
                    lucide.createIcons();
                    return;
                }

                const modal = document.getElementById('success-modal');
                const modalCard = document.getElementById('modal-card');
                modal.classList.remove('hidden');
                setTimeout(() => {
                    modalCard.classList.remove('scale-95', 'opacity-0');
                    modalCard.classList.add('scale-100', 'opacity-100');
                }, 10);

                document.getElementById('btn-modal-close').onclick = () => {
                    modalCard.classList.add('scale-95', 'opacity-0');
                    setTimeout(() => {
                        modal.classList.add('hidden');
                        switchView('login');
                    }, 300);
                };
                submitBtn.innerHTML = originalText;
                lucide.createIcons();
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const errorMsg = document.getElementById('login-error');
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;

            submitBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> 登入中...';
            lucide.createIcons();

            // 🌟 改用 supabaseClient
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

            if (error) {
                errorMsg.textContent = (error.message === 'Invalid login credentials') ? '帳號或密碼錯誤，請重新輸入。' : '登入失敗：' + error.message;
                errorMsg.classList.remove('hidden');
                submitBtn.innerHTML = originalText;
                lucide.createIcons();
            } else {
                errorMsg.classList.add('hidden');
                submitBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> 登入成功！';
                lucide.createIcons();

                const { data: storeData } = await supabaseClient
                    .from('stores')
                    .select('is_initialized')
                    .eq('owner_id', data.user.id)
                    .single();

                setTimeout(() => {
                    if (storeData && storeData.is_initialized) {
                        window.location.href = 'dashboard.html';
                    } else {
                        window.location.href = 'onboarding.html';
                    }
                }, 500);
            }
        });
    }
});