const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "../../src");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

test("upload settings expose the self-hosted mode with URL + model fields", () => {
  const settings = read("components/settings/UploadSettings.tsx");
  assert.match(settings, /id: "self-hosted"/, "self-hosted mode offered in the upload picker");
  assert.match(settings, /<SelfHostedPanel/, "SelfHostedPanel rendered for self-hosted uploads");
  assert.match(
    settings,
    /service="transcription"/,
    "panel bound to the transcription self-hosted service"
  );
  assert.match(settings, /setUploadRemoteTranscriptionUrl/, "URL field wired");
  assert.match(settings, /setUploadRemoteTranscriptionModel/, "model field wired");
  assert.match(
    settings,
    /setUploadTranscriptionMode\(mode\)/,
    "mode switch persists the selection"
  );
});

test("upload view already routes self-hosted through the request path", () => {
  const view = read("components/notes/UploadAudioView.tsx");
  assert.match(view, /isSelfHosted = transcriptionMode === "self-hosted"/, "mode detected");
  assert.match(
    view,
    /setProviderReady\(!!remoteTranscriptionUrl\?\.trim\(\)\)/,
    "provider ready gates on the URL"
  );
  assert.match(view, /remoteTranscriptionUrl/, "URL passed to the transcription config");
  assert.match(view, /remoteTranscriptionModel/, "model passed to the transcription config");
});

test("file transcription forwards the self-hosted mode, URL and model", () => {
  const ft = read("services/fileTranscription.ts");
  assert.match(ft, /transcriptionMode: cfg\.transcriptionMode/, "mode forwarded");
  assert.match(ft, /remoteTranscriptionUrl: cfg\.remoteTranscriptionUrl/, "URL forwarded");
  assert.match(ft, /remoteTranscriptionModel: cfg\.remoteTranscriptionModel/, "model forwarded");
  assert.match(
    ft,
    /cfg\.transcriptionMode !== "self-hosted"/,
    "self-hosted keeps local diarization"
  );
});
