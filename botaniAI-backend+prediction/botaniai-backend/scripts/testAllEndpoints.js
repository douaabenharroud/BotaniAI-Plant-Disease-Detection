const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';
let authToken = '';

const testEndpoints = async () => {
  console.log('🧪 Starting comprehensive API tests...\n');

  try {
    // 1. Test Authentication
    console.log('1. 🔐 Testing Authentication...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'demo@email.com',
      password: 'password123'
    });

    authToken = loginResponse.data.token;
    console.log('✅ Login successful');
    console.log(`   User: ${loginResponse.data.data.user.Name}`);
    console.log(`   Token: ${authToken.substring(0, 20)}...\n`);

    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    // 2. Test User Profile
    console.log('2. 👤 Testing User Profile...');
    const profileResponse = await axios.get(`${API_BASE}/auth/me`, { headers });
    console.log('✅ Profile fetched successfully');
    console.log(`   Username: ${profileResponse.data.data.user.Username}\n`);

    // 3. Test Plants Endpoints
    console.log('3. 🌿 Testing Plants Endpoints...');
    const plantsResponse = await axios.get(`${API_BASE}/plants`, { headers });
    console.log(`✅ Fetched ${plantsResponse.data.count} plants`);

    if (plantsResponse.data.count > 0) {
      const plantId = plantsResponse.data.data[0].PlantID;
      const plantDetailResponse = await axios.get(`${API_BASE}/plants/${plantId}`, { headers });
      console.log(`✅ Plant details: ${plantDetailResponse.data.data.plant.PlantName}`);

      // Test conditions check
      const conditionsResponse = await axios.get(`${API_BASE}/plants/${plantId}/check-conditions`, { headers });
      console.log(`✅ Conditions check completed`);
    }
    console.log('');

    // 4. Test Devices Endpoints
    console.log('4. 📱 Testing Devices Endpoints...');
    const devicesResponse = await axios.get(`${API_BASE}/devices`, { headers });
    console.log(`✅ Fetched ${devicesResponse.data.count} devices`);

    if (devicesResponse.data.count > 0) {
      const deviceId = devicesResponse.data.data[0].DeviceID;
      const deviceDetailResponse = await axios.get(`${API_BASE}/devices/${deviceId}`, { headers });
      console.log(`✅ Device details: ${deviceDetailResponse.data.data.device.location}`);

      // Test device status
      const statusResponse = await axios.get(`${API_BASE}/devices/${deviceId}/status`, { headers });
      console.log(`✅ Device status: ${statusResponse.data.data.status}`);
    }
    console.log('');

    // 5. Test Analysis Endpoints
    console.log('5. 🤖 Testing Analysis Endpoints...');
    const analysisResponse = await axios.get(`${API_BASE}/analysis`, { headers });
    console.log(`✅ Fetched ${analysisResponse.data.count} analyses`);

    if (analysisResponse.data.count > 0) {
      const analysisId = analysisResponse.data.data[0].AnalysisID;
      const analysisDetailResponse = await axios.get(`${API_BASE}/analysis/${analysisId}`, { headers });
      console.log(`✅ Analysis details - Health Score: ${analysisDetailResponse.data.data.analysis.HealthScore}`);

      // Test analysis history
      if (devicesResponse.data.count > 0) {
        const deviceId = devicesResponse.data.data[0].DeviceID;
        const historyResponse = await axios.get(`${API_BASE}/analysis/device/${deviceId}/history?days=7`, { headers });
        console.log(`✅ Analysis history: ${historyResponse.data.data.analyses.length} records`);
      }
    }
    console.log('');

    // 6. Test Recommendations Endpoints
    console.log('6. 💡 Testing Recommendations Endpoints...');
    const recsResponse = await axios.get(`${API_BASE}/recommendations`, { headers });
    console.log(`✅ Fetched ${recsResponse.data.count} recommendations`);

    if (recsResponse.data.count > 0) {
      const recId = recsResponse.data.data[0].recommendationID;
      const recDetailResponse = await axios.get(`${API_BASE}/recommendations/${recId}`, { headers });
      console.log(`✅ Recommendation: ${recDetailResponse.data.data.recommendation.text.substring(0, 50)}...`);

      // Test feedback analytics
      const analyticsResponse = await axios.get(`${API_BASE}/recommendations/analytics/feedback`, { headers });
      console.log(`✅ Feedback analytics: ${analyticsResponse.data.data.totalFeedback} feedback entries`);
    }
    console.log('');

    // 7. Test Plant Images Endpoints
    console.log('7. 📸 Testing Plant Images Endpoints...');
    const imagesResponse = await axios.get(`${API_BASE}/plant-images`, { headers });
    console.log(`✅ Fetched ${imagesResponse.data.count} plant images`);

    if (imagesResponse.data.count > 0 && plantsResponse.data.count > 0) {
      const plantId = plantsResponse.data.data[0].PlantID;
      const plantImagesResponse = await axios.get(`${API_BASE}/plant-images/plant/${plantId}`, { headers });
      console.log(`✅ Plant images: ${plantImagesResponse.data.data.images.length} images`);
    }
    console.log('');

    // 8. Test Actions Endpoints
    console.log('8. 📝 Testing Actions Endpoints...');
    const actionsResponse = await axios.get(`${API_BASE}/actions`, { headers });
    console.log(`✅ Fetched ${actionsResponse.data.count} actions`);

    // Test action statistics
    const statsResponse = await axios.get(`${API_BASE}/actions/statistics?days=30`, { headers });
    console.log(`✅ Action statistics: ${statsResponse.data.data.totalActions} total actions`);
    console.log('');

    // 9. Test Sync Endpoints
    console.log('9. 🔄 Testing Sync Endpoints...');
    const syncStatusResponse = await axios.get(`${API_BASE}/sync/thingspeak/status`, { headers });
    console.log(`✅ ThingSpeak status: ${syncStatusResponse.data.data.isConnected ? 'Connected' : 'Using mock data'}`);

    if (plantsResponse.data.count > 0) {
      const plantId = plantsResponse.data.data[0].PlantID;
      const syncResponse = await axios.post(`${API_BASE}/sync/${plantId}/thingspeak`, {}, { headers });
      console.log(`✅ Sync completed: ${syncResponse.data.message}`);

      const insightsResponse = await axios.get(`${API_BASE}/sync/${plantId}/insights?days=7`, { headers });
      console.log(`✅ Insights generated: ${insightsResponse.data.data.insights.overallTrend} trend`);
    }
    console.log('');

    // 10. Test Real-time Data Endpoints
    console.log('10. 📊 Testing Real-time Data...');
    if (plantsResponse.data.count > 0) {
      const plantId = plantsResponse.data.data[0].PlantID;
      const sensorDataResponse = await axios.get(`${API_BASE}/plants/${plantId}/sensor-data?period=24h`, { headers });
      console.log(`✅ Sensor data: ${sensorDataResponse.data.data.length} readings in last 24h`);
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Authentication & User Management');
    console.log('   ✅ Plant Management');
    console.log('   ✅ Device Management');
    console.log('   ✅ AI Analysis System');
    console.log('   ✅ Recommendation Engine');
    console.log('   ✅ Plant Image Analysis');
    console.log('   ✅ Action Logging');
    console.log('   ✅ Data Sync & Insights');
    console.log('   ✅ Real-time Sensor Data');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
};

// Run tests
testEndpoints();