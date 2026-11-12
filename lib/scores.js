const endpoint = process.env.NEXT_PUBLIC_SCORE_ENDPOINT?.trim() ?? "";

export const scoreStorageReady = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint);

export async function requestExam(request) {
  const service = request.action === "feedback" ? "feedback service" : "timed exam service";
  if (!scoreStorageReady) throw new Error(`The ${service} is not configured.`);

  let receipt;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: new URLSearchParams({ transport: "json", submission: JSON.stringify(request) }),
      credentials: "omit",
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error("Exam request failed.");
    const contentType = response.headers.get("content-type");
    if (contentType?.startsWith("text/plain") &&
        (await response.clone().text()).trim() === "Invalid receipt destination.") {
      // Older deployments reject the JSON request before starting or grading an exam.
      return requestLegacyExam(request, service);
    }
    receipt = await response.json();
  } catch (error) {
    if (error.name === "TimeoutError") throw new Error(`The ${service} did not respond. Try again.`);
    throw new Error(`Could not reach the ${service}. Try again.`);
  }

  if (receipt?.ok === true && receipt.data) return receipt.data;
  if (request.action === "feedback" && receipt?.message === "Unsupported exam request.") {
    throw new Error("Feedback is temporarily unavailable.");
  }
  throw new Error(receipt?.message || `The ${service} rejected the request.`);
}

function requestLegacyExam(request, service) {
  return new Promise((resolve, reject) => {
    const token = crypto.randomUUID();
    const frame = document.createElement("iframe");
    frame.name = `exam-${token}`;
    frame.title = service;
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
      if (!googleOrigin || event.data?.type !== "csc-reviewer-score" || event.data.token !== token) return;
      if (event.data.ok === true && event.data.data) complete(null, event.data.data);
      else complete(new Error(event.data.message || `The ${service} rejected the request.`));
    }

    const timeout = window.setTimeout(() => complete(new Error(`The ${service} did not respond. Try again.`)), 25000);
    window.addEventListener("message", receive);
    document.body.append(frame, form);
    form.submit();
  });
}
