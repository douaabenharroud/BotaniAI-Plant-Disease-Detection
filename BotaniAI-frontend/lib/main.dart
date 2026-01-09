import 'package:flutter/material.dart';
import 'pages/login_page.dart';

void main() {
  runApp(BotaniAiApp());
}

class BotaniAiApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BotaniAI',
      theme: ThemeData(
        primaryColor: Color(0xFF2E5F2F),
        scaffoldBackgroundColor: Colors.white,
        fontFamily: 'Roboto',
      ),
      home: WelcomeScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class WelcomeScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Background Photo - WEB VERSION PATH
          Container(
            decoration: BoxDecoration(
              image: DecorationImage(
                image: AssetImage('assets/images/Screenshot 2025-12-16 135900.png'),
                fit: BoxFit.cover,
              ),
            ),
          ),
          
          // Dark overlay for better visibility
          Container(
            color: Colors.black.withOpacity(0.2),
          ),
          
          // Text at the top (small size, no background)
          Positioned(
            top: 80, // Changed from 100 to 80 to be higher
            left: 0,
            right: 0,
            child: Center(
              child: Column(
                children: [
                  // Line 1
                  Text(
                    'Smart care for your indoor plants.',
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.white.withOpacity(0.2),
                    ),
                    textAlign: TextAlign.center,
                  ),
                  SizedBox(height: 8),
                  
                  // Line 2
                  Text(
                    'Monitor, water, and nurture with ease.',
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.white.withOpacity(0.2),
                    ),
                    textAlign: TextAlign.center,
                  ),
                  SizedBox(height: 8),
                  
                  // Line 3
                  Text(
                    'Grow healthy plants effortlessly.',
                    style: TextStyle(
                      fontSize: 16,
                      color: Colors.white.withOpacity(0.2),
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
          
          // Button at bottom center with white arrow
          Positioned(
            bottom: 50,
            left: 0,
            right: 0,
            child: Center(
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (context) => LoginPage()),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Color(0xFF2E5F2F),
                  foregroundColor: Colors.white,
                  padding: EdgeInsets.symmetric(horizontal: 30, vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(30),
                  ),
                  elevation: 8,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(width: 10),
                    // White arrow icon
                    Icon(
                      Icons.arrow_forward,
                      color: Colors.white,
                      size: 22,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}