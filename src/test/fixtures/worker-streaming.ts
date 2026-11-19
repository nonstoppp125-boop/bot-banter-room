import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

export default {
  fetch() {
    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: "text-start", id: "worker-stream" });
        writer.write({
          type: "text-delta",
          id: "worker-stream",
          delta: "Worker runtime stream OK",
        });
        writer.write({ type: "text-end", id: "worker-stream" });
      },
    });

    return createUIMessageStreamResponse({ stream });
  },
};
