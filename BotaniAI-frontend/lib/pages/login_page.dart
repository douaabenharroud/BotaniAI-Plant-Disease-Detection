import 'dart:convert';
import 'package:flutter/material.dart';
import '../widgets/wave_clipper.dart';
import 'signup_page.dart';
import 'my_plants_page.dart';
import 'package:http/http.dart' as http;

// Login model
class LoginModel {
  String email;
  String password;

  LoginModel({required this.email, required this.password});

  Map<String, dynamic> toJson() => {
        "email": email,
        "password": password,
      };
}

// API Service
class ApiService {
  static const String baseUrl = "http://localhost:5000/api/auth";

  static Future<Map<String, dynamic>> login(LoginModel loginData) async {
    final response = await http.post(
      Uri.parse("$baseUrl/login"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode(loginData.toJson()),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception(jsonDecode(response.body)['message']);
    }
  }
}

class LoginPage extends StatefulWidget {
  @override
  _LoginPageState createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final TextEditingController emailController = TextEditingController();
  final TextEditingController passwordController = TextEditingController();
  bool rememberMe = false;
  bool isLoading = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SingleChildScrollView(
        child: Column(
          children: [
            ClipPath(
              clipper: WaveClipper(),
              child: Container(
                height: 250,
                decoration: BoxDecoration(
                  image: DecorationImage(
                    image: NetworkImage(
                      'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=800&q=60'
                    ),
                    fit: BoxFit.cover,
                  ),
                ),
              ),
            ),
            SizedBox(height: 20),
            Text(
              'Welcome Back',
              style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF2E5F2F)),
            ),
            SizedBox(height: 8),
            Text(
              'Login to your account',
              style: TextStyle(fontSize: 16, color: Colors.grey[600]),
            ),
            SizedBox(height: 20),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: Column(
                children: [
                  TextField(
                    controller: emailController,
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: Colors.green[50],
                      prefixIcon: Icon(Icons.person, color: Color(0xFF2E5F2F)),
                      hintText: 'Email',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none),
                    ),
                  ),
                  SizedBox(height: 16),
                  TextField(
                    controller: passwordController,
                    obscureText: true,
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: Colors.green[50],
                      prefixIcon: Icon(Icons.lock, color: Color(0xFF2E5F2F)),
                      hintText: 'Password',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none),
                    ),
                  ),
                  SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                         
                          Text(''),
                        ],
                      ),
                      TextButton(
                        onPressed: () {},
                        child: Text(
                          '',
                          style: TextStyle(color: Color(0xFF2E5F2F)),
                        ),
                      )
                    ],
                  ),
                  SizedBox(height: 20),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                        minimumSize: Size(double.infinity, 50),
                        backgroundColor: Color(0xFF2E5F2F),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12))),
                    onPressed: isLoading ? null : () async {
                      setState(() {
                        isLoading = true;
                      });

                      String email = emailController.text.trim();
                      String password = passwordController.text.trim();

                      if(email.isEmpty || password.isEmpty){
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text("Please enter email and password")),
                        );
                        setState(() { isLoading = false; });
                        return;
                      }

                      try {
                        final loginModel = LoginModel(email: email, password: password);
                        final response = await ApiService.login(loginModel);

                        final String loginToken = response['token'];

                        print("User: ${response['data']['user']}");
                        print("Token: $loginToken");

                        Navigator.pushReplacement(
                          context,
                          MaterialPageRoute(
                            builder: (_) => MyPlantsPage(token: loginToken),
                          ),
                        );
                      } catch (e) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(e.toString())),
                        );
                      } finally {
                        setState(() {
                          isLoading = false;
                        });
                      }
                    },
                    child: isLoading
                        ? CircularProgressIndicator(color: Colors.grey[600])
                        : Text('Log In',
                            style: TextStyle(
                                fontSize: 18,  color: Colors.white,fontWeight: FontWeight.bold)),
                  ),
                  SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text("Don't have an account? "),
                      GestureDetector(
                        onTap: () {
                          Navigator.push(context,
                              MaterialPageRoute(builder: (_) => SignUpPage()));
                        },
                        child: Text('Sign Up',
                            style: TextStyle(
                                color: Color(0xFF2E5F2F),
                                fontWeight: FontWeight.bold)),
                      )
                    ],
                  )
                ],
              ),
            )
          ],
        ),
      ),
    );
  }
}
