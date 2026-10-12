import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const { MONGO_URI } = process.env;
if (!MONGO_URI) {
  throw new Error('MONGO_URI must be configured');
}

const client = new MongoClient(MONGO_URI);

try {
  await client.connect();
  console.log('Connected to MongoDB');

  // Delete the Aureline database
  const adminDb = client.db().admin();
  const databases = await adminDb.listDatabases();

  const aurelineDb = databases.databases.find(db => db.name === 'Aureline');

  if (aurelineDb) {
    await client.db('Aureline').dropDatabase();
    console.log('✓ Successfully deleted Aureline database');
  } else {
    console.log('✓ Aureline database does not exist - nothing to delete');
  }

  // List remaining databases
  const remainingDbs = await adminDb.listDatabases();
  console.log('\nRemaining databases:');
  remainingDbs.databases.forEach(db => {
    console.log(`  - ${db.name}`);
  });

} catch (error) {
  console.error('Error:', error);
  process.exitCode = 1;
} finally {
  await client.close();
}
