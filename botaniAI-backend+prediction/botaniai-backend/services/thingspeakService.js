// services/thingspeakService.js - UPDATED (no mock data)
const axios = require('axios');

class ThingSpeakService {
  constructor() {
    this.baseURL = 'https://api.thingspeak.com';
    this.timeout = 10000; // 10 second timeout
  }

  // Fetch latest data for a specific channel & key
  async getLatestData(channelID, apiKey) {
    // Validate inputs
    if (!channelID || !apiKey) {
      console.error('❌ Missing channelID or apiKey');
      throw new Error('ThingSpeak channelID and apiKey are required');
    }
    
    const cleanChannelID = String(channelID).trim();
    const cleanApiKey = String(apiKey).trim();
    
    if (!cleanChannelID || !cleanApiKey) {
      console.error('❌ Empty channelID or apiKey after trimming');
      throw new Error('ThingSpeak credentials cannot be empty');
    }
    
    try {
      const url = `${this.baseURL}/channels/${cleanChannelID}/feeds/last.json`;
      console.log(`📡 Fetching from ThingSpeak: ${url.replace(cleanApiKey, '***')}`);
      
      const response = await axios.get(url, {
        params: { api_key: cleanApiKey },
        timeout: this.timeout,
        validateStatus: function(status) {
          return status < 500; // Reject only if the status code is greater than or equal to 500
        }
      });

      console.log(`📡 ThingSpeak response status: ${response.status}`);
      
      if (response.status === 200 && response.data) {
        // Check if response contains error
        if (response.data.error) {
          console.error(`❌ ThingSpeak returned error: ${response.data.error}`);
          throw new Error(`ThingSpeak error: ${response.data.error}`);
        }
        
        const data = this.transformThingSpeakData(response.data);
        console.log(`✅ Fetched from Channel ${cleanChannelID}:`, {
          temp: data.temperature,
          humidity: data.humidity,
          time: data.timestamp.toISOString()
        });
        return data;
      } else if (response.status === 400) {
        console.error(`❌ ThingSpeak rejected request (400) for channel ${cleanChannelID}`);
        throw new Error(`Invalid API key, channel doesn't exist, or insufficient permissions`);
      } else if (response.status === 404) {
        console.error(`❌ ThingSpeak channel not found (404): ${cleanChannelID}`);
        throw new Error(`Channel ${cleanChannelID} not found on ThingSpeak`);
      } else if (response.status === 429) {
        console.error(`❌ Rate limit exceeded for channel ${cleanChannelID}`);
        throw new Error('ThingSpeak rate limit exceeded. Try again later.');
      } else {
        console.error(`❌ Unexpected response from ThingSpeak channel ${cleanChannelID}, status: ${response.status}`);
        throw new Error(`ThingSpeak returned status ${response.status}`);
      }
      
    } catch (error) {
      console.error(`❌ ThingSpeak API error for channel ${channelID}:`, {
        message: error.message,
        code: error.code,
        config: error.config ? {
          url: error.config.url,
          method: error.config.method
        } : null
      });
      
      // Re-throw the error instead of returning mock data
      throw new Error(`Failed to fetch from ThingSpeak: ${error.message}`);
    }
  }

  // Get channel information
  async getChannelInfo(channelID, apiKey) {
    try {
      const cleanChannelID = String(channelID).trim();
      const cleanApiKey = String(apiKey).trim();
      
      const url = `${this.baseURL}/channels/${cleanChannelID}.json`;
      console.log(`📡 Getting channel info: ${url}`);
      
      const response = await axios.get(url, {
        params: { api_key: cleanApiKey },
        timeout: this.timeout
      });

      if (response.status === 200 && response.data) {
        return {
          success: true,
          channel: response.data.channel,
          isPublic: response.data.channel.public_flag,
          fields: response.data.channel.field1 ? {
            field1: response.data.channel.field1,
            field2: response.data.channel.field2,
            field3: response.data.channel.field3,
            field4: response.data.channel.field4
          } : null
        };
      }
      
      return {
        success: false,
        message: 'Could not fetch channel info'
      };
      
    } catch (error) {
      console.error(`❌ Error getting channel info for ${channelID}:`, error.message);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Send data to ThingSpeak
  async sendDataToThingSpeak(channelID, writeAPIKey, data) {
    try {
      const cleanChannelID = String(channelID).trim();
      const cleanWriteAPIKey = String(writeAPIKey).trim();
      
      if (!cleanChannelID || !cleanWriteAPIKey) {
        throw new Error('Invalid channelID or writeAPIKey');
      }
      
      const url = `${this.baseURL}/update`;
      
      const params = {
        api_key: cleanWriteAPIKey,
        field1: data.temperature !== undefined ? data.temperature : 0,
        field2: data.humidity !== undefined ? data.humidity : 0,
        field3: data.soilMoisture !== undefined ? data.soilMoisture : 0,
        field4: data.lightIntensity !== undefined ? data.lightIntensity : 0
      };

      console.log(`📤 Sending to ThingSpeak Channel ${cleanChannelID}:`, {
        ...params,
        api_key: '***' + cleanWriteAPIKey.slice(-4)
      });
      
      const response = await axios.post(url, null, { 
        params,
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      console.log(`📤 ThingSpeak response:`, response.data);
      
      if (response.data > 0) {
        console.log(`✅ Data sent to ThingSpeak Channel ${cleanChannelID}. Entry ID: ${response.data}`);
        return { 
          success: true, 
          entryId: response.data,
          channelId: cleanChannelID
        };
      } else {
        console.error(`❌ ThingSpeak rejected data for channel ${cleanChannelID}. Response: ${response.data}`);
        throw new Error(`ThingSpeak rejected the data. Response: ${response.data}`);
      }
    } catch (error) {
      console.error(`❌ ThingSpeak send error for channel ${channelID}:`, {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      throw new Error(`Failed to send data to ThingSpeak: ${error.message}`);
    }
  }

  transformThingSpeakData(data) {
    // Check if this is real data or error response
    if (data.error) {
      console.log('⚠️ ThingSpeak returned error:', data.error);
      throw new Error(`ThingSpeak error: ${data.error}`);
    }
    
    return {
      temperature: parseFloat(data.field1) || 0,
      humidity: parseFloat(data.field2) || 0,
      soilMoisture: parseFloat(data.field3) || 0,
      lightIntensity: parseFloat(data.field4) || 0,
      timestamp: data.created_at ? new Date(data.created_at) : new Date(),
      entryId: data.entry_id || null,
      channelId: data.channel_id || null
    };
  }
}

module.exports = new ThingSpeakService();