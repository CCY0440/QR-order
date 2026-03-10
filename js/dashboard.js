// js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. 初始化 Lucide 圖示
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // ==========================================
    // 核心 UI 控制：側邊欄 (Sidebar) 響應式開關
    // ==========================================
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('open-sidebar');
    const closeBtn = document.getElementById('close-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    function toggleSidebar() {
        if (!sidebar) return;
        const isOpen = sidebar.classList.contains('translate-x-0');
        if (isOpen) {
            sidebar.classList.remove('translate-x-0');
            sidebar.classList.add('-translate-x-full');
            if (overlay) overlay.classList.add('hidden');
        } else {
            sidebar.classList.remove('-translate-x-full');
            sidebar.classList.add('translate-x-0');
            if (overlay) overlay.classList.remove('hidden');
        }
    }

    if (openBtn) openBtn.addEventListener('click', toggleSidebar);
    if (closeBtn) closeBtn.addEventListener('click', toggleSidebar);
    if (overlay) overlay.addEventListener('click', toggleSidebar);

    // ==========================================
    // 核心 UI 控制：SPA 單頁面切換邏輯
    // ==========================================
    const navLinks = document.querySelectorAll('.nav-link');
    const contentSections = document.querySelectorAll('.content-section');
    const headerTitle = document.getElementById('header-title');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            const targetId = link.getAttribute('data-target');
            const newTitle = link.getAttribute('data-title');

            // 1. 重置所有按鈕樣式，並點亮當前按鈕
            navLinks.forEach(nav => {
                nav.classList.remove('bg-emerald-50', 'text-emerald-600', 'font-bold', 'active');
                nav.classList.add('text-gray-500', 'hover:bg-gray-50', 'hover:text-gray-800', 'font-medium');
            });
            link.classList.remove('text-gray-500', 'hover:bg-gray-50', 'hover:text-gray-800', 'font-medium');
            link.classList.add('bg-emerald-50', 'text-emerald-600', 'font-bold', 'active');

            // 2. 隱藏所有區塊，顯示目標區塊並加入淡入動畫
            contentSections.forEach(section => {
                section.classList.add('hidden');
                section.classList.remove('fade-in');
            });

            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.remove('hidden');
                void targetSection.offsetWidth; // 魔法指令：強制瀏覽器重繪以觸發動畫
                targetSection.classList.add('fade-in');
            }

            // 3. 更新頂部標題
            if (headerTitle) headerTitle.textContent = newTitle;

            // 4. 手機版點擊後自動收起側邊欄
            if (window.innerWidth < 1024) {
                toggleSidebar();
            }
        });
    });

    // ==========================================
    // 子功能控制：訂單管理 - 狀態標籤切換
    // ==========================================
    const orderTabs = document.querySelectorAll('.order-tab');
    orderTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 重置樣式
            orderTabs.forEach(t => {
                t.classList.remove('bg-white', 'text-emerald-600', 'shadow-sm', 'active');
                t.classList.add('text-gray-500', 'hover:text-gray-700', 'hover:bg-gray-100');
            });
            // 點亮當前標籤
            tab.classList.remove('text-gray-500', 'hover:text-gray-700', 'hover:bg-gray-100');
            tab.classList.add('bg-white', 'text-emerald-600', 'shadow-sm', 'active');

            // （未來這裡會寫入：根據 tab.dataset.status 呼叫 Supabase 篩選訂單的邏輯）
        });
    });
});