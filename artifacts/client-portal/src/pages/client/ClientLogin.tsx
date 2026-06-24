import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { callCrmApi, crmSignIn, CrmSignInError } from '@/lib/crmApi';
import { useCrm } from '@/contexts/CrmContext';
import { Loader2, Eye, EyeOff, AlertCircle, Lock, Mail, Shield, ShieldCheck, Landmark, FileText, UserCheck, HeadphonesIcon, Clock, KeyRound, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { track, startTracking, flushNow } from '@/lib/clientTracking';
import { fetchPortalBranding, getCachedPortalBranding, type PortalBranding } from '@/lib/portalBranding';
import UBSLogoInline from '@/components/client-portal/UBSLogoInline';
import { useLanguage } from '@/contexts/LanguageContext';

const normalizeClientEmail = (value: string) => value.trim().toLowerCase();

type LoginErrorDetails = {
  message: string;
  status: number;
  step: string;
  requestId: string;
};

const friendlyMessage = (err: CrmSignInError, lang: 'fr' | 'en'): string => {
  if (err.step === 'auth') {
    if (err.status === 400) return lang === 'en' ? 'Incorrect username or password.' : 'Identifiant ou mot de passe incorrect.';
    if (err.status === 429) return lang === 'en' ? 'Too many attempts. Please wait a few minutes.' : 'Trop de tentatives. Merci de patienter quelques minutes.';
    if (err.status >= 500) return lang === 'en' ? 'Authentication service temporarily unavailable.' : "Service d'authentification momentanément indisponible.";
  }
  if (err.step === 'role_check') return lang === 'en' ? 'This account is not authorized to access the client space.' : "Ce compte n'est pas autorisé à accéder à l'espace client.";
  if (err.step === 'network') return lang === 'en' ? 'Unable to connect. Check your Internet connection.' : 'Connexion impossible. Vérifiez votre connexion Internet.';
  return err.message || (lang === 'en' ? 'Unknown error.' : 'Erreur inconnue.');
};


const ClientLogin = () => {
  const navigate = useNavigate();
  const { user: crmUser, authReady, refreshAuth } = useCrm();
  const { lang, setLang, t } = useLanguage();

  const services = [
    { icon: Landmark,       title: t.login.svcWealth,  desc: t.login.svcWealthDesc },
    { icon: FileText,       title: t.login.svcAsset,   desc: t.login.svcAssetDesc },
    { icon: UserCheck,      title: t.login.svcAdvice,  desc: t.login.svcAdviceDesc },
    { icon: HeadphonesIcon, title: t.login.svcSupport, desc: t.login.svcSupportDesc },
  ];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState<PortalBranding | null>(() => getCachedPortalBranding());
  const [brandingLoading, setBrandingLoading] = useState(!getCachedPortalBranding());
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<LoginErrorDetails | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const MAX_ATTEMPTS = 3;

  useEffect(() => {
    fetchPortalBranding()
      .then(data => { setBranding(data); setBrandingError(null); })
      .catch((err: Error) => { if (!getCachedPortalBranding()) setBrandingError(err?.message || 'Erreur'); })
      .finally(() => setBrandingLoading(false));
  }, []);

  useEffect(() => {
    if (authReady && crmUser) navigate('/client/dashboard', { replace: true });
  }, [authReady, crmUser, navigate]);

  const handleLogin = async (eOrCreds?: React.FormEvent | { email: string; password: string }) => {
    let emailVal = email;
    let passwordVal = password;
    if (eOrCreds && 'preventDefault' in eOrCreds) eOrCreds.preventDefault();
    else if (eOrCreds && 'email' in eOrCreds) { emailVal = eOrCreds.email; passwordVal = eOrCreds.password; }
    if (!emailVal || !passwordVal) return;
    setLoading(true);
    setLoginError(null);
    try {
      const authData = await crmSignIn(normalizeClientEmail(emailVal), passwordVal);
      setFailedAttempts(0);
      await refreshAuth(authData.user);
      callCrmApi('manage-client-accounts', 'log-activity', { activityAction: 'login' }, authData.access_token).catch(() => {});
      sessionStorage.setItem('lx.pending_login_log', '1');
      startTracking();
      track('login', { method: 'password' });
      track('session_start');
      flushNow();
      navigate('/client/dashboard', { replace: true });
    } catch (err: any) {
      const isCrm = err instanceof CrmSignInError;
      const isWrongPassword = isCrm && err.step === 'auth' && err.status === 400;
      let nextAttempts = failedAttempts;
      if (isWrongPassword) { nextAttempts = failedAttempts + 1; setFailedAttempts(nextAttempts); }
      const remaining = Math.max(0, MAX_ATTEMPTS - nextAttempts);
      let baseMessage = isCrm ? friendlyMessage(err, lang) : (err?.message || (lang === 'en' ? 'Unknown error' : 'Erreur inconnue'));
      if (isWrongPassword) {
        baseMessage = remaining > 0
          ? (lang === 'en'
              ? `Incorrect password. You have ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`
              : `Mot de passe incorrect. Il vous reste ${remaining} tentative${remaining > 1 ? 's' : ''}.`)
          : (lang === 'en' ? 'Too many attempts. Contact your advisor.' : 'Trop de tentatives. Contactez votre conseiller.');
      }
      setLoginError({
        message: baseMessage,
        status: isCrm ? err.status : 0,
        step: isCrm ? err.step : 'unknown',
        requestId: (isCrm && err.requestId) || `req_${Date.now().toString(36)}`,
      });
      toast.error(baseMessage);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authReady || crmUser) return;
    const params = new URLSearchParams(window.location.search);
    const urlLogin = params.get('login');
    const urlPassword = params.get('password');
    if (!urlLogin || !urlPassword || params.get('autologin') !== '1') return;
    setEmail(urlLogin);
    setPassword(urlPassword);
    window.history.replaceState({}, '', window.location.pathname);
    handleLogin({ email: urlLogin, password: urlPassword });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, crmUser]);

  if (brandingLoading && !branding) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#111111' }}>
        <Loader2 className="w-6 h-6 animate-spin text-white/30" />
      </div>
    );
  }
  if (brandingError && !branding) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-white">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-xl font-semibold text-slate-800">Portail non configuré</h1>
          <p className="text-sm text-slate-400">Contactez votre administrateur pour activer la configuration du portail.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── CSS animations ── */}
      <style>{`
        @keyframes gridPulse {
          0%, 100% { opacity: 0.018; }
          50%       { opacity: 0.035; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tickerBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.7; }
        }
        .anim-fadeup-1 { animation: fadeUp 0.55s ease-out 0.1s both; }
        .anim-fadeup-2 { animation: fadeUp 0.55s ease-out 0.25s both; }
        .anim-fadeup-3 { animation: fadeUp 0.55s ease-out 0.4s both; }
        .anim-fadeup-4 { animation: fadeUp 0.55s ease-out 0.55s both; }
        .anim-fadeup-5 { animation: fadeUp 0.55s ease-out 0.7s both; }
        .login-input:focus {
          border-color: #E60000 !important;
          box-shadow: 0 0 0 3px rgba(230,0,0,0.10) !important;
          background: #fff !important;
        }
        .login-btn:not(:disabled):hover {
          box-shadow: 0 8px 32px rgba(230,0,0,0.45) !important;
          transform: translateY(-1px);
        }
        .login-btn:not(:disabled):active {
          transform: translateY(0);
        }
      `}</style>

      <div className="min-h-screen flex flex-col" style={{ background: '#F5F5F5' }}>

        {/* ═══════════════════════════════════════════
            LEFT PANEL
        ═══════════════════════════════════════════ */}
        <div className="flex flex-1">
        <div
          className="hidden lg:flex lg:w-[52%] flex-col relative overflow-hidden"
          style={{ background: 'linear-gradient(150deg, #080808 0%, #111111 50%, #1A1A1A 80%, #222222 100%)' }}
        >
          {/* Animated grid */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)`,
            backgroundSize: '56px 56px',
            animation: 'gridPulse 5s ease-in-out infinite',
          }} />

          {/* Radial glows */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: `radial-gradient(ellipse at 15% 20%, rgba(230,0,0,0.12) 0%, transparent 45%),
                              radial-gradient(ellipse at 85% 75%, rgba(230,0,0,0.07) 0%, transparent 50%)`
          }} />

          {/* Content */}
          <div className="relative z-10 flex flex-col h-full px-12 xl:px-16 pt-12 pb-8">

            {/* Logo */}
            <div className="anim-fadeup-1 mb-10">
              <UBSLogoInline keysColor="white" className="h-16 w-auto" />
            </div>

            {/* Language switcher — top right of left panel */}
            <div className="absolute top-6 right-6 flex items-center gap-2">
              <button
                onClick={() => setLang('fr')}
                title="Français"
                className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center transition-all duration-200 ring-2 ${lang === 'fr' ? 'ring-white shadow-lg scale-110' : 'ring-transparent opacity-45 hover:opacity-80 hover:scale-105'}`}
              >
                <img src="/flag-fr.svg" alt="Français" className="w-full h-full object-cover" />
              </button>
              <button
                onClick={() => setLang('en')}
                title="English"
                className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center transition-all duration-200 ring-2 ${lang === 'en' ? 'ring-white shadow-lg scale-110' : 'ring-transparent opacity-45 hover:opacity-80 hover:scale-105'}`}
              >
                <img src="/flag-gb.svg" alt="English" className="w-full h-full object-cover" />
              </button>
            </div>

            {/* Red line + headline */}
            <div className="anim-fadeup-2 mb-6">
              <div style={{ width: '64px', height: '3px', background: 'linear-gradient(90deg, #E60000, #FF4444)', borderRadius: '2px', marginBottom: '22px' }} />
              <h1 style={{ fontSize: '2.2rem', fontWeight: 200, lineHeight: 1.22, letterSpacing: '-0.01em', color: '#fff', marginBottom: '14px' }}>
                {t.login.tagline}<br />
                <span style={{ fontWeight: 700, color: '#E60000' }}>{t.login.tagline2}</span>
              </h1>
              <p style={{ fontSize: '0.88rem', fontWeight: 300, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, maxWidth: '340px' }}>
                {t.login.subtitle}
              </p>
            </div>

            {/* Key stats */}
            <div className="anim-fadeup-3 grid grid-cols-2 gap-3 mb-7">
              {[
                { value: '1862', label: t.login.founded },
                { value: 'CHF 5,7 Trn', label: t.login.assets },
              ].map(stat => (
                <div key={stat.label} style={{ borderTop: '1px solid rgba(230,0,0,0.30)', paddingTop: '12px' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 600, color: '#fff', letterSpacing: '-0.02em', marginBottom: '4px' }}>{stat.value}</div>
                  <div style={{ fontSize: '0.63rem', textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.30)' }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Banking services grid */}
            <div className="anim-fadeup-4 mb-auto">
              <div style={{ width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(230,0,0,0.25), transparent)', marginBottom: '20px' }} />
              <div className="grid grid-cols-2 gap-4">
                {services.map(({ icon: Icon, title, desc }) => (
                  <div key={title}
                    className="rounded-xl p-4"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <div className="flex items-center justify-center rounded-lg mb-3"
                      style={{ width: '36px', height: '36px', background: 'rgba(230,0,0,0.12)', border: '1px solid rgba(230,0,0,0.22)' }}>
                      <Icon size={16} style={{ color: '#E60000' }} />
                    </div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.80)', marginBottom: '5px' }}>{title}</div>
                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.55, fontWeight: 300 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Institutional footer */}
          <div className="relative z-10 px-12 xl:px-16 py-5"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)' }}>
            <div className="flex items-end justify-between">
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.05em' }}>
                  UBS GROUP AG
                </div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}>
                  Banque privée internationale — Suisse
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.04em' }}>
                  Depuis 1862
                </div>
                <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.16)', marginTop: '2px' }}>
                  © 2026 Tous droits réservés
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            RIGHT PANEL — Login form
        ═══════════════════════════════════════════ */}
        <div className="flex-1 flex flex-col items-center justify-start relative px-6 py-10 overflow-y-auto"
          style={{ background: 'linear-gradient(160deg, #f2f2f2 0%, #F5F5F5 60%, #ebebeb 100%)', minWidth: 0 }}>

          {/* Mobile dark bg */}
          <div className="absolute inset-0 lg:hidden"
            style={{ background: 'linear-gradient(150deg, #080808 0%, #111111 60%, #1A1A1A 100%)' }} />

          {/* Mobile logo */}
          <div className="lg:hidden relative z-10 mb-8">
            <UBSLogoInline keysColor="white" className="h-12 w-auto mx-auto" />
          </div>

          {/* Card */}
          <div className="relative z-10 w-full anim-fadeup-1" style={{ maxWidth: '620px' }}>
            <div
              className="rounded-2xl px-12 py-10 xl:px-14 xl:py-12"
              style={{
                background: 'rgba(255,255,255,0.97)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.07)',
                border: '1px solid rgba(230,0,0,0.15)',
              }}
            >
              {/* ── Heading ── */}
              <div className="mb-5">
                <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#111111', marginBottom: '6px', lineHeight: 1.2 }}>
                  {t.login.welcome}
                </h2>
                <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.6 }}>
                  {t.login.welcomeSub}
                </p>
              </div>


              {/* ── Form ── */}
              <form onSubmit={handleLogin} className="space-y-4">

                {/* Email */}
                <div className="space-y-1.5">
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748b' }}>
                    {t.login.emailLabel}
                  </label>
                  <div className="relative">
                    <Mail size={15} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder={t.login.emailPlaceholder}
                      autoComplete="email"
                      className="login-input w-full text-sm outline-none transition-all text-slate-800 placeholder-slate-300"
                      style={{ height: '50px', paddingLeft: '44px', paddingRight: '16px', border: '1.5px solid #e2e8f0', borderRadius: '12px', background: '#f8f8f8' }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748b' }}>
                      {t.login.passwordLabel}
                    </label>
                    <a href="#" style={{ fontSize: '0.72rem', color: '#E60000', textDecoration: 'none', opacity: 0.75 }}
                      className="hover:opacity-100 transition-opacity">
                      {t.login.forgotPassword}
                    </a>
                  </div>
                  <div className="relative">
                    <Lock size={15} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={t.login.passwordPlaceholder}
                      autoComplete="current-password"
                      className="login-input w-full text-sm outline-none transition-all text-slate-800 placeholder-slate-300"
                      style={{ height: '50px', paddingLeft: '44px', paddingRight: '48px', border: '1.5px solid #e2e8f0', borderRadius: '12px', background: '#f8f8f8' }}
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                      style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', padding: '4px', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
                      className="hover:text-slate-600 transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember device */}
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: '#E60000' }} />
                  <span style={{ fontSize: '0.82rem', color: '#64748b' }}>{t.login.rememberMe}</span>
                </label>

                {/* Error */}
                {loginError && (
                  <div className="flex items-start gap-2.5 rounded-xl p-3.5" style={{ background: '#fff5f5', border: '1px solid #fecaca' }}>
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p style={{ fontSize: '0.78rem', color: '#dc2626', lineHeight: 1.5 }}>{loginError.message}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="login-btn w-full font-semibold text-sm text-white rounded-xl transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed
                    flex items-center justify-center gap-2"
                  style={{
                    height: '54px',
                    background: 'linear-gradient(135deg, #C00000 0%, #E60000 50%, #FF1A1A 100%)',
                    boxShadow: '0 6px 24px rgba(230,0,0,0.38)',
                    border: 'none',
                    fontSize: '0.9rem',
                    letterSpacing: '0.02em',
                  }}
                >
                  {loading
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <><Lock size={14} /><span>{t.login.submitButton}</span></>
                  }
                </button>

                {/* Help link */}
                <p className="text-center" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  <a href="#" style={{ color: '#111111', textDecoration: 'none', opacity: 0.5 }}
                    className="hover:opacity-90 transition-opacity">
                    {t.login.needHelp}
                  </a>
                </p>
              </form>

              {/* ── Security pillars ── */}
              <div className="mt-6 pt-5" style={{ borderTop: '1px solid #f1f5f9' }}>
                <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontWeight: 600, marginBottom: '10px' }}>
                  {lang === 'en' ? 'Your security first' : 'Votre sécurité avant tout'}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: KeyRound,    label: t.login.secureAuth },
                    { icon: ShieldCheck, label: t.login.encryptedData },
                    { icon: Activity,    label: t.login.monitoring },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl py-3 px-2"
                      style={{ background: '#f8f8f8', border: '1px solid #eeeeee' }}>
                      <Icon size={16} style={{ color: '#E60000', opacity: 0.85 }} />
                      <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 500, textAlign: 'center', lineHeight: 1.3 }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Security advice ── */}
              <div className="mt-4 rounded-xl p-4" style={{ background: 'rgba(230,0,0,0.04)', border: '1px solid rgba(230,0,0,0.15)' }}>
                <p style={{ fontSize: '0.72rem', color: '#4a1010', lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 700 }}>{t.login.securityTip} :</span>{' '}
                  {t.login.securityTipText}
                </p>
              </div>

              {/* ── Assistance section ── */}
              <div className="mt-5 pt-5" style={{ borderTop: '1px solid #f1f5f9' }}>
                <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', fontWeight: 600, marginBottom: '10px' }}>
                  {lang === 'en' ? 'Need assistance?' : 'Besoin d\'assistance ?'}
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    { icon: Clock, text: lang === 'en' ? 'Support available' : 'Assistance disponible', sub: lang === 'en' ? 'Mon – Fri, 9am – 6pm' : 'Lun – Ven, 9h00 – 18h00' },
                  ].map(({ icon: Icon, text, sub }) => (
                    <div key={text} className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: 'rgba(230,0,0,0.07)' }}>
                        <Icon size={13} style={{ color: '#E60000', opacity: 0.8 }} />
                      </div>
                      <div>
                        <p style={{ fontSize: '0.72rem', fontWeight: 600, color: '#1e293b', lineHeight: 1.2 }}>{text}</p>
                        <p style={{ fontSize: '0.67rem', color: '#94a3b8' }}>{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </>
  );
};

export default ClientLogin;
