# Share to Zapy: iOS Shortcut

Save anything from any app's share sheet (Instagram, LinkedIn, TikTok, Safari, Photos, Notes) to Zapy with one iOS Shortcut. There is no native build, no in-app login, and no scraping: the Shortcut posts what you shared to Zapy's `POST /save` endpoint with your personal share token, and Zapy reads it like any other save.

Build time is about five minutes. You need the Shortcuts app (built into iOS) and the Zapy app.

## 1. Get your token

1. Open Zapy → **Profile** → **Share to Zapy**.
2. Tap **Copy token**. It looks like `zapy_` followed by 64 letters and numbers.

Keep it private: anyone with the token can add saves to your Zapy. If it leaks, tap **Rotate** and paste the new token into the Shortcut (step 4). The old token stops working at once.

## 2. Create the Shortcut and put it in the share sheet

1. Open **Shortcuts** → **+** (top right). Tap the name at the top and call it **Save to Zapy**.
2. Tap the **ⓘ** button (bottom; on older iOS, the settings icon at the top) and turn on **Show in Share Sheet**. Tap **Done**.
3. A **Receive Any input from Share Sheet** block appears at the top. Tap **Any** and select only **Images**, **Text**, and **URLs**. Tap **If there's no input** and choose **Stop and Respond**.

## 3. Store the token once

1. Add the action **Text** (search "Text"). Paste your token into it.
2. Add **Set Variable**. Name the variable `Token`; its input is the **Text** above.

## 4. Branch on what was shared

Build three branches. Images go first because a screenshot share can also carry a URL.

### Branch A: images

1. Add **Get Images from Input**. Input: **Shortcut Input**.
2. Add **If**. Input: **Images**, condition **has any value**.
3. Inside the **If**, add **Repeat with Each** over **Images**. Inside the repeat:
   1. **Resize Image**: Repeat Item, width **2048**, height auto. This keeps uploads under Zapy's 8 MB limit.
   2. **Convert Image**: Resized Image to **JPEG**, quality about **0.8**, Preserve Metadata off.
   3. **Get Contents of URL** with URL `https://pleasant-lark-678.convex.site/save`. Tap **Show More**:
      - Method: **POST**
      - Headers → **Add new header**: key `Authorization`, value `Bearer ` (with one space) followed by the **Token** variable.
      - Headers → **Add new header**: key `Content-Type`, value `image/jpeg`.
      - Request Body: **File**, File: **Converted Image**.

### Branch B: links

1. Tap **Otherwise** (under the If from Branch A). Add **Get URLs from Input**. Input: **Shortcut Input**.
2. Add **If**. Input: **URLs**, condition **has any value**.
3. Inside it, add **Get Contents of URL** with URL `https://pleasant-lark-678.convex.site/save`. Tap **Show More**:
   - Method: **POST**
   - Headers: `Authorization` = `Bearer ` + **Token** (as above).
   - Request Body: **JSON**. Add two fields:
     - Text field, key `url`, value: the **URLs** variable. If a share carries several links, tap the variable and pick **Get Item from List → First Item** first.
     - Text field, key `text`, value: **Shortcut Input**. LinkedIn and TikTok share a caption with the link, and Zapy reads it too.

### Branch C: plain text

1. Tap the **Otherwise** of Branch B's If. Add **Get Contents of URL** with the same URL:
   - Method: **POST**
   - Headers: `Authorization` = `Bearer ` + **Token**.
   - Request Body: **JSON** with one Text field, key `text`, value **Shortcut Input**.

Leave both **End If** blocks where Shortcuts put them.

## 5. Confirm

After the last **End If**, add **Show Notification** with the text **Saved to Zapy**.

## 6. Use it

In Instagram, LinkedIn, TikTok, or any app: tap **Share** → **Save to Zapy** (scroll the app row, or tap **More** and add it to Favorites). The first run asks to allow sending to `pleasant-lark-678.convex.site`; tap **Always Allow**. The save shows up in Zapy's Library within a second, and analysis starts right away.

## What the endpoint accepts

| Request | Body | Result |
| --- | --- | --- |
| `Content-Type: application/json` | `{ "url": "...", "text": "..." }` (either or both) | Saved as a link or as text, like the Capture screen |
| `Content-Type: text/plain` | the text | Saved as text |
| `Content-Type: image/*` | the raw image, at most 8 MB | Saved as an image; Zapy reads it with vision |

Every request needs `Authorization: Bearer <token>`. Responses are JSON: `200 { "ok": true, "itemId": "..." }` on success.

## Troubleshooting

- **401**: the token is missing, mistyped, or was rotated. Copy it again from Profile → Share to Zapy and paste it into the **Text** action from step 3.
- **413**: the image is over 8 MB. Lower the **Resize Image** width or the JPEG quality.
- **429**: more than 30 saves in a minute. Wait a minute and share again.
- **400**: the share had nothing Zapy could read (an empty body or a malformed link). Check that the JSON keys are exactly `url` and `text`.
- Test from a Mac or a terminal:

  ```sh
  curl -X POST https://pleasant-lark-678.convex.site/save \
    -H "Authorization: Bearer $ZAPY_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"url":"https://www.instagram.com/p/abc123/"}'
  ```
