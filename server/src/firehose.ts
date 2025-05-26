import WebSocket from "ws";

// Connect to the AT Protocol firehose (bsky.network)
export function createFirehoseStream() {
  const ws = new WebSocket(
    "wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos"
  );
  ws.on("open", () => {
    console.log("Connected to AT Protocol firehose");
  });
  ws.on("close", () => {
    console.log("Firehose connection closed");
  });
  ws.on("error", (err: any) => {
    console.error("Firehose error:", err);
  });
  // Return a proper async iterator for incoming messages
  const queue: any[] = [];
  let resolveNext: ((value: IteratorResult<any, any>) => void) | null = null;
  ws.on("message", (data: any) => {
    let evt = null;
    try {
      evt = JSON.parse(data.toString());
    } catch {}
    if (resolveNext) {
      resolveNext({ value: evt, done: false });
      resolveNext = null;
    } else {
      queue.push(evt);
    }
  });
  return {
    [Symbol.asyncIterator]() {
      return {
        next() {
          if (queue.length > 0) {
            return Promise.resolve({ value: queue.shift(), done: false });
          }
          return new Promise<IteratorResult<any, any>>((resolve) => {
            resolveNext = resolve;
          });
        },
      };
    },
  } as AsyncIterable<any>;
}
