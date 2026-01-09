const mongoose = require('mongoose');
require('dotenv').config();

const clearDatabase = async () => {
  try {
    console.log('🌱 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Database connected');

    // Get all collections
    const collections = await mongoose.connection.db.collections();
    
    console.log('🧹 Clearing all collections...');
    for (let collection of collections) {
      await collection.deleteMany({});
      console.log(`✅ Cleared collection: ${collection.collectionName}`);
    }

    // Drop all indexes and recreate them
    console.log('🔄 Rebuilding indexes...');
    await mongoose.connection.db.dropDatabase();
    
    console.log('✅ Database completely cleared and reset');
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔗 Database connection closed');
    process.exit(0);
  }
};

clearDatabase();