# My Chat Timestamps

A small, self-installed Chrome extension that displays the **actual message creation time** in ChatGPT. No account, publishing step, or extra service required.

ChatGPT knows when a message was sent. This puts that information where you can see it.

## Features

- Shows date and local time (including seconds) next to your ChatGPT messages.
- Optional timestamps on ChatGPT replies.
- 12-hour or 24-hour clock format.
- Works with existing conversations when ChatGPT exposes their timestamp metadata.
- Runs locally in Chrome, without analytics, external libraries, or outbound requests.
- Shows no timestamp when ChatGPT does not expose a reliable value. It never substitutes the current time.

## Install (Chrome on macOS, Windows, or Linux)

1. Download this repository using **Code → Download ZIP**, or clone it.
2. Extract the ZIP to a **permanent folder**. On a Mac, `~/Extensions/my-chat-timestamps` is a good choice.
3. Open `chrome://extensions` in Chrome.
4. Enable **Developer mode** (upper-right).
5. Click **Load unpacked** and select the folder containing `manifest.json`.
6. Open or refresh [ChatGPT](https://chatgpt.com/) and view a conversation.

**Do not move or delete that folder** after installation. Chrome loads the extension files from that location. This unpacked extension does **not** update automatically.

## Settings

Open the extension popup from Chrome's puzzle-piece icon. You can choose:

- **24-hour time:** off by default (12-hour AM/PM).
- **Your messages only:** on by default. Turn it off to also display timestamps for assistant replies.

Settings are stored in ChatGPT's local browser storage on the device. No separate accounts or cloud synchronization.

## Permissions and privacy

The extension requests `activeTab` and `scripting` for its settings popup. Its content script runs only on `https://chatgpt.com/*` and `https://chat.openai.com/*`.

It reads message timestamps from metadata already accessible to scripts running inside ChatGPT's page and inserts small timestamp labels. The content script uses Chrome's `MAIN` execution world because the timestamp metadata is stored in ChatGPT's in-memory React state.

**Important:** Because the extension executes in the page's `MAIN` world, it technically has access to the contents of the ChatGPT page. The reviewed version of this code does not record message bodies, and it contains no `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, analytics, remote scripts, or message-export mechanism. This is a source-code observation, not a guarantee about future modifications or other browser extensions.

The project is not affiliated with or endorsed by OpenAI.

## Troubleshooting and limitations

- If timestamps don't appear, refresh the tab and confirm the extension is enabled in `chrome://extensions`.
- ChatGPT periodically changes its UI. These changes can break timestamp extraction without warning.
- Older conversations or some assistant replies may lack accessible creation-time metadata.
- The date and time are displayed in your computer's time zone.
- A conversation's start time is represented by its earliest accessible user-message timestamp. This extension does not add a separate conversation-level start indicator.
- The source was reviewed and syntax-checked, but hasn't been automatically tested against every live ChatGPT interface variant.

## Update

If you edit or replace the files in the extension directory, visit `chrome://extensions` and click **Reload** on **My Chat Timestamps**, then refresh ChatGPT. Revisit the source before installing updates from any contributor.

## License and attribution

Released under the MIT License. This extension adapts the timestamp-reading techniques from [Hangzhi/chatgpt-timestamp-extension](https://github.com/Hangzhi/chatgpt-timestamp-extension), also MIT-licensed. See [LICENSE](LICENSE) for the original copyright notice and license terms.
