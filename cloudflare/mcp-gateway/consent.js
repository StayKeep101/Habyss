/**
 * "Allow Claude to use your Habyss?": the page Supabase Auth's OAuth server
 * sends people to (Authentication → OAuth Server → Authorization Path:
 * /oauth/consent, on Site URL https://mcp.<domain>). Sign in with Apple or
 * Google (the same accounts as the app), then Allow or Don't allow. Names
 * from the request are set as text, never as HTML.
 */
export function consentPage({ supabaseUrl, supabaseKey }) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark light">
<title>Connect Habyss</title>
<style>
  :root { --bg: #0B1220; --card: #131C2E; --text: #E6ECF5; --muted: #9AA7BD; --accent: #799CD8; --on-accent: #0B1220; --line: rgba(255,255,255,0.08); }
  @media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) { --bg: #F4F6FA; --card: #FFFFFF; --text: #0F172A; --muted: #5B6578; --accent: #3F63A8; --on-accent: #FFFFFF; --line: rgba(15,23,42,0.08); } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; background: var(--bg); color: var(--text); font: 17px/1.45 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif; }
  main { width: 100%; max-width: 380px; background: var(--card); border: 1px solid var(--line); border-radius: 24px; padding: 28px 22px; text-align: center; }
  h1 { font-size: 22px; line-height: 1.25; margin: 0 0 8px; }
  p { color: var(--muted); margin: 0 0 20px; font-size: 15px; }
  ul { text-align: left; color: var(--muted); font-size: 15px; padding-left: 20px; margin: 0 0 22px; }
  button { display: block; width: 100%; min-height: 50px; border-radius: 14px; border: 0; font: 600 17px -apple-system, system-ui, sans-serif; margin-top: 10px; cursor: pointer; }
  .primary { background: var(--accent); color: var(--on-accent); }
  .quiet { background: transparent; color: var(--muted); }
  .apple { background: var(--text); color: var(--bg); }
  .google { background: transparent; color: var(--text); border: 1px solid var(--line); }
  .who { font-size: 13px; color: var(--muted); margin-top: 14px; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<main>
  <div id="loading"><p>One moment…</p></div>

  <section id="signin" hidden>
    <h1>Sign in to Habyss</h1>
    <p>Use the account you use in the app.</p>
    <button class="apple" id="apple">Continue with Apple</button>
    <button class="google" id="google">Continue with Google</button>
  </section>

  <section id="consent" hidden>
    <h1 id="title">Allow access?</h1>
    <p>It will be able to:</p>
    <ul>
      <li>See today's plan, your habits, tasks and goals</li>
      <li>Add habits, tasks, goals and roadmaps</li>
      <li>Tick tasks and habits done</li>
    </ul>
    <button class="primary" id="allow">Allow</button>
    <button class="quiet" id="deny">Don't allow</button>
    <div class="who" id="who"></div>
  </section>

  <section id="problem" hidden>
    <h1>That didn't work</h1>
    <p id="problemText">Go back to the app you were connecting and try again.</p>
  </section>
</main>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.89.0/dist/umd/supabase.min.js"></script>
<script>
(async () => {
  const show = id => ['loading', 'signin', 'consent', 'problem'].forEach(name => { document.getElementById(name).hidden = name !== id; });
  const fail = text => { if (text) document.getElementById('problemText').textContent = text; show('problem'); };
  const params = new URLSearchParams(location.search);
  const id = params.get('authorization_id');
  if (!id) return fail('This page opens from Claude or ChatGPT when you connect Habyss.');
  const sb = supabase.createClient(${JSON.stringify(supabaseUrl)}, ${JSON.stringify(supabaseKey)}, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } });

  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    // Back here after signing in, with the same authorization_id.
    const back = location.origin + location.pathname + '?authorization_id=' + encodeURIComponent(id);
    for (const provider of ['apple', 'google']) {
      document.getElementById(provider).onclick = () => sb.auth.signInWithOAuth({ provider, options: { redirectTo: back } });
    }
    return show('signin');
  }

  const { data, error } = await sb.auth.oauth.getAuthorizationDetails(id);
  if (error || !data) return fail(error && error.message);
  // Already allowed before: straight back.
  if (data.redirect_url) { location.replace(data.redirect_url); return; }
  const app = (data.client && (data.client.name || data.client.client_name)) || 'This app';
  document.getElementById('title').textContent = 'Allow ' + app + ' to use Habyss?';
  document.getElementById('who').textContent = data.user && data.user.email ? 'Signed in as ' + data.user.email : '';
  document.getElementById('allow').onclick = async () => { show('loading'); const r = await sb.auth.oauth.approveAuthorization(id); if (r.error) fail(r.error.message); };
  document.getElementById('deny').onclick = async () => { show('loading'); const r = await sb.auth.oauth.denyAuthorization(id); if (r.error) fail(r.error.message); };
  show('consent');
})().catch(error => {
  document.getElementById('problemText').textContent = (error && error.message) || 'Something went wrong.';
  ['loading', 'signin', 'consent'].forEach(name => { document.getElementById(name).hidden = true; });
  document.getElementById('problem').hidden = false;
});
</script>
</body>
</html>`;
}
