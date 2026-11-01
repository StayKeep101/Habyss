# Preview delivery

- After each completed set of app edits, run the relevant checks and update the EAS preview so the user can try the changes.
- For compatible JavaScript, styling, and asset changes, publish an EAS Update to the `preview` channel using the `preview` environment. Verify the installed preview runtime and target platforms first.
- If changes require native code or configuration, create an EAS build with the `preview` profile instead of publishing an incompatible OTA update.
- Report the update or build link and any verification limitations. Never publish to production unless explicitly requested.
