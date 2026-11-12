const endpoint = process.env.NEXT_PUBLIC_SCORE_ENDPOINT?.trim() ?? "";

export const scoreStorageReady = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint);

export async function requestExam(request) {
  const service = request.action === "feedback" ? "feedback service" : "timed exam service";
  if (!scoreStorageReady) throw new Error(`The ${service} is not configured.`);

  let receipt;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      // Deployments from before the JSON-only Code.gs need transport=json; newer ones ignore it.
      body: new URLSearchParams({ transport: "json", submission: JSON.stringify(request) }),
      credentials: "omit",
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error("Exam request failed.");
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
