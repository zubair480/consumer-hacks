# Share to Zapy: Android (HTTP Shortcuts)

Save anything from any Android app's share sheet (Instagram, LinkedIn, TikTok, Chrome, Photos, Gallery) to Zapy with the free, open-source app **HTTP Shortcuts** by Waboodoo. There is no native build and no in-app login: HTTP Shortcuts posts what you shared to Zapy's `POST /save` endpoint with your personal share token, and Zapy reads it like any other save.

Build time is about five minutes. You need HTTP Shortcuts ([Play Store](https://play.google.com/store/apps/details?id=ch.rmy.android.http_shortcuts), also on F-Droid) and the Zapy app.

**You build two shortcuts, one for text and links and one for images.** HTTP Shortcuts routes a share by what it carries: shared text goes to shortcuts that use a variable allowed to receive shared text, and a shared file goes to shortcuts whose request body is a file. One shortcut can't do both, so you make a pair. Both appear behind the same **Send to…** (HTTP Shortcuts) entry in the share sheet, and the right one runs on its own.

Labels below are taken from the app's source ([github.com/Waboodoo/HTTP-Shortcuts](https://github.com/Waboodoo/HTTP-Shortcuts), `strings.xml` as of November 2026) and its [docs](https://http-shortcuts.rmy.ch/advanced#share-text).

## 1. Get your token

1. Open Zapy → **Profile** → **Share to Zapy**.
2. Tap **Copy token**. It looks like `zapy_` followed by 64 letters and numbers.

Keep it private: anyone with the token can add saves to your Zapy. If it leaks, tap **Rotate** and paste the new token into both shortcuts (the **Token** field in steps 3 and 4). The old token stops working at once.

## 2. Create the shared-text variable

1. Open **HTTP Shortcuts** → open the menu (⋮, top right) → **Global Variables**.
2. Tap **+** and pick the type **Static Variable**.
3. **Name:** `shared`. Leave the value empty.
4. Under **Advanced Settings**, turn on:
   - **JSON encode**, so quotes and line breaks in a caption don't break the JSON body.
   - **Allow Receiving Value from Share Dialog**. In **Data to Receive from Sharing**, pick **Text only**.
5. Tap **Save** (✓).

## 3. Shortcut A: "Save to Zapy" (text and links)

1. Back on the main screen, tap **+** → **Regular HTTP Shortcut** → **Create from scratch**.
2. **Basic Settings:** name it **Save to Zapy**.
3. **Basic Request Settings:**
   - **Method:** `POST`
   - **URL:** `https://pleasant-lark-678.convex.site/save`
4. **Authentication** → **Authentication Method:** **Bearer Authentication** → **Token:** paste your token. This sends `Authorization: Bearer <token>`. (Adding a header under **Request Headers** with key `Authorization` and value `Bearer <token>` works the same.)
5. **Request Body / Parameters** → **Request Body Type:** **Custom Text**.
   - **Content-Type:** `application/json`
   - Body: type `{"text": "` then tap the **{ }** button and pick the global variable **shared** (it shows in purple), then type `"}`. The finished body reads:

     ```json
     {"text": "{shared}"}
     ```

   We send the shared text as `text`, not `url`, on purpose. When the shared text is just a link (Instagram, YouTube, Chrome), Zapy saves it as a link exactly as if it were sent as `url`. When an app shares a caption plus a link (TikTok, some LinkedIn shares), `url` would be rejected with **400** "That doesn't look like a valid link", while `text` saves the whole caption.
6. **Response Handling:**
   - **On Success:** **Show a custom message** → **Message:** `Saved to Zapy`
   - **On Failure:** **Show a simple error message** (any non-2xx response counts as a failure, so a bad token or a rejected share shows a toast like "Save to Zapy failed with status code 401").
   - **Display Type:** **Toast Popup**
7. Optional, Android 11 and newer: **Trigger & Execution Settings** → turn on **Show as app shortcut on launcher**. This also makes **Save to Zapy** appear as its own Direct Share target in the top row of the share sheet.
8. Tap **Save** (✓).

## 4. Shortcut B: "Save image to Zapy" (images)

1. Tap **+** → **Regular HTTP Shortcut** → **Create from scratch**. Name it **Save image to Zapy**.
2. **Basic Request Settings:** **Method** `POST`, **URL** `https://pleasant-lark-678.convex.site/save`.
3. **Authentication:** **Bearer Authentication**, **Token:** your token (as in shortcut A).
4. **Request Body / Parameters** → **Request Body Type:** **File**.
   - **File Data Source:** **Open File Picker**. A shared image replaces the picker, so nothing opens when you share.
   - **Content-Type:** leave it **empty**. HTTP Shortcuts then sends the shared file's own type (`image/jpeg`, `image/png`, …), which is what Zapy needs.
5. **Response Handling:** same as shortcut A (**Show a custom message** `Saved to Zapy`, **Show a simple error message**, **Toast Popup**).
6. **Trigger & Execution Settings:** check that **Allow receiving files from share dialog** is on (it is by default once the body is a file). Optionally turn on **Show as app shortcut on launcher** for Direct Share, as in shortcut A.
7. Tap **Save** (✓).

## 5. Use it

- **A link or a post** (Instagram, LinkedIn, TikTok, YouTube, X, Chrome): tap **Share** → **Send to…** (the HTTP Shortcuts icon), or the **Save to Zapy** Direct Share target. On some apps the HTTP Shortcuts target is under **More**.
- **An image** (Gallery, Google Photos, a screenshot): tap **Share** → **Send to…** → it runs **Save image to Zapy**.

You'll see the **Saved to Zapy** toast, and the save shows up in Zapy's Library within a second while analysis starts.

The first run doesn't ask for any permission. If HTTP Shortcuts shows a list of shortcuts instead of running one, another of your shortcuts also accepts shared text or files: pick the Zapy one, or turn off **Allow Receiving Value from Share Dialog** / **Allow receiving files from share dialog** on the other.

## What the endpoint accepts

| Request | Body | Result |
| --- | --- | --- |
| `Content-Type: application/json` | `{ "url": "...", "text": "..." }` (either or both) | Saved as a link or as text; a `text` that is only a link is saved as a link |
| `Content-Type: text/plain` | the text | Saved as text |
| `Content-Type: image/*` | the raw image, at most 8 MB | Saved as an image; Zapy reads it with vision |

Every request needs `Authorization: Bearer <token>`. Responses are JSON: `200 { "ok": true, "itemId": "..." }` on success.

## Troubleshooting

- **401**: the token is missing, mistyped, or was rotated. Copy it again from Profile → Share to Zapy and paste it into **Authentication → Token** in both shortcuts.
- **413**: the image is over 8 MB (full-resolution camera photos can be). Share a screenshot, or share from Google Photos after editing/saving a smaller copy. HTTP Shortcuts doesn't resize images.
- **415**: the body went out without a usable Content-Type. In shortcut A, check **Content-Type** is `application/json`; in shortcut B, leave it empty.
- **429**: more than 30 saves in a minute. Wait a minute and share again.
- **400**: the share had nothing Zapy could read, or the JSON is malformed. Check that **JSON encode** is on for the `shared` variable and the body is exactly `{"text": "{shared}"}` with the purple variable chip.
- "No suitable shortcuts found": the variable isn't allowed to receive shares (step 2.4), or shortcut A doesn't use it in its body.
- Test from a computer:

  ```sh
  curl -X POST https://pleasant-lark-678.convex.site/save \
    -H "Authorization: Bearer $ZAPY_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"text":"https://www.instagram.com/p/abc123/"}'
  ```

For iPhone, see [ios-shortcut.md](ios-shortcut.md).
