// 📌 lib/pages/device_detail_page.dart
// lib/pages/simple_devices_page.dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class SimpleDevicesPage extends StatefulWidget {
  final String token;
  SimpleDevicesPage({required this.token});

  @override
  _SimpleDevicesPageState createState() => _SimpleDevicesPageState();
}

class _SimpleDevicesPageState extends State<SimpleDevicesPage> {
  final String devicesApi = 'http://localhost:5000/api/devices';
  List<Map<String, dynamic>> _devices = [];
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _fetchDevices();
  }

  Future<void> _fetchDevices() async {
    setState(() => _loading = true);
    try {
      final resp = await http.get(
        Uri.parse(devicesApi),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      );
      
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body);
        setState(() {
          _devices = List<Map<String, dynamic>>.from(
            data['data'] ?? data
          );
        });
      }
    } catch (e) {
      _showSnackBar('Error: $e', Colors.red);
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _showAddDialog() async {
    final nameController = TextEditingController();
    final locationController = TextEditingController();
    final idController = TextEditingController();
    String selectedType = 'sensor';

    await showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Add New Device'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: InputDecoration(
                  labelText: 'Device Name',
                  border: OutlineInputBorder(),
                ),
              ),
              SizedBox(height: 10),
              TextField(
                controller: locationController,
                decoration: InputDecoration(
                  labelText: 'Location (Optional)',
                  border: OutlineInputBorder(),
                ),
              ),
              SizedBox(height: 10),
              TextField(
                controller: idController,
                decoration: InputDecoration(
                  labelText: 'Device ID (Optional)',
                  border: OutlineInputBorder(),
                ),
              ),
              SizedBox(height: 10),
              DropdownButtonFormField<String>(
                value: selectedType,
                decoration: InputDecoration(
                  labelText: 'Device Type',
                  border: OutlineInputBorder(),
                ),
                items: ['sensor', 'controller', 'gateway', 'other']
                    .map((type) => DropdownMenuItem(
                          value: type,
                          child: Text(type),
                        ))
                    .toList(),
                onChanged: (value) {
                  if (value != null) selectedType = value;
                },
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              await _addDevice(
                nameController.text,
                locationController.text,
                idController.text,
                selectedType,
              );
            },
            child: Text('Add Device'),
          ),
        ],
      ),
    );
  }

  Future<void> _addDevice(
      String name, String location, String deviceId, String type) async {
    if (name.isEmpty) {
      _showSnackBar('Device name is required', Colors.orange);
      return;
    }

    final payload = {
      'DeviceID': deviceId.isEmpty ? null : deviceId,
      'name': name,
      'location': location.isEmpty ? null : location,
      'deviceType': type,
      'firmwareVersion': '1.0.0',
    };

    // Remove null values
    payload.removeWhere((key, value) => value == null);

    try {
      final resp = await http.post(
        Uri.parse(devicesApi),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
        body: jsonEncode(payload),
      );

      if (resp.statusCode == 201) {
        _showSnackBar('Device added successfully', Colors.green);
        _fetchDevices();
      } else {
        final error = jsonDecode(resp.body)['message'] ?? 'Failed to add device';
        _showSnackBar(error, Colors.red);
      }
    } catch (e) {
      _showSnackBar('Error: $e', Colors.red);
    }
  }

  void _showSnackBar(String message, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: color,
      ),
    );
  }

  Widget _buildDeviceItem(Map<String, dynamic> device) {
    return Card(
      margin: EdgeInsets.all(8),
      child: ListTile(
        leading: Icon(
          device['deviceType'] == 'controller' 
              ? Icons.smart_toy 
              : device['deviceType'] == 'gateway'
                ? Icons.router
                : Icons.sensors,
          color: Colors.blue,
        ),
        title: Text(device['name'] ?? 'Unnamed Device'),
        subtitle: Text('Type: ${device['deviceType'] ?? 'unknown'}'),
        trailing: Icon(Icons.chevron_right),
        onTap: () {
          // Navigate to device details
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('My Devices'),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh),
            onPressed: _fetchDevices,
          ),
        ],
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator())
          : _devices.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.devices, size: 80, color: Colors.grey),
                      SizedBox(height: 20),
                      Text('No devices found'),
                      SizedBox(height: 10),
                      Text('Add your first device'),
                    ],
                  ),
                )
              : ListView.builder(
                  itemCount: _devices.length,
                  itemBuilder: (context, index) => _buildDeviceItem(_devices[index]),
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddDialog,
        child: Icon(Icons.add),
      ),
    );
  }
}