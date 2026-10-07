import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { initialRooms } from '../src/data.js';

dotenv.config();

if (!process.env.MONGO_URI) {
  throw new Error('MONGO_URI must be configured before seeding rooms.');
}

const client = new MongoClient(process.env.MONGO_URI);

try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || 'hotel-management');
  const rooms = db.collection('rooms');
  await rooms.createIndex({ id: 1 }, { unique: true });
  await rooms.createIndex({ number: 1 }, { unique: true });
  const result = await rooms.bulkWrite(
    initialRooms.map((room) => ({
      updateOne: {
        filter: { id: room.id },
        update: {
          $setOnInsert: {
            ...room,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );
  console.log(
    `Room seed finished: inserted ${result.upsertedCount}, left ${initialRooms.length - result.upsertedCount} existing rooms unchanged.`,
  );
} catch (error) {
  console.error('Room seed failed:', error);
  process.exitCode = 1;
} finally {
  await client.close();
}
