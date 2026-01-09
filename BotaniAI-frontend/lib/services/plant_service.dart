import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/plant.dart';

class PlantService {
  final String baseUrl = 'http://localhost:5000/api'; // your Node.js API

  Future<List<Plant>> getPlants() async {
    final response = await http.get(Uri.parse('$baseUrl/plants'));
    if (response.statusCode == 200) {
      List data = json.decode(response.body);
      return data.map((json) => Plant.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load plants');
    }
  }

  Future<Plant> addPlant(Plant plant) async {
    final response = await http.post(
      Uri.parse('$baseUrl/plants'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(plant.toJson()),
    );
    if (response.statusCode == 201) {
      return Plant.fromJson(json.decode(response.body));
    } else {
      throw Exception('Failed to add plant');
    }
  }
}
