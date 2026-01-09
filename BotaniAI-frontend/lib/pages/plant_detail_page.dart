import 'dart:convert';
import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:syncfusion_flutter_charts/charts.dart';

// Enhanced green color palette with dark green instead of maroon
final Color primaryColor = const Color(0xFF006400); // Dark Green
final Color primaryLight = const Color(0xFF008000); // Green
final Color secondaryColor = const Color(0xFF32CD32); // Lime Green
final Color accentColor = const Color(0xFF90EE90); // Light Green
final Color backgroundColor = const Color(0xFFF0FFF0); // Honeydew
final Color surfaceColor = Colors.white;
final Color cardColor = const Color(0xFFF8FFF8);
final Color textPrimary = const Color(0xFF003300); // Very Dark Green
final Color textSecondary = const Color(0xFF006633); // Dark Spring Green
final Color textLight = const Color(0xFF4CAF50); // Green
final Color errorColor = const Color(0xFF006400);
final Color warningColor = const Color(0xFF2E7D32); // Dark Green instead of orange
final Color successColor = const Color(0xFF388E3C);
final Color infoColor = const Color(0xFF2E7D32);
final Color darkGreenColor = const Color(0xFF2E7D32); // Dark Green
final Color darkerGreen = const Color(0xFF1B5E20); // Darker Green
final Color lightGreen = const Color(0xFFC8E6C9); // Light Green

// Graph colors for different sensor types
final Color temperatureGraphColor = const Color(0xFFE74C3C); // Red for temperature
final Color humidityGraphColor = const Color(0xFF3498DB); // Blue for humidity
final Color soilMoistureGraphColor = const Color(0xFF9B59B6); // Purple for soil moisture
final Color lightGraphColor = const Color(0xFFF39C12); // Orange for light

class PlantDetailPage extends StatefulWidget {
  final dynamic plant;
  final String token;
  
  const PlantDetailPage({
    Key? key,
    required this.plant,
    required this.token,
  }) : super(key: key);

  @override
  _PlantDetailPageState createState() => _PlantDetailPageState();
}

class _PlantDetailPageState extends State<PlantDetailPage> {
  // ===============================
  // STATE VARIABLES
  // ===============================
  bool _isLoading = false;
  List<dynamic> _devices = [];
  Timer? _refreshTimer;
  Map<String, Map<String, List<SensorDataPoint>>> _sensorData = {};
  Map<String, Map<String, dynamic>> _latestSensorValues = {};
  
  // AI Analysis state
  bool _isPredicting = false;
  String _predictionResult = '';
  String _recommendation = '';
  String _errorMessage = '';
  
  // Sensor data for AI - Initialize to null for no data
  double? _temperature;
  double? _humidity;
  double? _soilMoistureRaw;
  double? _soilMoisturePercent;
  
  // User input controllers
  final TextEditingController _heightController = TextEditingController();
  final TextEditingController _leafCountController = TextEditingController();
  final TextEditingController _newGrowthController = TextEditingController();
  final TextEditingController _wateringAmountController = TextEditingController();
  final TextEditingController _wateringFrequencyController = TextEditingController();

  // ===============================
  // HELPER METHODS
  // ===============================
  String? _extractUserIdFromToken() {
    try {
      final parts = widget.token.split('.');
      if (parts.length != 3) return null;
      
      final payload = parts[1];
      final normalized = base64Url.normalize(payload);
      final decoded = utf8.decode(base64Url.decode(normalized));
      final payloadMap = json.decode(decoded);
      
      return payloadMap['sub'] ?? 
             payloadMap['userId'] ?? 
             payloadMap['id'] ?? 
             payloadMap['user_id'] ??
             payloadMap['userID'];
    } catch (e) {
      print('Error extracting user ID from token: $e');
      return null;
    }
  }

