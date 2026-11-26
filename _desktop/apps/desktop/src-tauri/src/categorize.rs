//! Built-in categories for well-known apps and websites, so a fresh install shows a breakdown without setup.
//! A user's own category override always wins over these defaults.

/// Keeps scheme, host and path; drops credentials, query and fragment, which often carry tokens or search text.
/// Non-web schemes (about:, chrome://, file:) are kept as the bare scheme so local paths never leave the browser.
pub fn sanitize_url(raw: &str) -> Option<String> {
    let raw = raw.trim();
    let (scheme, rest) = raw.split_once("://")?;
    let scheme = scheme.to_ascii_lowercase();
    if scheme != "http" && scheme != "https" { return Some(format!("{scheme}://")); }
    let end = rest.find(['?', '#']).unwrap_or(rest.len());
    let rest = &rest[..end];
    let (authority, path) = rest.split_once('/').map_or((rest, ""), |(a, p)| (a, p));
    let host = authority.rsplit('@').next()?.to_ascii_lowercase();
    if host.is_empty() { return None; }
    Some(format!("{scheme}://{host}/{path}"))
}

/// The registrable-looking host: lowercase, without `www.` and port. `https://mail.google.com/x` → `mail.google.com`.
pub fn domain(url: &str) -> Option<String> {
    let (_, rest) = url.split_once("://")?;
    let host = rest.split('/').next()?.split(':').next()?.trim_start_matches("www.");
    (!host.is_empty()).then(|| host.to_string())
}

pub fn app_category(bundle: &str) -> &'static str {
    let b = bundle.to_ascii_lowercase();
    // Dotted keys match anywhere; plain keys match the start of a bundle segment, so "arc" never matches "research".
    let segments: Vec<&str> = b.split(['.', '-', '_']).collect();
    let has = |keys: &[&str]| keys.iter().any(|k| if k.contains('.') { b.contains(k) } else { segments.iter().any(|s| s.starts_with(k)) });
    if has(&["xcode", "vscode", "visualstudio", "jetbrains", "intellij", "pycharm", "webstorm", "goland", "rustrover", "clion", "android.studio", "sublimetext", "panic.nova", "zed", "cursor", "windsurf", "terminal", "iterm", "warp", "ghostty", "alacritty", "kitty", "wezterm", "hyper", "tower", "gitkraken", "github", "fork", "sourcetree", "postman", "insomnia", "docker", "tableplus", "dbeaver", "sequel", "simulator", "instruments", "claude", "openai.chat", "orca"]) { return "development"; }
    if has(&["figma", "sketch", "adobe", "pixelmator", "affinity", "framer", "blender", "procreate", "canva", "spline", "rive", "principle", "colorui"]) { return "design"; }
    if has(&["us.zoom", "facetime", "webex", "teams", "gotomeeting", "around", "tuple"]) { return "meetings"; }
    if has(&["slack", "discord", "mail", "outlook", "spark", "airmail", "superhuman", "mimestream", "messages", "mobilesms", "telegram", "whatsapp", "signal", "messenger", "skype", "linear", "missive"]) { return "communication"; }
    if has(&["pages", "word", "ulysses", "iawriter", "bear", "obsidian", "notion", "craft", "drafts", "scrivener", "typora", "notes", "evernote", "logseq", "roam"]) { return "writing"; }
    if has(&["numbers", "excel", "keynote", "powerpoint", "calendar", "ical", "fantastical", "things", "omnifocus", "todoist", "reminders", "ticktick", "habyss", "airtable", "clickup", "asana", "trello", "monday", "1password", "raycast", "alfred"]) { return "productivity"; }
    if has(&["preview", "pdf", "kindle", "books", "zotero", "readwise", "reeder", "netnewswire", "dictionary", "anki"]) { return "research"; }
    if has(&["spotify", "music", "tv", "netflix", "vlc", "iina", "infuse", "podcasts", "steam", "epicgames", "battle.net", "twitch", "photobooth", "plex"]) { return "entertainment"; }
    if has(&["finder", "systempreferences", "systemsettings", "activitymonitor", "console", "keychain", "archive", "cleanmymac", "appstore", "screenshot", "loginwindow"]) { return "utilities"; }
    if has(&["safari", "chrome", "firefox", "brave", "edgemac", "vivaldi", "opera", "thebrowser", "chromium", "orion", "zen"]) { return "browsing"; }
    "uncategorized"
}

