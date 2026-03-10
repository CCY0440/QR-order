// js/auth.js
document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // ==========================================
    // 0. 初始化 Supabase
    // ==========================================
    const SUPABASE_URL = 'https://xhvlwmcrgwskaforgxqd.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_nluuQ4-miY-nunLCYrvTrA_z577O8Pc';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // 抓取 DOM 元素
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const btnShowRegister = document.getElementById('btn-show-register');
    const btnShowLogin = document.getElementById('btn-show-login');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');

    // ==========================================
    // 1. 介面切換邏輯
    // ==========================================
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

    btnShowRegister.addEventListener('click', () => switchView('register'));
    btnShowLogin.addEventListener('click', () => switchView('login'));

    // ==========================================
    // 2. 真實的 Supabase 註冊邏輯 (升級版：含店面建立)
    // ==========================================
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 🟢 [新加入]：抓取店家名稱
        const storeName = document.getElementById('register-store-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const errorMsg = document.getElementById('register-error');

        // 密碼強度檢查
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

        // --- 步驟 A：先建立 Auth 帳號 ---
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (error) {
            errorMsg.textContent = '註冊失敗：' + error.message;
            errorMsg.classList.remove('hidden');
            submitBtn.innerHTML = originalText;
            lucide.createIcons();
            return; // 帳號建立失敗就停止
        }

        // --- 步驟 B：帳號建立成功後，立刻建立 stores 資料 (這是最踏實的一步) ---
        if (data.user) {
            const { error: storeError } = await supabase
                .from('stores')
                .insert([
                    {
                        name: storeName,
                        owner_id: data.user.id // 將店家綁定給這位剛註冊的老闆
                    }
                ]);

            if (storeError) {
                console.error('店家資料建立失敗:', storeError);
                errorMsg.textContent = '帳號已建立，但店家初始化失敗，請聯絡客服。';
                errorMsg.classList.remove('hidden');
                submitBtn.innerHTML = originalText;
                lucide.createIcons();
                return; // 如果建立店面失敗，不顯示成功彈窗
            }

            // --- 步驟 C：全部成功，顯示特製彈窗 ---
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

    // ==========================================
    // 3. 真實的 Supabase 登入邏輯
    // ==========================================
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorMsg = document.getElementById('login-error');

        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> 登入中...';
        lucide.createIcons();

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            errorMsg.textContent = (error.message === 'Invalid login credentials')
                ? '帳號或密碼錯誤，請重新輸入。'
                : '登入失敗：' + error.message;
            errorMsg.classList.remove('hidden');
            submitBtn.innerHTML = originalText;
            lucide.createIcons();
        } else {
            errorMsg.classList.add('hidden');
            submitBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> 登入成功！';
            lucide.createIcons();

            // 🚦 【新邏輯】：檢查初始化狀態
            const { data: storeData } = await supabase
                .from('stores')
                .select('is_initialized')
                .eq('owner_id', data.user.id)
                .single();

            setTimeout(() => {
                if (storeData && storeData.is_initialized) {
                    // 🟢 已設定完：直接去後台
                    window.location.href = 'dashboard.html';
                } else {
                    // 🔴 第一次登入：去引導頁
                    window.location.href = 'onboarding.html';
                }
            }, 500);
        }
    });
});