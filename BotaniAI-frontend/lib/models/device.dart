// lib/models/simple_device.dart
class SimpleDevice {
  final String deviceID;
  final String name;
  final String location;
  final String deviceType;
  
  SimpleDevice({
    required this.deviceID,
    required this.name,
    required this.location,
    required this.deviceType,
  });
  
  Map<String, dynamic> toJson() {
    return {
      'DeviceID': deviceID,
      'name': name,
      'location': location,
      'deviceType': deviceType,
      'firmwareVersion': '1.0.0',
    };
  }
}