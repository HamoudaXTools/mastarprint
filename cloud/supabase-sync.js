/* MASTER PRINT Cloud Sync - first-pass shared snapshot bridge.
   Uses Supabase Auth + RLS + Realtime. No privileged key is used in the client. */
(function () {
  const config = window.MASTER_PRINT_SUPABASE || {};
  const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url || '') &&
                /^sb_publishable_/.test(config.publishableKey || '');
  let client = null, companyId = null, channel = null, timer = null, applyingRemote = false;
  const status = (msg, kind='info') => {
    let el = document.getElementById('mpCloudStatus');
    if (!el) {
      el = document.createElement('div');
      el.id = 'mpCloudStatus';
      el.style.cssText = 'position:fixed;z-index:99999;bottom:14px;left:14px;max-width:90vw;padding:10px 14px;border-radius:12px;background:#111827;color:#fff;font:13px Arial;box-shadow:0 4px 20px #0004;direction:rtl';
      document.body.appendChild(el);
    }
    el.textContent = 'MASTER PRINT Cloud: ' + msg;
    el.style.border = kind === 'error' ? '1px solid #ef4444' : kind === 'ok' ? '1px solid #22c55e' : '1px solid #64748b';
  };
  const currentState = () => {
    try { return JSON.parse(localStorage.getItem('alm_data') || '{}'); }
    catch (_) { return {}; }
  };
  async function loadCompany() {
    const { data: profile, error } = await client.from('profiles')
      .select('company_id,role,is_active').eq('id', (await client.auth.getUser()).data.user.id).single();
    if (error || !profile || !profile.is_active) throw new Error('لا يوجد ملف موظف نشط لهذا الحساب. أضف المستخدم إلى جدول profiles أولاً.');
    companyId = profile.company_id;
    const { data: row, error: readError } = await client.from('app_state')
      .select('state').eq('company_id', companyId).maybeSingle();
    if (readError) throw readError;
    if (row && row.state) {
      applyingRemote = true;
      localStorage.setItem('alm_data', JSON.stringify(row.state));
      if (typeof window.MPApplyCloudState === 'function') window.MPApplyCloudState(row.state);
      applyingRemote = false;
      status('متصل — تم تحميل بيانات الشركة', 'ok');
    } else {
      const { error: insertError } = await client.from('app_state')
        .insert({ company_id: companyId, state: currentState() });
      if (insertError) throw insertError;
      status('متصل — تم رفع بيانات هذا المتصفح لأول مرة', 'ok');
    }
    if (channel) await client.removeChannel(channel);
    channel = client.channel('master-print-company-' + companyId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'app_state',
        filter: 'company_id=eq.' + companyId
      }, payload => {
        if (applyingRemote || !payload.new || !payload.new.state) return;
        applyingRemote = true;
        localStorage.setItem('alm_data', JSON.stringify(payload.new.state));
        if (typeof window.MPApplyCloudState === 'function') window.MPApplyCloudState(payload.new.state);
        applyingRemote = false;
        status('تم استلام تحديث جديد من الموقع أو التطبيق', 'ok');
      }).subscribe();
  }
  async function signIn() {
    if (!ready) { status('أكمل إعداد supabase-config.js أولاً', 'error'); return; }
    const email = prompt('أدخل بريد مستخدم Supabase:');
    if (!email) return;
    const password = prompt('أدخل كلمة مرور Supabase:');
    if (!password) return;
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) { status(error.message, 'error'); return; }
    try { await loadCompany(); }
    catch (e) { status(e.message || String(e), 'error'); }
  }
  async function signOut() {
    if (client) await client.auth.signOut();
    if (channel) await client.removeChannel(channel);
    companyId = null; channel = null;
    status('تم تسجيل الخروج من السحابة');
  }
  function queueSave(state) {
    if (!client || !companyId || applyingRemote) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const { error } = await client.from('app_state').upsert({
        company_id: companyId, state: state || currentState(), updated_at: new Date().toISOString()
      }, { onConflict: 'company_id' });
      if (error) status('تعذر حفظ التغييرات: ' + error.message, 'error');
      else status('تم حفظ التغييرات على السحابة', 'ok');
    }, 700);
  }
  window.MPCloud = { signIn, signOut, queueSave, isReady: () => ready };
  window.addEventListener('DOMContentLoaded', () => {
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap;padding:9px;background:#eef5ff;color:#123;border-bottom:1px solid #cbd5e1;font:13px Arial;direction:rtl';
    bar.innerHTML = '<strong>MASTER PRINT Cloud</strong><span>اربط الموقع بقاعدة البيانات المشتركة</span><button id="mpCloudLogin" style="border:0;border-radius:8px;padding:8px 14px;background:#155eef;color:white;cursor:pointer">تسجيل دخول السحابة</button><button id="mpCloudLogout" style="border:1px solid #94a3b8;border-radius:8px;padding:8px 12px;background:white;cursor:pointer">خروج</button>';
    document.body.prepend(bar);
    bar.querySelector('#mpCloudLogin').onclick = signIn;
    bar.querySelector('#mpCloudLogout').onclick = signOut;
    if (!ready) status('بانتظار إعداد رابط المشروع والمفتاح العام');
    else {
      client = window.supabase.createClient(config.url, config.publishableKey);
      client.auth.getSession().then(async ({data}) => {
        if (data.session) {
          try { await loadCompany(); } catch(e) { status(e.message || String(e), 'error'); }
        }
      });
      client.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session && !companyId) {
          try { await loadCompany(); } catch(e) { status(e.message || String(e), 'error'); }
        }
      });
    }
  });
})();
