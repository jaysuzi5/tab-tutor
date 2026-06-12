// Mic-privacy promise, shown BEFORE requesting permission (spec §10).

export function MicPrivacyNote() {
  return (
    <p className="privacy">
      🎙️ Your mic is used only to listen to your guitar, right here in your
      browser. <strong>Raw audio never leaves this device</strong> and is never
      uploaded or sent to any AI. Only tiny structured features (the chord we
      heard, timing, confidence) are used — and only when you start a session.
    </p>
  );
}
