// js/config.js
const SUPABASE_URL = 'https://xhvlwmcrgwskaforgxqd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhodmx3bWNyZ3dza2Fmb3JneHFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTc3NjMsImV4cCI6MjA4ODY5Mzc2M30.kpAvMhfEXF-HsUUxi7awuYyx0u1As3mqdwusBcpEKvo';

window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);