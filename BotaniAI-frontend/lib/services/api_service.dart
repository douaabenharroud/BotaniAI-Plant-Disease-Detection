import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  static const String baseUrl = 'http://localhost:5000/api';

  static Future<int> predictPlantHealth(Map<String, dynamic> sensorData) async {
    final response = await http.post(
      Uri.parse('$baseUrl/predict'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(sensorData),
    );

    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['prediction'];
    } else {
      throw Exception('Failed to predict plant health');
    }
  }
}
