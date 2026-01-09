import 'dart:convert';
import 'package:http/http.dart' as http;


import '../models/login_model.dart';
class AuthService {
  final String baseUrl = "http://localhost:5000/api/auth"; // <-- Node.js backend URL

  Future<Map<String, dynamic>> signup(String name, String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/register'), // <-- CORRECTED route
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "Name": name,                  // match backend field names
          "Username": email.split('@')[0], // or provide a separate username
          "Email": email,
          "password": password,
          "confirmPassword": password,    // backend expects confirmPassword
        }),
      );

      return jsonDecode(response.body);
    } catch (e) {
      print('Signup error: $e');
      return {"message": "Failed to connect to server"};
    }
  }
}


class ApiService {
  static const String baseUrl = "http://localhost:5000/api/auth";

  // Login function
  static Future<Map<String, dynamic>> login(LoginModel loginData) async {
    final response = await http.post(
      Uri.parse("$baseUrl/login"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode(loginData.toJson()),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body); // returns user + token
    } else {
      throw Exception(jsonDecode(response.body)['message']);
    }
  }
}
