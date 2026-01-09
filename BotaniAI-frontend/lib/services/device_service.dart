// lib/services/device_service.dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/device.dart';

class DeviceService {
  final String baseUrl = 'http://localhost:5000/api'; // Change to your backend URL

  Future<List<Device>> getDevices(String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/devices'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data['success']) {
        final List<dynamic> devicesJson = data['devices'];
        return devicesJson.map((json) => Device.fromJson(json)).toList();
      }
    }
    throw Exception('Failed to load devices');
  }

  Future<Device> registerDevice(Map<String, dynamic> deviceData, String token) async {
    final response = await http.post(
      Uri.parse('$baseUrl/devices'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: json.encode(deviceData),
    );

    if (response.statusCode == 201) {
      final data = json.decode(response.body);
      if (data['success']) {
        return Device.fromJson(data['device']);
      }
    }
    throw Exception('Failed to register device');
  }

  Future<Device> updateDevice(String deviceId, Map<String, dynamic> updates, String token) async {
    final response = await http.put(
      Uri.parse('$baseUrl/devices/$deviceId'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: json.encode(updates),
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      if (data['success']) {
        return Device.fromJson(data['device']);
      }
    }
    throw Exception('Failed to update device');
  }

  Future<void> deleteDevice(String deviceId, String token) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/devices/$deviceId'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode != 200) {
      throw Exception('Failed to delete device');
    }
  }
}