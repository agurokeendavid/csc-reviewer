const endpoint = process.env.NEXT_PUBLIC_SCORE_ENDPOINT?.trim() ?? "";

export const scoreStorageReady = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint);

export function requestExam(request) {
  if (!scoreStorageReady) return Promise.reject(new Error("The timed exam service is not configured."));

  return new Promise((resolve, reject) => {
    const token = crypto.randomUUID();
    const frame = document.createElement("iframe");
    frame.name = `score-${token}`;
    frame.title = "Timed exam service";
    frame.hidden = true;

    const form = document.createElement("form");
    form.hidden = true;
    form.method = "POST";
    form.action = endpoint;
    form.target = frame.name;

    const field = document.createElement("input");
    field.type = "hidden";
    field.name = "submission";
    field.value = JSON.stringify({ ...request, token, origin: window.location.origin });
    form.append(field);

    function complete(error, data) {
      window.clearTimeout(timeout);
      window.removeEventListener("message", receive);
      frame.remove();
      form.remove();
      if (error) reject(error);
      else resolve(data);
    }

    function receive(event) {
      const googleOrigin = /^https:\/\/(?:script\.google\.com|(?:[\w-]+\.)?googleusercontent\.com)$/.test(event.origin);
      if (!googleOrigin || event.data?.type !== "csc-reviewer-score" || event.data?.token !== token) return;
      if (event.data.ok && event.data.data) complete(null, event.data.data);
      else complete(new Error(event.data.message || "The timed exam service rejected the request."));
    }

    const timeout = window.setTimeout(() => complete(new Error("The timed exam service did not respond. Try again.")), 25000);
    window.addEventListener("message", receive);
    document.body.append(frame, form);
    form.submit();
  });
}
