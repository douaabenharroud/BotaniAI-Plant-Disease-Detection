// check_schema.js
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/BotaniAI', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function checkSchema() {
  console.log('🔍 CHECKING PREDICTION SCHEMA\n');
  
  // Get the Prediction model
  const Prediction = require('./models/Prediction');
  
  // Look at the schema paths
  const schemaPaths = Prediction.schema.paths;
  
  console.log('Schema fields and types:');
  console.log('========================');
  
  Object.keys(schemaPaths).forEach(key => {
    const path = schemaPaths[key];
    console.log(`${key}:`);
    console.log(`  Type: ${path.instance}`);
    console.log(`  Required: ${path.isRequired || false}`);
    console.log(`  Default: ${path.defaultValue || 'none'}`);
    console.log('---');
  });
  
  // Check a few sample documents
  console.log('\n📝 SAMPLE PREDICTION DOCUMENTS:');
  console.log('===============================');
  
  const samples = await Prediction.find().limit(3);
  
  if (samples.length === 0) {
    console.log('No prediction documents found');
  } else {
    samples.forEach((doc, i) => {
      console.log(`\nDocument ${i + 1}:`);
      console.log(`  _id: ${doc._id}`);
      console.log(`  plantID: ${doc.plantID} (type: ${typeof doc.plantID})`);
      console.log(`  userID: ${doc.userID} (type: ${typeof doc.userID})`);
      console.log(`  deviceAssignmentID: ${doc.deviceAssignmentID} (type: ${typeof doc.deviceAssignmentID})`);
    });
  }
  
  mongoose.disconnect();
}

checkSchema().catch(console.error);