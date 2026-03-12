// ==========================================
// 🌟 終極攔截網：在 Supabase 洗掉網址前，第一時間抓取！
// ==========================================
let isPasswordRecovery = false;

// 1. 暴力備案：只要網址有 recovery 或 code，就當作是重設密碼
const currentUrl = window.location.href;
if (currentUrl.includes('type=recovery') || currentUrl.includes('code=')) {
    isPasswordRecovery = true;
}

// 2. 啟動官方雷達：監聽 Supabase 廣播
if (window.supabaseClient) {
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log('【系統廣播】目前登入狀態事件:', event); // 打開 F12 可以看到這個！
        if (event === 'PASSWORD_RECOVERY') {
            isPasswordRecovery = true;
            if (document.readyState === 'interactive' || document.readyState === 'complete') {
                showResetPasswordForm();
            }
        }
    });
}

function showResetPasswordForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const resetPasswordForm = document.getElementById('reset-password-form');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');

    if (loginForm) loginForm.classList.add('hidden');
    if (registerForm) registerForm.classList.add('hidden');
    if (resetPasswordForm) resetPasswordForm.classList.remove('hidden');

    if (authTitle) authTitle.textContent = '設定新密碼';
    if (authSubtitle) authSubtitle.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {

    // 🌟 網頁準備好後，檢查剛剛有沒有攔截到訊號
    if (isPasswordRecovery) {
        showResetPasswordForm();
    }

    // ==========================================
    // 全域客製化對話框系統 (AppDialog)
    // ==========================================
    window.AppDialog = {
        show: function (options) {
            return new Promise((resolve) => {
                const modal = document.getElementById('modal-dialog');
                const content = document.getElementById('modal-dialog-content');
                const title = document.getElementById('dialog-title');
                const msg = document.getElementById('dialog-message');
                const btnConfirm = document.getElementById('btn-dialog-confirm');
                const btnCancel = document.getElementById('btn-dialog-cancel');
                const icon = document.getElementById('dialog-icon');
                const iconContainer = document.getElementById('dialog-icon-container');

                if (!modal) {
                    alert(options.message);
                    resolve(true);
                    return;
                }

                title.textContent = options.title || '提示';
                msg.textContent = options.message || '';

                if (options.type === 'danger') {
                    icon.setAttribute('data-lucide', 'alert-triangle');
                    iconContainer.className = 'w-16 h-16 rounded-full flex items-center justify-center mb-5 shrink-0 bg-red-100 text-red-600';
                    btnConfirm.className = 'flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-red-500/20 active:scale-95';
                } else if (options.type === 'warning') {
                    icon.setAttribute('data-lucide', 'info');
                    iconContainer.className = 'w-16 h-16 rounded-full flex items-center justify-center mb-5 shrink-0 bg-yellow-100 text-yellow-600';
                    btnConfirm.className = 'flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-md active:scale-95';
                } else {
                    icon.setAttribute('data-lucide', 'check-circle-2');
                    iconContainer.className = 'w-16 h-16 rounded-full flex items-center justify-center mb-5 shrink-0 bg-emerald-100 text-emerald-600';
                    btnConfirm.className = 'flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-95';
                }
                if (typeof lucide !== 'undefined') lucide.createIcons();

                if (options.showCancel) btnCancel.classList.remove('hidden');
                else btnCancel.classList.add('hidden');

                modal.classList.remove('hidden');
                setTimeout(() => {
                    modal.classList.remove('opacity-0');
                    content.classList.remove('scale-95', 'opacity-0');
                }, 10);

                const closeAndResolve = (result) => {
                    modal.classList.add('opacity-0');
                    content.classList.add('scale-95', 'opacity-0');
                    setTimeout(() => {
                        modal.classList.add('hidden');
                        resolve(result);
                    }, 300);
                    btnConfirm.onclick = null;
                    btnCancel.onclick = null;
                };

                btnConfirm.onclick = () => closeAndResolve(true);
                btnCancel.onclick = () => closeAndResolve(false);
            });
        },
        alert: function (message, type = 'warning', title = '提示') {
            return this.show({ message, type, title, showCancel: false });
        },
        confirm: function (message, type = 'danger', title = '請確認') {
            return this.show({ message, type, title, showCancel: true });
        }
    };

    // ==========================================
    // 登入、註冊與其他表單切換邏輯 (維持原樣)
    // ==========================================
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const btnShowRegister = document.getElementById('btn-show-register');
    const btnShowLogin = document.getElementById('btn-show-login');

    if (btnShowRegister) {
        btnShowRegister.addEventListener('click', () => {
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            authTitle.textContent = '建立店家帳號';
            authSubtitle.textContent = '請填寫以下資訊來開通您的專屬後台';
        });
    }

    if (btnShowLogin) {
        btnShowLogin.addEventListener('click', () => {
            registerForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            authTitle.textContent = '歡迎回來';
            authSubtitle.textContent = '請登入您的店家管理帳號';
        });
    }

    // ==========================================
    // 🌟 送出新密碼邏輯 (升級前端驗證與錯誤翻譯)
    // ==========================================
    const resetPasswordForm = document.getElementById('reset-password-form');
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('reset-new-password').value;

            // 🌟 1. 前端預先防護 (Regex 正規表達式檢查)
            // 規則：至少 8 碼，必須包含至少一個小寫字母 (a-z)、一個大寫字母 (A-Z) 和一個數字 (\d)
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

            if (!passwordRegex.test(newPassword)) {
                AppDialog.alert('密碼必須至少 8 碼，且同時包含「大寫字母」、「小寫字母」與「數字」喔！', 'warning', '密碼格式不符');
                return; // 直接擋下來，不浪費時間送給 Supabase
            }

            const btnSave = document.getElementById('btn-save-new-password');
            const originalText = btnSave.innerHTML;
            btnSave.innerHTML = '<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> 儲存中...';
            btnSave.disabled = true;
            if (typeof lucide !== 'undefined') lucide.createIcons();

            try {
                const { error } = await window.supabaseClient.auth.updateUser({
                    password: newPassword
                });

                if (error) throw error;

                await AppDialog.alert('密碼重設成功！請使用新密碼重新登入。', 'success', '修改完成');

                // 清除網址代碼，並回到一般登入畫面
                window.history.replaceState(null, null, window.location.pathname);
                window.location.reload();

            } catch (error) {
                console.error('密碼重設失敗:', error); // 這是留給我們開發者在 F12 看的原始錯誤

                // 🌟 2. 錯誤訊息翻譯蒟蒻 (攔截 Supabase 的原始英文)
                let errorMsg = error.message;

                if (errorMsg.includes('Password should contain')) {
                    errorMsg = '密碼必須同時包含大寫、小寫字母與數字喔！';
                } else if (errorMsg.includes('different from the old password') || errorMsg.includes('same password')) {
                    // 🌟 抓到了！原來 Supabase 是說 "different from the old password"
                    errorMsg = '新密碼不能與舊密碼相同，請換一個全新的密碼試試。';
                } else {
                    errorMsg = '密碼重設失敗：' + error.message;
                }

                AppDialog.alert(errorMsg, 'danger', '設定失敗');
            } finally {
                btnSave.innerHTML = originalText;
                btnSave.disabled = false;
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        });
    }

    // ==========================================
    // 忘記密碼 (寄信視窗) 邏輯
    // ==========================================
    const btnShowForgot = document.getElementById('btn-show-forgot-password');
    const modalForgot = document.getElementById('modal-forgot-password');
    const modalForgotContent = document.getElementById('modal-forgot-content');
    const btnCancelForgot = document.getElementById('btn-cancel-forgot');
    const btnSendReset = document.getElementById('btn-send-reset-email');
    const inputForgotEmail = document.getElementById('input-forgot-email');

    function toggleForgotModal(show) {
        if (show) {
            modalForgot.classList.remove('hidden');
            setTimeout(() => {
                modalForgot.classList.remove('opacity-0');
                modalForgotContent.classList.remove('scale-95', 'opacity-0');
            }, 10);

            const loginEmailInput = document.getElementById('login-email');
            if (loginEmailInput) {
                inputForgotEmail.value = loginEmailInput.value;
            }
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

    if (btnSendReset) {
        btnSendReset.addEventListener('click', async () => {
            const email = inputForgotEmail.value.trim();
            if (!email) {
                AppDialog.alert('請輸入電子郵件！', 'warning');
                return;
            }

            const originalText = btnSendReset.innerHTML;
            btnSendReset.innerHTML = '<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> 發送中...';
            btnSendReset.disabled = true;
            if (typeof lucide !== 'undefined') lucide.createIcons();

            try {
                const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + window.location.pathname,
                });

                if (error) throw error;

                AppDialog.alert('重設密碼信件已寄出！請至您的信箱收信，並點擊信中連結。', 'success', '寄送成功');
                toggleForgotModal(false);

            } catch (error) {
                console.error('發送失敗:', error);
                AppDialog.alert('發送失敗：' + error.message, 'danger', '發生錯誤');
            } finally {
                btnSendReset.innerHTML = originalText;
                btnSendReset.disabled = false;
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        });
    }
});