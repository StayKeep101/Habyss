# Habyss authentication

## Redirect configuration

All native email (OTP/magic-link and password confirmation) and Google requests use `habyss://auth-callback`. Set this as the Site URL and include it in Redirect URLs under Supabase → Authentication → URL Configuration. Keep any other legitimate app redirects. Do not put this custom scheme in Google's authorized redirect URIs: Google must return to `https://wlbjhtlznzdumqxetilx.supabase.co/auth/v1/callback` first.

On 2026-09-29 a live Google authorization/cancellation round trip returned `http://localhost:3000/`. After the owner updated URL Configuration, the same probe returned `habyss://auth-callback`. Apple, Google and email are enabled. The saved Management API credential lacks `auth_config_read`, so the private provider configuration and email templates were not inspected.

Run `npm run check:auth` to repeat the public settings and PKCE redirect checks. It creates and cancels a diagnostic OAuth flow; it does not authorize an account or send email.

Email templates should use `{{ .ConfirmationURL }}` for the link and can include `{{ .Token }}` for the code entered in Habyss. A direct link to `{{ .SiteURL }}` alone does not verify an email. Request a fresh email after configuration changes. PKCE links must open in the app installation that requested them; the numeric email code is an alternative.

## Apple device signing

The pre-existing local Debug-iphoneos build and its embedded provisioning profile both lacked `com.apple.developer.applesignin`, despite the entitlement being present in the repository. A simulator does not validate device provisioning. The user's `ERR_REQUEST_UNKNOWN` occurs in native Apple authorization before Supabase sees a token.

Use the `com.habyss.app` App ID on team `4JYFVLU9NW`, enable Sign in with Apple, and regenerate its provisioning profile. Both Debug and Release source entitlements already request `Default`. Supabase's Apple Client IDs must include `com.habyss.app`, with nonce verification enabled. Native identity-token sign-in does not require the web OAuth client secret.

The Expo Apple patch presents authentication on the main queue and captures the foreground scene's key window, returning a recoverable error if no window exists. The browser patch also uses scene-aware window lookup. `patch-package` reapplies both during `npm install`; rebuilding the native app is required.

Build and verify the actual signed artifact:

```sh
xcodebuild -workspace ios/Habyss.xcworkspace -scheme Habyss -configuration Debug -destination 'generic/platform=iOS' -allowProvisioningUpdates build
python3 scripts/check-ios-auth.py /path/to/Debug-iphoneos/Habyss.app
```

The checker requires the Apple entitlement in both the code signature and embedded profile, as well as the correct bundle and callback scheme. Installing a newly signed build is necessary; reloading JavaScript cannot update entitlements.

## Google branding

In the Google Cloud project owning the OAuth client, open Google Auth Platform → Branding, set the application name to Habyss, and submit brand verification if requested. A custom Supabase auth domain is needed to replace the project hostname in domain-based browser prompts. This also requires DNS ownership and updating Google's HTTPS callback URI. Do not replace the existing working callback with the app scheme.

Sources: [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Google branding](https://supabase.com/docs/guides/auth/social-login/auth-google#setup-consent-screen-branding), [Apple provider](https://supabase.com/docs/guides/auth/social-login/auth-apple).

## Device acceptance

After installing the new build, check Apple authorization on the signed-in physical iPhone; Google account selection returning to Habyss; a fresh email link with Habyss both open and closed; entering the emailed code; and an expired link showing an in-app error. Unit tests and a cancelled OAuth probe do not establish successful real-user authorization.

## Verification on 2026-09-29

- 58 targeted tests passed across account, social sign-in, older-build fallback, and callback-screen tests; TypeScript passed.
- `patch-package --error-on-fail` applied both new native patches successfully.
- The signed Debug device build succeeded. `scripts/check-ios-auth.py` passed all six checks, including the Apple entitlement in the new provisioning profile and signature.
- Installed the new build on the paired iPhone without uninstalling the existing app.
- The live public auth/PKCE redirect probe passed again after installation. Successful user authorization on the phone remains a manual acceptance check.
- The owner confirmed the Google app name is already Habyss, changed its audience from Testing to Production, and owns `habyss.app`. Brand verification/publication is still separate. The homepage resolves to `https://www.habyss.app/`; `auth.habyss.app` is not configured in DNS.

If a branded auth hostname is also wanted, Supabase custom domains are a paid add-on on a paid plan. Use `auth.habyss.app` (not the website's apex), add a CNAME to `wlbjhtlznzdumqxetilx.supabase.co`, and add the verification TXT record Supabase generates. **Before activation**, add `https://auth.habyss.app/auth/v1/callback` to the Google OAuth client's authorized redirect URIs alongside the existing Supabase URI. After verification and activation, update the app's Supabase URL only after checking the new endpoint. Keep `habyss://auth-callback` as the mobile return URL. No custom-domain purchase, DNS mutation, or activation was performed in this task.
