// ==========================================
// 忘記密碼功能邏輯
// ==========================================
const btnShowForgot = document.getElementById('btn-show-forgot-password');
const modalForgot = document.getElementById('modal-forgot-password');
const modalForgotContent = document.getElementById('modal-forgot-content');
const btnCancelForgot = document.getElementById('btn-cancel-forgot');
const btnSendReset = document.getElementById('btn-send-reset-email');
const inputForgotEmail = document.getElementById('input-forgot-email');

// 開關 Modal 動畫
function toggleForgotModal(show) {
    if (show) {
        modalForgot.classList.remove('hidden');
        setTimeout(() => {
            modalForgot.classList.remove('opacity-0');
            modalForgotContent.classList.remove('scale-95', 'opacity-0');
        }, 10);
        // 自動把登入框的信箱帶過來，省去使用者重打
        inputForgotEmail.value = document.getElementById('login-email').value;
    } else {
        modalForgot.classList.add('opacity-0');
        modalForgotContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modalForgot.classList.add('hidden');
            inputForgotEmail.value = '';
        }, 300);
    }
}

if (btnShowForgot) btnShowForgot.addEventListener('click', () => toggleForgotModal(true));
if (btnCancelForgot) btnCancelForgot.addEventListener('click', () => toggleForgotModal(false));

// 發送重設信件
if (btnSendReset) {
    btnSendReset.addEventListener('click', async () => {
        const email = inputForgotEmail.value.trim();
        if (!email) {
            alert('請輸入電子郵件！');
            return;
        }

        // 按鈕轉圈圈防連點
        const originalText = btnSendReset.innerHTML;
        btnSendReset.innerHTML = '<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> 發送中...';
        btnSendReset.disabled = true;
        lucide.createIcons();

        try {
            // 呼叫 Supabase 寄出重設信，並指定點擊連結後要跳轉回哪個頁面 (這裡設定跳回登入頁)
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + window.location.pathname, // 目前網址
            });

            if (error) throw error;

            alert('重設密碼信件已寄出！請至您的信箱收信，並點擊信中連結。');
            toggleForgotModal(false);

        } catch (error) {
            console.error('發送失敗:', error);
            alert('發送失敗：' + error.message);
        } finally {
            btnSendReset.innerHTML = originalText;
            btnSendReset.disabled = false;
        }
    });
}