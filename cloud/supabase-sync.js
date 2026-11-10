/* MASTER PRINT Cloud Sync + Password Recovery
   Browser client uses only Supabase URL and publishable key. */
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
  function showPasswordRecovery() {
    if (document.getElementById('mpRecoveryModal')) return;
    const modal = document.createElement('div');
    modal.id = 'mpRecoveryModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#061323dd;display:grid;place-items:center;padding:18px;direction:rtl';
    modal.innerHTML = '<form id="mpRecoveryForm" style="width:min(420px,100%);background:#fff;color:#172438;border-radius:18px;padding:26px;box-shadow:0 20px 70px #0007;font-family:Tajawal,Arial"><h2 style="margin:0 0 8px">تعيين كلمة مرور جديدة</h2><p style="color:#64748b;line-height:1.7">اكتب كلمة المرور الجديدة مرتين. استخدم حروفًا إنجليزية وأرقامًا لسهولة تسجيل الدخول.</p><label style="display:block;margin:14px 0 6px">كلمة المرور الجديدة</label><input id="mpNewPassword" type="password" minlength="8" required autocomplete="new-password" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:9px"><label style="display:block;margin:14px 0 6px">تأكيد كلمة المرور</label><input id="mpConfirmPassword" type="password" minlength="8" required autocomplete="new-password" style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #cbd5e1;border-radius:9px"><p id="mpRecoveryError" style="color:#dc2626;min-height:20px;font-size:13px"></p><button type="submit" style="width:100%;padding:13px;border:0;border-radius:10px;background:#087cf0;color:white;font-weight:800;cursor:pointer">حفظ كلمة المرور</button></form>';
    document.body.appendChild(modal);
    modal.querySelector('#mpRecoveryForm').addEventListener('submit', async e => {
      e.preventDefault();
      const p = modal.querySelector('#mpNewPassword').value;
      const c = modal.querySelector('#mpConfirmPassword').value;
      const err = modal.querySelector('#mpRecoveryError');
      if (p.length < 8) { err.textContent = 'كلمة المرور يجب ألا تقل عن 8 أحرف.'; return; }
      if (p !== c) { err.textContent = 'كلمتا المرور غير متطابقتين.'; return; }
      const btn = modal.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'جارٍ الحفظ...';
      const { error } = await client.auth.updateUser({ password: p });
      if (error) { err.textContent = error.message; btn.disabled = false; btn.textContent = 'حفظ كلمة المرور'; return; }
      modal.remove();
      history.replaceState({}, document.title, location.pathname + location.search);
      status('تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.', 'ok');
    });
  }
  async function requestPasswordReset() {
    if (!ready || !client) { status('إعداد الاتصال بالسحابة غير مكتمل', 'error'); return; }
    const email = prompt('اكتب بريد حساب Supabase لاستعادة كلمة المرور:');
    if (!email) return;
    const redirectTo = location.origin + location.pathname;
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) status('تعذر إرسال رابط الاستعادة: ' + error.message, 'error');
    else status('تم إرسال رابط الاستعادة إلى بريدك الإلكتروني.', 'ok');
  }
  const currentState = () => { try { return JSON.parse(localStorage.getItem('alm_data') || '{}'); } catch (_) { return {}; } };
  async function loadCompany() {
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError) throw new Error('تعذر التحقق من جلسة الدخول: ' + authError.message);
    if (!authData.user) throw new Error('انتهت جلسة الدخول. سجّل الدخول مرة أخرى.');
    const { data: profile, error } = await client.from('profiles')
      .select('company_id,role,is_active,full_name').eq('id', authData.user.id).maybeSingle();
    if (error) throw new Error('تم التحقق من البريد وكلمة المرور، لكن تعذر قراءة ملف الموظف: ' + error.message);
    if (!profile) throw new Error('بيانات الدخول صحيحة، لكن لا يوجد سجل لهذا المستخدم في جدول profiles. أضف ملف الموظف واربطه بالشركة.');
    if (!profile.is_active) throw new Error('هذا الحساب موقوف. راجع مدير النظام.');
    if (!profile.company_id) throw new Error('حسابك غير مربوط بشركة. راجع قيمة company_id في جدول profiles.');
    companyId = profile.company_id;
    const roleNames = { owner: 'مدير', admin: 'مدير', manager: 'مدير', employee: 'موظف', viewer: 'موظف' };
    sessionStorage.setItem('alm_logged_in', '1');
    sessionStorage.setItem('mp_current_user', JSON.stringify({ username: authData.user.email || authData.user.id, name: profile.full_name || authData.user.email || 'مستخدم', role: roleNames[profile.role] || 'موظف', owner: profile.role === 'owner' }));
    const { data: row, error: readError } = await client.from('app_state').select('state').eq('company_id', companyId).maybeSingle();
    if (readError) status('تم تسجيل الدخول، لكن تعذر تحميل بيانات السحابة: ' + readError.message, 'error');
    else if (row && row.state) {
      applyingRemote = true; localStorage.setItem('alm_data', JSON.stringify(row.state));
      if (typeof window.MPApplyCloudState === 'function') window.MPApplyCloudState(row.state);
      applyingRemote = false; status('متصل — تم تحميل بيانات الشركة', 'ok');
    } else {
      const { error: insertError } = await client.from('app_state').insert({ company_id: companyId, state: currentState() });
      if (insertError) status('تم تسجيل الدخول، لكن تعذر إنشاء سجل بيانات الشركة: ' + insertError.message, 'error');
      else status('متصل — تم تهيئة بيانات الشركة لأول مرة', 'ok');
    }
    if (channel) await client.removeChannel(channel);
    channel = client.channel('master-print-company-' + companyId).on('postgres_changes', { event: '*', schema: 'public', table: 'app_state', filter: 'company_id=eq.' + companyId }, payload => {
      if (applyingRemote || !payload.new || !payload.new.state) return;
      applyingRemote = true; localStorage.setItem('alm_data', JSON.stringify(payload.new.state));
      if (typeof window.MPApplyCloudState === 'function') window.MPApplyCloudState(payload.new.state);
      applyingRemote = false; status('تم استلام تحديث جديد من الموقع أو التطبيق', 'ok');
    }).subscribe();
    if (typeof window.MPCloudLoginSuccess === 'function') window.MPCloudLoginSuccess();
  }
  function normalizeLoginEmail(identifier) {
    const value = String(identifier || '').trim();
    if (value.includes('@')) return value.toLowerCase();
    const digits = value.replace(/\D/g, '');
    if (/^01[0-2,5]\d{8}$/.test(digits)) return '20' + digits.slice(1) + '@login.masterprint.invalid';
    if (/^201[0-2,5]\d{8}$/.test(digits)) return digits + '@login.masterprint.invalid';
    throw new Error('اكتب البريد الإلكتروني أو رقم الهاتف المسجل في حسابك.');
  }
  async function signInWithCredentials(identifier, password) {
    if (!ready || !client) throw new Error('اتصال Supabase غير جاهز. راجع إعدادات المشروع.');
    const email = normalizeLoginEmail(identifier);
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await loadCompany();
  }
  async function signIn() {
    if (!ready) { status('أكمل إعداد supabase-config.js أولاً', 'error'); return; }
    const email = prompt('أدخل بريد مستخدم Supabase:'); if (!email) return;
    const password = prompt('أدخل كلمة مرور Supabase:'); if (!password) return;
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) { status(error.message, 'error'); return; }
    try { await loadCompany(); } catch (e) { status(e.message || String(e), 'error'); }
  }
  async function signOut() {
    if (client) await client.auth.signOut();
    if (channel) await client.removeChannel(channel);
    companyId = null; channel = null; status('تم تسجيل الخروج من السحابة');
  }
  async function listCompanyProfiles() {
    if (!client || !companyId) throw new Error('يجب تسجيل الدخول أولاً.');
    const { data, error } = await client.from('profiles').select('id,full_name,email,role,is_active,department,created_at').eq('company_id', companyId).order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }
  async function createCompanyUser({ email, password, fullName, role, department }) {
    if (!client || !companyId) throw new Error('يجب تسجيل الدخول أولاً.');
    const { data: current } = await client.auth.getUser();
    if (!current.user) throw new Error('انتهت جلسة المدير. سجّل الدخول مجددًا.');
    const { data: me, error: meError } = await client.from('profiles').select('role,company_id,is_active').eq('id', current.user.id).single();
    if (meError || !me || !me.is_active || !['owner','admin'].includes(me.role)) throw new Error('ليس لديك صلاحية إنشاء حسابات.');
    // A separate non-persistent client prevents signUp from replacing the owner's active session.
    const signupClient = window.supabase.createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await signupClient.auth.signUp({
      email: String(email).trim().toLowerCase(), password,
      options: { data: { full_name: fullName, company_id: companyId } }
    });
    if (error) throw error;
    if (!data.user) throw new Error('Supabase لم يُرجع مستخدمًا جديدًا.');
    const profileRole = role === 'مدير' ? 'manager' : 'employee';
    const { error: profileError } = await client.from('profiles').insert({
      id: data.user.id, company_id: companyId, full_name: fullName, email: String(email).trim().toLowerCase(),
      role: profileRole, is_active: true, department: department || null
    });
    if (profileError) throw new Error('تم إنشاء حساب Auth لكن تعذرت إضافة ملف الموظف: ' + profileError.message);
    return { email: data.user.email, confirmationRequired: !data.session };
  }
  async function updateCompanyProfile(id, changes) {
    if (!client || !companyId) throw new Error('يجب تسجيل الدخول أولاً.');
    const patch = {};
    if (changes.role) patch.role = changes.role === 'مدير' ? 'manager' : 'employee';
    if (typeof changes.is_active === 'boolean') patch.is_active = changes.is_active;
    if (changes.department !== undefined) patch.department = changes.department;
    const { error } = await client.from('profiles').update(patch).eq('id', id).eq('company_id', companyId);
    if (error) throw error;
  }
  function queueSave(state) {
    if (!client || !companyId || applyingRemote) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const { error } = await client.from('app_state').upsert({ company_id: companyId, state: state || currentState(), updated_at: new Date().toISOString() }, { onConflict: 'company_id' });
      if (error) status('تعذر حفظ التغييرات: ' + error.message, 'error'); else status('تم حفظ التغييرات على السحابة', 'ok');
    }, 700);
  }
  // Backward-compatible alias: older deployed login pages call signInWithPhone.
  // The current login form accepts email/password, so route both names to Supabase Auth.
  const signInWithPhone = signInWithCredentials;
  window.MPCloud = { signIn, signInWithCredentials, signInWithPhone, signOut, queueSave, requestPasswordReset, listCompanyProfiles, createCompanyUser, updateCompanyProfile, isReady: () => ready };
  window.addEventListener('DOMContentLoaded', () => {
    if (!ready) status('إعداد رابط المشروع والمفتاح العام غير مكتمل', 'error');
    else {
      client = window.supabase.createClient(config.url, config.publishableKey);
      client.auth.getSession().then(async ({ data }) => { if (data.session) { try { await loadCompany(); } catch (e) { status(e.message || String(e), 'error'); } } });
      client.auth.onAuthStateChange(async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') showPasswordRecovery();
      });
    }
  });
})();