/// The category of a site, matched on the domain or any parent domain (`docs.github.com` matches `github.com`).
pub fn domain_category(domain: &str) -> Option<&'static str> {
    const SITES: &[(&str, &str)] = &[
        ("github.com", "development"), ("gitlab.com", "development"), ("bitbucket.org", "development"), ("stackoverflow.com", "development"), ("stackexchange.com", "development"), ("developer.apple.com", "development"), ("developer.mozilla.org", "development"), ("docs.rs", "development"), ("crates.io", "development"), ("npmjs.com", "development"), ("pypi.org", "development"), ("vercel.com", "development"), ("netlify.com", "development"), ("supabase.com", "development"), ("cloudflare.com", "development"), ("expo.dev", "development"), ("localhost", "development"), ("127.0.0.1", "development"), ("claude.ai", "development"), ("chatgpt.com", "development"), ("console.anthropic.com", "development"), ("aws.amazon.com", "development"), ("console.cloud.google.com", "development"), ("tauri.app", "development"), ("react.dev", "development"),
        ("figma.com", "design"), ("dribbble.com", "design"), ("behance.net", "design"), ("canva.com", "design"), ("framer.com", "design"), ("mobbin.com", "design"),
        ("meet.google.com", "meetings"), ("zoom.us", "meetings"), ("teams.microsoft.com", "meetings"), ("whereby.com", "meetings"),
        ("mail.google.com", "communication"), ("outlook.live.com", "communication"), ("outlook.office.com", "communication"), ("slack.com", "communication"), ("discord.com", "communication"), ("web.whatsapp.com", "communication"), ("web.telegram.org", "communication"), ("messenger.com", "communication"), ("linear.app", "communication"),
        ("docs.google.com", "writing"), ("notion.so", "writing"), ("notion.site", "writing"), ("medium.com", "writing"), ("substack.com", "writing"), ("overleaf.com", "writing"),
        ("sheets.google.com", "productivity"), ("calendar.google.com", "productivity"), ("drive.google.com", "productivity"), ("trello.com", "productivity"), ("asana.com", "productivity"), ("todoist.com", "productivity"), ("airtable.com", "productivity"), ("clickup.com", "productivity"), ("monday.com", "productivity"),
        ("wikipedia.org", "research"), ("scholar.google.com", "research"), ("arxiv.org", "research"), ("perplexity.ai", "research"), ("researchgate.net", "research"), ("google.com", "research"), ("duckduckgo.com", "research"), ("bing.com", "research"),
        ("coursera.org", "learning"), ("udemy.com", "learning"), ("khanacademy.org", "learning"), ("edx.org", "learning"), ("duolingo.com", "learning"), ("brilliant.org", "learning"), ("leetcode.com", "learning"), ("frontendmasters.com", "learning"), ("egghead.io", "learning"),
        ("youtube.com", "entertainment"), ("youtu.be", "entertainment"), ("netflix.com", "entertainment"), ("twitch.tv", "entertainment"), ("primevideo.com", "entertainment"), ("disneyplus.com", "entertainment"), ("hulu.com", "entertainment"), ("max.com", "entertainment"), ("spotify.com", "entertainment"), ("soundcloud.com", "entertainment"), ("crunchyroll.com", "entertainment"), ("9gag.com", "entertainment"),
        ("twitter.com", "social"), ("x.com", "social"), ("facebook.com", "social"), ("instagram.com", "social"), ("tiktok.com", "social"), ("reddit.com", "social"), ("linkedin.com", "social"), ("threads.net", "social"), ("bsky.app", "social"), ("pinterest.com", "social"), ("snapchat.com", "social"), ("tumblr.com", "social"), ("news.ycombinator.com", "social"),
        ("cnn.com", "news"), ("bbc.com", "news"), ("bbc.co.uk", "news"), ("nytimes.com", "news"), ("theguardian.com", "news"), ("lemonde.fr", "news"), ("reuters.com", "news"), ("bloomberg.com", "news"), ("theverge.com", "news"), ("techcrunch.com", "news"), ("news.google.com", "news"),
        ("amazon.com", "shopping"), ("amazon.fr", "shopping"), ("amazon.co.uk", "shopping"), ("ebay.com", "shopping"), ("etsy.com", "shopping"), ("aliexpress.com", "shopping"), ("temu.com", "shopping"), ("leboncoin.fr", "shopping"), ("vinted.fr", "shopping"),
    ];
    // Most specific suffix first: mail.google.com is communication although google.com is research.
    let mut host = domain;
    loop {
        if let Some((_, c)) = SITES.iter().find(|(d, _)| *d == host) { return Some(c); }
        host = host.split_once('.')?.1;
        if !host.contains('.') && host != "localhost" { return None; }
    }
}

