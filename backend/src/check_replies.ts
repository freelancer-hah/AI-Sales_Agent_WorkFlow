import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const replies = await db.collection('emailreplies').find({}).toArray();
  console.log('Total replies:', replies.length);
  for (const r of replies) {
    console.log(`Reply ID: ${r._id}`);
    console.log(`From: ${r.from}`);
    console.log(`Subject: ${r.subject}`);
    console.log(`Classification: ${r.classification}`);
    console.log(`BodyText: ${r.bodyText?.slice(0, 150)}`);
    console.log(`SuggestedDraft: ${r.suggestedReplyDraft || '(empty)'}`);
    console.log(`-----------------------------------`);
  }
  await mongoose.disconnect();
}

main().catch(console.error);

