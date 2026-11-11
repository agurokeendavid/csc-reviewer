const endpoint = process.env.NEXT_PUBLIC_SCORE_ENDPOINT?.trim() ?? "";

export const scoreStorageReady = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint);

export async function requestExam(request) {
  if (!scoreStorageReady) throw new Error("The timed exam service is not configured.");

  let receipt;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: new URLSearchParams({ transport: "json", submission: JSON.stringify(request) }),
      credentials: "omit",
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error("Exam request failed.");
    receipt = await response.json();
  } catch (error) {
    if (error.name === "TimeoutError") throw new Error("The timed exam service did not respond. Try again.");
    throw new Error("Could not reach the timed exam service. Try again.");
  }

  if (receipt?.ok === true && receipt.data) return receipt.data;
  throw new Error(receipt?.message || "The timed exam service rejected the request.");
}