/// A public DNS name: letters, digits, dots and hyphens, with a dot, not an IP address or a local name.
pub fn public_host(host: &str) -> bool {
    let ok = !host.is_empty() && host.len() <= 253 && host.contains('.') && host.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
        && !host.starts_with(['.', '-']) && !host.ends_with(['.', '-']) && !host.contains("..");
    ok && !host.split('.').all(|p| p.chars().all(|c| c.is_ascii_digit())) && !host.ends_with(".local") && !host.ends_with(".internal") && !host.ends_with(".localhost")
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn urls_lose_query_fragment_and_credentials() {
        assert_eq!(sanitize_url("https://user:pw@WWW.Example.com/a/b?token=1#x").as_deref(), Some("https://www.example.com/a/b"));
        assert_eq!(sanitize_url("https://example.com").as_deref(), Some("https://example.com/"));
        assert_eq!(sanitize_url("file:///Users/me/secret.pdf").as_deref(), Some("file://"));
        assert_eq!(sanitize_url("not a url"), None);
    }
    #[test] fn domains_strip_www_and_port() {
        assert_eq!(domain("https://www.github.com/x").as_deref(), Some("github.com"));
        assert_eq!(domain("http://localhost:3000/").as_deref(), Some("localhost"));
        assert_eq!(domain("file://"), None);
    }
    #[test] fn most_specific_site_wins() {
        assert_eq!(domain_category("mail.google.com"), Some("communication"));
        assert_eq!(domain_category("www.google.com"), Some("research"));
        assert_eq!(domain_category("gist.github.com"), Some("development"));
        assert_eq!(domain_category("en.wikipedia.org"), Some("research"));
        assert_eq!(domain_category("m.youtube.com"), Some("entertainment"));
        assert_eq!(domain_category("example.org"), None);
    }
    #[test] fn apps_get_sensible_defaults() {
        assert_eq!(app_category("com.microsoft.VSCode"), "development");
        assert_eq!(app_category("com.tinyspeck.slackmacgap"), "communication");
        assert_eq!(app_category("com.google.Chrome"), "browsing");
        assert_eq!(app_category("us.zoom.xos"), "meetings");
        assert_eq!(app_category("com.figma.Desktop"), "design");
        assert_eq!(app_category("com.spotify.client"), "entertainment");
        assert_eq!(app_category("com.example.unknown"), "uncategorized");
    }
    #[test] fn only_public_hosts_get_icon_requests() {
        assert!(public_host("github.com")); assert!(public_host("mail.google.com"));
        for bad in ["localhost", "127.0.0.1", "192.168.1.1", "printer.local", "a..b.com", "evil.com/x", "x.com:8080", "", "-a.com"] { assert!(!public_host(bad), "{bad}"); }
    }
}