  Map<String, String> get _headers {
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${widget.token}',
    };
  }

  String? get _userID => _extractUserIdFromToken();

  String get _plantID {
    return widget.plant.plantID ?? widget.plant.PlantID ?? widget.plant.id;
  }

  @override
  void initState() {
    super.initState();
    _loadPlantDevices();
    _startAutoRefresh();
  }

  @override
  void dispose() {
    _stopAutoRefresh();
    _heightController.dispose();
    _leafCountController.dispose();
    _newGrowthController.dispose();
    _wateringAmountController.dispose();
    _wateringFrequencyController.dispose();
    super.dispose();
  }

  // ===============================
  // AUTO REFRESH MANAGEMENT
  // ===============================
  void _startAutoRefresh() {
    _refreshTimer = Timer.periodic(Duration(seconds: 5), (timer) {
      if (mounted) {
        _refreshThingSpeakDataForAllSensors();
      }
    });
  }

  void _stopAutoRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = null;
  }

  Future<void> _refreshThingSpeakDataForAllSensors() async {
    for (final device in _devices) {
      final deviceId = device['DeviceID'] ?? device['_id'];
      final hasThingSpeak = device['thingSpeakChannelID'] != null && 
                           device['thingSpeakWriteAPIKey'] != null;
      
      if (hasThingSpeak && device['Status'] == 'active') {
        await _fetchThingSpeakData(deviceId, showNotification: false);
      }
    }
  }

  // ===============================
  // SENSOR MANAGEMENT
  // ===============================
  Future<void> _loadPlantDevices() async {
    if (mounted) setState(() => _isLoading = true);
    
    try {
      final url = 'http://localhost:5000/api/deviceassignments/plant/$_plantID';
      final response = await http.get(Uri.parse(url), headers: _headers);
      
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        List<dynamic> devices = body['success'] == true ? body['data'] ?? [] : List.from(body);
        
        final sensors = devices.where((device) {
          final deviceType = device['deviceType']?.toString().toLowerCase() ?? '';
          return deviceType == 'sensor';
        }).toList();
        
        if (mounted) setState(() => _devices = sensors);
        
        // Reset sensor values to null before loading new data
        if (mounted) {
          setState(() {
            _temperature = null;
            _humidity = null;
            _soilMoistureRaw = null;
            _soilMoisturePercent = null;
            _sensorData.clear();
            _latestSensorValues.clear();
          });
        }
        
        for (final sensor in sensors) {
          await _loadSensorData(sensor);
        }
      } else if (response.statusCode == 404) {
        await _tryDevicesEndpoint();
      } else {
        await _loadDevicesAlternative();
      }
    } catch (e) {
      print('Error loading plant devices: $e');
      await _loadDevicesAlternative();
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _tryDevicesEndpoint() async {
    try {
      final url = 'http://localhost:5000/api/devices/plant/$_plantID';
      final response = await http.get(Uri.parse(url), headers: _headers);
      
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['success'] == true) {
          final devices = body['data'] ?? [];
          final sensors = devices.where((device) {
            final deviceType = device['deviceType']?.toString().toLowerCase() ?? '';
            return deviceType == 'sensor';
          }).toList();
          
          if (mounted) setState(() => _devices = sensors);
          
          for (final sensor in sensors) {
            await _loadSensorData(sensor);
          }
        }
      }
    } catch (e) {
      print('Error with devices/plant endpoint: $e');
    }
  }

  Future<void> _loadDevicesAlternative() async {
    try {
      final assignmentsResponse = await http.get(
        Uri.parse('http://localhost:5000/api/deviceassignments'),
        headers: _headers,
      );
      
      if (assignmentsResponse.statusCode != 200) return;
      
      final assignmentsBody = jsonDecode(assignmentsResponse.body);
      List<dynamic> allAssignments = assignmentsBody['success'] == true 
          ? assignmentsBody['data'] ?? [] 
          : List.from(assignmentsBody);
      
      final plantAssignments = allAssignments.where((assignment) {
        return assignment['plantID'] == _plantID;
      }).toList();
      
      if (plantAssignments.isEmpty) {
        if (mounted) setState(() => _devices = []);
        return;
      }
      
      await _fetchDeviceDetailsFromAssignments(plantAssignments);
    } catch (e) {
      print('Error in alternative loading: $e');
    }
  }

  Future<void> _fetchDeviceDetailsFromAssignments(List<dynamic> assignments) async {
    try {
      final List<dynamic> deviceDetails = [];
      
      for (final assignment in assignments) {
        final deviceID = assignment['DeviceID'];
        if (deviceID != null) {
          final response = await http.get(
            Uri.parse('http://localhost:5000/api/devices/$deviceID'),
            headers: _headers,
          );
          
          if (response.statusCode == 200) {
            final body = jsonDecode(response.body);
            final device = body['data']?['device'] ?? body['device'] ?? body;
            
            if (device != null) {
              final deviceType = device['deviceType']?.toString().toLowerCase() ?? '';
              if (deviceType == 'sensor') {
                deviceDetails.add(device);
                await _loadSensorData(device);
              }
            }
          }
        }
      }
      
      if (mounted) setState(() => _devices = deviceDetails);
    } catch (e) {
      print('Error fetching device details: $e');
    }
  }

  Future<void> _loadSensorData(dynamic device) async {
    final deviceId = device['DeviceID'] ?? device['_id'];
    
    // Clear any existing data for this device
    if (mounted) {
      setState(() {
        _sensorData.remove(deviceId);
        _latestSensorValues.remove(deviceId);
      });
    }
    
    if (device['lastData'] != null) {
      final lastData = device['lastData'];
      if (lastData is Map) {
        final Map<String, dynamic> convertedData = {};
        lastData.forEach((key, value) {
          if (key is String) {
            convertedData[key] = value;
          } else {
            convertedData[key.toString()] = value;
          }
        });
        _updateLatestValues(deviceId, convertedData);
      }
    }
    
    final hasThingSpeak = device['thingSpeakChannelID'] != null && 
                         device['thingSpeakWriteAPIKey'] != null;
    
    if (hasThingSpeak && device['Status'] == 'active') {
      await _fetchThingSpeakData(deviceId, showNotification: false);
    }
  }

  void _updateLatestValues(String deviceId, Map<String, dynamic> data) {
    if (mounted) {
      setState(() {
        _latestSensorValues[deviceId] = data;
        
        // Update sensor data for AI - only if we have valid data
        if (data['temperature'] != null && data['temperature'] is num) {
          _temperature = data['temperature'].toDouble();
        }
        if (data['humidity'] != null && data['humidity'] is num) {
          _humidity = data['humidity'].toDouble();
        }
        if (data['soilMoisture'] != null && data['soilMoisture'] is num) {
          _soilMoistureRaw = data['soilMoisture'].toDouble();
          _soilMoisturePercent = _convertSoilMoistureToPercent(_soilMoistureRaw!);
        }
      });
    }
  }

  void _addSensorDataPoint(String deviceId, String sensorType, double value) {
    // Only add data point if value is not null
    if (value == null) return;
    
    final now = DateTime.now();
    final dataPoint = SensorDataPoint(timestamp: now, value: value);
    
    if (mounted) {
      setState(() {
        _sensorData[deviceId] ??= {};
        _sensorData[deviceId]![sensorType] ??= [];
        
        final dataList = _sensorData[deviceId]![sensorType]!;
        dataList.add(dataPoint);
        if (dataList.length > 50) dataList.removeAt(0);
      });
    }
  }

  Future<void> _toggleDeviceStatus(String deviceId, bool isActive) async {
    try {
      final newStatus = isActive ? 'inactive' : 'active';
      
      final response = await http.put(
        Uri.parse('http://localhost:5000/api/devices/$deviceId'),
        headers: _headers,
        body: jsonEncode({'Status': newStatus}),
      );
      
      if (response.statusCode == 200) {
        final index = _devices.indexWhere((device) => 
          device['DeviceID'] == deviceId || device['_id'] == deviceId);
        
        if (index != -1 && mounted) {
          setState(() => _devices[index]['Status'] = newStatus);
          
          if (newStatus == 'inactive') {
            _sensorData.remove(deviceId);
            _latestSensorValues.remove(deviceId);
          }
        }
        
        _showSnackBar('Sensor ${isActive ? 'deactivated' : 'activated'} successfully', successColor);
      } else {
        _showSnackBar('Failed to update sensor status', errorColor);
      }
    } catch (e) {
      print('Error toggling device status: $e');
      _showSnackBar('Error: ${e.toString()}', errorColor);
    }
  }

  Future<void> _deleteSensor(String deviceId) async {
    bool? confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Delete Sensor', style: TextStyle(color: primaryColor)),
        content: Text('Are you sure you want to delete this sensor? This will permanently remove all sensor data and assignments.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancel', style: TextStyle(color: primaryColor)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: errorColor),
            child: Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    
    if (confirm != true) return;
    
    setState(() => _isLoading = true);
    
    try {
      final deleteResponse = await http.delete(
        Uri.parse('http://localhost:5000/api/devices/$deviceId'),
        headers: _headers,
      );
      
      final responseBody = jsonDecode(deleteResponse.body);
      
      if (deleteResponse.statusCode == 200 && responseBody['success'] == true) {
        if (mounted) {
          setState(() {
            _devices.removeWhere((device) => 
              device['DeviceID'] == deviceId || device['_id'] == deviceId);
            _sensorData.remove(deviceId);
            _latestSensorValues.remove(deviceId);
          });
        }
        
        _showSnackBar('✅ Sensor deleted successfully', successColor);
      } else {
        _showSnackBar('Failed to delete sensor: ${responseBody['message']}', errorColor);
      }
    } catch (e) {
      print('Error deleting sensor: $e');
      _showSnackBar('Error: ${e.toString()}', errorColor);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _modifySensor(dynamic device) async {
    final deviceId = device['DeviceID'] ?? device['_id'];
    final deviceName = device['deviceName'] ?? 'Unnamed Sensor';
    final location = device['location'] ?? '';
    final thingSpeakChannelID = device['thingSpeakChannelID'] ?? '';
    final thingSpeakWriteAPIKey = device['thingSpeakWriteAPIKey'] ?? '';
    final thingSpeakReadAPIKey = device['thingSpeakReadAPIKey'] ?? '';
    
    final nameController = TextEditingController(text: deviceName);
    final locationController = TextEditingController(text: location);
    final channelController = TextEditingController(text: thingSpeakChannelID);
    final writeKeyController = TextEditingController(text: thingSpeakWriteAPIKey);
    final readKeyController = TextEditingController(text: thingSpeakReadAPIKey);
    
    bool _includeThingSpeak = thingSpeakChannelID.isNotEmpty;
    
    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setState) {
        return AlertDialog(
          backgroundColor: cardColor,
          title: Row(children: [
            Icon(Icons.edit, color: primaryColor),
            SizedBox(width: 10),
            Text('Modify Sensor', style: TextStyle(color: primaryColor))
          ]),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameController, 
                  decoration: InputDecoration(
                    labelText: 'Sensor Name *', 
                    labelStyle: TextStyle(color: textSecondary),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)), 
                    hintText: 'e.g., Temperature Sensor', 
                    prefixIcon: Icon(Icons.title, color: primaryColor),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(color: primaryColor, width: 2),
                    ),
                    filled: true,
                    fillColor: Colors.white,
                  ),
                  style: TextStyle(color: textPrimary),
                ),
                SizedBox(height: 15),
                TextField(
                  controller: locationController, 
                  decoration: InputDecoration(
                    labelText: 'Location (Optional)', 
                    labelStyle: TextStyle(color: textSecondary),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)), 
                    hintText: 'e.g., Near the window', 
                    prefixIcon: Icon(Icons.location_on, color: primaryColor),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(color: primaryColor, width: 2),
                    ),
                    filled: true,
                    fillColor: Colors.white,
                  ),
                  style: TextStyle(color: textPrimary),
                ),
                SizedBox(height: 15),
                Row(children: [
                  Checkbox(
                    value: _includeThingSpeak, 
                    onChanged: (value) => setState(() => _includeThingSpeak = value ?? false), 
                    activeColor: primaryColor
                  ),
                  Text('Configure ThingSpeak', style: TextStyle(color: primaryColor)), 
                  SizedBox(width: 10), 
                  Icon(Icons.cloud_upload, color: primaryColor),
                ]),
                if (_includeThingSpeak) ...[
                  SizedBox(height: 15),
                  Text('ThingSpeak Configuration', 
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: primaryColor)),
                  SizedBox(height: 10),
                  TextField(
                    controller: channelController, 
                    decoration: InputDecoration(
                      labelText: 'ThingSpeak Channel ID', 
                      labelStyle: TextStyle(color: textSecondary),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)), 
                      hintText: 'e.g., 1234567', 
                      prefixIcon: Icon(Icons.numbers, color: primaryColor),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: primaryColor, width: 2),
                      ),
                      filled: true,
                      fillColor: Colors.white,
                    ), 
                    keyboardType: TextInputType.number,
                    style: TextStyle(color: textPrimary),
                  ),
                  SizedBox(height: 10),
                  TextField(
                    controller: writeKeyController, 
                    decoration: InputDecoration(
                      labelText: 'ThingSpeak Write API Key', 
                      labelStyle: TextStyle(color: textSecondary),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)), 
                      hintText: 'Write key from ThingSpeak', 
                      prefixIcon: Icon(Icons.vpn_key, color: primaryColor),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: primaryColor, width: 2),
                      ),
                      filled: true,
                      fillColor: Colors.white,
                    ), 
                    obscureText: true,
                    style: TextStyle(color: textPrimary),
                  ),
                  SizedBox(height: 10),
                  TextField(
                    controller: readKeyController, 
                    decoration: InputDecoration(
                      labelText: 'ThingSpeak Read API Key (Optional)', 
                      labelStyle: TextStyle(color: textSecondary),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)), 
                      hintText: 'Read key from ThingSpeak', 
                      prefixIcon: Icon(Icons.vpn_key, color: primaryColor),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: primaryColor, width: 2),
                      ),
                      filled: true,
                      fillColor: Colors.white,
                    ), 
                    obscureText: true,
                    style: TextStyle(color: textPrimary),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context), 
              child: Text('Cancel', style: TextStyle(color: primaryColor)),
            ),
            ElevatedButton(
              onPressed: () async {
                if (nameController.text.isEmpty) {
                  _showSnackBar('Sensor name is required', errorColor);
                  return;
                }
                Navigator.pop(context);
                await _updateSensor(
                  deviceId,
                  nameController.text,
                  locationController.text,
                  _includeThingSpeak ? channelController.text : '',
                  _includeThingSpeak ? writeKeyController.text : '',
                  _includeThingSpeak ? readKeyController.text : '',
                );
              },
              child: Text('Update'),
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        );
      }),
    );
  }

  Future<void> _updateSensor(
    String deviceId,
    String deviceName,
    String location,
    String thingSpeakChannelID,
    String thingSpeakWriteAPIKey,
    String thingSpeakReadAPIKey,
  ) async {
    setState(() => _isLoading = true);
    
    try {
      final Map<String, dynamic> deviceData = {
        'deviceName': deviceName,
        'location': location,
      };
      
      if (thingSpeakChannelID.isNotEmpty) {
        deviceData['thingSpeakChannelID'] = thingSpeakChannelID;
      } else {
        deviceData['thingSpeakChannelID'] = null;
        deviceData['thingSpeakWriteAPIKey'] = null;
        deviceData['thingSpeakReadAPIKey'] = null;
      }
      
      if (thingSpeakWriteAPIKey.isNotEmpty) {
        deviceData['thingSpeakWriteAPIKey'] = thingSpeakWriteAPIKey;
      }
      
      if (thingSpeakReadAPIKey.isNotEmpty) {
        deviceData['thingSpeakReadAPIKey'] = thingSpeakReadAPIKey;
      }
      
      final response = await http.put(
        Uri.parse('http://localhost:5000/api/devices/$deviceId'),
        headers: _headers,
        body: jsonEncode(deviceData),
      );
      
      final responseBody = jsonDecode(response.body);
      
      if (response.statusCode == 200 && responseBody['success'] == true) {
        _showSnackBar('✅ Sensor updated successfully!', successColor);
        
        final index = _devices.indexWhere((device) => 
          device['DeviceID'] == deviceId || device['_id'] == deviceId);
        
        if (index != -1 && mounted) {
          setState(() {
            _devices[index]['deviceName'] = deviceName;
            _devices[index]['location'] = location;
            
            if (thingSpeakChannelID.isNotEmpty) {
              _devices[index]['thingSpeakChannelID'] = thingSpeakChannelID;
              _devices[index]['thingSpeakWriteAPIKey'] = thingSpeakWriteAPIKey;
              _devices[index]['thingSpeakReadAPIKey'] = thingSpeakReadAPIKey;
            } else {
              _devices[index].remove('thingSpeakChannelID');
              _devices[index].remove('thingSpeakWriteAPIKey');
              _devices[index].remove('thingSpeakReadAPIKey');
            }
          });
        }
        
        _sensorData.remove(deviceId);
        _latestSensorValues.remove(deviceId);
        await _loadSensorData(_devices[index]);
      } else {
        _showSnackBar('❌ Failed to update sensor: ${responseBody['message']}', errorColor);
      }
    } catch (e) {
      print('Error updating sensor: $e');
      _showSnackBar('Error: ${e.toString()}', errorColor);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _createSensorForPlant(
    String deviceName,
    String location,
    String? thingSpeakChannelID,
    String? thingSpeakWriteAPIKey,
    String? thingSpeakReadAPIKey,
  ) async {
    if (mounted) setState(() => _isLoading = true);
    
    try {
      final Map<String, dynamic> deviceData = {
        'deviceName': deviceName,
        'deviceType': 'sensor',
        'userID': _userID,
        'Status': 'active',
        'firmwareVersion': '1.0.0',
        'location': location.isNotEmpty ? location : null,
        'capabilities': ['temperature', 'humidity', 'soil_moisture', 'light'],
      };
      
      if (thingSpeakChannelID != null && thingSpeakChannelID.isNotEmpty) {
        deviceData['thingSpeakChannelID'] = thingSpeakChannelID;
      }
      if (thingSpeakWriteAPIKey != null && thingSpeakWriteAPIKey.isNotEmpty) {
        deviceData['thingSpeakWriteAPIKey'] = thingSpeakWriteAPIKey;
      }
      if (thingSpeakReadAPIKey != null && thingSpeakReadAPIKey.isNotEmpty) {
        deviceData['thingSpeakReadAPIKey'] = thingSpeakReadAPIKey;
      }
      
      final deviceResp = await http.post(
        Uri.parse('http://localhost:5000/api/devices'),
        headers: _headers,
        body: jsonEncode(deviceData),
      );

      if (deviceResp.statusCode == 201 || deviceResp.statusCode == 200) {
        final deviceBody = jsonDecode(deviceResp.body);
        final createdDevice = deviceBody['data'] ?? deviceBody;
        final deviceId = createdDevice['DeviceID'] ?? createdDevice['_id'];
        
        await _assignSensorToPlant(deviceId, createdDevice);
      } else {
        _showSnackBar('Failed to create sensor: ${deviceResp.statusCode}', errorColor);
      }
    } catch (e) {
      print('Error creating sensor: $e');
      _showSnackBar('Error: ${e.toString()}', errorColor);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _assignSensorToPlant(String deviceId, dynamic deviceData) async {
    try {
      final assignData = {
        'DeviceID': deviceId,
        'plantID': _plantID,
        'userID': _userID,
        'status': 'active',
      };
      
      final assignResp = await http.post(
        Uri.parse('http://localhost:5000/api/deviceassignments/assign'),
        headers: _headers,
        body: jsonEncode(assignData),
      );

      if (assignResp.statusCode == 200 || assignResp.statusCode == 201) {
        if (mounted) setState(() => _devices.insert(0, deviceData));
        await _loadSensorData(deviceData);
        _showSnackBar('✅ Sensor created successfully!', successColor);
      } else {
        if (mounted) setState(() => _devices.insert(0, deviceData));
        await _loadSensorData(deviceData);
        _showSnackBar('⚠️ Sensor created but assignment failed', warningColor);
      }
    } catch (e) {
      print('Error assigning sensor: $e');
      if (mounted) setState(() => _devices.insert(0, deviceData));
      await _loadSensorData(deviceData);
      _showSnackBar('⚠️ Sensor created but assignment failed', warningColor);
    }
  }

  Future<void> _testThingSpeakConnection(String deviceId, String channelId, String writeKey) async {
    try {
      final response = await http.post(
        Uri.parse('http://localhost:5000/api/devices/$deviceId/test-thingspeak'),
        headers: _headers,
        body: jsonEncode({}),
      );
      
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['success'] == true) {
          _showSnackBar('✅ ThingSpeak connection successful!', successColor);
        } else {
          _showSnackBar('❌ ThingSpeak connection failed: ${body['error']}', errorColor);
        }
      } else {
        _showSnackBar('❌ Failed to test ThingSpeak connection', errorColor);
      }
    } catch (e) {
      print('Error testing ThingSpeak: $e');
      _showSnackBar('Error: ${e.toString()}', errorColor);
    }
  }

  Future<void> _fetchThingSpeakData(String deviceId, {bool showNotification = true}) async {
    try {
      final response = await http.get(
        Uri.parse('http://localhost:5000/api/devices/$deviceId/thingspeak-data'),
        headers: _headers,
      );
      
      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        if (body['success'] == true) {
          final data = body['data'];
          
          if (data != null && data is Map) {
            final Map<String, dynamic> convertedData = {};
            data.forEach((key, value) {
              if (key is String) {
                convertedData[key] = value;
              } else {
                convertedData[key.toString()] = value;
              }
            });
            
            _updateLatestValues(deviceId, convertedData);
            
            // Only add data points if values are not null
            if (convertedData['temperature'] != null && 
                convertedData['temperature'] is num) {
              _addSensorDataPoint(deviceId, 'temperature', convertedData['temperature'].toDouble());
            }
            if (convertedData['humidity'] != null && 
                convertedData['humidity'] is num) {
              _addSensorDataPoint(deviceId, 'humidity', convertedData['humidity'].toDouble());
            }
            if (convertedData['soilMoisture'] != null && 
                convertedData['soilMoisture'] is num) {
              _addSensorDataPoint(deviceId, 'soilMoisture', convertedData['soilMoisture'].toDouble());
            }
            if (convertedData['lightIntensity'] != null && 
                convertedData['lightIntensity'] is num) {
              _addSensorDataPoint(deviceId, 'lightIntensity', convertedData['lightIntensity'].toDouble());
            }
          }
          
          if (showNotification) {
            _showSnackBar('✅ ThingSpeak data fetched successfully!', successColor);
          }
        } else if (showNotification) {
          _showSnackBar('❌ Failed to fetch ThingSpeak data: ${body['message']}', errorColor);
        }
      } else if (showNotification) {
        _showSnackBar('❌ Failed to fetch ThingSpeak data', errorColor);
      }
    } catch (e) {
      print('Error fetching ThingSpeak data: $e');
      if (showNotification) {
        _showSnackBar('Error: ${e.toString()}', errorColor);
      }
    }
  }

  Future<void> _updateThingSpeakConfig(
    String deviceId, 
    String channelId, 
    String writeKey,
    String? readKey
  ) async {
    try {
      final data = {
        'thingSpeakChannelID': channelId,
        'thingSpeakWriteAPIKey': writeKey,
        'thingSpeakReadAPIKey': readKey,
      };
      
      final response = await http.put(
        Uri.parse('http://localhost:5000/api/devices/$deviceId/thingspeak'),
        headers: _headers,
        body: jsonEncode(data),
      );
      
      if (response.statusCode == 200) {
        _showSnackBar('✅ ThingSpeak configuration updated!', successColor);
        
        final index = _devices.indexWhere((device) => 
          device['DeviceID'] == deviceId || device['_id'] == deviceId);
        
        if (index != -1 && mounted) {
          setState(() {
            _devices[index]['thingSpeakChannelID'] = channelId;
            _devices[index]['thingSpeakWriteAPIKey'] = writeKey;
            _devices[index]['thingSpeakReadAPIKey'] = readKey;
          });
        }
        
        _sensorData.remove(deviceId);
        _latestSensorValues.remove(deviceId);
        await _fetchThingSpeakData(deviceId, showNotification: false);
      } else {
        _showSnackBar('❌ Failed to update ThingSpeak configuration', errorColor);
      }
    } catch (e) {
      print('Error updating ThingSpeak config: $e');
      _showSnackBar('Error: ${e.toString()}', errorColor);
    }
  }

  // REMOVED: _sendTestDataToThingSpeak function (no fake data)

  // ===============================
  // AI ANALYSIS FUNCTIONS
  // ===============================
  double _convertSoilMoistureToPercent(double rawValue) {
    const dryValue = 4095.0;
    const wetValue = 1300.0;
    
    if (rawValue <= wetValue) return 100.0;
    if (rawValue >= dryValue) return 0.0;
    
    double percent = 100 - ((rawValue - wetValue) / (dryValue - wetValue)) * 100;
    return percent.clamp(0.0, 100.0).roundToDouble();
  }

  Future<void> _predictPlantHealth() async {
    if (_heightController.text.isEmpty ||
        _leafCountController.text.isEmpty ||
        _newGrowthController.text.isEmpty ||
        _wateringAmountController.text.isEmpty ||
        _wateringFrequencyController.text.isEmpty) {
      _showSnackBar('❌ Please fill all fields', errorColor);
      return;
    }
    
    setState(() {
      _isPredicting = true;
      _errorMessage = '';
    });
    
    try {
      // Use 0.0 for null sensor values in AI prediction
      final features = {
        "Height_cm": double.parse(_heightController.text),
        "Leaf_Count": double.parse(_leafCountController.text),
        "New_Growth_Count": double.parse(_newGrowthController.text),
        "Watering_Amount_ml": double.parse(_wateringAmountController.text),
        "Watering_Frequency_days": double.parse(_wateringFrequencyController.text),
        "Room_Temperature_C": _temperature ?? 0.0,
        "Humidity_%": _humidity ?? 0.0,
        "Soil_Moisture_%": _soilMoisturePercent ?? 0.0,
      };
      
      print('📊 Sending to ML API:');
      print('  Temperature: ${_temperature ?? "No data"}°C');
      print('  Humidity: ${_humidity ?? "No data"}%');
      print('  Soil Moisture: ${_soilMoisturePercent ?? "No data"}% (from RAW: ${_soilMoistureRaw ?? "No data"})');
      
      final response = await http.post(
        Uri.parse('http://localhost:8000/predict'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(features),
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        
        setState(() {
          _predictionResult = data['prediction_label'] ?? data['prediction'] ?? 'Unknown';
          _recommendation = data['recommendation'] ?? 'No recommendation available';
        });
        
        _showSnackBar('✅ Prediction successful!', successColor);
      } else {
        throw Exception('API error: ${response.statusCode}');
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Error: $e\n\nMake sure ML server is running on port 8000';
      });
      _showSnackBar('❌ Prediction failed', errorColor);
    } finally {
      setState(() => _isPredicting = false);
    }
  }

  void _loadExampleData() {
    setState(() {
      _heightController.text = '50';
      _leafCountController.text = '12';
      _newGrowthController.text = '2';
      _wateringAmountController.text = '250';
      _wateringFrequencyController.text = '3';
    });
    _showSnackBar('Example data loaded', successColor);
  }

  void _clearAllData() {
    setState(() {
      _heightController.clear();
      _leafCountController.clear();
      _newGrowthController.clear();
      _wateringAmountController.clear();
      _wateringFrequencyController.clear();
    });
    _showSnackBar('Manual data cleared', warningColor);
  }

  // ===============================
  // DISPLAY WIDGETS
  // ===============================
  void _showSnackBar(String message, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: color,
        duration: Duration(seconds: 3),
      ),
    );
  }

  Widget _buildSensorDataDisplay() {
    return Card(
      elevation: 2,
      color: cardColor,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.sensors, color: primaryColor),
                SizedBox(width: 8),
                Text('Real Sensor Data', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: primaryColor)),
              ],
            ),
            SizedBox(height: 12),
            
            ListTile(
              leading: Icon(Icons.thermostat, color: temperatureGraphColor),
              title: Text('Temperature', style: TextStyle(color: textPrimary)),
              trailing: Text(
                _temperature != null ? '${_temperature!.toStringAsFixed(1)}°C' : 'No data',
                style: TextStyle(
                  fontWeight: FontWeight.bold, 
                  color: _temperature != null ? temperatureGraphColor : Colors.grey
                )
              ),
              contentPadding: EdgeInsets.zero,
            ),
            ListTile(
              leading: Icon(Icons.water_drop, color: humidityGraphColor),
              title: Text('Humidity', style: TextStyle(color: textPrimary)),
              trailing: Text(
                _humidity != null ? '${_humidity!.toStringAsFixed(1)}%' : 'No data',
                style: TextStyle(
                  fontWeight: FontWeight.bold, 
                  color: _humidity != null ? humidityGraphColor : Colors.grey
                )
              ),
              contentPadding: EdgeInsets.zero,
            ),
            ListTile(
              leading: Icon(Icons.grass, color: soilMoistureGraphColor),
              title: Text('Soil Moisture', style: TextStyle(color: textPrimary)),
              trailing: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    _soilMoisturePercent != null ? '${_soilMoisturePercent!.toStringAsFixed(1)}%' : 'No data',
                    style: TextStyle(
                      fontWeight: FontWeight.bold, 
                      color: _soilMoisturePercent != null ? soilMoistureGraphColor : Colors.grey
                    )
                  ),
                  if (_soilMoistureRaw != null)
                    Text('RAW: ${_soilMoistureRaw!.toStringAsFixed(0)}', style: TextStyle(fontSize: 10, color: Colors.grey)),
                ],
              ),
              contentPadding: EdgeInsets.zero,
            ),
            
            SizedBox(height: 8),
            if (_devices.isNotEmpty && _devices.any((d) => d['thingSpeakChannelID'] != null))
              Text('Auto-refresh every 5 seconds', style: TextStyle(fontSize: 12, color: primaryColor)),
          ],
        ),
      ),
    );
  }

  Widget _buildPredictionInputCard() {
    return Card(
      elevation: 2,
      color: cardColor,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(Icons.psychology, color: primaryColor),
              SizedBox(width: 8),
              Text('AI Plant Health Prediction', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: primaryColor)),
            ]),
            SizedBox(height: 12),
            
            Text('Complete plant information for AI analysis', style: TextStyle(color: textSecondary)),
            SizedBox(height: 16),
            
            _buildTextField(_heightController, 'Height (cm)', Icons.height),
            SizedBox(height: 12),
            _buildTextField(_leafCountController, 'Leaf Count', Icons.forest),
            SizedBox(height: 12),
            _buildTextField(_newGrowthController, 'New Growth Count', Icons.emoji_nature),
            SizedBox(height: 12),
            _buildTextField(_wateringAmountController, 'Water Amount (ml)', Icons.water_drop),
            SizedBox(height: 12),
            _buildTextField(_wateringFrequencyController, 'Water Frequency (days)', Icons.calendar_today),
            
            SizedBox(height: 20),
            Row(
              children: [
                Expanded(child: _buildButton(Icons.science, 'Load Example', _loadExampleData, lightGreen)),
                SizedBox(width: 10),
                Expanded(child: _buildButton(Icons.clear_all, 'Clear All', _clearAllData, lightGreen)),
              ],
            ),
            
            SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _isPredicting ? null : _predictPlantHealth,
                icon: _isPredicting 
                    ? SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Icon(Icons.psychology),
                label: Text(_isPredicting ? 'ANALYZING...' : 'ANALYZE PLANT HEALTH', style: TextStyle(fontSize: 16)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryColor,
                  foregroundColor: Colors.white,
                  padding: EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTextField(TextEditingController controller, String label, IconData icon) {
    return TextField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: textSecondary),
        prefixIcon: Icon(icon, color: primaryColor),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: lightGreen),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: primaryColor, width: 2),
        ),
        filled: true,
        fillColor: Colors.white,
      ),
      keyboardType: TextInputType.number,
      style: TextStyle(color: textPrimary),
    );
  }

  Widget _buildButton(IconData icon, String text, VoidCallback onPressed, Color color) {
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 18, color: primaryColor),
      label: Text(text, style: TextStyle(color: primaryColor)),
      style: OutlinedButton.styleFrom(
        foregroundColor: primaryColor,
        side: BorderSide(color: primaryColor),
        backgroundColor: color,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }

  Widget _buildPredictionResultCard() {
    if (_predictionResult.isEmpty) return SizedBox();
    
    return Card(
      elevation: 2,
      color: cardColor,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(_getPredictionIcon(_predictionResult), color: _getPredictionColor(_predictionResult), size: 30),
              SizedBox(width: 12),
              Expanded(child: Text(_predictionResult.toUpperCase(), 
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: _getPredictionColor(_predictionResult)))),
            ]),
            SizedBox(height: 16),
            Text('Recommendation:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: primaryColor)),
            SizedBox(height: 8),
            Text(_recommendation, style: TextStyle(color: textPrimary)),
            SizedBox(height: 16),
            Text('Used Sensor Data:', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: primaryColor)),
            SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                Chip(
                  label: Text(
                    _temperature != null ? 'Temp: ${_temperature!.toStringAsFixed(1)}°C' : 'Temp: No data',
                    style: TextStyle(color: _temperature != null ? temperatureGraphColor : Colors.grey)
                  ),
                  backgroundColor: _temperature != null ? temperatureGraphColor.withOpacity(0.2) : Colors.grey.withOpacity(0.2),
                  side: BorderSide(color: _temperature != null ? temperatureGraphColor.withOpacity(0.3) : Colors.grey.withOpacity(0.3)),
                ),
                Chip(
                  label: Text(
                    _humidity != null ? 'Humidity: ${_humidity!.toStringAsFixed(1)}%' : 'Humidity: No data',
                    style: TextStyle(color: _humidity != null ? humidityGraphColor : Colors.grey)
                  ),
                  backgroundColor: _humidity != null ? humidityGraphColor.withOpacity(0.2) : Colors.grey.withOpacity(0.2),
                  side: BorderSide(color: _humidity != null ? humidityGraphColor.withOpacity(0.3) : Colors.grey.withOpacity(0.3)),
                ),
                Chip(
                  label: Text(
                    _soilMoisturePercent != null ? 'Soil: ${_soilMoisturePercent!.toStringAsFixed(1)}%' : 'Soil: No data',
                    style: TextStyle(color: _soilMoisturePercent != null ? soilMoistureGraphColor : Colors.grey)
                  ),
                  backgroundColor: _soilMoisturePercent != null ? soilMoistureGraphColor.withOpacity(0.2) : Colors.grey.withOpacity(0.2),
                  side: BorderSide(color: _soilMoisturePercent != null ? soilMoistureGraphColor.withOpacity(0.3) : Colors.grey.withOpacity(0.3)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDevicesSection() {
    return Card(
      elevation: 2,
      color: cardColor,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.sensors, color: primaryColor),
                SizedBox(width: 10),
                Text(
                  'Plant Sensors',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: primaryColor,
                  ),
                ),
                SizedBox(width: 10),
                Chip(
                  label: Text(_devices.length.toString(), style: TextStyle(color: Colors.white)),
                  backgroundColor: primaryColor,
                ),
                Spacer(),
                IconButton(
                  icon: Icon(Icons.refresh, color: primaryColor),
                  onPressed: _loadPlantDevices,
                  tooltip: 'Refresh Sensors',
                ),
              ],
            ),
            SizedBox(height: 15),
            
            if (_devices.isEmpty)
              _buildEmptyDevicesState()
            else
              ..._buildDeviceList(),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildDeviceList() {
    List<Widget> widgets = [];
    
    for (int i = 0; i < _devices.length; i++) {
      final device = _devices[i];
      
      widgets.add(
        Container(
          margin: EdgeInsets.only(bottom: i < _devices.length - 1 ? 8 : 0),
          child: _buildSensorCard(device),
        ),
      );
      
      final deviceId = device['DeviceID'] ?? device['_id'];
      final latestValues = _latestSensorValues[deviceId];
      final hasThingSpeak = device['thingSpeakChannelID'] != null && 
                           device['thingSpeakWriteAPIKey'] != null;
      
      if (device['Status'] == 'active' && latestValues != null) {
        widgets.add(
          Container(
            margin: EdgeInsets.only(top: 8, bottom: 16),
            child: _buildSensorDataDisplayWidget(device, latestValues, hasThingSpeak),
          ),
        );
      }
      
      if (i < _devices.length - 1) {
        widgets.add(Divider(height: 8, color: lightGreen));
      }
    }
    
    return widgets;
  }

  Widget _buildEmptyDevicesState() {
    return Container(
      padding: EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: lightGreen,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: primaryColor.withOpacity(0.3)),
      ),
      child: Column(
        children: [
          Icon(Icons.sensors_off, size: 50, color: primaryColor),
          SizedBox(height: 10),
          Text(
            'No sensors for this plant',
            style: TextStyle(
              fontSize: 16,
              color: primaryColor,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: 5),
          Text(
            'Add sensors to monitor this plant',
            style: TextStyle(fontSize: 12, color: primaryColor),
          ),
        ],
      ),
    );
  }

  Widget _buildSensorDataDisplayWidget(dynamic device, Map<String, dynamic>? latestValues, bool hasThingSpeak) {
    final deviceId = device['DeviceID'] ?? device['_id'];
    final deviceName = device['deviceName'] ?? 'Unnamed Sensor';
    final sensorHistory = _sensorData[deviceId];
    
    // Check if we have any sensor data to display
    bool hasData = false;
    final List<String> availableSensors = [];
    
    if (latestValues != null) {
      if (latestValues['temperature'] != null && latestValues['temperature'] is num) {
        availableSensors.add('temperature');
        hasData = true;
      }
      if (latestValues['humidity'] != null && latestValues['humidity'] is num) {
        availableSensors.add('humidity');
        hasData = true;
      }
      if (latestValues['soilMoisture'] != null && latestValues['soilMoisture'] is num) {
        availableSensors.add('soilMoisture');
        hasData = true;
      }
      if (latestValues['lightIntensity'] != null && latestValues['lightIntensity'] is num) {
        availableSensors.add('lightIntensity');
        hasData = true;
      }
    }
    
    return Container(
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: lightGreen),
      ),
      padding: EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.analytics, size: 18, color: primaryColor),
              SizedBox(width: 8),
              Text(
                'Sensor Data - $deviceName',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: primaryColor),
              ),
              Spacer(),
              if (hasThingSpeak)
                Text('Auto-refresh every 5s', style: TextStyle(fontSize: 11, color: primaryColor)),
            ],
          ),
          SizedBox(height: 10),
          
          if (latestValues != null)
            _buildRealTimeValues(latestValues, hasData)
          else
            Padding(
              padding: EdgeInsets.all(8),
              child: Text('No sensor data available', style: TextStyle(color: Colors.grey)),
            ),
          
          SizedBox(height: 15),
          
          // Only show graphs if we have data points
          if (sensorHistory != null && sensorHistory.isNotEmpty && hasData)
            ..._buildSensorGraphs(deviceId, sensorHistory, availableSensors),
        ],
      ),
    );
  }

  Widget _buildRealTimeValues(Map<String, dynamic> values, bool hasData) {
    final List<Widget> chips = [];
    
    final tempValue = values['temperature'];
    chips.add(_buildValueChip(
      '🌡️ Temperature', 
      tempValue != null && tempValue is num 
        ? '${tempValue.toStringAsFixed(1)}°C' 
        : 'No data',
      tempValue != null ? temperatureGraphColor : Colors.grey
    ));
    
    final humValue = values['humidity'];
    chips.add(_buildValueChip(
      '💧 Humidity', 
      humValue != null && humValue is num 
        ? '${humValue.toStringAsFixed(1)}%' 
        : 'No data',
      humValue != null ? humidityGraphColor : Colors.grey
    ));
    
    final soilValue = values['soilMoisture'];
    chips.add(_buildValueChip(
      '🌱 Soil', 
      soilValue != null && soilValue is num 
        ? '${_convertSoilMoistureToPercent(soilValue.toDouble()).toStringAsFixed(1)}%' 
        : 'No data',
      soilValue != null ? soilMoistureGraphColor : Colors.grey
    ));
    
    final lightValue = values['lightIntensity'];
    chips.add(_buildValueChip(
      '☀️ Light', 
      lightValue != null && lightValue is num 
        ? '${lightValue.toStringAsFixed(0)} lux' 
        : 'No data',
      lightValue != null ? lightGraphColor : Colors.grey
    ));
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Current Values:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: primaryColor)),
        if (!hasData)
          Padding(
            padding: EdgeInsets.only(bottom: 8),
            child: Text('No sensor readings available', style: TextStyle(fontSize: 11, color: Colors.grey)),
          ),
        SizedBox(height: 8),
        Wrap(
          spacing: 16,
          runSpacing: 8,
          children: chips,
        ),
      ],
    );
  }

  Widget _buildValueChip(String label, String value, Color color) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: color)),
          SizedBox(width: 6),
          Container(
            padding: EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(10)),
            child: Text(value, style: TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildSensorGraphs(String deviceId, Map<String, List<SensorDataPoint>> sensorHistory, List<String> sensorTypes) {
    final List<Widget> graphs = [];
    
    for (final sensorType in sensorTypes) {
      final dataPoints = sensorHistory[sensorType];
      if (dataPoints != null && dataPoints.length > 1) {
        Color graphColor;
        switch (sensorType) {
          case 'temperature':
            graphColor = temperatureGraphColor;
            break;
          case 'humidity':
            graphColor = humidityGraphColor;
            break;
          case 'soilMoisture':
            graphColor = soilMoistureGraphColor;
            break;
          case 'lightIntensity':
            graphColor = lightGraphColor;
            break;
          default:
            graphColor = primaryColor;
        }
        
        graphs.add(
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_getSensorLabel(sensorType), style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: graphColor)),
              SizedBox(height: 4),
              Container(
                height: 150,
                child: SfCartesianChart(
                  margin: EdgeInsets.zero,
                  plotAreaBorderWidth: 0,
                  primaryXAxis: DateTimeAxis(
                    majorGridLines: MajorGridLines(width: 0),
                    intervalType: DateTimeIntervalType.minutes,
                    labelStyle: TextStyle(color: textSecondary, fontSize: 10),
                  ),
                  primaryYAxis: NumericAxis(
                    majorGridLines: MajorGridLines(width: 1, color: Colors.grey[200]!),
                    labelStyle: TextStyle(color: textSecondary, fontSize: 10),
                  ),
                  series: <CartesianSeries>[
                    LineSeries<SensorDataPoint, DateTime>(
                      dataSource: dataPoints,
                      xValueMapper: (SensorDataPoint data, _) => data.timestamp,
                      yValueMapper: (SensorDataPoint data, _) => data.value,
                      color: graphColor,
                      width: 2,
                      markerSettings: MarkerSettings(
                        isVisible: true,
                        height: 4,
                        width: 4,
                        shape: DataMarkerType.circle,
                        borderWidth: 2,
                        borderColor: graphColor,
                      ),
                    ),
                  ],
                  tooltipBehavior: TooltipBehavior(
                    enable: true,
                    color: cardColor,
                    textStyle: TextStyle(color: textPrimary),
                    borderColor: graphColor,
                  ),
                ),
              ),
              SizedBox(height: 15),
            ],
          ),
        );
      }
    }
    
    return graphs;
  }

  String _getSensorLabel(String sensorType) {
    switch (sensorType) {
      case 'temperature': return 'Temperature (°C)';
      case 'humidity': return 'Humidity (%)';
      case 'soilMoisture': return 'Soil Moisture (%)';
      case 'lightIntensity': return 'Light Intensity (lux)';
      default: return sensorType;
    }
  }

  Widget _buildSensorCard(dynamic device) {
    final deviceName = device['deviceName'] ?? 'Unnamed Sensor';
    final deviceId = device['DeviceID'] ?? device['_id'] ?? 'Unknown ID';
    final deviceType = device['deviceType'] ?? 'sensor';
    final status = device['Status'] ?? 'active';
    final location = device['location'];
    final capabilities = device['capabilities'] ?? [];
    final thingSpeakChannelID = device['thingSpeakChannelID'];
    final thingSpeakWriteAPIKey = device['thingSpeakWriteAPIKey'];
    final thingSpeakReadAPIKey = device['thingSpeakReadAPIKey'];
    final isActive = status == 'active';
    final hasThingSpeak = thingSpeakChannelID != null && thingSpeakWriteAPIKey != null;
    
    return Container(
      decoration: BoxDecoration(
        color: isActive 
          ? (hasThingSpeak ? primaryColor.withOpacity(0.1) : lightGreen) 
          : Colors.grey[100],
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: isActive 
            ? (hasThingSpeak ? primaryColor : primaryColor.withOpacity(0.5)) 
            : Colors.grey[300]!,
        ),
      ),
      child: ListTile(
        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        leading: Container(
          width: 40, height: 40,
          decoration: BoxDecoration(
            color: isActive ? primaryColor : Colors.grey[400]!,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(hasThingSpeak ? Icons.cloud : Icons.sensors, color: Colors.white, size: 22),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(deviceName, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: primaryColor)),
                SizedBox(width: 8),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(color: isActive ? primaryColor : Colors.grey, borderRadius: BorderRadius.circular(4)),
                  child: Text(isActive ? 'ACTIVE' : 'INACTIVE', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
                if (hasThingSpeak) ...[
                  SizedBox(width: 8),
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: primaryColor, borderRadius: BorderRadius.circular(4)),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.cloud, size: 10, color: Colors.white),
                      SizedBox(width: 2),
                      Text('TS', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                    ]),
                ),
                ],
              ],
            ),
            SizedBox(height: 4),
            Text('Type: ${deviceType.toUpperCase()}', style: TextStyle(fontSize: 12, color: textSecondary)),
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(height: 4),
            Text('ID: ${deviceId.substring(0, min(10, deviceId.length))}...', 
                 style: TextStyle(fontFamily: 'Monospace', fontSize: 11, color: textSecondary)),
            if (location != null && location.isNotEmpty)
              Padding(padding: EdgeInsets.only(top: 2), child: Text('📍 $location', style: TextStyle(fontSize: 11, color: textSecondary))),
            if (hasThingSpeak)
              Padding(
                padding: EdgeInsets.only(top: 2),
                child: Row(children: [
                  Icon(Icons.cloud, size: 11, color: primaryColor),
                  SizedBox(width: 4),
                  Text('Channel: $thingSpeakChannelID', style: TextStyle(fontSize: 11, color: textSecondary)),
                ]),
              ),
            if (capabilities.isNotEmpty)
              Padding(
                padding: EdgeInsets.only(top: 4),
                child: Wrap(
                  spacing: 4, runSpacing: 4,
                  children: capabilities.take(3).map<Widget>((capability) {
                    return Chip(
                      label: Text(capability.toString(), style: TextStyle(color: primaryColor)), 
                      labelStyle: TextStyle(fontSize: 10), 
                      backgroundColor: primaryColor.withOpacity(0.2),
                      side: BorderSide(color: primaryColor.withOpacity(0.3)),
                    );
                  }).toList(),
                ),
              ),
          ],
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // DELETE button
            IconButton(
              icon: Icon(Icons.delete, size: 20, color: errorColor),
              onPressed: () => _deleteSensor(deviceId),
              tooltip: 'Delete Sensor',
            ),
            // EDIT button
            IconButton(
              icon: Icon(Icons.edit, size: 20, color: infoColor),
              onPressed: () => _modifySensor(device),
              tooltip: 'Edit Sensor',
            ),
            if (hasThingSpeak)
              IconButton(
                icon: Icon(Icons.cloud_upload, size: 20, color: primaryColor),
                onPressed: () => _showThingSpeakOptions(context, device),
                tooltip: 'ThingSpeak Options',
              ),
            IconButton(
              icon: Icon(isActive ? Icons.toggle_on : Icons.toggle_off, color: isActive ? primaryColor : Colors.grey, size: 30),
              onPressed: () => _toggleDeviceStatus(deviceId, isActive),
              tooltip: isActive ? 'Deactivate' : 'Activate',
            ),
          ],
        ),
        onTap: () => _showSensorDetails(context, device),
      ),
    );
  }

  void _showThingSpeakOptions(BuildContext context, dynamic device) {
    final deviceId = device['DeviceID'] ?? device['_id'];
    final thingSpeakChannelID = device['thingSpeakChannelID'];
    final thingSpeakWriteAPIKey = device['thingSpeakWriteAPIKey'];
    
    showModalBottomSheet(
      context: context,
      backgroundColor: cardColor,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => Container(
        padding: EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('ThingSpeak Options', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: primaryColor)),
            SizedBox(height: 10),
            Text('Channel: $thingSpeakChannelID', style: TextStyle(color: textSecondary)),
            SizedBox(height: 20),
            
            SizedBox(width: double.infinity, child: ElevatedButton.icon(
              onPressed: () { Navigator.pop(context); _testThingSpeakConnection(deviceId, thingSpeakChannelID, thingSpeakWriteAPIKey); },
              icon: Icon(Icons.cloud), label: Text('Test Connection'),
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
                padding: EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            )),
            SizedBox(height: 10),
            
            SizedBox(width: double.infinity, child: ElevatedButton.icon(
              onPressed: () { Navigator.pop(context); _fetchThingSpeakData(deviceId, showNotification: true); },
              icon: Icon(Icons.download), label: Text('Fetch Latest Data'),
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
                padding: EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            )),
            SizedBox(height: 10),
            
            SizedBox(width: double.infinity, child: ElevatedButton.icon(
              onPressed: () { Navigator.pop(context); _showEditThingSpeakDialog(context, device); },
              icon: Icon(Icons.edit), label: Text('Edit Configuration'),
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
                padding: EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            )),
            SizedBox(height: 10),
            
            SizedBox(width: double.infinity, child: TextButton(
              onPressed: () => Navigator.pop(context), 
              child: Text('Close', style: TextStyle(color: primaryColor)),
            )),
          ],
        ),
      ),
    );
  }

  void _showEditThingSpeakDialog(BuildContext context, dynamic device) {
    final deviceId = device['DeviceID'] ?? device['_id'];
    final deviceName = device['deviceName'] ?? 'Sensor';
    final currentChannelID = device['thingSpeakChannelID'] ?? '';
    final currentWriteKey = device['thingSpeakWriteAPIKey'] ?? '';
    final currentReadKey = device['thingSpeakReadAPIKey'] ?? '';
    
    final channelController = TextEditingController(text: currentChannelID);
    final writeKeyController = TextEditingController(text: currentWriteKey);
    final readKeyController = TextEditingController(text: currentReadKey);
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: cardColor,
        title: Row(children: [Icon(Icons.cloud, color: primaryColor), SizedBox(width: 10), Text('Edit ThingSpeak Config', style: TextStyle(color: primaryColor))]),
        content: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text('Device: $deviceName', style: TextStyle(fontWeight: FontWeight.bold, color: primaryColor)),
            SizedBox(height: 15),
            TextField(
              controller: channelController, 
              decoration: InputDecoration(
                labelText: 'ThingSpeak Channel ID', 
                labelStyle: TextStyle(color: textSecondary),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)), 
                hintText: 'e.g., 1234567', 
                prefixIcon: Icon(Icons.numbers, color: primaryColor),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: primaryColor, width: 2),
                ),
                filled: true,
                fillColor: Colors.white,
              ), 
              keyboardType: TextInputType.number,
              style: TextStyle(color: textPrimary),
            ),
            SizedBox(height: 10),
            TextField(
              controller: writeKeyController, 
              decoration: InputDecoration(
                labelText: 'Write API Key *', 
                labelStyle: TextStyle(color: textSecondary),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)), 
                hintText: 'Write key from ThingSpeak', 
                prefixIcon: Icon(Icons.vpn_key, color: primaryColor),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: primaryColor, width: 2),
                ),
                filled: true,
                fillColor: Colors.white,
              ), 
              obscureText: true,
              style: TextStyle(color: textPrimary),
            ),
            SizedBox(height: 10),
            TextField(
              controller: readKeyController, 
              decoration: InputDecoration(
                labelText: 'Read API Key (Optional)', 
                labelStyle: TextStyle(color: textSecondary),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)), 
                hintText: 'Read key from ThingSpeak', 
                prefixIcon: Icon(Icons.vpn_key, color: primaryColor),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: primaryColor, width: 2),
                ),
                filled: true,
                fillColor: Colors.white,
              ), 
              obscureText: true,
              style: TextStyle(color: textPrimary),
            ),
          ]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context), 
            child: Text('Cancel', style: TextStyle(color: primaryColor)),
          ),
          ElevatedButton(
            onPressed: () async {
              if (channelController.text.isEmpty || writeKeyController.text.isEmpty) {
                _showSnackBar('Channel ID and Write API Key are required', errorColor);
                return;
              }
              Navigator.pop(context);
              await _updateThingSpeakConfig(deviceId, channelController.text, writeKeyController.text,
                readKeyController.text.isNotEmpty ? readKeyController.text : null);
            },
            child: Text('Save'),
            style: ElevatedButton.styleFrom(
              backgroundColor: primaryColor,
              foregroundColor: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  void _showSensorDetails(BuildContext context, dynamic device) {
    final deviceName = device['deviceName'] ?? 'Unnamed Sensor';
    final deviceId = device['DeviceID'] ?? device['_id'] ?? 'Unknown';
    final deviceType = device['deviceType'] ?? 'sensor';
    final status = device['Status'] ?? 'active';
    final firmware = device['firmwareVersion'] ?? '1.0.0';
    final location = device['location'];
    final capabilities = device['capabilities'] ?? [];
    final thingSpeakChannelID = device['thingSpeakChannelID'];
    final thingSpeakWriteAPIKey = device['thingSpeakWriteAPIKey'];
    final thingSpeakReadAPIKey = device['thingSpeakReadAPIKey'];
    final lastSyncTime = device['lastSyncTime'];
    final isActive = status == 'active';
    final hasThingSpeak = thingSpeakChannelID != null && thingSpeakWriteAPIKey != null;
    final latestValues = _latestSensorValues[deviceId];
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: cardColor,
        title: Row(children: [
          Icon(hasThingSpeak ? Icons.cloud : Icons.sensors, color: primaryColor),
          SizedBox(width: 10),
          Text('Sensor Details', style: TextStyle(color: primaryColor)),
        ]),
        content: SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Row(children: [
              Container(
                padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: isActive ? primaryColor : Colors.grey, borderRadius: BorderRadius.circular(4)),
                child: Text(isActive ? 'ACTIVE' : 'INACTIVE', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
              SizedBox(width: 8),
              if (hasThingSpeak)
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: primaryColor, borderRadius: BorderRadius.circular(4)),
                  child: Row(children: [
                    Icon(Icons.cloud, size: 12, color: Colors.white),
                    SizedBox(width: 4),
                    Text('THINGSPEAK', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                  ]),
                ),
              SizedBox(width: 8),
              Expanded(child: Text(deviceName, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: primaryColor))),
            ]),
            SizedBox(height: 15),
            
            Container(
              padding: EdgeInsets.all(10),
              decoration: BoxDecoration(color: lightGreen, borderRadius: BorderRadius.circular(8)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Device ID:', style: TextStyle(fontWeight: FontWeight.bold, color: primaryColor)),
                SizedBox(height: 4),
                SelectableText(deviceId, style: TextStyle(fontFamily: 'Monospace', fontSize: 12, color: primaryColor)),
              ]),
            ),
            SizedBox(height: 15),
            
            _buildDetailRow('Type', deviceType.toUpperCase()),
            _buildDetailRow('Firmware', firmware),
            if (location != null && location.isNotEmpty) _buildDetailRow('Location', location),
            _buildDetailRow('Status', status.toUpperCase()),
            
            SizedBox(height: 15),
            Container(
              padding: EdgeInsets.all(10),
              decoration: BoxDecoration(color: lightGreen, borderRadius: BorderRadius.circular(8)),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Current Sensor Data:', style: TextStyle(fontWeight: FontWeight.bold, color: primaryColor)),
                SizedBox(height: 5),
                _buildDetailRow('Temperature', latestValues != null && latestValues['temperature'] != null && latestValues['temperature'] is num
                  ? '${latestValues['temperature'].toStringAsFixed(1)}°C' 
                  : 'No data'),
                _buildDetailRow('Humidity', latestValues != null && latestValues['humidity'] != null && latestValues['humidity'] is num
                  ? '${latestValues['humidity'].toStringAsFixed(1)}%' 
                  : 'No data'),
                _buildDetailRow('Soil Moisture', latestValues != null && latestValues['soilMoisture'] != null && latestValues['soilMoisture'] is num
                  ? '${_convertSoilMoistureToPercent(latestValues['soilMoisture'].toDouble()).toStringAsFixed(1)}%' 
                  : 'No data'),
                _buildDetailRow('Light', latestValues != null && latestValues['lightIntensity'] != null && latestValues['lightIntensity'] is num
                  ? '${latestValues['lightIntensity'].toStringAsFixed(0)} lux'
                  : 'No data'),
                if (hasThingSpeak)
                  Text('Auto-refreshing every 5s', style: TextStyle(fontSize: 11, color: primaryColor, fontStyle: FontStyle.italic)),
              ]),
            ),
            
            if (hasThingSpeak) ...[
              SizedBox(height: 15),
              Container(
                padding: EdgeInsets.all(10),
                decoration: BoxDecoration(color: lightGreen, borderRadius: BorderRadius.circular(8)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Icon(Icons.cloud, size: 16, color: primaryColor),
                    SizedBox(width: 8),
                    Text('ThingSpeak Configuration', style: TextStyle(fontWeight: FontWeight.bold, color: primaryColor)),
                  ]),
                  SizedBox(height: 8),
                  _buildDetailRow('Channel ID', thingSpeakChannelID),
                  _buildDetailRow('Write API Key', thingSpeakWriteAPIKey != null 
                    ? '${thingSpeakWriteAPIKey.substring(0, min(8, thingSpeakWriteAPIKey.length))}...' 
                    : 'Not set'),
                  if (thingSpeakReadAPIKey != null)
                    _buildDetailRow('Read API Key', '${thingSpeakReadAPIKey.substring(0, min(8, thingSpeakReadAPIKey.length))}...'),
                ]),
              ),
            ],
            
            if (capabilities.isNotEmpty) ...[
              SizedBox(height: 15),
              Text('Capabilities:', style: TextStyle(fontWeight: FontWeight.bold, color: primaryColor)),
              SizedBox(height: 4),
              Wrap(spacing: 8, runSpacing: 8, children: capabilities.map<Widget>((capability) {
                return Chip(
                  label: Text(capability.toString(), style: TextStyle(color: primaryColor)), 
                  labelStyle: TextStyle(fontSize: 12),
                  backgroundColor: primaryColor.withOpacity(0.2),
                  side: BorderSide(color: primaryColor.withOpacity(0.3)),
                );
              }).toList()),
            ],
            
            SizedBox(height: 15),
            if (device['createdAt'] != null) _buildDetailRow('Created', _formatDate(device['createdAt'])),
            if (lastSyncTime != null) _buildDetailRow('Last Sync', _formatDateTime(lastSyncTime)),
          ]),
        ),
        actions: [
          // DELETE button in details
          ElevatedButton(
            onPressed: () { 
              Navigator.pop(context); 
              _deleteSensor(deviceId); 
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: errorColor,
              foregroundColor: Colors.white,
            ),
            child: Text('Delete'),
          ),
          // EDIT button in details
          ElevatedButton.icon(
            onPressed: () { Navigator.pop(context); _modifySensor(device); },
            icon: Icon(Icons.edit, size: 20), label: Text('Edit'),
            style: ElevatedButton.styleFrom(
              backgroundColor: infoColor,
              foregroundColor: Colors.white,
            ),
          ),
          if (hasThingSpeak)
            ElevatedButton.icon(
              onPressed: () { Navigator.pop(context); _showThingSpeakOptions(context, device); },
              icon: Icon(Icons.cloud, size: 20), label: Text('ThingSpeak'),
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
              ),
            ),
          ElevatedButton(
            onPressed: () { Navigator.pop(context); _toggleDeviceStatus(deviceId, isActive); },
            style: ElevatedButton.styleFrom(
              backgroundColor: isActive ? primaryColor : Colors.grey,
              foregroundColor: Colors.white,
            ),
            child: Text(isActive ? 'Deactivate' : 'Activate'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context), 
            child: Text('Close', style: TextStyle(color: primaryColor)),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('$label: ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: primaryColor)),
        SizedBox(width: 5),
        Expanded(child: Text(value, style: TextStyle(fontSize: 14, color: textPrimary))),
      ]),
    );
  }

  String _formatDate(dynamic date) {
    if (date == null) return 'N/A';
    try {
      final datetime = DateTime.parse(date.toString()).toLocal();
      return '${datetime.day}/${datetime.month}/${datetime.year}';
    } catch (e) {
      return date.toString();
    }
  }

  String _formatDateTime(dynamic date) {
    if (date == null) return 'N/A';
    try {
      final datetime = DateTime.parse(date.toString()).toLocal();
      return '${datetime.day}/${datetime.month}/${datetime.year} ${datetime.hour}:${datetime.minute.toString().padLeft(2, '0')}';
    } catch (e) {
      return date.toString();
    }
  }

  Future<void> _showCreateSensorDialog(BuildContext context) async {
    final deviceNameController = TextEditingController();
    final locationController = TextEditingController();
    final thingSpeakChannelController = TextEditingController();
    final thingSpeakWriteKeyController = TextEditingController();
    final thingSpeakReadKeyController = TextEditingController();
    
    bool _includeThingSpeak = false;
    
    await showDialog(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setState) {
        return AlertDialog(
          backgroundColor: cardColor,
          title: Row(children: [Icon(Icons.add_circle, color: primaryColor), SizedBox(width: 10), Text('Add New Sensor', style: TextStyle(color: primaryColor))]),
          content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(
              controller: deviceNameController, 
              decoration: InputDecoration(
                labelText: 'Sensor Name *', 
                labelStyle: TextStyle(color: textSecondary),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)), 
                hintText: 'e.g., Temperature Sensor', 
                prefixIcon: Icon(Icons.title, color: primaryColor),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: primaryColor, width: 2),
                ),
                filled: true,
                fillColor: Colors.white,
              ),
              style: TextStyle(color: textPrimary),
            ),
            SizedBox(height: 15),
            TextField(
              controller: locationController, 
              decoration: InputDecoration(
                labelText: 'Location (Optional)', 
                labelStyle: TextStyle(color: textSecondary),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)), 
                hintText: 'e.g., Near the window', 
                prefixIcon: Icon(Icons.location_on, color: primaryColor),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: primaryColor, width: 2),
                ),
                filled: true,
                fillColor: Colors.white,
              ),
              style: TextStyle(color: textPrimary),
            ),
            SizedBox(height: 15),
            Row(children: [
              Checkbox(value: _includeThingSpeak, onChanged: (value) => setState(() => _includeThingSpeak = value ?? false), activeColor: primaryColor),
              Text('Configure ThingSpeak', style: TextStyle(color: primaryColor)), 
              SizedBox(width: 10), 
              Icon(Icons.cloud_upload, color: primaryColor),
            ]),
            if (_includeThingSpeak) ...[
              SizedBox(height: 15),
              Text('ThingSpeak Configuration', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: primaryColor)),
              SizedBox(height: 10),
              TextField(
                controller: thingSpeakChannelController, 
                decoration: InputDecoration(
                  labelText: 'ThingSpeak Channel ID', 
                  labelStyle: TextStyle(color: textSecondary),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)), 
                  hintText: 'e.g., 1234567', 
                  prefixIcon: Icon(Icons.numbers, color: primaryColor),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: primaryColor, width: 2),
                  ),
                  filled: true,
                  fillColor: Colors.white,
                ), 
                keyboardType: TextInputType.number,
                style: TextStyle(color: textPrimary),
              ),
              SizedBox(height: 10),
              TextField(
                controller: thingSpeakWriteKeyController, 
                decoration: InputDecoration(
                  labelText: 'ThingSpeak Write API Key', 
                  labelStyle: TextStyle(color: textSecondary),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)), 
                  hintText: 'Write key from ThingSpeak', 
                  prefixIcon: Icon(Icons.vpn_key, color: primaryColor),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: primaryColor, width: 2),
                  ),
                  filled: true,
                  fillColor: Colors.white,
                ), 
                obscureText: true,
                style: TextStyle(color: textPrimary),
              ),
              SizedBox(height: 10),
              TextField(
                controller: thingSpeakReadKeyController, 
                decoration: InputDecoration(
                  labelText: 'ThingSpeak Read API Key (Optional)', 
                  labelStyle: TextStyle(color: textSecondary),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)), 
                  hintText: 'Read key from ThingSpeak', 
                  prefixIcon: Icon(Icons.vpn_key, color: primaryColor),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide(color: primaryColor, width: 2),
                  ),
                  filled: true,
                  fillColor: Colors.white,
                ), 
                obscureText: true,
                style: TextStyle(color: textPrimary),
              ),
              SizedBox(height: 10),
              Container(
                padding: EdgeInsets.all(10), 
                decoration: BoxDecoration(color: lightGreen, borderRadius: BorderRadius.circular(8)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('📝 ThingSpeak Notes:', style: TextStyle(fontWeight: FontWeight.bold, color: primaryColor)),
                  SizedBox(height: 5),
                  Text('• Create a channel on thingspeak.com', style: TextStyle(fontSize: 12, color: textPrimary)),
                  Text('• Get Channel ID and API Keys from your channel', style: TextStyle(fontSize: 12, color: textPrimary)),
                  Text('• Write API Key is required for sending data', style: TextStyle(fontSize: 12, color: textPrimary)),
                  Text('• Read API Key is optional for fetching data', style: TextStyle(fontSize: 12, color: textPrimary)),
                  Text('• Data will auto-refresh every 5 seconds', style: TextStyle(fontSize: 12, color: textPrimary)),
                ]),
              ),
            ],
          ])),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context), 
              child: Text('Cancel', style: TextStyle(color: primaryColor)),
            ),
            ElevatedButton(
              onPressed: () async {
                if (deviceNameController.text.isEmpty) {
                  _showSnackBar('Sensor name is required', errorColor);
                  return;
                }
                Navigator.pop(context);
                await _createSensorForPlant(
                  deviceNameController.text,
                  locationController.text,
                  _includeThingSpeak ? thingSpeakChannelController.text : null,
                  _includeThingSpeak ? thingSpeakWriteKeyController.text : null,
                  _includeThingSpeak ? thingSpeakReadKeyController.text : null,
                );
              },
              child: Text('Create Sensor'),
              style: ElevatedButton.styleFrom(
                backgroundColor: primaryColor,
                foregroundColor: Colors.white,
              ),
            ),
          ],
        );
      }),
    );
  }

  void _showThingSpeakHelp(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: cardColor,
        title: Row(children: [Icon(Icons.cloud, color: primaryColor), SizedBox(width: 10), Text('ThingSpeak Help', style: TextStyle(color: primaryColor))]),
        content: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text('What is ThingSpeak?', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: primaryColor)),
          SizedBox(height: 10),
          Text('ThingSpeak is an IoT platform that allows you to collect, visualize, and analyze live data streams in the cloud.', style: TextStyle(color: textPrimary)),
          SizedBox(height: 15),
          Text('📡 Auto-Refresh Feature:', style: TextStyle(fontWeight: FontWeight.bold, color: primaryColor)),
          SizedBox(height: 5),
          Text('• Sensors with ThingSpeak auto-refresh every 5 seconds', style: TextStyle(color: textPrimary)),
          Text('• Real-time data visualization with graphs', style: TextStyle(color: textPrimary)),
          Text('• Historical data tracking (last 50 points)', style: TextStyle(color: textPrimary)),
          SizedBox(height: 15),
          Text('How to get started:', style: TextStyle(fontWeight: FontWeight.bold, color: primaryColor)),
          SizedBox(height: 5),
          Text('1. Go to thingspeak.com and create a free account', style: TextStyle(color: textPrimary)),
          Text('2. Create a new channel', style: TextStyle(color: textPrimary)),
          Text('3. Configure fields (e.g., Field 1: Temperature)', style: TextStyle(color: textPrimary)),
          Text('4. Copy the Channel ID and API Keys', style: TextStyle(color: textPrimary)),
          Text('5. Enter them when creating/editing a sensor', style: TextStyle(color: textPrimary)),
          SizedBox(height: 15),
          Text('Field Mapping:', style: TextStyle(fontWeight: FontWeight.bold, color: primaryColor)),
          SizedBox(height: 5),
          Text('• Field 1: Temperature (°C)', style: TextStyle(color: textPrimary)),
          Text('• Field 2: Humidity (%)', style: TextStyle(color: textPrimary)),
          Text('• Field 3: Soil Moisture (%)', style: TextStyle(color: textPrimary)),
          Text('• Field 4: Light Intensity (lux)', style: TextStyle(color: textPrimary)),
          SizedBox(height: 15),
          Text('Benefits:', style: TextStyle(fontWeight: FontWeight.bold, color: primaryColor)),
          SizedBox(height: 5),
          Text('✓ Live data visualization', style: TextStyle(color: textPrimary)),
          Text('✓ Historical data storage', style: TextStyle(color: textPrimary)),
          Text('✓ Data export options', style: TextStyle(color: textPrimary)),
          Text('✓ Mobile app available', style: TextStyle(color: textPrimary)),
          Text('✓ MATLAB analytics integration', style: TextStyle(color: textPrimary)),
          Text('✓ Real-time auto-refresh (5s)', style: TextStyle(color: textPrimary)),
        ])),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context), 
            child: Text('Close', style: TextStyle(color: primaryColor)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                content: Text('Open: https://thingspeak.com'), 
                backgroundColor: primaryColor
              ));
            },
            child: Text('Visit ThingSpeak'),
            style: ElevatedButton.styleFrom(
              backgroundColor: primaryColor,
              foregroundColor: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Color _getPredictionColor(String label) {
    final lowerLabel = label.toLowerCase();
    if (lowerLabel.contains('poor') || label.contains('1')) return errorColor;
    if (lowerLabel.contains('fair') || label.contains('2')) return warningColor;
    if (lowerLabel.contains('good') || label.contains('3')) return successColor;
    if (lowerLabel.contains('excellent') || label.contains('4')) return primaryColor;
    return primaryColor;
  }

  IconData _getPredictionIcon(String label) {
    final lowerLabel = label.toLowerCase();
    if (lowerLabel.contains('poor') || label.contains('1')) return Icons.sick;
    if (lowerLabel.contains('fair') || label.contains('2')) return Icons.warning;
    if (lowerLabel.contains('good') || label.contains('3')) return Icons.health_and_safety;
    if (lowerLabel.contains('excellent') || label.contains('4')) return Icons.eco;
    return Icons.psychology;
  }

  // ===============================
  // MAIN BUILD METHOD
  // ===============================
  @override
  Widget build(BuildContext context) {
    final plantName = widget.plant.PlantName ?? widget.plant.plantName ?? 'Plant';
    final plantType = widget.plant.PlantType ?? widget.plant.plantType ?? 'Unknown';
    
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: backgroundColor,
        appBar: AppBar(
          title: Text(plantName, style: TextStyle(color: Colors.white)),
          backgroundColor: primaryColor,
          bottom: TabBar(
            tabs: [
              Tab(icon: Icon(Icons.sensors, color: Colors.white), text: 'Sensors'),
              Tab(icon: Icon(Icons.psychology, color: Colors.white), text: 'AI Analysis'),
            ],
            indicatorColor: Colors.white,
            labelColor: Colors.white,
            unselectedLabelColor: Colors.white.withOpacity(0.7),
          ),
          actions: [
            IconButton(
              icon: Icon(Icons.refresh, color: Colors.white), 
              onPressed: _loadPlantDevices, 
              tooltip: 'Refresh Sensors'
            ),
          ],
        ),
        body: _isLoading 
            ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                CircularProgressIndicator(color: primaryColor),
                SizedBox(height: 20),
                Text('Loading plant data...', style: TextStyle(color: primaryColor)),
              ]))
            : TabBarView(children: [
                // TAB 1: SENSORS
                RefreshIndicator(
                  onRefresh: _loadPlantDevices,
                  color: primaryColor,
                  backgroundColor: backgroundColor,
                  child: SingleChildScrollView(
                    padding: EdgeInsets.all(16),
                    child: Column(children: [
                      Card(
                        elevation: 2,
                        color: cardColor,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        child: Padding(
                          padding: EdgeInsets.all(16),
                          child: Row(children: [
                            Container(
                              width: 50, height: 50,
                              decoration: BoxDecoration(color: primaryColor.withOpacity(0.1), borderRadius: BorderRadius.circular(25)),
                              child: Icon(Icons.local_florist, color: primaryColor, size: 28),
                            ),
                            SizedBox(width: 15),
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(plantName, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: primaryColor)),
                              SizedBox(height: 4),
                              Text('Type: $plantType', style: TextStyle(fontSize: 14, color: textSecondary)),
                              SizedBox(height: 8),
                              Text('${_devices.length} sensor${_devices.length != 1 ? 's' : ''} assigned', style: TextStyle(fontSize: 12, color: textSecondary)),
                              if (_devices.isNotEmpty)
                                Text('${_devices.where((d) => d['thingSpeakChannelID'] != null).length} with ThingSpeak', style: TextStyle(fontSize: 12, color: textSecondary)),
                              if (_devices.any((d) => d['thingSpeakChannelID'] != null))
                                Text('📡 Auto-refresh: Every 5 seconds', style: TextStyle(fontSize: 11, color: primaryColor)),
                            ])),
                          ]),
                        ),
                      ),
                      SizedBox(height: 20),
                      _buildSensorDataDisplay(),
                      SizedBox(height: 20),
                      _buildDevicesSection(),
                      SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: () => _showCreateSensorDialog(context),
                          icon: Icon(Icons.add), label: Text('Add New Sensor to Plant'),
                          style: ElevatedButton.styleFrom(
                            padding: EdgeInsets.symmetric(vertical: 15), 
                            backgroundColor: primaryColor,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ),
                      SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () => _showThingSpeakHelp(context),
                          icon: Icon(Icons.help, color: primaryColor), label: Text('ThingSpeak Help'),
                          style: OutlinedButton.styleFrom(
                            padding: EdgeInsets.symmetric(vertical: 12), 
                            side: BorderSide(color: primaryColor),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ),
                      SizedBox(height: 30),
                    ]),
                  ),
                ),
                
                // TAB 2: AI ANALYSIS
                SingleChildScrollView(
                  padding: EdgeInsets.all(16),
                  child: Column(children: [
                    _buildSensorDataDisplay(),
                    SizedBox(height: 20),
                    _buildPredictionInputCard(),
                    SizedBox(height: 20),
                    if (_errorMessage.isNotEmpty)
                      Card(
                        elevation: 2,
                        color: errorColor.withOpacity(0.1), 
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        child: Padding(
                          padding: EdgeInsets.all(12),
                          child: Row(children: [
                            Icon(Icons.error, color: errorColor),
                            SizedBox(width: 12),
                            Expanded(child: Text(_errorMessage, style: TextStyle(color: errorColor))),
                          ]),
                        ),
                      ),
                    SizedBox(height: 20),
                    if (_predictionResult.isNotEmpty) _buildPredictionResultCard(),
                  ]),
                ),
              ]),
      ),
    );
  }
}

class SensorDataPoint {
  final DateTime timestamp;
  final double value;
  
  SensorDataPoint({required this.timestamp, required this.value});
}

int min(int a, int b) => a < b ? a : b;