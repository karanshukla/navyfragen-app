import type { Database } from "./db";
import type { Record as MessageRecord } from "./lexicon/types/app/navyfragen/message";

// This ingestor will listen to the AT Protocol firehose and store anonymous messages
export async function ingestFirehoseMessages(
  db: Database,
  firehose: AsyncIterable<any>
) {
  for await (const evt of firehose) {
    // Check if this is a message record
    if (
      evt?.record?.$type === "app.navyfragen.message" ||
      evt?.record?.$type === "app.navyfragen.message#main"
    ) {
      const msg = evt.record as MessageRecord;
      // Insert into DB (ignore if already exists)
      await db
        .insertInto("message")
        .values({
          tid: evt.tid || evt.uri || evt.cid || "",
          message: msg.message,
          createdAt: msg.createdAt,
          recipient: msg.recipient || evt.recipient || "",
        })
        .onConflict((oc: any) => oc.column("tid").doNothing())
        .execute();
    }
  }
}
