# Privacy Policy for Eyes Chrome Extension

**Effective Date:** June 5, 2026  
**Last Updated:** June 5, 2026

## Our Commitment to Privacy

Eyes is built with a strong focus on user privacy and minimal data handling. We believe powerful accessibility tools should never come at the cost of your personal information.

This Privacy Policy explains what information the Eyes Chrome extension ("Eyes", "the extension", "we", "us", or "our") collects, how we use it, and the choices you have.

By installing or using Eyes, you agree to the practices described in this policy.

## Information We Collect — None

Eyes is designed to **collect zero personal data**:

- We do **not** collect, store, or transmit any personal information.
- We do **not** track your browsing history or activity.
- We do **not** use analytics, cookies, telemetry, or any third-party tracking.
- We do **not** send any data to external servers or services.

All processing happens **locally inside your browser**.

## How Eyes Stores Your Preferences

The only data the extension handles is your own customization settings, which are saved **exclusively on your device**:

- Selected visual mode (Dark, Grayscale, Sepia, Blue Light, High Contrast)
- Brightness, contrast, font scale, line height, and letter spacing values
- Custom text, background, and link colors
- Site-specific vs global setting preference

These preferences are stored using Chrome’s built-in `chrome.storage.local` API. They are used solely to apply visual accessibility improvements to the websites you visit and to remember your choices across sessions.

You can reset or change these settings at any time through the extension popup. Clearing your browser data or uninstalling the extension will remove all stored preferences.

## Permissions Explained

Eyes requests the following permissions **only** to deliver its core accessibility features:

| Permission              | Purpose                                                                 | Data Flow                  |
|-------------------------|-------------------------------------------------------------------------|----------------------------|
| `storage`               | Save and retrieve your visual preferences locally                      | Stays on your device      |
| `activeTab`             | Allow the popup to communicate with and update the currently active tab in real time | Temporary, local only     |
| Host permission `<all_urls>` | Inject CSS filters, readability styles, and color overrides on any page you choose to enhance | All modifications are client-side; no data leaves your browser |

These permissions are necessary for the extension to work on the websites you browse. We do not use them to read page content for any purpose other than applying your chosen visual enhancements.

## No Remote Code or External Services

- Eyes contains **no remote code execution**.
- There are **no external API calls**, analytics scripts, or third-party libraries that phone home.
- All visual transformations (filters, custom CSS, readability adjustments) are generated and applied locally by the extension’s content script.

## Your Rights and Control

You have full control:

- Adjust or disable any mode or setting instantly via the popup.
- Use site-specific mode or apply settings globally.
- Uninstall the extension at any time to remove all local data.
- Review or clear `chrome.storage.local` data through Chrome’s developer tools if desired.

## Children’s Privacy

Eyes is not directed at children under the age of 13 (or the applicable age of digital consent in your jurisdiction). We do not knowingly collect any information from children.

## Changes to This Policy

We may update this Privacy Policy occasionally to reflect changes in the extension or legal requirements. The “Last Updated” date at the top will indicate revisions. Material changes will be communicated through the Chrome Web Store listing or extension update notes where appropriate.

Continued use of Eyes after an update constitutes acceptance of the revised policy.

## Contact

If you have questions, concerns, or feedback about this Privacy Policy or the Eyes extension, please reach out through:

- The **Support** section of the Chrome Web Store listing for Eyes
- Any associated developer contact channels listed there

We take privacy seriously and aim to respond promptly.

---

**Summary**  
Eyes is a privacy-first accessibility extension.  
**No data collection. No tracking. No external transmission.**  
Everything stays on your device to give you comfortable, sharp, and customizable browsing — nothing more.

Thank you for using Eyes responsibly. 👁

---

*This policy applies only to the Eyes Chrome extension and does not cover any websites you visit while using it.*