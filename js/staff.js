// =============================================
// staff.js — 店員管理模組
// =============================================
(async function () {
    let storeId = null;

    const ROLE_CONFIG = {
        owner: { label: '負責人', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
        manager: { label: '店長', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
        staff: { label: '店員', bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
    };

    async function getStoreId() {
        if (storeId) return storeId;
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return null;
        const { data: store } = await window.supabaseClient.from('stores').select('id').eq('owner_id', user.id).single();
        if (store) storeId = store.id;
        return storeId;
    }

    window.loadStaff = async function () {
        const id = await getStoreId();
        if (!id) return;

        const { data: staffList } = await window.supabaseClient
            .from('store_staff')
            .select('*')
            .eq('store_id', id)
            .order('created_at', { ascending: true });

        renderStaffList(staffList || []);
    };

    function renderStaffList(list) {
        const container = document.getElementById('staff-list');
        if (!container) return;

        if (list.length === 0) {
            container.innerHTML = `<div class="p-12 text-center">
                <i data-lucide="users" class="w-10 h-10 mx-auto mb-3 text-gray-200"></i>
                <p class="font-bold text-gray-400 text-sm">尚未新增任何店員</p>
            </div>`;
            lucide.createIcons();
            return;
        }

        container.innerHTML = list.map(staff => {
            const r = ROLE_CONFIG[staff.role] || ROLE_CONFIG.staff;
            const initial = (staff.name || staff.email).charAt(0).toUpperCase();
            return `
            <div class="px-6 py-4 flex items-center gap-4">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center font-black text-gray-600 text-sm shrink-0">
                    ${initial}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="font-bold text-gray-800 text-sm">${staff.name || '（未設定姓名）'}</p>
                    <p class="text-xs text-gray-400 truncate">${staff.email}</p>
                </div>
                <span class="text-xs font-bold px-2.5 py-1 rounded-lg ${r.bg} ${r.text} border ${r.border}">${r.label}</span>
                <button class="btn-delete-staff p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    data-id="${staff.id}" data-name="${staff.name || staff.email}">
                    <i data-lucide="trash-2" class="w-4 h-4 pointer-events-none"></i>
                </button>
            </div>`;
        }).join('');

        lucide.createIcons();

        container.querySelectorAll('.btn-delete-staff').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ok = await window.AppDialog.confirm(`確定要移除「${btn.dataset.name}」的店員身份嗎？`, 'danger', '移除確認');
                if (!ok) return;
                await window.supabaseClient.from('store_staff').delete().eq('id', btn.dataset.id);
                window.loadStaff();
            });
        });
    }

    // 新增店員
    document.getElementById('btn-add-staff')?.addEventListener('click', () => {
        document.getElementById('add-staff-form').classList.remove('hidden');
        document.getElementById('btn-add-staff').classList.add('hidden');
    });

    document.getElementById('btn-cancel-staff')?.addEventListener('click', () => {
        document.getElementById('add-staff-form').classList.add('hidden');
        document.getElementById('btn-add-staff').classList.remove('hidden');
        document.getElementById('staff-name').value = '';
        document.getElementById('staff-email').value = '';
    });

    document.getElementById('btn-save-staff')?.addEventListener('click', async () => {
        const id = await getStoreId();
        const name = document.getElementById('staff-name').value.trim();
        const email = document.getElementById('staff-email').value.trim();
        const role = document.querySelector('input[name="staff-role"]:checked')?.value || 'staff';

        if (!email) { window.AppDialog.alert('請填寫 Email', 'warning'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { window.AppDialog.alert('Email 格式不正確', 'warning'); return; }

        const btn = document.getElementById('btn-save-staff');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin inline mr-1"></i> 新增中...';
        btn.disabled = true;
        lucide.createIcons();

        const { error } = await window.supabaseClient.from('store_staff').insert({ store_id: id, name: name || null, email, role });

        if (error) {
            window.AppDialog.alert('新增失敗：' + error.message, 'danger');
        } else {
            document.getElementById('btn-cancel-staff').click();
            window.loadStaff();
        }

        btn.innerHTML = originalHtml;
        btn.disabled = false;
        lucide.createIcons();
    });
})();