const endpoint = process.env.NEXT_PUBLIC_SCORE_ENDPOINT?.trim() ?? "";

export const scoreStorageReady = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint);

export function saveScore(score) {
  if (!scoreStorageReady) return Promise.reject(new Error("Google Sheets is not configured."));

  return new Promise((resolve, reject) => {
    const token = crypto.randomUUID();
    const frame = document.createElement("iframe");
    frame.name = `score-${token}`;
    frame.title = "Google Sheets score submission";
    frame.hidden = true;

    const form = document.createElement("form");
    form.hidden = true;
    form.method = "POST";
    form.action = endpoint;
    form.target = frame.name;

    const field = document.createElement("input");
    field.type = "hidden";
    field.name = "submission";
    field.value = JSON.stringify({ ...score, token, origin: window.location.origin });
    form.append(field);

    function complete(error) {
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
      frame.remove();
      form.remove();
      if (error) reject(error);
      else resolve();
    }

    function receive(event) {
      const googleOrigin = /^https:\/\/(?:script\.google\.com|(?:[\w-]+\.)?googleusercontent\.com)$/.test(event.origin);
      if (!googleOrigin || event.data?.type !== "csc-reviewer-score" || event.data?.token !== token) return;
      complete(event.data.ok === true ? null : new Error("Google Sheets rejected the score."));
    }

    const timeout = window.setTimeout(() => complete(new Error("Google Sheets did not confirm the save.")), 20000);
    window.addEventListener("message", receive);
    document.body.append(frame, form);
    form.submit();
  });
}
