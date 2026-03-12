// js/config.js
const SUPABASE_URL = 'https://xhvlwmcrgwskaforgxqd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nluuQ4-miY-nunLCYrvTrA_z577O8Pc';

// 🌟 重點：我們用 window.supabaseClient 讓它變成全域通用的工具
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);